package com.foodmate.application.account.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.foodmate.application.account.port.out.UserAccountRepository;
import com.foodmate.application.account.port.out.UserAccountRepository.RefreshTokenRow;
import com.foodmate.application.account.service.UserAccountService;
import com.foodmate.application.account.service.UserAccountService.AdminUserView;
import com.foodmate.application.account.service.UserAccountService.AuthResult;
import com.foodmate.application.account.service.UserAccountService.AuthSessionView;
import com.foodmate.application.account.service.UserAccountService.MessageRecord;
import com.foodmate.application.account.service.UserAccountService.PageResult;
import com.foodmate.application.account.service.UserAccountService.ProfileRecord;
import com.foodmate.application.account.service.UserAccountService.ProfileUpdate;
import com.foodmate.application.account.service.UserAccountService.SearchResult;
import com.foodmate.application.account.service.UserAccountService.SessionMetadata;
import com.foodmate.application.account.service.UserAccountService.SessionRecord;
import com.foodmate.application.account.service.UserAccountService.UserRecord;
import com.foodmate.application.common.service.OperationAuditService;
import com.foodmate.shared.account.enums.UserRole;
import com.foodmate.shared.account.enums.UserStatus;
import com.foodmate.shared.conversation.enums.MessageRole;
import com.foodmate.shared.conversation.enums.SessionMode;
import com.foodmate.shared.conversation.enums.SessionStatus;
import com.foodmate.shared.error.BusinessException;
import com.foodmate.shared.error.ErrorCode;
import com.foodmate.shared.id.IdGenerator;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.spec.KeySpec;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** P1-1 账户、会话和消息用例。生产持久化通过端口访问，local-stub 显式使用内存。 */
@Service
public class UserAccountServiceImpl implements UserAccountService {
    private static final long AUTH_SESSION_SECONDS = 1_800;
    private static final long REFRESH_TOKEN_SECONDS = 604_800;

    private final UserAccountRepository store;
    private final IdGenerator ids;
    private final OperationAuditService audit;
    // 新密码使用 BCrypt；校验方法继续兼容已有 PBKDF2 哈希，避免升级时强制重置账号。
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(12);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SecureRandom random = new SecureRandom();
    private final Map<Long, UserRecord> users = new HashMap<>();
    private final Map<String, AuthSessionRecord> authSessions = new HashMap<>();
    private final Map<String, RefreshTokenRecord> refreshTokens = new HashMap<>();
    private final Map<Long, ProfileRecord> profiles = new HashMap<>();
    private final Map<Long, SessionRecord> sessions = new HashMap<>();
    private final Map<Long, List<MessageRecord>> messages = new HashMap<>();

    public UserAccountServiceImpl(
            ObjectProvider<UserAccountRepository> storeProvider,
            ObjectProvider<IdGenerator> idProvider) {
        this(storeProvider, idProvider, null);
    }

    @Autowired
    public UserAccountServiceImpl(
            ObjectProvider<UserAccountRepository> storeProvider,
            ObjectProvider<IdGenerator> idProvider,
            ObjectProvider<OperationAuditService> auditProvider) {
        this.store = storeProvider.getIfAvailable();
        this.ids = Objects.requireNonNull(idProvider.getIfAvailable(), "IdGenerator is required");
        this.audit = auditProvider == null ? null : auditProvider.getIfAvailable();
    }

    @Transactional
    public synchronized AuthResult register(
            String username, String email, String password, String nickname) {
        return register(username, email, password, nickname, SessionMetadata.EMPTY);
    }

    @Transactional
    public synchronized AuthResult register(
            String username,
            String email,
            String password,
            String nickname,
            SessionMetadata metadata) {
        try {
            requireText(username, "username");
            requireText(email, "email");
            validatePassword(password);
            if (store != null) {
                if (store.userExists(username, email)) {
                    throw conflict("username or email already exists");
                }
                long userId = ids.nextId();
                store.insertUser(
                        userId, "U" + userId, username, email, hashPassword(password), nickname);
                store.insertProfile(ids.nextId(), userId, nickname);
                AuthResult result =
                        issueSession(userId, username, UserRole.USER.code(), metadata, null);
                audit(userId, "user", Long.toString(userId), "user.register");
                return result;
            }
            if (users.values().stream()
                    .anyMatch(
                            user ->
                                    user.username().equalsIgnoreCase(username)
                                            || user.email().equalsIgnoreCase(email))) {
                throw conflict("username or email already exists");
            }
            long userId = ids.nextId();
            users.put(
                    userId,
                    new UserRecord(
                            userId,
                            username,
                            email,
                            hashPassword(password),
                            nickname,
                            UserRole.USER.code(),
                            UserStatus.ACTIVE.code()));
            profiles.put(
                    userId,
                    new ProfileRecord(
                            userId, nickname, null, null, null, null, null, null, null, null, "[]",
                            "[]", "{}"));
            AuthResult result =
                    issueSession(userId, username, UserRole.USER.code(), metadata, null);
            audit(userId, "user", Long.toString(userId), "user.register");
            return result;
        } catch (RuntimeException exception) {
            failure(null, "user", null, "user.register", exception);
            throw exception;
        }
    }

    public synchronized AuthResult login(String usernameOrEmail, String password) {
        return login(usernameOrEmail, password, SessionMetadata.EMPTY);
    }

    @Transactional
    public synchronized AuthResult login(
            String usernameOrEmail, String password, SessionMetadata metadata) {
        requireText(usernameOrEmail, "username");
        UserRecord user = findUser(usernameOrEmail).orElseThrow(() -> invalidCredentials());
        if (UserStatus.DISABLED.code().equals(user.status()))
            throw new com.foodmate.shared.error.BusinessException(
                    com.foodmate.shared.error.ErrorCode.AUTH_ACCOUNT_DISABLED);
        if (UserStatus.LOCKED.code().equals(user.status()))
            throw new com.foodmate.shared.error.BusinessException(
                    com.foodmate.shared.error.ErrorCode.AUTH_ACCOUNT_LOCKED);
        if (!verifyPassword(password, user.passwordHash())) throw invalidCredentials();
        if (store != null) store.markLogin(user.userId());
        return issueSession(user.userId(), user.username(), user.role(), metadata, null);
    }

    public synchronized void logout(String sessionToken) {
        logout(sessionToken, null);
    }

    @Transactional
    public synchronized void logout(String sessionToken, String refreshToken) {
        if (sessionToken != null && !sessionToken.isBlank()) revokeSession(sha256(sessionToken));
        if (refreshToken != null && !refreshToken.isBlank()) {
            String hash = sha256(refreshToken);
            if (store != null) store.revokeRefreshToken(hash);
            RefreshTokenRecord current = refreshTokens.get(hash);
            if (current != null)
                refreshTokens.put(
                        hash,
                        new RefreshTokenRecord(
                                current.refreshTokenId(),
                                current.userId(),
                                current.expiresAt(),
                                Instant.now()));
        }
    }

    @Transactional
    public synchronized AuthResult refresh(String refreshToken, SessionMetadata metadata) {
        if (refreshToken == null || refreshToken.isBlank()) throw refreshTokenInvalid();
        String hash = sha256(refreshToken);
        RefreshTokenRow row =
                store == null ? claimRefreshToken(hash) : store.consumeRefreshToken(hash);
        if (row == null) throw refreshTokenInvalid();
        UserRecord user = getUser(row.userId()).orElseThrow(UserAccountServiceImpl::authRequired);
        if (!UserStatus.ACTIVE.code().equals(user.status()))
            throw new com.foodmate.shared.error.BusinessException(
                    UserStatus.DISABLED.code().equals(user.status())
                            ? com.foodmate.shared.error.ErrorCode.AUTH_ACCOUNT_DISABLED
                            : com.foodmate.shared.error.ErrorCode.AUTH_ACCOUNT_LOCKED);
        SessionMetadata actual = metadata == null ? SessionMetadata.EMPTY : metadata;
        return issueSession(
                user.userId(), user.username(), user.role(), actual, row.refreshTokenId());
    }

    @Transactional
    public synchronized void changePassword(
            long userId, String currentPassword, String newPassword) {
        try {
            validatePassword(newPassword);
            UserRecord user = getUser(userId).orElseThrow(UserAccountServiceImpl::authRequired);
            if (!verifyPassword(currentPassword, user.passwordHash())) throw invalidCredentials();
            if (store != null) {
                store.changePassword(userId, hashPassword(newPassword));
                store.revokeAll(userId);
                store.revokeAllRefreshTokens(userId);
            } else {
                users.put(
                        userId,
                        new UserRecord(
                                user.userId(),
                                user.username(),
                                user.email(),
                                hashPassword(newPassword),
                                user.nickname(),
                                user.role(),
                                user.status()));
                authSessions.replaceAll(
                        (key, value) ->
                                value.userId() == userId
                                        ? new AuthSessionRecord(
                                                value.userId(),
                                                value.sessionTokenHash(),
                                                value.csrfTokenHash(),
                                                value.expiresAt(),
                                                Instant.now())
                                        : value);
                revokeInMemoryRefreshTokens(userId);
            }
            audit(userId, "user", Long.toString(userId), "user.password.change");
        } catch (RuntimeException exception) {
            failure(userId, "user", Long.toString(userId), "user.password.change", exception);
            throw exception;
        }
    }

    public synchronized void requireCurrentPassword(long userId, String currentPassword) {
        UserRecord user = getUser(userId).orElseThrow(UserAccountServiceImpl::authRequired);
        if (!verifyPassword(currentPassword, user.passwordHash())) throw invalidCredentials();
    }

    public synchronized List<AuthSessionView> listAuthSessions(long userId) {
        if (store != null) return store.authSessions(userId);
        return authSessions.values().stream()
                .filter(s -> s.userId() == userId)
                .map(
                        s ->
                                new AuthSessionView(
                                        0,
                                        null,
                                        null,
                                        null,
                                        s.expiresAt(),
                                        null,
                                        null,
                                        s.revokedAt()))
                .toList();
    }

    public synchronized List<AdminUserView> listUsersForAdmin() {
        if (store == null)
            return users.values().stream()
                    .map(
                            u ->
                                    new AdminUserView(
                                            u.userId(),
                                            u.username(),
                                            emailReference(u.email()),
                                            u.nickname(),
                                            u.role(),
                                            u.status(),
                                            1))
                    .toList();
        return store.adminUsers();
    }

    @Transactional
    public synchronized void revokeAuthSession(long userId, long authSessionId) {
        try {
            if (store != null) store.revoke(userId, authSessionId);
            audit(userId, "user_session", Long.toString(authSessionId), "user.session.revoke");
        } catch (RuntimeException exception) {
            failure(
                    userId,
                    "user_session",
                    Long.toString(authSessionId),
                    "user.session.revoke",
                    exception);
            throw exception;
        }
    }

    @Transactional
    public synchronized void revokeAllAuthSessions(long userId) {
        try {
            if (store != null) {
                store.revokeAll(userId);
                store.revokeAllRefreshTokens(userId);
            } else
                authSessions.replaceAll(
                        (key, value) ->
                                value.userId() == userId
                                        ? new AuthSessionRecord(
                                                value.userId(),
                                                value.sessionTokenHash(),
                                                value.csrfTokenHash(),
                                                value.expiresAt(),
                                                Instant.now())
                                        : value);
            revokeInMemoryRefreshTokens(userId);
            audit(userId, "user_session", Long.toString(userId), "user.sessions.revoke_all");
        } catch (RuntimeException exception) {
            failure(
                    userId,
                    "user_session",
                    Long.toString(userId),
                    "user.sessions.revoke_all",
                    exception);
            throw exception;
        }
    }

    public synchronized String createPasswordResetToken(String email) {
        UserRecord user = findUser(email).orElse(null);
        String raw = randomToken();
        if (user != null && store != null) {
            store.expireResetTokens(user.userId());
            store.insertResetToken(
                    ids.nextId(), user.userId(), sha256(raw), Instant.now().plusSeconds(900));
        }
        return raw;
    }

    @Transactional
    public synchronized void resetPassword(String token, String newPassword) {
        Long userId = null;
        try {
            validatePassword(newPassword);
            if (store == null) throw notFound("password reset is unavailable");
            String hash = sha256(token);
            userId = store.resetTokenUser(hash);
            if (userId == null) throw notFound("invalid or expired reset token");
            store.changePassword(userId, hashPassword(newPassword));
            store.consumeResetToken(hash);
            revokeAllAuthSessions(userId);
            audit(userId, "user", Long.toString(userId), "user.password.change");
        } catch (RuntimeException exception) {
            failure(
                    userId,
                    "user",
                    userId == null ? null : Long.toString(userId),
                    "user.password.change",
                    exception);
            throw exception;
        }
    }

    public synchronized UserRecord requireSessionUser(String sessionToken) {
        if (sessionToken == null || sessionToken.isBlank()) throw authRequired();
        String hash = sha256(sessionToken);
        AuthSessionRecord session = store == null ? authSessions.get(hash) : findSession(hash);
        if (session == null
                || session.revokedAt() != null
                || session.expiresAt().isBefore(Instant.now())) throw authRequired();
        if (store != null) store.touchAuthSession(hash);
        UserRecord user =
                getUser(session.userId()).orElseThrow(UserAccountServiceImpl::authRequired);
        if (!UserStatus.ACTIVE.code().equals(user.status()))
            throw new com.foodmate.shared.error.BusinessException(
                    UserStatus.DISABLED.code().equals(user.status())
                            ? com.foodmate.shared.error.ErrorCode.AUTH_ACCOUNT_DISABLED
                            : com.foodmate.shared.error.ErrorCode.AUTH_ACCOUNT_LOCKED);
        return user;
    }

    public synchronized void requireCsrf(String sessionToken, String csrfToken) {
        if (csrfToken == null || csrfToken.isBlank())
            throw new com.foodmate.shared.error.BusinessException(
                    com.foodmate.shared.error.ErrorCode.FORBIDDEN, "CSRF token is required");
        String sessionHash = sha256(sessionToken);
        AuthSessionRecord session =
                store == null ? authSessions.get(sessionHash) : findSession(sessionHash);
        if (session == null
                || !MessageDigest.isEqual(
                        session.csrfTokenHash().getBytes(StandardCharsets.UTF_8),
                        sha256(csrfToken).getBytes(StandardCharsets.UTF_8)))
            throw new com.foodmate.shared.error.BusinessException(
                    com.foodmate.shared.error.ErrorCode.FORBIDDEN, "invalid CSRF token");
    }

    public synchronized ProfileRecord profile(long userId) {
        if (store == null)
            return profiles.getOrDefault(
                    userId,
                    new ProfileRecord(
                            userId, null, null, null, null, null, null, null, null, null, "[]",
                            "[]", "{}"));
        return store.profile(userId);
    }

    @Transactional
    public synchronized ProfileRecord updateProfile(long userId, ProfileUpdate update) {
        try {
            if (store == null) {
                ProfileRecord current = profiles.getOrDefault(userId, profile(userId));
                ProfileRecord next = current.with(update);
                profiles.put(userId, next);
                audit(userId, "profile", Long.toString(userId), "profile.update");
                return next;
            }
            store.ensureProfile(ids.nextId(), userId);
            store.updateProfile(userId, update);
            ProfileRecord result = profile(userId);
            audit(userId, "profile", Long.toString(userId), "profile.update");
            return result;
        } catch (RuntimeException exception) {
            failure(userId, "profile", Long.toString(userId), "profile.update", exception);
            throw exception;
        }
    }

    @Transactional
    public synchronized SessionRecord createSession(long userId, String title, String mode) {
        Long sessionId = null;
        try {
            String actualMode = mode == null || mode.isBlank() ? SessionMode.AGENT.code() : mode;
            if (!List.of(SessionMode.AGENT.code(), SessionMode.CHAT.code()).contains(actualMode))
                throw new IllegalArgumentException("mode must be agent or chat");
            String actualTitle = title == null || title.isBlank() ? "新会话" : title.trim();
            if (actualTitle.length() > 255)
                throw new IllegalArgumentException("title must be at most 255 characters");
            sessionId = ids.nextId();
            if (store != null) {
                // 当前 V1 为单租户运行模式；数据库仍要求显式写入 tenant_id，不能依赖不存在的列默认值。
                store.insertSession(sessionId, userId, actualTitle, actualMode);
            }
            SessionRecord record =
                    new SessionRecord(
                            sessionId,
                            userId,
                            actualTitle,
                            actualMode,
                            SessionStatus.ACTIVE.code(),
                            null);
            if (store == null) sessions.put(sessionId, record);
            audit(userId, "session", Long.toString(sessionId), "session.create");
            return record;
        } catch (RuntimeException exception) {
            failure(
                    userId,
                    "session",
                    sessionId == null ? null : Long.toString(sessionId),
                    "session.create",
                    exception);
            throw exception;
        }
    }

    public synchronized List<SessionRecord> listSessions(long userId) {
        return listSessions(userId, 1, 50, null, null).items();
    }

    public synchronized PageResult<SessionRecord> listSessions(
            long userId, int page, int size, String query, String status) {
        int safePage = Math.max(1, page);
        int safeSize = Math.min(100, Math.max(1, size));
        String q = query == null ? "" : query.trim();
        String wantedStatus = status == null || status.isBlank() ? null : status.trim();
        if (store != null) {
            long total = store.countSessions(userId, q, wantedStatus);
            List<SessionRecord> items =
                    store.sessions(userId, q, wantedStatus, safeSize, (safePage - 1) * safeSize);
            return new PageResult<>(items, total, safePage, safeSize);
        }
        List<SessionRecord> all =
                sessions.values().stream()
                        .filter(
                                s ->
                                        s.userId() == userId
                                                && !SessionStatus.DELETED.code().equals(s.status())
                                                && (wantedStatus == null
                                                        || wantedStatus.equals(s.status()))
                                                && (q.isBlank()
                                                        || s.title()
                                                                .toLowerCase()
                                                                .contains(q.toLowerCase())))
                        .sorted(
                                Comparator.comparing(
                                        SessionRecord::lastMessageAt,
                                        Comparator.nullsLast(Comparator.reverseOrder())))
                        .toList();
        int from = Math.min((safePage - 1) * safeSize, all.size());
        int to = Math.min(from + safeSize, all.size());
        return new PageResult<>(all.subList(from, to), all.size(), safePage, safeSize);
    }

    public synchronized PageResult<SessionRecord> listDeletedSessions(
            long userId, int page, int size) {
        int safePage = Math.max(1, page), safeSize = Math.min(100, Math.max(1, size));
        if (store != null) {
            long total = store.countDeletedSessions(userId);
            int offset = (safePage - 1) * safeSize;
            List<SessionRecord> items = store.deletedSessions(userId, safeSize, offset);
            return new PageResult<>(items, total, safePage, safeSize);
        }
        List<SessionRecord> all =
                sessions.values().stream()
                        .filter(
                                s ->
                                        s.userId() == userId
                                                && SessionStatus.DELETED.code().equals(s.status()))
                        .toList();
        return new PageResult<>(all, all.size(), safePage, safeSize);
    }

    @Transactional
    public synchronized void renameSession(long userId, long sessionId, String title) {
        try {
            requireText(title, "title");
            String actual = title.trim();
            if (actual.length() > 255)
                throw new IllegalArgumentException("title must be at most 255 characters");
            requireSession(userId, sessionId);
            if (store != null) store.renameSession(userId, sessionId, actual);
            sessions.computeIfPresent(sessionId, (key, value) -> value.withTitle(actual));
            audit(userId, "session", Long.toString(sessionId), "session.rename");
        } catch (RuntimeException exception) {
            failure(userId, "session", Long.toString(sessionId), "session.rename", exception);
            throw exception;
        }
    }

    @Transactional
    public synchronized void setSessionStatus(long userId, long sessionId, String status) {
        try {
            if (!List.of(SessionStatus.ACTIVE.code(), SessionStatus.ARCHIVED.code())
                    .contains(status)) throw new IllegalArgumentException("invalid session status");
            requireSession(userId, sessionId);
            if (store != null) store.setSessionStatus(userId, sessionId, status);
            sessions.computeIfPresent(sessionId, (key, value) -> value.withStatus(status));
            audit(userId, "session", Long.toString(sessionId), "session.status.update");
        } catch (RuntimeException exception) {
            failure(
                    userId,
                    "session",
                    Long.toString(sessionId),
                    "session.status.update",
                    exception);
            throw exception;
        }
    }

    @Transactional
    public synchronized void deleteSession(long userId, long sessionId) {
        try {
            requireSession(userId, sessionId);
            if (store != null) store.deleteSession(userId, sessionId);
            sessions.computeIfPresent(
                    sessionId, (key, value) -> value.withStatus(SessionStatus.DELETED.code()));
            audit(userId, "session", Long.toString(sessionId), "session.delete");
        } catch (RuntimeException exception) {
            failure(userId, "session", Long.toString(sessionId), "session.delete", exception);
            throw exception;
        }
    }

    @Transactional
    public synchronized void restoreSession(long userId, long sessionId) {
        try {
            if (store != null) {
                int changed = store.restoreSession(userId, sessionId);
                if (changed != 1) throw notFound("session not found or restore period expired");
            } else {
                SessionRecord session = sessions.get(sessionId);
                if (session == null
                        || session.userId() != userId
                        || !SessionStatus.DELETED.code().equals(session.status()))
                    throw notFound("session not found or restore period expired");
                sessions.put(sessionId, session.withStatus(SessionStatus.ACTIVE.code()));
            }
            audit(userId, "session", Long.toString(sessionId), "session.restore");
        } catch (RuntimeException exception) {
            failure(userId, "session", Long.toString(sessionId), "session.restore", exception);
            throw exception;
        }
    }

    public synchronized List<MessageRecord> listMessages(long userId, long sessionId) {
        return listMessages(userId, sessionId, 1, 100).items();
    }

    public synchronized PageResult<MessageRecord> listMessages(
            long userId, long sessionId, int page, int size) {
        requireSession(userId, sessionId);
        int safePage = Math.max(1, page), safeSize = Math.min(100, Math.max(1, size));
        if (store != null) {
            long total = store.countMessages(sessionId);
            int offset = (safePage - 1) * safeSize;
            List<MessageRecord> items = store.messages(sessionId, safeSize, offset);
            return new PageResult<>(items, total, safePage, safeSize);
        }
        List<MessageRecord> all = messages.getOrDefault(sessionId, List.of());
        int from = Math.min((safePage - 1) * safeSize, all.size());
        return new PageResult<>(
                all.subList(from, Math.min(from + safeSize, all.size())),
                all.size(),
                safePage,
                safeSize);
    }

    /** 更正用户消息后由上层失效会话摘要，避免旧摘要继续代表已删除内容。 */
    @Transactional
    public synchronized MessageRecord updateMessage(
            long userId, long sessionId, long messageId, String content) {
        try {
            requireSession(userId, sessionId);
            requireText(content, "content");
            if (content.length() > 10000)
                throw new IllegalArgumentException("content must be at most 10000 characters");
            if (store != null) {
                int changed = store.updateMessage(userId, sessionId, messageId, content);
                if (changed != 1) throw notFound("message not found");
                MessageRecord updated = store.message(messageId);
                if (updated == null) throw notFound("message not found");
                audit(userId, "message", Long.toString(messageId), "message.update");
                return updated;
            }
            List<MessageRecord> records = messages.getOrDefault(sessionId, List.of());
            for (int i = 0; i < records.size(); i++) {
                MessageRecord current = records.get(i);
                if (current.messageId() == messageId
                        && MessageRole.USER.code().equals(current.role())) {
                    MessageRecord updated =
                            new MessageRecord(
                                    current.messageId(),
                                    current.sessionId(),
                                    current.agentRunId(),
                                    current.role(),
                                    content,
                                    current.structuredPayload(),
                                    current.sequenceNo(),
                                    current.createdAt());
                    records.set(i, updated);
                    audit(userId, "message", Long.toString(messageId), "message.update");
                    return updated;
                }
            }
            throw notFound("message not found");
        } catch (RuntimeException exception) {
            failure(userId, "message", Long.toString(messageId), "message.update", exception);
            throw exception;
        }
    }

    /** 逻辑删除用户消息；sequence_no 不复用，保证历史事件和摘要来源仍可审计。 */
    @Transactional
    public synchronized void deleteMessage(long userId, long sessionId, long messageId) {
        try {
            requireSession(userId, sessionId);
            if (store != null) {
                int changed = store.deleteMessage(userId, sessionId, messageId);
                if (changed != 1) throw notFound("message not found");
                audit(userId, "message", Long.toString(messageId), "message.delete");
                return;
            }
            List<MessageRecord> records = messages.getOrDefault(sessionId, List.of());
            boolean removed =
                    records.removeIf(
                            item ->
                                    item.messageId() == messageId
                                            && MessageRole.USER.code().equals(item.role()));
            if (!removed) throw notFound("message not found");
            audit(userId, "message", Long.toString(messageId), "message.delete");
        } catch (RuntimeException exception) {
            failure(userId, "message", Long.toString(messageId), "message.delete", exception);
            throw exception;
        }
    }

    public synchronized List<SearchResult> searchSessions(
            long userId, String query, int page, int size) {
        String q = query == null ? "" : query.trim();
        if (q.isBlank()) return List.of();
        int safeSize = Math.min(100, Math.max(1, size)), offset = Math.max(0, page - 1) * safeSize;
        if (store != null) return store.search(userId, q, safeSize, offset);
        return sessions.values().stream()
                .filter(
                        s ->
                                s.userId() == userId
                                        && !SessionStatus.DELETED.code().equals(s.status())
                                        && s.title().toLowerCase().contains(q.toLowerCase()))
                .map(s -> new SearchResult(s.sessionId(), s.title(), s.title()))
                .limit(safeSize)
                .toList();
    }

    public synchronized void archiveSession(long userId, long sessionId) {
        setSessionStatus(userId, sessionId, SessionStatus.ARCHIVED.code());
    }

    @Transactional
    public synchronized MessageRecord addMessage(
            long userId, long sessionId, String role, String content, Object structuredPayload) {
        return addMessage(userId, sessionId, role, content, structuredPayload, null);
    }

    @Transactional
    public synchronized MessageRecord addMessage(
            long userId,
            long sessionId,
            String role,
            String content,
            Object structuredPayload,
            Long agentRunId) {
        Long messageId = null;
        try {
            requireSession(userId, sessionId);
            if (!MessageRole.USER.code().equals(role))
                throw new IllegalArgumentException("only user messages are accepted in M1-2");
            requireText(content, "content");
            if (content.length() > 10000)
                throw new IllegalArgumentException("content must be at most 10000 characters");
            if (store != null) store.lockMessageSequence(sessionId);
            int sequence = nextSequence(sessionId);
            messageId = ids.nextId();
            String payload =
                    json(
                            structuredPayload == null
                                    ? JsonNodeFactory.instance.objectNode()
                                    : structuredPayload);
            if (store != null) {
                store.insertMessage(
                        messageId, sessionId, agentRunId, role, content, payload, sequence, userId);
                store.touchSession(sessionId);
            }
            MessageRecord record =
                    new MessageRecord(
                            messageId,
                            sessionId,
                            agentRunId,
                            role,
                            content,
                            payload,
                            sequence,
                            Instant.now());
            if (store == null)
                messages.computeIfAbsent(sessionId, ignored -> new ArrayList<>()).add(record);
            audit(userId, "message", Long.toString(messageId), "message.create");
            return record;
        } catch (RuntimeException exception) {
            failure(
                    userId,
                    "message",
                    messageId == null ? null : Long.toString(messageId),
                    "message.create",
                    exception);
            throw exception;
        }
    }

    private void audit(long userId, String targetType, String targetId, String action) {
        if (audit != null)
            audit.record(
                    userId, targetType, targetId, action, "success", null, null, null, Map.of());
    }

    private void failure(
            Long operatorId,
            String targetType,
            String targetId,
            String action,
            RuntimeException exception) {
        if (audit != null)
            audit.recordFailure(
                    operatorId,
                    targetType,
                    targetId,
                    action,
                    "failed",
                    errorCode(exception),
                    null,
                    null,
                    Map.of("exception_type", exception.getClass().getSimpleName()));
    }

    private static String errorCode(RuntimeException exception) {
        if (exception instanceof BusinessException businessException)
            return businessException.errorCode().code();
        if (exception instanceof IllegalArgumentException) return ErrorCode.INVALID_ARGUMENT.code();
        return ErrorCode.INTERNAL_ERROR.code();
    }

    private String emailReference(String email) {
        return email == null || email.isBlank() ? null : "email-" + sha256(email).substring(0, 16);
    }

    private int nextSequence(long sessionId) {
        if (store != null) return store.nextSequence(sessionId);
        return messages.getOrDefault(sessionId, List.of()).size() + 1;
    }

    private void requireSession(long userId, long sessionId) {
        if (store != null) {
            if (!store.sessionExists(userId, sessionId)) throw notFound("session not found");
        } else if (!sessions.containsKey(sessionId)
                || sessions.get(sessionId).userId() != userId
                || SessionStatus.DELETED.code().equals(sessions.get(sessionId).status()))
            throw notFound("session not found");
    }

    private AuthResult issueSession(
            long userId,
            String username,
            String role,
            SessionMetadata metadata,
            Long rotatedFromTokenId) {
        SessionMetadata actual = metadata == null ? SessionMetadata.EMPTY : metadata;
        String sessionToken = randomToken();
        String csrfToken = randomToken();
        String sessionHash = sha256(sessionToken);
        Instant expiresAt = Instant.now().plusSeconds(AUTH_SESSION_SECONDS);
        AuthSessionRecord record =
                new AuthSessionRecord(userId, sessionHash, sha256(csrfToken), expiresAt, null);
        if (store != null)
            store.insertAuthSession(
                    ids.nextId(),
                    userId,
                    sessionHash,
                    record.csrfTokenHash(),
                    actual.userAgent(),
                    actual.ipAddress(),
                    expiresAt);
        if (store == null) authSessions.put(sessionHash, record);
        String refreshToken = randomToken();
        String refreshHash = sha256(refreshToken);
        Instant refreshExpiresAt = Instant.now().plusSeconds(REFRESH_TOKEN_SECONDS);
        long refreshTokenId = ids.nextId();
        if (store != null)
            store.insertRefreshToken(
                    refreshTokenId,
                    userId,
                    refreshHash,
                    null,
                    actual.userAgent(),
                    actual.ipAddress(),
                    refreshExpiresAt,
                    rotatedFromTokenId);
        else
            refreshTokens.put(
                    refreshHash,
                    new RefreshTokenRecord(refreshTokenId, userId, refreshExpiresAt, null));
        return new AuthResult(
                userId,
                username,
                role,
                sessionToken,
                csrfToken,
                expiresAt,
                refreshToken,
                refreshExpiresAt);
    }

    private RefreshTokenRow claimRefreshToken(String hash) {
        RefreshTokenRecord current = refreshTokens.get(hash);
        if (current == null
                || current.revokedAt() != null
                || current.expiresAt().isBefore(Instant.now())) return null;
        refreshTokens.put(
                hash,
                new RefreshTokenRecord(
                        current.refreshTokenId(),
                        current.userId(),
                        current.expiresAt(),
                        Instant.now()));
        return new RefreshTokenRow(current.refreshTokenId(), current.userId(), null, null, null);
    }

    private void revokeInMemoryRefreshTokens(long userId) {
        refreshTokens.replaceAll(
                (key, value) ->
                        value.userId() == userId
                                ? new RefreshTokenRecord(
                                        value.refreshTokenId(),
                                        value.userId(),
                                        value.expiresAt(),
                                        Instant.now())
                                : value);
    }

    private Optional<UserRecord> findUser(String value) {
        if (store != null) return Optional.ofNullable(store.findUser(value));
        return users.values().stream()
                .filter(
                        user ->
                                user.username().equalsIgnoreCase(value)
                                        || user.email().equalsIgnoreCase(value))
                .findFirst();
    }

    private Optional<UserRecord> getUser(long id) {
        if (store != null) return Optional.ofNullable(store.getUser(id));
        return Optional.ofNullable(users.get(id));
    }

    private AuthSessionRecord findSession(String hash) {
        UserAccountRepository.AuthSessionRow row = store.findAuthSession(hash);
        return row == null
                ? null
                : new AuthSessionRecord(
                        row.userId(), hash, row.csrfTokenHash(), row.expiresAt(), row.revokedAt());
    }

    private void revokeSession(String hash) {
        if (store != null) store.revokeByHash(hash);
        AuthSessionRecord current = authSessions.get(hash);
        if (current != null)
            authSessions.put(
                    hash,
                    new AuthSessionRecord(
                            current.userId(),
                            hash,
                            current.csrfTokenHash(),
                            current.expiresAt(),
                            Instant.now()));
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("structured payload must be JSON");
        }
    }

    private String randomToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashPassword(String password) {
        return passwordEncoder.encode(password);
    }

    private boolean verifyPassword(String password, String encoded) {
        if (encoded != null && encoded.startsWith("$2")) {
            try {
                return passwordEncoder.matches(password, encoded);
            } catch (IllegalArgumentException exception) {
                return false;
            }
        }
        try {
            String[] parts = encoded.split("\\$");
            if (parts.length != 4) return false;
            byte[] salt = Base64.getDecoder().decode(parts[2]);
            byte[] expected = Base64.getDecoder().decode(parts[3]);
            return MessageDigest.isEqual(
                    expected, pbkdf2(password.toCharArray(), salt, Integer.parseInt(parts[1])));
        } catch (GeneralSecurityException | IllegalArgumentException exception) {
            return false;
        }
    }

    private byte[] pbkdf2(char[] password, byte[] salt, int iterations)
            throws GeneralSecurityException {
        KeySpec spec = new PBEKeySpec(password, salt, iterations, 256);
        return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                .generateSecret(spec)
                .getEncoded();
    }

    private String sha256(String value) {
        try {
            return Base64.getEncoder()
                    .encodeToString(
                            MessageDigest.getInstance("SHA-256")
                                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static void requireText(String value, String name) {
        if (value == null || value.isBlank())
            throw new IllegalArgumentException(name + " must not be blank");
    }

    private static void validatePassword(String password) {
        if (password == null || password.length() < 8)
            throw new IllegalArgumentException("password must contain at least 8 characters");
    }

    private static com.foodmate.shared.error.BusinessException invalidCredentials() {
        return new com.foodmate.shared.error.BusinessException(
                com.foodmate.shared.error.ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    private static com.foodmate.shared.error.BusinessException authRequired() {
        return new com.foodmate.shared.error.BusinessException(
                com.foodmate.shared.error.ErrorCode.AUTH_REQUIRED);
    }

    private static com.foodmate.shared.error.BusinessException refreshTokenInvalid() {
        return new com.foodmate.shared.error.BusinessException(
                com.foodmate.shared.error.ErrorCode.AUTH_REFRESH_TOKEN_INVALID);
    }

    private static com.foodmate.shared.error.BusinessException conflict(String message) {
        return new com.foodmate.shared.error.BusinessException(
                com.foodmate.shared.error.ErrorCode.CONFLICT, message);
    }

    private static com.foodmate.shared.error.BusinessException notFound(String message) {
        return new com.foodmate.shared.error.BusinessException(
                com.foodmate.shared.error.ErrorCode.NOT_FOUND, message);
    }

    private record AuthSessionRecord(
            long userId,
            String sessionTokenHash,
            String csrfTokenHash,
            Instant expiresAt,
            Instant revokedAt) {}

    private record RefreshTokenRecord(
            long refreshTokenId, long userId, Instant expiresAt, Instant revokedAt) {}
}

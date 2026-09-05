package com.foodmate.application.account;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentCaptor.forClass;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.foodmate.application.account.port.out.UserAccountRepository;
import com.foodmate.application.account.service.impl.UserAccountServiceImpl;
import com.foodmate.application.common.service.OperationAuditService;
import com.foodmate.shared.error.BusinessException;
import com.foodmate.shared.error.ErrorCode;
import com.foodmate.shared.id.IdGenerator;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class UserAccountServiceImplTest {
    @Test
    void registrationFailureRecordsSafeAudit() {
        UserAccountRepository repository = mock(UserAccountRepository.class);
        OperationAuditService audit = mock(OperationAuditService.class);
        when(repository.userExists("new-user", "new@example.com")).thenReturn(false);
        doThrow(new IllegalStateException("database unavailable"))
                .when(repository)
                .insertUser(anyLong(), anyString(), anyString(), anyString(), anyString(), any());
        UserAccountServiceImpl service = service(repository, audit);

        assertThrows(
                IllegalStateException.class,
                () -> service.register("new-user", "new@example.com", "password123", "New"));

        verify(audit)
                .recordFailure(
                        isNull(),
                        eq("user"),
                        isNull(),
                        eq("user.register"),
                        eq("failed"),
                        eq(ErrorCode.INTERNAL_ERROR.code()),
                        isNull(),
                        isNull(),
                        any());
    }

    @Test
    void profileFailureRecordsAudit() {
        UserAccountRepository repository = mock(UserAccountRepository.class);
        OperationAuditService audit = mock(OperationAuditService.class);
        doThrow(new IllegalStateException("database unavailable"))
                .when(repository)
                .updateProfile(eq(7L), any());
        UserAccountServiceImpl service = service(repository, audit);

        assertThrows(
                IllegalStateException.class,
                () ->
                        service.updateProfile(
                                7L,
                                new com.foodmate.application.account.service.UserAccountService
                                        .ProfileUpdate(
                                        "New", null, null, null, null, null, null, null)));

        verify(audit)
                .recordFailure(
                        eq(7L),
                        eq("profile"),
                        eq("7"),
                        eq("profile.update"),
                        eq("failed"),
                        eq(ErrorCode.INTERNAL_ERROR.code()),
                        isNull(),
                        isNull(),
                        any());
    }

    @Test
    void sessionCreationFailureRecordsAudit() {
        UserAccountRepository repository = mock(UserAccountRepository.class);
        OperationAuditService audit = mock(OperationAuditService.class);
        doThrow(new IllegalStateException("database unavailable"))
                .when(repository)
                .insertSession(anyLong(), eq(7L), anyString(), anyString());
        UserAccountServiceImpl service = service(repository, audit);

        assertThrows(
                IllegalStateException.class, () -> service.createSession(7L, "Session", "chat"));

        verify(audit)
                .recordFailure(
                        eq(7L),
                        eq("session"),
                        eq("100"),
                        eq("session.create"),
                        eq("failed"),
                        eq(ErrorCode.INTERNAL_ERROR.code()),
                        isNull(),
                        isNull(),
                        any());
    }

    @Test
    void invalidPasswordChangeRecordsAuditWithoutPasswordData() {
        UserAccountRepository repository = mock(UserAccountRepository.class);
        OperationAuditService audit = mock(OperationAuditService.class);
        UserAccountServiceImpl service = service(repository, audit);

        assertThrows(
                IllegalArgumentException.class,
                () -> service.changePassword(7L, "current-password", "short"));

        verify(audit)
                .recordFailure(
                        eq(7L),
                        eq("user"),
                        eq("7"),
                        eq("user.password.change"),
                        eq("failed"),
                        eq(ErrorCode.INVALID_ARGUMENT.code()),
                        isNull(),
                        isNull(),
                        any());
    }

    @Test
    void resetPasswordRecordsPasswordChangeAudit() {
        UserAccountRepository repository = mock(UserAccountRepository.class);
        OperationAuditService audit = mock(OperationAuditService.class);
        when(repository.resetTokenUser(anyString())).thenReturn(7L);
        UserAccountServiceImpl service = service(repository, audit);

        service.resetPassword("reset-token", "new-password");

        verify(repository).changePassword(eq(7L), anyString());
        verify(repository).consumeResetToken(anyString());
        verify(audit)
                .record(
                        eq(7L),
                        eq("user"),
                        eq("7"),
                        eq("user.password.change"),
                        eq("success"),
                        isNull(),
                        isNull(),
                        isNull(),
                        any());
    }

    @Test
    void invalidResetTokenRecordsFailureAudit() {
        UserAccountRepository repository = mock(UserAccountRepository.class);
        OperationAuditService audit = mock(OperationAuditService.class);
        when(repository.resetTokenUser(anyString())).thenReturn(null);
        UserAccountServiceImpl service = service(repository, audit);

        BusinessException exception =
                assertThrows(
                        BusinessException.class,
                        () -> service.resetPassword("expired-token", "new-password"));

        org.junit.jupiter.api.Assertions.assertEquals(ErrorCode.NOT_FOUND, exception.errorCode());
        verify(audit)
                .recordFailure(
                        isNull(),
                        eq("user"),
                        isNull(),
                        eq("user.password.change"),
                        eq("failed"),
                        eq("NOT_FOUND"),
                        isNull(),
                        isNull(),
                        any());
    }

    @Test
    void registrationStoresBcryptHashForNewPassword() {
        UserAccountRepository repository = mock(UserAccountRepository.class);
        OperationAuditService audit = mock(OperationAuditService.class);
        when(repository.userExists("new-user", "new@example.com")).thenReturn(false);
        UserAccountServiceImpl service = service(repository, audit);

        service.register("new-user", "new@example.com", "password123", "New");

        ArgumentCaptor<String> passwordHash = forClass(String.class);
        verify(repository)
                .insertUser(
                        anyLong(),
                        anyString(),
                        anyString(),
                        anyString(),
                        passwordHash.capture(),
                        any());
        assertTrue(passwordHash.getValue().startsWith("$2"));
        assertTrue(new BCryptPasswordEncoder().matches("password123", passwordHash.getValue()));
    }

    private UserAccountServiceImpl service(
            UserAccountRepository repository, OperationAuditService audit) {
        ObjectProvider<UserAccountRepository> storeProvider = mock(ObjectProvider.class);
        ObjectProvider<IdGenerator> idProvider = mock(ObjectProvider.class);
        ObjectProvider<OperationAuditService> auditProvider = mock(ObjectProvider.class);
        when(storeProvider.getIfAvailable()).thenReturn(repository);
        when(idProvider.getIfAvailable()).thenReturn(() -> 100L);
        when(auditProvider.getIfAvailable()).thenReturn(audit);
        return new UserAccountServiceImpl(storeProvider, idProvider, auditProvider);
    }
}

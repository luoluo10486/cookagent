package com.foodmate.api.controller.account;

import com.foodmate.api.response.account.AdminUserDetailResponse;
import com.foodmate.application.account.service.UserAccountService;
import com.foodmate.application.account.service.AdminOperationalQueryService;
import com.foodmate.shared.account.enums.UserRole;
import com.foodmate.shared.api.ApiResponse;
import com.foodmate.shared.trace.TraceContextHolder;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 管理后台用户只读查询接口。 */
@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController extends AuthenticatedControllerSupport {
    private final AdminOperationalQueryService queries;

    public AdminUserController(UserAccountService accounts) {
        this(accounts, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public AdminUserController(
            UserAccountService accounts, AdminOperationalQueryService queries) {
        super(accounts);
        this.queries = queries;
    }

    @GetMapping
    public ApiResponse<List<UserAccountService.AdminUserView>> list(HttpServletRequest request) {
        requireAnyRole(request, UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPERADMIN);
        return ApiResponse.success(accounts.listUsersForAdmin(), TraceContextHolder.currentOrNew());
    }

    @GetMapping("/{id}/detail")
    public ApiResponse<AdminUserDetailResponse> detail(
            @PathVariable long id, HttpServletRequest request) {
        requireAnyRole(request, UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPERADMIN);
        if (queries == null) throw new IllegalStateException("admin query service is unavailable");
        return ApiResponse.success(
                new AdminUserDetailResponse(
                        accounts.profile(id),
                        accounts.listAuthSessions(id),
                        accounts.listSessions(id, 1, 50, null, null),
                        queries.operationAuditsForUser(id, 1, 50)),
                TraceContextHolder.currentOrNew());
    }
}

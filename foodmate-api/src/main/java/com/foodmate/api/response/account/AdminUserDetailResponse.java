package com.foodmate.api.response.account;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.foodmate.application.account.service.AdminOperationalQueryService;
import com.foodmate.application.account.service.UserAccountService;
import java.util.List;

/** 管理端用户详情响应；仅返回资料、会话和脱敏审计摘要。 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record AdminUserDetailResponse(
        UserAccountService.ProfileRecord profile,
        List<UserAccountService.AuthSessionView> loginSessions,
        UserAccountService.PageResult<UserAccountService.SessionRecord> businessSessions,
        AdminOperationalQueryService.Page<AdminOperationalQueryService.OperationAudit>
                operationHistory) {}

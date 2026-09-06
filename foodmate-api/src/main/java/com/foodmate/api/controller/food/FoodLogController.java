package com.foodmate.api.controller.food;

import com.foodmate.api.controller.account.AuthenticatedControllerSupport;
import com.foodmate.api.request.food.FoodLogCreateRequest;
import com.foodmate.api.request.food.FoodLogUpdateRequest;
import com.foodmate.api.response.food.FoodLogResponse;
import com.foodmate.application.account.service.UserAccountService;
import com.foodmate.application.food.service.FoodLogService;
import com.foodmate.shared.api.ApiResponse;
import com.foodmate.shared.trace.TraceContextHolder;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 手工饮食记录接口；用户归属由会话决定。 */
@RestController
@Profile("local")
@RequestMapping("/api/food-logs")
public class FoodLogController extends AuthenticatedControllerSupport {
    private final FoodLogService foods;

    public FoodLogController(UserAccountService accounts, FoodLogService foods) {
        super(accounts);
        this.foods = foods;
    }

    @PostMapping
    public ApiResponse<FoodLogResponse> create(
            HttpServletRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody FoodLogCreateRequest body) {
        FoodLogService.CreateCommand command =
                new FoodLogService.CreateCommand(
                        body.sessionId(),
                        body.agentRunId(),
                        body.mealTime(),
                        body.mealType(),
                        body.notes(),
                        idempotencyKey,
                        body.items().stream()
                                .map(
                                        item ->
                                                new FoodLogService.ItemCommand(
                                                        item.rawName(),
                                                        item.amount(),
                                                        item.unit(),
                                                        item.nutritionFoodId()))
                                .toList());
        return ok(map(foods.create(user(request).userId(), command)));
    }

    @GetMapping
    public ApiResponse<List<FoodLogResponse>> list(
            HttpServletRequest request, @RequestParam Instant from, @RequestParam Instant to) {
        return ok(foods.list(user(request).userId(), from, to).stream().map(this::map).toList());
    }

    @GetMapping("/deleted")
    public ApiResponse<List<FoodLogResponse>> deleted(HttpServletRequest request) {
        return ok(foods.listDeleted(user(request).userId()).stream().map(this::map).toList());
    }

    @PatchMapping("/{foodLogId}")
    public ApiResponse<FoodLogResponse> update(
            HttpServletRequest request,
            @PathVariable long foodLogId,
            @RequestParam long revision,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody FoodLogUpdateRequest body) {
        FoodLogService.UpdateCommand command =
                new FoodLogService.UpdateCommand(
                        body.mealTime(),
                        body.mealType(),
                        body.notes(),
                        idempotencyKey,
                        body.items().stream()
                                .map(
                                        item ->
                                                new FoodLogService.ItemCommand(
                                                        item.rawName(),
                                                        item.amount(),
                                                        item.unit(),
                                                        item.nutritionFoodId()))
                                .toList());
        return ok(map(foods.update(user(request).userId(), foodLogId, revision, command)));
    }

    @DeleteMapping("/{foodLogId}")
    public ApiResponse<Void> delete(
            HttpServletRequest request,
            @PathVariable long foodLogId,
            @RequestParam long revision,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        foods.delete(user(request).userId(), foodLogId, revision, idempotencyKey);
        return ok(null);
    }

    @PostMapping("/{foodLogId}/restore")
    public ApiResponse<FoodLogResponse> restore(
            HttpServletRequest request,
            @PathVariable long foodLogId,
            @RequestParam long revision,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        return ok(map(foods.restore(user(request).userId(), foodLogId, revision, idempotencyKey)));
    }

    private <T> ApiResponse<T> ok(T value) {
        return ApiResponse.success(value, TraceContextHolder.currentOrNew());
    }

    private FoodLogResponse map(FoodLogService.FoodLogView value) {
        return new FoodLogResponse(
                Long.toString(value.foodLogId()),
                value.sessionId() == null ? null : Long.toString(value.sessionId()),
                value.agentRunId() == null ? null : Long.toString(value.agentRunId()),
                value.mealTime(),
                value.mealType().code(),
                value.notes(),
                value.source(),
                value.revision(),
                value.deleted(),
                value.createdAt(),
                value.updatedAt(),
                value.items().stream()
                        .map(
                                item ->
                                        new FoodLogResponse.Item(
                                                Long.toString(item.foodLogItemId()),
                                                item.itemOrder(),
                                                item.rawName(),
                                                item.amount(),
                                                item.unit(),
                                                item.nutritionStatus(),
                                                item.caloriesKcal(),
                                                item.proteinG(),
                                                item.fatG(),
                                                item.carbsG()))
                        .toList());
    }
}

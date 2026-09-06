package com.foodmate.application.food.service.impl;

import com.foodmate.application.food.port.out.FoodLogRepository;
import com.foodmate.application.food.port.out.FoodLogRepository.NutritionFoodCandidate;
import com.foodmate.application.food.service.NutritionFoodService;
import com.foodmate.application.food.service.NutritionNameNormalizer;
import com.foodmate.shared.error.BusinessException;
import com.foodmate.shared.error.ErrorCode;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

/** 营养目录候选应用服务；只返回已审核、未删除的公共目录数据。 */
@Service
@Profile("local")
public class NutritionFoodServiceImpl implements NutritionFoodService {
    private static final int DEFAULT_LIMIT = 8;
    private static final int MAX_LIMIT = 12;

    private final FoodLogRepository store;

    public NutritionFoodServiceImpl(FoodLogRepository store) {
        this.store = store;
    }

    @Override
    public List<NutritionFoodCandidate> search(String query, Integer limit) {
        String normalized = NutritionNameNormalizer.normalize(query);
        if (normalized.isBlank() || normalized.length() > 80) {
            throw new BusinessException(ErrorCode.INVALID_ARGUMENT, "食材查询不能为空且不能超过 80 个字符");
        }
        int boundedLimit = limit == null ? DEFAULT_LIMIT : limit;
        if (boundedLimit < 1 || boundedLimit > MAX_LIMIT) {
            throw new BusinessException(ErrorCode.INVALID_ARGUMENT, "食材候选数量必须在 1 到 12 之间");
        }
        return store.findNutritionFoodCandidates(normalized, boundedLimit);
    }
}

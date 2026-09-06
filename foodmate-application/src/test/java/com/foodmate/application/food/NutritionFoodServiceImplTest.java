package com.foodmate.application.food;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.foodmate.application.food.port.out.FoodLogRepository;
import com.foodmate.application.food.service.NutritionFoodService;
import com.foodmate.application.food.service.impl.NutritionFoodServiceImpl;
import com.foodmate.shared.error.BusinessException;
import com.foodmate.shared.error.ErrorCode;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

/** 营养目录候选查询的输入边界和结果透传测试。 */
class NutritionFoodServiceImplTest {
    @Test
    void normalizesCookingPrefixBeforeSearchingApprovedCandidates() {
        FoodLogRepository repository = mock(FoodLogRepository.class);
        FoodLogRepository.NutritionFoodCandidate candidate = candidate(171477L, 0);
        when(repository.findNutritionFoodCandidates("鸡胸肉", 8)).thenReturn(List.of(candidate));
        NutritionFoodService service = new NutritionFoodServiceImpl(repository);

        List<FoodLogRepository.NutritionFoodCandidate> result = service.search("煮 鸡胸肉", 8);

        assertEquals(List.of(candidate), result);
        verify(repository).findNutritionFoodCandidates("鸡胸肉", 8);
    }

    @Test
    void rejectsBlankOrOutOfRangeSearch() {
        NutritionFoodService service = new NutritionFoodServiceImpl(mock(FoodLogRepository.class));

        BusinessException blank = assertThrows(BusinessException.class, () -> service.search(" ", 8));
        BusinessException limit = assertThrows(BusinessException.class, () -> service.search("燕麦", 13));

        assertEquals(ErrorCode.INVALID_ARGUMENT, blank.errorCode());
        assertEquals(ErrorCode.INVALID_ARGUMENT, limit.errorCode());
    }

    private FoodLogRepository.NutritionFoodCandidate candidate(long id, int rank) {
        return new FoodLogRepository.NutritionFoodCandidate(
                id,
                "Chicken, cooked, roasted",
                "鸡胸肉",
                "meat",
                "cooked",
                "g",
                new BigDecimal("165.0000"),
                new BigDecimal("31.0200"),
                new BigDecimal("3.5700"),
                BigDecimal.ZERO,
                "USDA FoodData Central",
                "USDA-v1",
                rank);
    }
}

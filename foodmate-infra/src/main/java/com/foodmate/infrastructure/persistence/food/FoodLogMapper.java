package com.foodmate.infrastructure.persistence.food;

import com.foodmate.application.food.port.out.FoodLogRepository.FoodLogItemSnapshot;
import com.foodmate.application.food.port.out.FoodLogRepository.FoodLogItemWrite;
import com.foodmate.application.food.port.out.FoodLogRepository.FoodLogWrite;
import com.foodmate.application.food.port.out.FoodLogRepository.NutritionFoodCandidate;
import com.foodmate.application.food.port.out.FoodLogRepository.NutritionFoodLookup;
import com.foodmate.application.food.port.out.FoodLogRepository.UnitConversionLookup;
import com.foodmate.application.food.port.out.FoodLogRepository.UpdateFoodLogWrite;
import java.time.Instant;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/** 饮食记录及其明细的 MyBatis 映射。 */
@Mapper
public interface FoodLogMapper {
    record FoodLogRow(
            long foodLogId,
            long userId,
            Long sessionId,
            Long agentRunId,
            Instant mealTime,
            String mealType,
            String notes,
            String source,
            long revision,
            boolean deleted,
            Instant createdAt,
            Instant updatedAt) {}

    @Select(
            "SELECT EXISTS(SELECT 1 FROM sessions WHERE session_id=#{sessionId} AND user_id=#{userId} AND is_deleted=FALSE)")
    boolean sessionOwned(@Param("userId") long userId, @Param("sessionId") long sessionId);

    @Select(
            "SELECT EXISTS(SELECT 1 FROM agent_runs r JOIN sessions s ON s.session_id=r.session_id WHERE r.agent_run_id=#{agentRunId} AND r.created_by=#{userId} AND r.is_deleted=FALSE AND s.user_id=#{userId} AND s.is_deleted=FALSE)")
    boolean agentRunOwned(@Param("userId") long userId, @Param("agentRunId") long agentRunId);

    @Select(
            "SELECT nutrition_food_id AS nutritionFoodId,standard_name AS standardName,basis_unit AS basisUnit,calories_kcal_per_100 AS caloriesKcalPer100,protein_g_per_100 AS proteinGPer100,fat_g_per_100 AS fatGPer100,carbs_g_per_100 AS carbsGPer100,source_name AS sourceName,source_version AS sourceVersion FROM nutrition_foods WHERE is_deleted=FALSE AND review_status='approved' AND (lower(trim(standard_name))=#{normalizedName} OR lower(trim(chinese_name))=#{normalizedName} OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(aliases_json) alias_value WHERE lower(trim(alias_value))=#{normalizedName})) ORDER BY CASE WHEN lower(trim(standard_name))=#{normalizedName} THEN 0 WHEN lower(trim(chinese_name))=#{normalizedName} THEN 1 ELSE 2 END,nutrition_food_id LIMIT 1")
    NutritionFoodLookup findNutritionFood(@Param("normalizedName") String normalizedName);

    @Select(
            "SELECT nutrition_food_id AS nutritionFoodId,standard_name AS standardName,basis_unit AS basisUnit,calories_kcal_per_100 AS caloriesKcalPer100,protein_g_per_100 AS proteinGPer100,fat_g_per_100 AS fatGPer100,carbs_g_per_100 AS carbsGPer100,source_name AS sourceName,source_version AS sourceVersion FROM nutrition_foods WHERE nutrition_food_id=#{nutritionFoodId} AND is_deleted=FALSE AND review_status='approved'")
    NutritionFoodLookup findNutritionFoodById(@Param("nutritionFoodId") long nutritionFoodId);

    @Select(
            """
            <script>
            WITH query AS (SELECT #{normalizedName}::text AS value)
            SELECT food.nutrition_food_id AS nutritionFoodId,
                   food.standard_name AS standardName,
                   food.chinese_name AS chineseName,
                   food.category,
                   food.food_form AS foodForm,
                   food.basis_unit AS basisUnit,
                   food.calories_kcal_per_100 AS caloriesKcalPer100,
                   food.protein_g_per_100 AS proteinGPer100,
                   food.fat_g_per_100 AS fatGPer100,
                   food.carbs_g_per_100 AS carbsGPer100,
                   food.source_name AS sourceName,
                   food.source_version AS sourceVersion,
                   CASE
                       WHEN lower(trim(food.standard_name)) = query.value
                            OR lower(trim(food.chinese_name)) = query.value THEN 0
                       WHEN EXISTS (
                           SELECT 1
                           FROM jsonb_array_elements_text(COALESCE(food.aliases_json, '[]'::jsonb)) AS alias_value
                           WHERE lower(trim(alias_value)) = query.value
                       ) THEN 1
                       WHEN lower(trim(food.standard_name)) LIKE query.value || '%'
                            OR lower(trim(food.chinese_name)) LIKE query.value || '%' THEN 2
                       ELSE 3
                   END AS matchRank
            FROM nutrition_foods food
            CROSS JOIN query
            WHERE food.is_deleted = FALSE
              AND food.review_status = 'approved'
              AND (
                  lower(trim(food.standard_name)) = query.value
                  OR lower(trim(food.chinese_name)) = query.value
                  OR EXISTS (
                      SELECT 1
                      FROM jsonb_array_elements_text(COALESCE(food.aliases_json, '[]'::jsonb)) AS alias_value
                      WHERE lower(trim(alias_value)) = query.value
                  )
                  OR lower(trim(food.standard_name)) LIKE '%' || query.value || '%'
                  OR lower(trim(food.chinese_name)) LIKE '%' || query.value || '%'
                  OR EXISTS (
                      SELECT 1
                      FROM jsonb_array_elements_text(COALESCE(food.aliases_json, '[]'::jsonb)) AS alias_value
                      WHERE lower(trim(alias_value)) LIKE '%' || query.value || '%'
                  )
              )
            ORDER BY matchRank,
                     CASE food.food_form WHEN 'cooked' THEN 0 WHEN 'raw' THEN 1 ELSE 2 END,
                     food.nutrition_food_id
            LIMIT #{limit}
            </script>
            """)
    List<NutritionFoodCandidate> findNutritionFoodCandidates(
            @Param("normalizedName") String normalizedName, @Param("limit") int limit);

    @Select(
            "SELECT conversion_id AS conversionId,multiplier,target_unit AS targetUnit,source_name AS sourceName,source_version AS sourceVersion FROM nutrition_unit_conversions WHERE nutrition_food_id=#{nutritionFoodId} AND lower(trim(source_unit))=#{sourceUnit} AND target_unit=#{targetUnit} AND is_deleted=FALSE AND review_status='approved' LIMIT 1")
    UnitConversionLookup findUnitConversion(
            @Param("nutritionFoodId") long nutritionFoodId,
            @Param("sourceUnit") String sourceUnit,
            @Param("targetUnit") String targetUnit);

    @Insert(
            "INSERT INTO food_logs(food_log_id,user_id,session_id,agent_run_id,meal_time,meal_type,notes,source,idempotency_key,revision,created_by,updated_by) VALUES (#{foodLogId},#{userId},#{sessionId},#{agentRunId},#{mealTime},#{mealType},#{notes},#{source},#{idempotencyKey},#{revision},#{userId},#{userId})")
    int insertFoodLog(FoodLogWrite write);

    @Update(
            "UPDATE food_logs SET meal_time=#{mealTime},meal_type=#{mealType},notes=#{notes},updated_at=CURRENT_TIMESTAMP,updated_by=#{userId},revision=revision+1 WHERE food_log_id=#{foodLogId} AND user_id=#{userId} AND revision=#{expectedRevision} AND is_deleted=FALSE")
    int updateFoodLog(UpdateFoodLogWrite write);

    @Update(
            "UPDATE food_log_items SET is_deleted=TRUE,deleted_at=CURRENT_TIMESTAMP,deleted_by=#{userId},updated_at=CURRENT_TIMESTAMP,updated_by=#{userId} WHERE food_log_id=#{foodLogId} AND is_deleted=FALSE")
    int softDeleteItems(@Param("userId") long userId, @Param("foodLogId") long foodLogId);

    @Insert(
            "INSERT INTO food_log_items(food_log_item_id,food_log_id,item_order,raw_name,nutrition_food_id,amount,unit,normalized_amount,normalized_unit,conversion_id,calories_kcal,protein_g,fat_g,carbs_g,nutrition_status,nutrition_source,nutrition_version,created_by,updated_by) VALUES (#{foodLogItemId},#{foodLogId},#{itemOrder},#{rawName},#{nutritionFoodId},#{amount},#{unit},#{normalizedAmount},#{normalizedUnit},#{conversionId},#{caloriesKcal},#{proteinG},#{fatG},#{carbsG},#{nutritionStatus},#{nutritionSource},#{nutritionVersion},#{userId},#{userId})")
    void insertItem(FoodLogItemWrite item);

    @Select(
            "SELECT f.food_log_id AS foodLogId,f.user_id AS userId,f.session_id AS sessionId,f.agent_run_id AS agentRunId,f.meal_time AS mealTime,f.meal_type AS mealType,f.notes,f.source,f.revision,f.is_deleted AS deleted,f.created_at AS createdAt,f.updated_at AS updatedAt FROM food_logs f WHERE f.user_id=#{userId} AND f.is_deleted=FALSE AND f.meal_time>=#{from} AND f.meal_time<#{to} ORDER BY f.meal_time DESC")
    List<FoodLogRow> findVisible(
            @Param("userId") long userId, @Param("from") Instant from, @Param("to") Instant to);

    @Select(
            "SELECT f.food_log_id AS foodLogId,f.user_id AS userId,f.session_id AS sessionId,f.agent_run_id AS agentRunId,f.meal_time AS mealTime,f.meal_type AS mealType,f.notes,f.source,f.revision,f.is_deleted AS deleted,f.created_at AS createdAt,f.updated_at AS updatedAt FROM food_logs f WHERE f.user_id=#{userId} AND f.is_deleted=TRUE ORDER BY f.updated_at DESC,f.food_log_id DESC")
    List<FoodLogRow> findDeleted(@Param("userId") long userId);

    @Select(
            "SELECT f.food_log_id AS foodLogId,f.user_id AS userId,f.session_id AS sessionId,f.agent_run_id AS agentRunId,f.meal_time AS mealTime,f.meal_type AS mealType,f.notes,f.source,f.revision,f.is_deleted AS deleted,f.created_at AS createdAt,f.updated_at AS updatedAt FROM food_logs f WHERE f.food_log_id=#{foodLogId} AND f.user_id=#{userId} AND f.is_deleted=#{includeDeleted}")
    FoodLogRow findOwned(
            @Param("userId") long userId,
            @Param("foodLogId") long foodLogId,
            @Param("includeDeleted") boolean includeDeleted);

    @Select(
            "SELECT i.food_log_item_id AS foodLogItemId,i.item_order AS itemOrder,i.raw_name AS rawName,i.amount,i.unit,i.nutrition_status AS nutritionStatus,i.calories_kcal AS caloriesKcal,i.protein_g AS proteinG,i.fat_g AS fatG,i.carbs_g AS carbsG FROM food_log_items i WHERE i.food_log_id=#{foodLogId} AND i.is_deleted=FALSE ORDER BY i.item_order")
    List<FoodLogItemSnapshot> findItems(long foodLogId);

    @Update(
            "UPDATE food_logs SET is_deleted=TRUE,deleted_at=CURRENT_TIMESTAMP,deleted_by=#{userId},updated_at=CURRENT_TIMESTAMP,updated_by=#{userId},revision=revision+1 WHERE food_log_id=#{foodLogId} AND user_id=#{userId} AND revision=#{revision} AND is_deleted=FALSE")
    int softDelete(long userId, long foodLogId, long revision);

    @Update(
            "UPDATE food_logs SET is_deleted=FALSE,deleted_at=NULL,deleted_by=NULL,updated_at=CURRENT_TIMESTAMP,updated_by=#{userId},revision=revision+1 WHERE food_log_id=#{foodLogId} AND user_id=#{userId} AND revision=#{revision} AND is_deleted=TRUE")
    int restore(long userId, long foodLogId, long revision);
}

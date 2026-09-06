-- M2-4 营养候选确认状态。
-- 只扩展饮食明细状态约束，不改写既有记录，也不自动选择生熟形态。

BEGIN;

ALTER TABLE food_log_items
    DROP CONSTRAINT IF EXISTS chk_food_log_items_status;

ALTER TABLE food_log_items
    ADD CONSTRAINT chk_food_log_items_status
        CHECK (nutrition_status IN ('matched', 'pending', 'pending_confirmation', 'invalid'));

COMMENT ON COLUMN food_log_items.nutrition_status IS
    '营养状态：matched、pending、pending_confirmation 或 invalid；候选歧义必须人工确认。';

CREATE INDEX IF NOT EXISTS idx_nutrition_foods_candidate_lookup
    ON nutrition_foods (review_status, is_deleted, chinese_name, food_form, nutrition_food_id);

COMMIT;

-- V34 回滚前置检查，只读。
-- 只有 pending_confirmation 行为 0 且人工确认兼容性已复核时，才允许另行授权回滚。

SELECT COUNT(*) AS pending_confirmation_rows
FROM food_log_items
WHERE nutrition_status = 'pending_confirmation';

SELECT COUNT(*) AS pending_confirmation_rows,
       CASE
           WHEN COUNT(*) = 0
               THEN 'ready_for_manual_review: no pending_confirmation rows remain'
           ELSE 'blocked: pending_confirmation rows must be migrated first'
       END AS rollback_precheck
FROM food_log_items
WHERE nutrition_status = 'pending_confirmation';

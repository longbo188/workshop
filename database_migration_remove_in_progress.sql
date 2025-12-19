-- 移除in_progress状态的数据库迁移脚本
USE workshop_db;

-- 1. 将所有in_progress状态的任务改为pending
UPDATE tasks SET status = 'pending' WHERE status = 'in_progress';

-- 2. 修改status字段的ENUM定义，移除in_progress
ALTER TABLE tasks MODIFY COLUMN status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending';

-- 3. 删除相关的报工记录（可选，根据需求决定是否保留历史数据）
-- DELETE FROM work_reports WHERE work_type IN ('start', 'complete');

-- 4. 验证修改结果
SELECT status, COUNT(*) as count FROM tasks GROUP BY status;






































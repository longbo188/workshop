-- 添加staff确认相关的状态到ENUM
-- 执行时间：建议在低峰期执行

USE workshop_db;

-- 1. 修改status字段的ENUM定义，添加pending_staff_confirmation和staff_confirmed
ALTER TABLE exception_reports 
MODIFY COLUMN status ENUM(
  'pending',
  'pending_second_approval',
  'pending_staff_confirmation',
  'staff_confirmed',
  'approved',
  'rejected',
  'processing',
  'resolved'
) DEFAULT 'pending';

-- 2. 修复已分配staff但status为空的报告
UPDATE exception_reports 
SET status = 'pending_staff_confirmation'
WHERE (status = '' OR status IS NULL) 
  AND assigned_to_staff_id IS NOT NULL;

-- 3. 验证修改结果
SELECT status, COUNT(*) as count 
FROM exception_reports 
GROUP BY status;











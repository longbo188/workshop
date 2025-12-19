-- 添加staff确认功能
-- 执行时间：建议在低峰期执行

USE workshop_db;

-- 1. 添加staff确认相关字段
ALTER TABLE exception_reports 
ADD COLUMN IF NOT EXISTS assigned_to_staff_id INT NULL COMMENT '转给staff确认的用户ID',
ADD COLUMN IF NOT EXISTS staff_confirmed_at DATETIME NULL COMMENT 'staff确认时间',
ADD COLUMN IF NOT EXISTS staff_confirmation_note TEXT NULL COMMENT 'staff确认备注';

-- 2. 添加外键约束（如果不存在）
-- 注意：MySQL不支持 IF NOT EXISTS 在 ADD FOREIGN KEY，需要先检查
-- 这里先尝试添加，如果已存在会报错但可以忽略

-- 3. 验证修改结果
DESCRIBE exception_reports;






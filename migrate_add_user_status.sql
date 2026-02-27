-- 给 users 表增加在职状态字段（软删除）

ALTER TABLE users 
  ADD COLUMN status ENUM('active','inactive') NOT NULL DEFAULT 'active' 
  AFTER department;

-- 兼容历史数据（如果已有 status 字段或已存在 NULL）
UPDATE users SET status = 'active' WHERE status IS NULL;


-- 删除整体任务负责人字段的迁移脚本
-- 执行前请备份数据库

-- 1. 删除 assigned_to 字段的外键约束
ALTER TABLE tasks DROP FOREIGN KEY fk_tasks_assigned_to;

-- 2. 删除 assigned_to 字段
ALTER TABLE tasks DROP COLUMN assigned_to;

-- 3. 删除 assigned_user_name 字段（如果存在）
-- 注意：这个字段可能不存在，如果报错可以忽略
ALTER TABLE tasks DROP COLUMN assigned_user_name;

-- 4. 更新任务表结构，确保只有阶段负责人字段
-- 检查当前表结构
DESCRIBE tasks;

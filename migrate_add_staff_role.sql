-- 添加staff角色
-- 执行时间：建议在低峰期执行

USE workshop_db;

-- 1. 修改users表的role字段，添加staff角色
ALTER TABLE users MODIFY COLUMN role ENUM('worker', 'supervisor', 'admin', 'manager', 'staff') DEFAULT 'worker';

-- 验证：查询所有角色类型
SELECT DISTINCT role FROM users;









-- 添加manager角色并更新用户ID 86的角色
-- 执行时间：建议在低峰期执行

USE workshop_db;

-- 1. 修改users表的role字段，添加manager角色
ALTER TABLE users MODIFY COLUMN role ENUM('worker', 'supervisor', 'admin', 'manager') DEFAULT 'worker';

-- 2. 将用户ID 86的角色更新为manager
UPDATE users SET role = 'manager' WHERE id = 86;

-- 验证：查询用户ID 86的信息
SELECT id, username, name, role, department FROM users WHERE id = 86;















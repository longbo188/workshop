-- 数据库迁移脚本：为任务表添加新字段
-- 用于支持Excel任务导入功能

USE workshop_db;

-- 为tasks表添加新字段
ALTER TABLE tasks 
ADD COLUMN device_number VARCHAR(100) AFTER actual_hours,
ADD COLUMN product_model VARCHAR(100) AFTER device_number,
ADD COLUMN order_status VARCHAR(50) AFTER product_model,
ADD COLUMN production_time DATETIME AFTER order_status;

-- 添加索引以提高查询性能
CREATE INDEX idx_tasks_device_number ON tasks(device_number);
CREATE INDEX idx_tasks_product_model ON tasks(product_model);
CREATE INDEX idx_tasks_order_status ON tasks(order_status);
CREATE INDEX idx_tasks_production_time ON tasks(production_time);

-- 显示更新结果
SELECT 'Tasks table updated successfully' as message;
DESCRIBE tasks;










































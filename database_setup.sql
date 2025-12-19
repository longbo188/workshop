-- 车间报工系统数据库结构
-- 创建数据库
CREATE DATABASE IF NOT EXISTS workshop_db;
USE workshop_db;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role ENUM('worker', 'supervisor', 'admin', 'manager', 'staff') DEFAULT 'worker',
    department VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 任务表
CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
    priority ENUM('normal', 'urgent') DEFAULT 'normal',
    assigned_to INT,
    created_by INT,
    start_time DATETIME,
    end_time DATETIME,
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2),
    machining_hours_est DECIMAL(5,2) NULL,
    electrical_hours_est DECIMAL(5,2) NULL,
    pre_assembly_hours_est DECIMAL(5,2) NULL,
    post_assembly_hours_est DECIMAL(5,2) NULL,
    debugging_hours_est DECIMAL(5,2) NULL,
    machining_phase TINYINT(1) DEFAULT 0,
    electrical_phase TINYINT(1) DEFAULT 0,
    pre_assembly_phase TINYINT(1) DEFAULT 0,
    post_assembly_phase TINYINT(1) DEFAULT 0,
    debugging_phase TINYINT(1) DEFAULT 0,
    device_number VARCHAR(100),
    product_model VARCHAR(100),
    order_status VARCHAR(50),
    production_time DATETIME,
    promised_completion_time DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 报工记录表
CREATE TABLE IF NOT EXISTS work_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    work_type ENUM('start', 'pause', 'resume', 'complete', 'quality_check') NOT NULL,
    start_time DATETIME,
    end_time DATETIME,
    hours_worked DECIMAL(5,2),
    quantity_completed INT DEFAULT 0,
    quality_notes TEXT,
    issues TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 插入测试数据
INSERT INTO users (username, password, name, role, department) VALUES
('admin', 'admin123', '系统管理员', 'admin', 'IT部门'),
('supervisor1', 'super123', '车间主管', 'supervisor', '生产部'),
('worker1', 'worker123', '张三', 'worker', '组装车间'),
('worker2', 'worker123', '李四', 'worker', '质检车间'),
('worker3', 'worker123', '王五', 'worker', '包装车间');

INSERT INTO tasks (name, description, status, priority, assigned_to, created_by, estimated_hours) VALUES
('组装零件A', '按照图纸要求组装零件A，注意精度要求', 'pending', 'normal', 3, 2, 4.5),
('质检产品B', '对产品B进行质量检查，确保符合标准', 'pending', 'normal', 4, 2, 2.0),
('包装产品C', '将产品C进行包装，贴上标签', 'pending', 'normal', 5, 2, 1.5),
('维修设备D', '维修生产设备D，更换损坏部件', 'pending', 'urgent', 3, 2, 6.0),
('清洁工作区', '清洁工作区域，保持整洁', 'completed', 'low', 3, 2, 1.0);


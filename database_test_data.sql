-- 车间报工系统测试数据
USE workshop_db;

-- 插入用户数据
INSERT INTO users (username, password, name, role, department) VALUES
('admin', 'admin123', '系统管理员', 'admin', 'IT部门'),
('supervisor1', 'super123', '车间主管', 'supervisor', '生产部'),
('worker1', 'worker123', '张三', 'worker', '组装车间'),
('worker2', 'worker123', '李四', 'worker', '质检车间'),
('worker3', 'worker123', '王五', 'worker', '包装车间');

-- 插入任务数据
INSERT INTO tasks (name, description, status, priority, assigned_to, created_by, estimated_hours) VALUES
('组装零件A', '按照图纸要求组装零件A，注意精度要求', 'pending', 'normal', 3, 2, 4.5),
('质检产品B', '对产品B进行质量检查，确保符合标准', 'pending', 'normal', 4, 2, 2.0),
('包装产品C', '将产品C进行包装，贴上标签', 'pending', 'normal', 5, 2, 1.5),
('维修设备D', '维修生产设备D，更换损坏部件', 'in_progress', 'urgent', 3, 2, 6.0),
('清洁工作区', '清洁工作区域，保持整洁', 'completed', 'low', 3, 2, 1.0);






























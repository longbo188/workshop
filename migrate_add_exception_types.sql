-- 添加新的异常类型：设计问题、其他问题
-- 执行时间：建议在低峰期执行

USE workshop_db;

-- 修改exception_type字段的ENUM定义，添加"设计问题"和"其他问题"
ALTER TABLE exception_reports 
MODIFY COLUMN exception_type ENUM(
  '缺料',
  '来料不良',
  '改造类（研发售后或生产不良）',
  '临时安排任务',
  '设计问题',
  '其他问题'
) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL;

-- 验证修改结果
DESCRIBE exception_reports;


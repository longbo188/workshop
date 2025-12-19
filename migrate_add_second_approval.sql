-- 添加二级审批功能
-- 执行时间：建议在低峰期执行

USE workshop_db;

-- 1. 添加二级审批相关字段
ALTER TABLE exception_reports 
ADD COLUMN first_approver_id INT NULL COMMENT '一级审批人ID（主管）',
ADD COLUMN first_approved_at DATETIME NULL COMMENT '一级审批时间',
ADD COLUMN first_approval_note TEXT NULL COMMENT '一级审批备注',
ADD COLUMN second_approver_id INT NULL COMMENT '二级审批人ID（经理）',
ADD COLUMN second_approved_at DATETIME NULL COMMENT '二级审批时间',
ADD COLUMN second_approval_note TEXT NULL COMMENT '二级审批备注',
ADD COLUMN modified_exception_type VARCHAR(100) NULL COMMENT '主管修改后的异常类型',
ADD COLUMN modified_description TEXT NULL COMMENT '主管修改后的异常描述',
ADD COLUMN modified_start_datetime DATETIME NULL COMMENT '主管修改后的异常开始时间',
ADD COLUMN modified_end_datetime DATETIME NULL COMMENT '主管修改后的异常结束时间',
ADD FOREIGN KEY (first_approver_id) REFERENCES users(id) ON DELETE SET NULL,
ADD FOREIGN KEY (second_approver_id) REFERENCES users(id) ON DELETE SET NULL;

-- 2. 修改status字段，添加新的状态
-- 注意：如果status是ENUM类型，需要先修改ENUM定义
-- 如果status是VARCHAR，则不需要修改

-- 3. 验证修改结果
DESCRIBE exception_reports;















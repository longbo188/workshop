-- 修改daily_attendance表的时间字段类型，支持HH:MM格式
-- 将TIME类型改为VARCHAR(5)类型

ALTER TABLE daily_attendance 
MODIFY COLUMN overtime_start_time VARCHAR(5) NULL,
MODIFY COLUMN overtime_end_time VARCHAR(5) NULL,
MODIFY COLUMN leave_start_time VARCHAR(5) NULL,
MODIFY COLUMN leave_end_time VARCHAR(5) NULL;
































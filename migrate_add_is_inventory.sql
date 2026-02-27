-- 为任务表增加“是否库存”字段（用于标记库存任务）

ALTER TABLE tasks 
  ADD COLUMN is_inventory TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否库存任务（1=库存，0=非库存）'
  AFTER delivery_plan_note;


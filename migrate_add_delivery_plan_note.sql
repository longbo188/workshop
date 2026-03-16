-- 为任务表增加“交货计划备注”字段（用于主管派工界面的可编辑备注列）

ALTER TABLE tasks 
  ADD COLUMN delivery_plan_note TEXT NULL COMMENT '交货计划备注（交货计划说明）'
  AFTER order_status;



# 已完成任务显示问题调试总结

## 问题描述
用户反馈："仍然看不到各阶段已完成的任务"

## 当前状态

### 测试数据
- **任务ID**: 752 (M1S261474 - A1000)
- **状态**: `status = 'pending'`
- **机加阶段**: `machining_phase = 1` (已完成)
- **完成时间**: `machining_complete_time = '2025-10-20T06:30:03.000Z'`
- **分配给**: `assigned_to = 3`
- **work_reports记录**: 存在（id: 25, user_id: 3, work_type: 'complete'）

### API测试结果
- **接口**: `GET /api/tasks/user/3/completed`
- **返回结果**: 只有2个完全完成的任务（ID: 893, 1029）
- **预期结果**: 应该包含任务752（部分完成）

### SQL查询
```sql
SELECT DISTINCT t.*, 
       wr.approval_status as latest_completion_status, 
       wr.created_at as latest_completion_created_at
FROM tasks t
LEFT JOIN (
  SELECT x.task_id, w.approval_status, w.created_at
  FROM (
    SELECT task_id, MAX(id) AS last_id
    FROM work_reports
    WHERE work_type = 'complete'
    GROUP BY task_id
  ) x
  JOIN work_reports w ON w.id = x.last_id
) wr ON wr.task_id = t.id
WHERE t.id IN (
  SELECT DISTINCT task_id FROM work_reports 
  WHERE user_id = 3 AND work_type = 'complete'
)
AND (
  t.status = 'completed' 
  OR t.machining_phase = 1 
  OR t.electrical_phase = 1 
  OR t.pre_assembly_phase = 1 
  OR t.post_assembly_phase = 1 
  OR t.debugging_phase = 1
)
ORDER BY COALESCE(t.end_time, wr.created_at) DESC
```

### 查询条件验证
1. ✅ 任务752在子查询中（`SELECT DISTINCT task_id FROM work_reports WHERE user_id = 3 AND work_type = 'complete'`）
2. ✅ 任务752满足阶段完成条件（`t.machining_phase = 1`）
3. ❌ 但任务752没有出现在最终结果中

## 可能的原因

1. **子查询问题**: 子查询可能没有正确执行
2. **字段类型问题**: `machining_phase`可能是TINYINT(1)，在某些情况下可能不等于1
3. **JOIN问题**: LEFT JOIN可能导致某些记录被过滤掉
4. **查询缓存**: 可能存在查询缓存问题

## 建议的调试步骤

1. **直接测试子查询**:
```bash
# 测试子查询是否正确返回任务752
node -e "const mysql = require('mysql2/promise'); async function test() { const conn = await mysql.createConnection({host: 'localhost', user: 'root', password: '123456', database: 'work_app'}); const [rows] = await conn.execute('SELECT DISTINCT task_id FROM work_reports WHERE user_id = 3 AND work_type = \"complete\"'); console.log(rows.map(r => r.task_id)); await conn.end(); } test();"
```

2. **测试主查询**:
```bash
# 测试主查询是否返回任务752
node -e "const mysql = require('mysql2/promise'); async function test() { const conn = await mysql.createConnection({host: 'localhost', user: 'root', password: '123456', database: 'work_app'}); const [rows] = await conn.execute('SELECT t.id, t.name, t.machining_phase FROM tasks t WHERE t.id = 752'); console.log(rows); await conn.end(); } test();"
```

3. **检查字段类型**:
```bash
# 检查machining_phase字段类型
node -e "const mysql = require('mysql2/promise'); async function test() { const conn = await mysql.createConnection({host: 'localhost', user: 'root', password: '123456', database: 'work_app'}); const [rows] = await conn.execute('DESCRIBE tasks machining_phase'); console.log(rows); await conn.end(); } test();"
```

## 下一步行动

由于数据库访问受限，建议：
1. 在前端直接测试API
2. 检查后端控制台日志
3. 尝试简化查询逻辑
4. 考虑使用UNION而不是OR条件








































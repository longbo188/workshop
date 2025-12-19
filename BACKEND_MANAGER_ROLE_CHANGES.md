# 后端添加 manager 角色修改说明

## 概述
本文档详细说明在 `backend/server.js` 中添加 `manager` 角色（权限与 `supervisor` 相同）需要修改的所有位置。

## 需要修改的位置（共4处）

### 1. 导入标准工时权限检查（第627行）

**文件位置**：`backend/server.js` 第627行

**修改前**：
```javascript
const role = userRows[0].role;
if (role !== 'admin' && role !== 'supervisor') {
  await connection.end();
  return res.status(403).json({ error: '权限不足，只有管理员和主管可以导入标准工时' });
}
```

**修改后**：
```javascript
const role = userRows[0].role;
if (role !== 'admin' && role !== 'supervisor' && role !== 'manager') {
  await connection.end();
  return res.status(403).json({ error: '权限不足，只有管理员、主管和经理可以导入标准工时' });
}
```

**修改说明**：
- 在权限检查条件中添加 `&& role !== 'manager'`
- 更新错误提示信息，包含"经理"

**影响范围**：导入标准工时功能

---

### 2. 用户导入时的角色验证（第864行）

**文件位置**：`backend/server.js` 第864行

**修改前**：
```javascript
// 验证角色是否有效
if (!['worker', 'supervisor', 'admin'].includes(row.role)) {
  errors.push(`${row.username}: 角色无效，必须是 worker/supervisor/admin`);
  failCount++;
  continue;
}
```

**修改后**：
```javascript
// 验证角色是否有效
if (!['worker', 'supervisor', 'admin', 'manager'].includes(row.role)) {
  errors.push(`${row.username}: 角色无效，必须是 worker/supervisor/admin/manager`);
  failCount++;
  continue;
}
```

**修改说明**：
- 在角色验证数组中添加 `'manager'`
- 更新错误提示信息，包含 `manager`

**影响范围**：批量导入用户功能

---

### 3. 导入任务权限检查（第1066行）

**文件位置**：`backend/server.js` 第1066行

**修改前**：
```javascript
const userRole = userRows[0].role;
if (userRole !== 'admin' && userRole !== 'supervisor') {
  await connection.end();
  return res.status(403).json({ error: '权限不足，只有管理员和主管可以导入任务' });
}
```

**修改后**：
```javascript
const userRole = userRows[0].role;
if (userRole !== 'admin' && userRole !== 'supervisor' && userRole !== 'manager') {
  await connection.end();
  return res.status(403).json({ error: '权限不足，只有管理员、主管和经理可以导入任务' });
}
```

**修改说明**：
- 在权限检查条件中添加 `&& userRole !== 'manager'`
- 更新错误提示信息，包含"经理"

**影响范围**：导入任务功能

---

### 4. 异常报告审批人验证（第3066行）

**文件位置**：`backend/server.js` 第3066行

**修改前**：
```javascript
// 检查审批人是否存在且具有审批权限
const [approverRows] = await connection.execute(`
  SELECT id, name, role FROM users WHERE id = ? AND (role = 'admin' OR role = 'supervisor')
`, [approverId]);
```

**修改后**：
```javascript
// 检查审批人是否存在且具有审批权限
const [approverRows] = await connection.execute(`
  SELECT id, name, role FROM users WHERE id = ? AND (role = 'admin' OR role = 'supervisor' OR role = 'manager')
`, [approverId]);
```

**修改说明**：
- 在 SQL 查询的 WHERE 条件中添加 `OR role = 'manager'`
- 允许 manager 角色作为异常报告的审批人

**影响范围**：异常报告审批功能

---

## 修改总结

| 序号 | 位置 | 行号 | 功能 | 修改类型 | 工作量 |
|------|------|------|------|---------|--------|
| 1 | 导入标准工时权限检查 | 627 | 权限验证 | 添加条件判断 | 2分钟 |
| 2 | 用户导入角色验证 | 864 | 角色验证 | 添加数组元素 | 2分钟 |
| 3 | 导入任务权限检查 | 1066 | 权限验证 | 添加条件判断 | 2分钟 |
| 4 | 异常报告审批人验证 | 3066 | SQL查询 | 添加OR条件 | 3分钟 |

**总计**：4处修改，约9-12分钟

---

## 修改模式

所有修改都遵循相同的模式：

### 模式1：权限检查（3处）
```javascript
// 修改前
if (role !== 'admin' && role !== 'supervisor') {

// 修改后
if (role !== 'admin' && role !== 'supervisor' && role !== 'manager') {
```

### 模式2：角色数组验证（1处）
```javascript
// 修改前
if (!['worker', 'supervisor', 'admin'].includes(row.role)) {

// 修改后
if (!['worker', 'supervisor', 'admin', 'manager'].includes(row.role)) {
```

### 模式3：SQL查询（1处）
```sql
-- 修改前
WHERE (role = 'admin' OR role = 'supervisor')

-- 修改后
WHERE (role = 'admin' OR role = 'supervisor' OR role = 'manager')
```

---

## 注意事项

1. **错误提示信息**：修改权限检查时，记得同步更新错误提示信息，将"管理员和主管"改为"管理员、主管和经理"

2. **SQL注入防护**：第3066行的SQL查询使用了参数化查询（`?` 占位符），这是安全的，不需要额外处理

3. **测试要点**：
   - 测试 manager 角色是否可以导入标准工时
   - 测试 manager 角色是否可以导入任务
   - 测试 manager 角色是否可以成为异常报告的审批人
   - 测试导入用户时 manager 角色是否被正确验证

4. **向后兼容性**：这些修改不会影响现有的 worker、supervisor 和 admin 角色的功能

---

## 完整修改清单

### 需要修改的文件
- ✅ `backend/server.js`（4处修改）

### 不需要修改的地方
- ❌ 数据库连接配置（无需修改）
- ❌ API路由定义（无需修改）
- ❌ 其他业务逻辑（manager权限与supervisor相同，无需额外逻辑）

---

## 快速修改脚本

如果需要批量查找所有相关位置，可以使用以下grep命令：

```bash
# 查找所有包含 supervisor 权限检查的位置
grep -n "supervisor" backend/server.js

# 查找所有角色验证的位置
grep -n "role.*admin.*supervisor\|supervisor.*admin" backend/server.js
```

---

## 验证清单

修改完成后，请验证以下功能：

- [ ] manager 角色可以导入标准工时
- [ ] manager 角色可以导入任务
- [ ] manager 角色可以作为异常报告的审批人
- [ ] 导入用户时，manager 角色可以被正确识别和验证
- [ ] 错误提示信息正确显示"管理员、主管和经理"
- [ ] 现有 worker、supervisor、admin 角色功能不受影响















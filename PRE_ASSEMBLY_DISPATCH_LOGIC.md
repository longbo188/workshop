# 组装前段任务派工逻辑说明

## 一、待派工任务筛选逻辑（前端）

### 1.1 筛选条件
当用户在派工页面选择"组装前段"作为筛选条件时，系统会显示满足以下条件的任务：

**必须满足的条件：**
- ✅ 机加阶段已派工（`machining_assignee` 不为空）或机加阶段已完成（`machining_phase === 1`）
- ✅ 组装前段未分配（`pre_assembly_assignee` 为空）
- ✅ 组装前段未完成（`pre_assembly_phase === 0`）
- ✅ 任务未完成（`status !== 'completed'`）

### 1.2 筛选流程

#### 第一步：基础筛选（`base` 过滤）
```typescript
// 如果筛选组装前段
if (this.unassignedTaskFilters.phase === 'pre_assembly') {
  // 如果组装前段已分配，直接排除
  if (task.pre_assembly_assignee) return false;
  
  // 机加已派工且组装前段未分配，应该显示
  const machiningAssigned = task.machining_assignee || task.machining_phase === 1;
  if (machiningAssigned && task.pre_assembly_phase === 0) {
    return true;
  }
}
```

#### 第二步：详细筛选
```typescript
// 组装前段筛选条件
if (p === 'pre_assembly') {
  // 机加阶段已派工（已分配或已完成）
  const machiningAssigned = task.machining_assignee || task.machining_phase === 1;
  if (!machiningAssigned) return false;
  
  // 如果组装前段已分配，则不在待派工列表中
  if (task.pre_assembly_assignee) return false;
  
  // 已完成则不在待派工列表中
  if (task.pre_assembly_phase !== 0) return false;
}
```

## 二、派工流程（前端）

### 2.1 自动派工
当筛选条件选择"组装前段"时，从待派工任务拖拽到员工，系统会：

1. **自动识别阶段**：不弹出选择对话框，直接分配组装前段
2. **检查任务状态**：
   ```typescript
   if (task.pre_assembly_phase === 0 && !task.pre_assembly_assignee) {
     await this.assignTaskFromUnassigned(task, employeeId, 'pre_assembly');
   } else {
     this.presentToast('组装前段已完成或已分配，无法分配');
   }
   ```

### 2.2 派工请求
前端调用 `/api/tasks/assign` API，传递参数：
- `taskId`: 任务ID
- `userId`: 员工ID
- `phaseKey`: `'pre_assembly'`

## 三、前置条件检查（后端）

### 3.1 检查函数：`canStartPhase`

**组装前段的前置条件：**
- ✅ 只需要：机加阶段已派工（`machining_assignee` 不为空）
- ❌ 不需要：机加阶段完成（不检查 `machining_phase === 1`）

**检查逻辑：**
```javascript
if (phaseKey === 'pre_assembly') {
  const machiningAssigneeValue = task.machining_assignee;
  const machiningAssigned = machiningAssigneeValue != null && 
                             machiningAssigneeValue !== '' && 
                             machiningAssigneeValue !== 0 && 
                             machiningAssigneeValue !== '0' &&
                             machiningAssigneeValue !== 'null' &&
                             machiningAssigneeValue !== 'undefined';
  
  return machiningAssigned;
}
```

**检查的值：**
- `machining_assignee` 必须为有效值（不为 `null`、`undefined`、`''`、`0`、`'0'`、`'null'`、`'undefined'`）

### 3.2 检查流程

1. **获取完整任务信息**：
   ```sql
   SELECT id, status, current_phase, 
          machining_assignee, machining_phase,
          pre_assembly_assignee, pre_assembly_phase,
          ...
   FROM tasks WHERE id = ?
   ```

2. **调用 `canStartPhase` 检查**：
   - 如果返回 `false`，返回错误：`无法分配组装前段阶段，请检查前置条件`

3. **错误信息包含**：
   - 需要满足的条件：机加阶段已派工（`machining_assignee` 不为空）
   - 当前值：`machining_assignee` 的值和类型

## 四、数据库更新（后端）

### 4.1 更新语句
```sql
UPDATE tasks SET 
  pre_assembly_assignee = ?,
  current_phase = CASE 
    WHEN current_phase IS NULL THEN 'pre_assembly'
    ELSE current_phase
  END
WHERE id = ?
```

### 4.2 更新内容
- `pre_assembly_assignee`: 设置为分配的员工ID
- `current_phase`: 如果当前阶段为空，设置为 `'pre_assembly'`

### 4.3 验证更新
更新后验证 `pre_assembly_assignee` 是否真的被设置为期望的值：
```javascript
const [verifyTask] = await connection.execute(`
  SELECT pre_assembly_assignee FROM tasks WHERE id = ?
`, [taskId]);

if (verifyTask[0].pre_assembly_assignee != newAssigned) {
  return res.status(500).json({ error: '任务分配失败：数据库更新未生效' });
}
```

## 五、派工成功后的处理

### 5.1 前端处理
1. 显示成功提示：`任务分配成功`
2. 刷新数据：
   - 调用 `loadData()` 刷新任务列表
   - 调用 `loadVizData()` 刷新可视化数据
   - 延迟 500ms 后再次刷新可视化数据，确保待派工列表更新

### 5.2 待派工列表更新
- 任务会从待派工列表中移除（因为 `pre_assembly_assignee` 已不为空）
- 筛选逻辑会排除已分配的任务

## 六、关键点总结

### 6.1 前置条件
- **只需要**：机加阶段已派工（`machining_assignee` 不为空）
- **不需要**：机加阶段完成（`machining_phase === 1`）

### 6.2 筛选逻辑
- 机加阶段已派工（`machining_assignee` 不为空）**或** 机加阶段已完成（`machining_phase === 1`）
- 组装前段未分配（`pre_assembly_assignee` 为空）
- 组装前段未完成（`pre_assembly_phase === 0`）

### 6.3 派工流程
1. 筛选条件选择"组装前段"
2. 从待派工任务拖拽到员工
3. 系统自动分配组装前段（不弹出选择对话框）
4. 后端检查前置条件
5. 更新数据库
6. 验证更新成功
7. 刷新前端数据

### 6.4 错误处理
- 如果前置条件不满足，返回详细错误信息
- 如果数据库更新失败，返回错误信息
- 前端显示错误提示，不显示"任务分配成功"

## 七、调试信息

### 7.1 服务器端日志
- 检查前置条件时的任务状态
- `canStartPhase` 函数的检查过程
- 分配失败时的详细错误信息

### 7.2 客户端日志
- 分配任务的详细信息（任务ID、员工ID、阶段）
- 错误信息的完整内容

## 八、常见问题

### 8.1 为什么无法分配？
可能的原因：
1. 机加阶段未派工（`machining_assignee` 为空）
2. 组装前段已分配（`pre_assembly_assignee` 不为空）
3. 组装前段已完成（`pre_assembly_phase === 1`）

### 8.2 如何查看详细信息？
- 查看服务器控制台的调试日志
- 查看浏览器控制台的错误信息
- 错误信息会显示 `machining_assignee` 的值和类型












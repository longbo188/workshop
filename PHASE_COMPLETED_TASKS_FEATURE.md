# 各阶段已完成任务显示功能

## 功能概述
修改已完成任务列表，使其不仅显示整个任务完成的任务，还显示工人完成过任何阶段的任务，让工人能够查看自己参与过的所有任务。

## 实现的功能

### 1. 后端API逻辑修改
修改 `/api/tasks/user/:userId/completed` API，使其包含：
- **整个任务已完成的任务**：`status = 'completed'`
- **各阶段已完成的任务**：通过 `work_reports` 表查找用户完成过任何阶段的任务

### 2. 前端显示优化
- **阶段进度显示**：在已完成任务中显示各阶段的完成状态
- **完成状态信息**：显示任务完成状态和阶段完成数量
- **时间信息**：显示任务完成时间或最后阶段完成时间
- **审批状态**：显示最后提交的审批状态

## 技术实现

### 后端修改 (`backend/server.js`)

#### 1. 新字段查询逻辑
```sql
SELECT DISTINCT t.*, 
       wr.approval_status as latest_completion_status, 
       wr.created_at as latest_completion_created_at,
       u1.name as assigned_user_name,
       u2.name as current_phase_assignee_name
FROM tasks t
LEFT JOIN users u1 ON t.assigned_to = u1.id
LEFT JOIN users u2 ON t.current_phase_assignee = u2.id
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
WHERE (t.assigned_to = ? OR t.current_phase_assignee = ?) 
AND (
  t.status = 'completed' 
  OR EXISTS (
    SELECT 1 FROM work_reports wr2 
    WHERE wr2.task_id = t.id 
    AND wr2.user_id = ? 
    AND wr2.work_type = 'complete'
  )
)
ORDER BY COALESCE(t.end_time, wr.created_at) DESC
```

#### 2. 关键改进
- **DISTINCT**：避免重复记录
- **EXISTS子查询**：查找用户完成过任何阶段的任务
- **COALESCE排序**：优先按任务完成时间排序，其次按最后阶段完成时间排序

### 前端修改

#### 1. HTML模板更新 (`home.page.html`)
```html
<!-- 已完成任务显示完成时间 -->
<p *ngIf="taskViewMode === 'completed' && task.end_time">
  <strong>任务完成时间：</strong>{{ task.end_time | date:'yyyy-MM-dd HH:mm' }}
</p>

<!-- 已完成任务显示最后阶段完成时间 -->
<p *ngIf="taskViewMode === 'completed' && task.latest_completion_created_at && !task.end_time">
  <strong>最后完成时间：</strong>{{ task.latest_completion_created_at | date:'yyyy-MM-dd HH:mm' }}
</p>

<!-- 阶段进度显示 -->
<div class="phase-progress-mini" *ngIf="task.current_phase || taskViewMode === 'completed'">
  <div class="phase-progress-title">生产阶段：</div>
  <div class="phase-steps">
    <span class="phase-step" 
          [class.completed]="task.machining_phase === 1"
          [class.current]="task.current_phase === 'machining'">机加</span>
    <!-- 其他阶段... -->
  </div>
</div>

<!-- 已完成任务显示阶段完成状态 -->
<div *ngIf="taskViewMode === 'completed'" class="completion-status">
  <p *ngIf="task.status === 'completed'"><strong>任务状态：</strong>全部完成</p>
  <p *ngIf="task.status !== 'completed' && getCompletedPhasesCount(task) > 0">
    <strong>完成阶段：</strong>{{ getCompletedPhasesCount(task) }}/5 个阶段
  </p>
  <p *ngIf="task.latest_completion_status === 'pending'"><strong>审批状态：</strong>待审批</p>
  <p *ngIf="task.latest_completion_status === 'approved'"><strong>审批状态：</strong>已审批</p>
  <p *ngIf="task.latest_completion_status === 'rejected'"><strong>审批状态：</strong>已驳回</p>
</div>
```

#### 2. TypeScript方法 (`home.page.ts`)
```typescript
// 获取已完成阶段数量
getCompletedPhasesCount(task: any): number {
  let count = 0;
  if (task.machining_phase === 1) count++;
  if (task.electrical_phase === 1) count++;
  if (task.pre_assembly_phase === 1) count++;
  if (task.post_assembly_phase === 1) count++;
  if (task.debugging_phase === 1) count++;
  return count;
}
```

#### 3. CSS样式 (`home.page.scss`)
```scss
// 已完成任务状态样式
.completion-status {
  margin-top: 8px;
  padding: 8px;
  background-color: #f8f9fa;
  border-radius: 6px;
  border-left: 3px solid #28a745;
  
  p {
    margin: 4px 0;
    font-size: 0.9em;
    color: #495057;
    
    strong {
      color: #212529;
    }
  }
}
```

## 功能特性

### 1. 全面的任务显示
- **整个任务完成**：显示 `status = 'completed'` 的任务
- **阶段任务完成**：显示用户完成过任何阶段的任务
- **去重处理**：使用 `DISTINCT` 避免重复显示

### 2. 详细的状态信息
- **任务状态**：全部完成 vs 部分完成
- **阶段进度**：显示已完成的阶段数量（如：3/5 个阶段）
- **审批状态**：待审批、已审批、已驳回
- **时间信息**：任务完成时间或最后阶段完成时间

### 3. 视觉优化
- **阶段进度条**：显示各阶段的完成状态
- **状态卡片**：用不同颜色和样式区分不同状态
- **信息层次**：清晰的信息组织和显示

## 使用场景

### 工人查看已完成任务
1. **全面了解**：查看自己参与过的所有任务
2. **进度跟踪**：了解各任务的完成进度
3. **审批状态**：查看提交的报工审批状态
4. **历史记录**：查看完成时间和阶段信息

### 任务管理
1. **工作量统计**：了解工人的工作贡献
2. **进度监控**：跟踪各任务的阶段完成情况
3. **质量控制**：查看审批状态和质量记录

## 测试结果

### API测试
```json
[
  {
    "id": 893,
    "name": "M1S321688 - V5300DP",
    "status": "completed",
    "machining_phase": 1,
    "electrical_phase": 1,
    "pre_assembly_phase": 1,
    "post_assembly_phase": 1,
    "debugging_phase": 1,
    "latest_completion_status": "pending",
    "latest_completion_created_at": "2025-10-20T05:34:58.000Z"
  }
]
```

### 预期效果
- ✅ 显示整个任务完成的任务
- ✅ 显示各阶段已完成的任务
- ✅ 显示阶段完成进度
- ✅ 显示审批状态
- ✅ 显示完成时间信息

## 总结
通过修改后端API逻辑和前端显示，现在已完成任务列表能够显示工人参与过的所有任务，包括整个任务完成和各阶段完成的任务。这提供了更全面的任务历史记录和进度跟踪功能。










































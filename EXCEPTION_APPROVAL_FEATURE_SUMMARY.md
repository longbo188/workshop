# 异常审批功能实现总结

## 功能概述

为工人操作界面增加了异常审批功能，当出现影响生产进度的异常情况时，工人可以向主管或管理员上报审批。

## 异常类型

系统支持以下4种异常类型：
1. **缺料** - 生产所需材料不足
2. **来料不良** - 采购的原材料质量有问题
3. **改造类（研发售后或生产不良）** - 需要技术改造或修复
4. **临时安排任务** - 临时增加的生产任务

## 影响程度

异常报告支持4个影响程度等级：
- **低** - 影响较小
- **中** - 中等影响（默认）
- **高** - 影响较大
- **紧急** - 紧急情况，需要优先处理

## 功能实现

### 1. 数据库设计

创建了 `exception_reports` 表，包含以下字段：
- `id` - 主键
- `task_id` - 关联的任务ID
- `user_id` - 上报用户ID
- `exception_type` - 异常类型（ENUM）
- `title` - 异常标题
- `description` - 异常描述
- `impact_level` - 影响程度（ENUM）
- `status` - 状态（pending/approved/rejected/processing/resolved）
- `submitted_at` - 提交时间
- `approved_by` - 审批人ID
- `approved_at` - 审批时间
- `approval_note` - 审批备注
- `resolved_at` - 解决时间
- `resolution_note` - 解决方案

### 2. 后端API接口

#### 异常报告管理
- `POST /api/exception-reports` - 提交异常报告
- `GET /api/exception-reports/user/:userId` - 获取用户的异常报告列表
- `GET /api/exception-reports/pending` - 获取待审批的异常报告（主管/管理员）

#### 审批管理
- `POST /api/exception-reports/:reportId/approve` - 审批异常报告（批准/驳回）
- `POST /api/exception-reports/:reportId/processing` - 标记为处理中
- `POST /api/exception-reports/:reportId/resolve` - 标记为已解决
- `GET /api/exception-reports/stats` - 获取异常报告统计信息

### 3. 前端界面

#### 工人界面（home.page）
- 在任务操作区域添加"异常上报"按钮
- 异常上报模态框，包含：
  - 异常类型选择
  - 影响程度选择
  - 异常标题输入
  - 异常描述输入
- 权限控制：只有分配给该用户的任务才能上报异常

#### 主管界面（exception-approval.page）
- 新增异常审批页面，包含：
  - 待审批异常报告列表
  - 按影响程度排序显示
  - 批准/驳回操作
  - 处理中/已解决状态管理
- 审批模态框，包含：
  - 异常详情显示
  - 审批备注输入
- 解决模态框，包含：
  - 解决方案输入

### 4. 权限控制

- **工人**：只能为分配给自己的任务提交异常报告
- **主管/管理员**：可以查看和审批所有异常报告
- 支持新老数据库结构的兼容性处理

## 工作流程

1. **异常发现**：工人在生产过程中发现异常情况
2. **异常上报**：工人通过界面提交异常报告，选择类型和影响程度
3. **报告审核**：主管/管理员查看待审批的异常报告
4. **审批决定**：主管/管理员批准或驳回异常报告
5. **问题处理**：批准的异常报告进入处理阶段
6. **问题解决**：处理完成后标记为已解决

## 状态流转

```
pending（待审批） → approved（已批准） → processing（处理中） → resolved（已解决）
                ↘ rejected（已驳回）
```

## 测试验证

- ✅ 异常报告提交功能正常
- ✅ 权限控制有效
- ✅ 审批流程完整
- ✅ 状态更新正确
- ✅ 界面交互流畅

## 技术特点

1. **响应式设计**：支持移动端和桌面端
2. **实时更新**：支持下拉刷新获取最新数据
3. **错误处理**：完善的错误提示和异常处理
4. **数据验证**：前端和后端双重数据验证
5. **兼容性**：支持新老数据库结构

## 使用说明

### 工人使用
1. 在任务列表中点击"异常上报"按钮
2. 选择异常类型和影响程度
3. 填写异常标题和详细描述
4. 提交异常报告

### 主管使用
1. 点击主页面的"异常审批"按钮
2. 查看待审批的异常报告列表
3. 点击"批准"或"驳回"进行审批
4. 对已批准的报告进行后续处理

## 文件清单

### 数据库
- `exception_reports` 表

### 后端
- `backend/server.js` - 异常审批API接口

### 前端
- `src/app/pages/home/home.page.html` - 工人界面异常上报按钮和模态框
- `src/app/pages/home/home.page.ts` - 异常上报逻辑
- `src/app/pages/exception-approval/exception-approval.page.ts` - 异常审批页面逻辑
- `src/app/pages/exception-approval/exception-approval.page.html` - 异常审批页面界面
- `src/app/pages/exception-approval/exception-approval.page.scss` - 异常审批页面样式
- `src/app/app.routes.ts` - 路由配置

## 总结

异常审批功能已完全实现并测试通过，为生产管理提供了完整的异常处理流程，提高了生产效率和问题响应速度。










































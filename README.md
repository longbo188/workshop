# 车间报工系统

一个基于 Ionic + Angular + Node.js + MySQL 的车间生产任务管理系统。

## 🚀 功能特性

### 用户管理
- ✅ 用户登录认证
- ✅ 角色权限管理（管理员、主管、工人）
- ✅ 用户信息显示

### 任务管理
- ✅ 任务列表展示
- ✅ 任务状态管理（待处理、进行中、已完成、已取消）
- ✅ 任务优先级（低、中、高、紧急）
- ✅ 任务分配和跟踪

### 报工功能
- ✅ 开始报工
- ✅ 完成报工
- ✅ 报工记录
- ✅ 质量备注
- ✅ 问题记录

## 🛠️ 技术栈

### 前端
- **Ionic 8** - 移动端UI框架
- **Angular 20** - 前端框架
- **TypeScript** - 类型安全
- **SCSS** - 样式预处理器

### 后端
- **Node.js** - 运行时环境
- **Express.js** - Web框架
- **MySQL** - 数据库
- **CORS** - 跨域支持

## 📦 安装和运行

### 1. 安装依赖
```bash
npm install
```

### 2. 数据库设置
1. 启动MySQL服务（推荐使用XAMPP）
2. 导入数据库结构：
```bash
mysql -u root -p < database_setup.sql
```

### 3. 启动后端服务
```bash
node backend/server.js
```

### 4. 启动前端服务
```bash
npm start
# 或
ionic serve
```

## 🔑 测试账号

| 用户名 | 密码 | 角色 | 部门 |
|--------|------|------|------|
| admin | admin123 | 管理员 | IT部门 |
| supervisor1 | super123 | 主管 | 生产部 |
| worker1 | worker123 | 工人 | 组装车间 |
| worker2 | worker123 | 工人 | 质检车间 |
| worker3 | worker123 | 工人 | 包装车间 |

## 📱 使用流程

1. **登录系统** - 使用测试账号登录
2. **查看任务** - 在首页查看分配的任务
3. **开始报工** - 点击"开始报工"按钮
4. **完成报工** - 填写完成数量、质量备注等信息
5. **查看记录** - 系统自动记录报工历史

## 🗂️ 项目结构

```
work-app/
├── src/
│   ├── app/
│   │   ├── pages/
│   │   │   ├── login/          # 登录页面
│   │   │   ├── home/           # 首页
│   │   │   └── work-detail/    # 报工详情页
│   │   ├── task-list/          # 任务列表页
│   │   └── app.routes.ts       # 路由配置
│   └── theme/                  # 主题样式
├── backend/
│   └── server.js               # 后端服务
├── database_setup.sql          # 数据库结构
└── package.json
```

## 🔧 API接口

### 认证接口
- `POST /api/login` - 用户登录

### 任务接口
- `GET /api/tasks` - 获取所有任务（管理员）
- `GET /api/tasks/user/:userId` - 获取用户任务

### 报工接口
- `POST /api/work/start` - 开始报工
- `POST /api/work/complete` - 完成报工
- `GET /api/work-reports/:userId` - 获取报工记录

## 🎯 系统特点

- **响应式设计** - 支持手机、平板、桌面设备
- **实时更新** - 任务状态实时同步
- **用户友好** - 简洁直观的操作界面
- **数据安全** - 完整的用户认证和权限控制
- **可扩展** - 模块化设计，易于扩展新功能

## 📈 后续开发计划

- [ ] 任务创建和编辑功能
- [ ] 报表统计功能
- [ ] 消息通知系统
- [ ] 移动端APP打包
- [ ] 数据导出功能

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个项目！

## 📄 许可证

MIT License




















































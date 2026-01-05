// 添加任务池状态字段的数据库迁移脚本
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'work_app',
  charset: 'utf8mb4'
};

async function migrateAddTaskPoolStatus() {
  const conn = await mysql.createConnection(dbConfig);
  
  try {
    console.log('开始添加任务池状态字段...');
    
    // 添加任务池状态字段
    try {
      await conn.execute("ALTER TABLE tasks ADD COLUMN task_pool_status ENUM('assigned', 'in_pool', 'completed') DEFAULT 'assigned' AFTER status");
      console.log('已添加 task_pool_status 字段');
    } catch (e) {
      console.log('task_pool_status 字段已存在或添加失败:', e.code || e.message);
    }
    
    // 添加当前阶段负责人字段
    try {
      await conn.execute("ALTER TABLE tasks ADD COLUMN current_phase_assignee INT NULL AFTER current_phase");
      console.log('已添加 current_phase_assignee 字段');
    } catch (e) {
      console.log('current_phase_assignee 字段已存在或添加失败:', e.code || e.message);
    }
    
    // 添加阶段完成时间戳字段
    try {
      await conn.execute("ALTER TABLE tasks ADD COLUMN last_phase_completed_at DATETIME NULL AFTER current_phase_assignee");
      console.log('已添加 last_phase_completed_at 字段');
    } catch (e) {
      console.log('last_phase_completed_at 字段已存在或添加失败:', e.code || e.message);
    }
    
    console.log('任务池状态字段添加完成！');
    
  } catch (error) {
    console.error('迁移失败:', error);
  } finally {
    await conn.end();
  }
}

migrateAddTaskPoolStatus();









































// 简化的数据库字段添加脚本
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'work_app',
  charset: 'utf8mb4'
};

async function addMissingFields() {
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
    console.log('连接数据库成功');
    
    // 检查并添加字段
    const fields = [
      {
        name: 'task_pool_status',
        sql: "ALTER TABLE tasks ADD COLUMN task_pool_status ENUM('assigned', 'in_pool', 'completed') DEFAULT 'assigned' AFTER status"
      },
      {
        name: 'current_phase_assignee',
        sql: "ALTER TABLE tasks ADD COLUMN current_phase_assignee INT NULL AFTER current_phase"
      },
      {
        name: 'last_phase_completed_at',
        sql: "ALTER TABLE tasks ADD COLUMN last_phase_completed_at DATETIME NULL AFTER current_phase_assignee"
      }
    ];
    
    for (const field of fields) {
      try {
        await conn.execute(field.sql);
        console.log(`✅ 成功添加字段: ${field.name}`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`⚠️  字段已存在: ${field.name}`);
        } else {
          console.log(`❌ 添加字段失败 ${field.name}:`, error.message);
        }
      }
    }
    
    console.log('数据库字段检查完成');
    
  } catch (error) {
    console.error('数据库操作失败:', error.message);
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

addMissingFields();







































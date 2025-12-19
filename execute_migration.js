const mysql = require('mysql2/promise');
const fs = require('fs');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function executeMigration() {
  let connection;
  try {
    console.log('开始执行数据库迁移...');
    connection = await mysql.createConnection(dbConfig);
    
    // 读取SQL文件
    const sql = fs.readFileSync('remove_assigned_to_field.sql', 'utf8');
    
    // 分割SQL语句并执行
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('执行SQL:', statement.trim());
        try {
          await connection.execute(statement);
          console.log('✓ 执行成功');
        } catch (error) {
          if (error.message.includes('check that it exists') || 
              error.message.includes('doesn\'t exist') ||
              error.message.includes('Unknown column')) {
            console.log('⚠ 跳过（字段或约束不存在）:', error.message);
          } else {
            throw error;
          }
        }
      }
    }
    
    console.log('数据库迁移完成！');
    
  } catch (error) {
    console.error('迁移失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

executeMigration();

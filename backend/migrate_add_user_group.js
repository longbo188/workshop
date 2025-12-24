const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function addUserGroupField() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    // 检查字段是否存在
    const [columns] = await connection.execute(`SHOW COLUMNS FROM users LIKE 'user_group'`);
    
    if (columns.length === 0) {
      // 添加user_group字段
      await connection.execute(`ALTER TABLE users ADD COLUMN user_group VARCHAR(100) DEFAULT NULL`);
      console.log('✓ 已添加字段: user_group');
    } else {
      console.log('- 字段 user_group 已存在，跳过');
    }
    
    console.log('用户组字段迁移完成');
  } catch (error) {
    console.error('✗ 迁移失败:', error);
  } finally {
    await connection.end();
  }
}

addUserGroupField();

































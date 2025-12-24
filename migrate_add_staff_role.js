const mysql = require('mysql2/promise');

// 数据库配置（与 backend/server.js 保持一致）
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function migrate() {
  let connection;
  try {
    console.log('开始执行迁移：添加 staff 角色...');
    
    connection = await mysql.createConnection(dbConfig);
    
    // 1. 修改users表的role字段，添加staff角色
    console.log('正在修改 users 表的 role 字段...');
    await connection.execute(`
      ALTER TABLE users MODIFY COLUMN role ENUM('worker', 'supervisor', 'admin', 'manager', 'staff') DEFAULT 'worker'
    `);
    console.log('✓ users 表的 role 字段已更新');
    
    // 2. 验证：查询所有角色类型
    console.log('\n验证：查询所有角色类型...');
    const [roles] = await connection.execute(`
      SELECT DISTINCT role FROM users
    `);
    console.log('当前数据库中的角色类型：');
    roles.forEach(row => {
      console.log(`  - ${row.role}`);
    });
    
    await connection.end();
    console.log('\n✓ 迁移完成！');
    
  } catch (error) {
    if (connection) {
      await connection.end();
    }
    console.error('✗ 迁移失败：', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('提示：字段可能已存在，这通常不是问题');
    } else {
      process.exit(1);
    }
  }
}

migrate();









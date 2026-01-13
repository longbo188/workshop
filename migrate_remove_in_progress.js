const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function runMigration() {
  let connection;
  try {
    console.log('连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('开始执行数据库迁移（移除in_progress状态）...');

    // 1. 将所有in_progress状态的任务改为pending
    console.log('1. 更新in_progress状态的任务...');
    const [updateResult] = await connection.execute(
      "UPDATE tasks SET status = 'pending' WHERE status = 'in_progress'"
    );
    console.log(`更新了 ${updateResult.affectedRows} 个任务的状态`);

    // 2. 修改status字段的ENUM定义
    console.log('2. 修改status字段的ENUM定义...');
    await connection.execute(
      "ALTER TABLE tasks MODIFY COLUMN status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending'"
    );
    console.log('status字段已更新');

    // 3. 验证修改结果
    console.log('3. 验证修改结果...');
    const [statusCounts] = await connection.execute(
      'SELECT status, COUNT(*) as count FROM tasks GROUP BY status'
    );
    console.log('当前任务状态分布:');
    statusCounts.forEach((row: any) => {
      console.log(`  ${row.status}: ${row.count} 个任务`);
    });

    console.log('\n数据库迁移完成！');

    // 验证表结构
    const [rows] = await connection.execute('DESCRIBE tasks');
    console.log('\n更新后的tasks表结构:');
    const statusField = rows.find((row: any) => row.Field === 'status');
    if (statusField) {
      console.log(`status字段: ${statusField.Type} - ${statusField.Null} - ${statusField.Key} - ${statusField.Default}`);
    }

  } catch (error: any) {
    console.error('数据库迁移失败：', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

runMigration();













































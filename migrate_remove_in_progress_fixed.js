const mysql = require('mysql2/promise');

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

    // 1. 首先检查当前状态分布
    console.log('1. 检查当前任务状态分布...');
    const [statusCounts] = await connection.execute(
      'SELECT status, COUNT(*) as count FROM tasks GROUP BY status'
    );
    console.log('当前任务状态分布:');
    statusCounts.forEach((row) => {
      console.log(`  ${row.status}: ${row.count} 个任务`);
    });

    // 2. 检查work_reports表中的数据
    console.log('\n2. 检查work_reports表中的数据...');
    const [workReports] = await connection.execute(
      'SELECT COUNT(*) as count FROM work_reports'
    );
    console.log(`work_reports表中有 ${workReports[0].count} 条记录`);

    // 3. 临时禁用外键检查
    console.log('\n3. 临时禁用外键检查...');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    // 4. 将所有in_progress状态的任务改为pending
    console.log('4. 更新in_progress状态的任务...');
    const [updateResult] = await connection.execute(
      "UPDATE tasks SET status = 'pending' WHERE status = 'in_progress'"
    );
    console.log(`更新了 ${updateResult.affectedRows} 个任务的状态`);

    // 5. 修改status字段的ENUM定义
    console.log('5. 修改status字段的ENUM定义...');
    await connection.execute(
      "ALTER TABLE tasks MODIFY COLUMN status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending'"
    );
    console.log('status字段已更新');

    // 6. 重新启用外键检查
    console.log('6. 重新启用外键检查...');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    // 7. 验证修改结果
    console.log('\n7. 验证修改结果...');
    const [newStatusCounts] = await connection.execute(
      'SELECT status, COUNT(*) as count FROM tasks GROUP BY status'
    );
    console.log('更新后任务状态分布:');
    newStatusCounts.forEach((row) => {
      console.log(`  ${row.status}: ${row.count} 个任务`);
    });

    // 8. 验证表结构
    console.log('\n8. 验证表结构...');
    const [rows] = await connection.execute('DESCRIBE tasks');
    const statusField = rows.find((row) => row.Field === 'status');
    if (statusField) {
      console.log(`status字段: ${statusField.Type} - ${statusField.Null} - ${statusField.Key} - ${statusField.Default}`);
    }

    // 9. 检查外键约束是否正常
    console.log('\n9. 检查外键约束...');
    const [constraints] = await connection.execute(`
      SELECT 
        CONSTRAINT_NAME,
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE REFERENCED_TABLE_NAME = 'tasks' 
      AND TABLE_SCHEMA = 'workshop_db'
    `);
    
    if (constraints.length > 0) {
      console.log('外键约束状态:');
      constraints.forEach((constraint) => {
        console.log(`  ${constraint.TABLE_NAME}.${constraint.COLUMN_NAME} -> ${constraint.REFERENCED_TABLE_NAME}.${constraint.REFERENCED_COLUMN_NAME}`);
      });
    } else {
      console.log('没有找到相关的外键约束');
    }

    console.log('\n✅ 数据库迁移完成！');

  } catch (error) {
    console.error('❌ 数据库迁移失败：', error.message);
    console.error('错误详情:', error);
  } finally {
    if (connection) {
      // 确保重新启用外键检查
      try {
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
      } catch (e) {
        console.log('重新启用外键检查时出现警告:', e.message);
      }
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

runMigration();

// 数据库迁移脚本：添加阶段暂停时间字段
const mysql = require('mysql2/promise');

// 数据库配置（与backend/server.js保持一致）
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '', // XAMPP MySQL 默认密码（如果没改就是空字符串）
  database: 'workshop_db'
};

async function migrate() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！');

    // 检查字段是否已存在
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'workshop_db' 
        AND TABLE_NAME = 'tasks' 
        AND COLUMN_NAME IN ('machining_paused_at', 'electrical_paused_at', 'pre_assembly_paused_at', 'post_assembly_paused_at', 'debugging_paused_at')
    `);

    const existingColumns = columns.map(col => col.COLUMN_NAME);
    const columnsToAdd = [
      { name: 'machining_paused_at', after: 'machining_complete_time' },
      { name: 'electrical_paused_at', after: 'electrical_complete_time' },
      { name: 'pre_assembly_paused_at', after: 'pre_assembly_complete_time' },
      { name: 'post_assembly_paused_at', after: 'post_assembly_complete_time' },
      { name: 'debugging_paused_at', after: 'debugging_complete_time' }
    ];

    let addedCount = 0;
    for (const col of columnsToAdd) {
      if (!existingColumns.includes(col.name)) {
        console.log(`\n添加字段 ${col.name}...`);
        await connection.execute(`
          ALTER TABLE tasks 
          ADD COLUMN ${col.name} DATETIME NULL AFTER ${col.after}
        `);
        console.log(`✅ 字段 ${col.name} 添加成功！`);
        addedCount++;
      } else {
        console.log(`⚠️  字段 ${col.name} 已存在，跳过`);
      }
    }

    if (addedCount === 0) {
      console.log('\n✅ 所有字段已存在，无需添加');
    } else {
      console.log(`\n✅ 成功添加 ${addedCount} 个字段`);
    }

    // 验证结果
    console.log('\n验证结果：');
    const [verifyColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'workshop_db' 
        AND TABLE_NAME = 'tasks' 
        AND COLUMN_NAME LIKE '%_paused_at'
      ORDER BY COLUMN_NAME
    `);

    if (verifyColumns.length > 0) {
      console.log('暂停时间字段：');
      verifyColumns.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? '可空' : '不可空'})`);
      });
    }

    console.log('\n🎉 迁移完成！');

  } catch (error) {
    console.error('\n❌ 迁移失败！');
    console.error('错误信息:', error.message);
    console.error('详细错误:', error);
    
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n提示：数据库不存在，请先创建数据库 workshop_db');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n提示：数据库访问被拒绝，请检查用户名和密码');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n提示：无法连接到数据库，请确保MySQL服务正在运行');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭。');
    }
  }
}

// 执行迁移
console.log('========================================');
console.log('数据库迁移：添加阶段暂停时间字段');
console.log('========================================\n');
migrate();













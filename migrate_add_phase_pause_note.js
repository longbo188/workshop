// 数据库迁移脚本：添加阶段暂停备注字段
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
        AND COLUMN_NAME IN ('machining_pause_note', 'electrical_pause_note', 'pre_assembly_pause_note', 'post_assembly_pause_note', 'debugging_pause_note')
    `);

    const existingColumns = columns.map(col => col.COLUMN_NAME);
    const columnsToAdd = [
      { name: 'machining_pause_note', after: 'machining_paused_at' },
      { name: 'electrical_pause_note', after: 'electrical_paused_at' },
      { name: 'pre_assembly_pause_note', after: 'pre_assembly_paused_at' },
      { name: 'post_assembly_pause_note', after: 'post_assembly_paused_at' },
      { name: 'debugging_pause_note', after: 'debugging_paused_at' }
    ];

    let addedCount = 0;
    for (const col of columnsToAdd) {
      if (!existingColumns.includes(col.name)) {
        console.log(`\n添加字段 ${col.name}...`);
        await connection.execute(`
          ALTER TABLE tasks 
          ADD COLUMN ${col.name} TEXT NULL AFTER ${col.after}
        `);
        console.log(`✅ 字段 ${col.name} 添加成功！`);
        addedCount++;
      } else {
        console.log(`⚠️  字段 ${col.name} 已存在，跳过`);
      }
    }

    if (addedCount === 0) {
      console.log('\n所有字段已存在，无需添加。');
    } else {
      console.log(`\n✅ 成功添加 ${addedCount} 个字段！`);
    }

    // 验证字段
    console.log('\n验证字段...');
    const [verifyColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'workshop_db' 
        AND TABLE_NAME = 'tasks' 
        AND COLUMN_NAME LIKE '%_pause_note'
      ORDER BY COLUMN_NAME
    `);

    console.log('\n暂停备注字段列表：');
    verifyColumns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? '可空' : '非空'})`);
    });

    console.log('\n✅ 迁移完成！');

  } catch (error) {
    console.error('❌ 迁移失败：', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭。');
    }
  }
}

// 执行迁移
migrate()
  .then(() => {
    console.log('\n🎉 所有操作完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 发生错误：', error);
    process.exit(1);
  });













// 数据库迁移脚本：添加 is_non_standard 字段到 tasks 表
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function migrate() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    console.log('\n添加 is_non_standard 字段到 tasks 表...');
    try {
      await connection.execute(`
        ALTER TABLE tasks 
        ADD COLUMN is_non_standard TINYINT(1) DEFAULT 0 
        COMMENT '是否非标：0=否，1=是'
      `);
      console.log('✅ is_non_standard 字段已添加');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  is_non_standard 字段已存在，跳过添加');
      } else {
        throw error;
      }
    }

    // 验证字段
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'workshop_db' 
      AND TABLE_NAME = 'tasks' 
      AND COLUMN_NAME = 'is_non_standard'
    `);

    if (columns.length > 0) {
      console.log('\n✅ 字段验证成功：');
      console.log(`  字段名: ${columns[0].COLUMN_NAME}`);
      console.log(`  类型: ${columns[0].COLUMN_TYPE}`);
      console.log(`  默认值: ${columns[0].COLUMN_DEFAULT}`);
      console.log(`  注释: ${columns[0].COLUMN_COMMENT || '无'}`);
    } else {
      console.log('⚠️  警告：未找到 is_non_standard 字段');
    }

    console.log('\n🎉 迁移完成');
  } catch (error) {
    console.error('❌ 迁移失败：', error.message || error);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

migrate();










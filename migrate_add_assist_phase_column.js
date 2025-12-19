const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'workshop_db',
  multipleStatements: true
};

async function migrate() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');

    const [columns] = await connection.execute(`
      SHOW COLUMNS FROM work_reports LIKE 'assist_phase'
    `);

    if (columns.length === 0) {
      console.log('正在为 work_reports 表添加 assist_phase 字段...');
      await connection.execute(`
        ALTER TABLE work_reports 
        ADD COLUMN assist_phase VARCHAR(50) DEFAULT NULL AFTER work_type
      `);
      console.log('assist_phase 字段已添加');
    } else {
      console.log('assist_phase 字段已存在，跳过添加');
    }

    console.log('迁移完成！');
  } catch (error) {
    console.error('迁移失败:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrate()
  .then(() => {
    console.log('迁移脚本执行成功');
    process.exit(0);
  })
  .catch((error) => {
    console.error('迁移脚本执行失败:', error);
    process.exit(1);
  });







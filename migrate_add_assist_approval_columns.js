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

    const [approvedByColumn] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'work_reports'
        AND COLUMN_NAME = 'approved_by'
    `);

    if (approvedByColumn.length === 0) {
      console.log('正在为 work_reports 添加 approved_by/approved_at 字段...');
      await connection.execute(`
        ALTER TABLE work_reports
        ADD COLUMN approved_by INT NULL AFTER approval_status,
        ADD COLUMN approved_at DATETIME NULL AFTER approved_by
      `);
      console.log('字段添加完成');
    } else {
      console.log('approved_by 字段已存在，跳过');
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







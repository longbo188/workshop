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

    // 修改 work_reports 表的 work_type 枚举，添加 'assist'
    console.log('正在修改 work_reports 表的 work_type 枚举...');
    await connection.execute(`
      ALTER TABLE work_reports 
      MODIFY COLUMN work_type ENUM('start', 'pause', 'resume', 'complete', 'quality_check', 'assist') NOT NULL
    `);
    console.log('work_reports 表的 work_type 枚举已更新，已添加 "assist" 类型');

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


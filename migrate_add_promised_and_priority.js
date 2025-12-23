const mysql = require('mysql2/promise');

const dbConfig = { host: 'localhost', user: 'root', password: '', database: 'workshop_db' };

async function run() {
  let conn;
  try {
    console.log('连接数据库...');
    conn = await mysql.createConnection(dbConfig);
    console.log('添加 promised_completion_time 字段...');
    try { await conn.execute("ALTER TABLE tasks ADD COLUMN promised_completion_time DATETIME AFTER production_time"); console.log('已添加 promised_completion_time'); } catch(e) { console.log('promised_completion_time 已存在或失败:', e.code || e.message); }
    console.log('完成。');
  } catch (e) {
    console.error('迁移失败:', e.message);
  } finally {
    if (conn) { await conn.end(); console.log('数据库连接已关闭'); }
  }
}

run();










































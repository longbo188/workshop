const mysql = require('mysql2/promise');

async function run() {
  const dbConfig = { host: 'localhost', user: 'root', password: '', database: 'workshop_db', charset: 'utf8mb4' };
  const conn = await mysql.createConnection(dbConfig);
  try {
    const drop = async (sql) => {
      try { await conn.execute(sql); console.log('OK:', sql); } catch (e) { console.log('SKIP:', e.code || e.message); }
    };
    await drop("ALTER TABLE tasks DROP COLUMN task_pool_status");
    await drop("ALTER TABLE tasks DROP COLUMN current_phase_assignee");
    await drop("ALTER TABLE tasks DROP COLUMN last_phase_completed_at");
    console.log('DB rollback done');
  } finally {
    await conn.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
































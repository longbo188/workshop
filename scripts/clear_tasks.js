const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'workshop_db', charset: 'utf8mb4'
  });
  try {
    console.log('开始清空 tasks 及关联表...');
    await conn.execute('SET FOREIGN_KEY_CHECKS=0');

    const tables = [
      'work_reports',
      'task_time_logs',
      'exception_reports'
    ];

    for (const t of tables) {
      try {
        const [r] = await conn.execute(`SELECT COUNT(*) as c FROM ${t}`);
        console.log(`${t} 当前行数:`, r[0].c);
        await conn.execute(`TRUNCATE TABLE ${t}`);
        console.log(`已清空 ${t}`);
      } catch (e) {
        console.log(`跳过 ${t}:`, e.code || e.message);
      }
    }

    // 清空 tasks
    const [rt] = await conn.execute('SELECT COUNT(*) as c FROM tasks');
    console.log('tasks 当前行数:', rt[0].c);
    await conn.execute('TRUNCATE TABLE tasks');
    console.log('已清空 tasks');

    await conn.execute('SET FOREIGN_KEY_CHECKS=1');
    console.log('完成');
  } catch (e) {
    console.error('执行失败:', e.message);
  } finally {
    await conn.end();
  }
})();






























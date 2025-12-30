const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'workshop_db',
  charset: 'utf8mb4'
};

async function testSQL() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // 直接查询daily_attendance表
    console.log('=== 直接查询daily_attendance表 ===');
    const [directRows] = await connection.execute(
      'SELECT * FROM daily_attendance WHERE user_id = ? AND date = ?',
      [3, '2025-10-22']
    );
    console.log('直接查询结果数量:', directRows.length);
    if (directRows.length > 0) {
      console.log('直接查询结果:', directRows[0]);
    }
    
    // 测试用户表
    console.log('\n=== 查询用户表 ===');
    const [userRows] = await connection.execute(
      'SELECT * FROM users WHERE id = ? AND role = "worker"',
      [3]
    );
    console.log('用户查询结果数量:', userRows.length);
    if (userRows.length > 0) {
      console.log('用户查询结果:', userRows[0]);
    }
    
    // 测试简化的CTE查询
    console.log('\n=== 测试简化的CTE查询 ===');
    const [cteRows] = await connection.execute(`
      WITH RECURSIVE dates(d) AS (
        SELECT ?
        UNION ALL
        SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM dates WHERE d < ?
      )
      SELECT 
        da.id,
        u.id as user_id,
        u.name as user_name,
        dates.d as date,
        da.is_confirmed,
        da.actual_hours
      FROM dates
      JOIN users u ON u.role = "worker" AND u.id = ?
      LEFT JOIN daily_attendance da ON da.user_id = u.id AND da.date = dates.d
      ORDER BY dates.d DESC, u.name ASC
    `, ['2025-10-22', '2025-10-22', 3]);
    
    console.log('CTE查询结果数量:', cteRows.length);
    if (cteRows.length > 0) {
      console.log('CTE查询结果:', cteRows[0]);
    }
    
    await connection.end();
    
  } catch (error) {
    console.error('错误:', error.message);
  }
}

testSQL();




































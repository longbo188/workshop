const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'workshop_db',
  charset: 'utf8mb4'
};

async function debugDailyAttendance() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // 测试参数
    const startDate = '2025-10-22';
    const endDate = '2025-10-22';
    const userId = 3;
    const standardWorkHours = 7.58;
    const ps = 50;
    const offset = 0;
    
    console.log('=== 调试参数 ===');
    console.log('startDate:', startDate);
    console.log('endDate:', endDate);
    console.log('userId:', userId);
    console.log('standardWorkHours:', standardWorkHours);
    console.log('ps:', ps);
    console.log('offset:', offset);
    
    const params = [startDate, endDate];
    const userFilterSql = 'u.role = "worker" AND u.id = ?';
    
    console.log('\n=== 参数数组 ===');
    const allParams = [...params, userId, standardWorkHours, standardWorkHours, standardWorkHours, standardWorkHours, ps, offset];
    console.log('参数数量:', allParams.length);
    console.log('参数内容:', allParams);
    
    // 测试主查询
    console.log('\n=== 执行主查询 ===');
    const [rows] = await connection.execute(`
      WITH RECURSIVE dates(d) AS (
        SELECT ?
        UNION ALL
        SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM dates WHERE d < ?
      )
      SELECT 
        da.id,
        u.id as user_id,
        u.name as user_name,
        u.department,
        dates.d as date,
        da.is_confirmed,
        da.actual_hours,
        da.standard_attendance_hours,
        da.overtime_hours,
        da.leave_hours
      FROM dates
      JOIN users u ON ${userFilterSql}
      LEFT JOIN daily_attendance da ON da.user_id = u.id AND da.date = dates.d
      ORDER BY dates.d DESC, u.name ASC
      LIMIT ? OFFSET ?
    `, allParams);
    
    console.log('查询结果数量:', rows.length);
    if (rows.length > 0) {
      console.log('第一条记录:', rows[0]);
    }
    
    // 测试统计查询
    console.log('\n=== 执行统计查询 ===');
    const [countRows] = await connection.execute(`
      WITH RECURSIVE dates(d) AS (
        SELECT ?
        UNION ALL
        SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM dates WHERE d < ?
      )
      SELECT COUNT(1) as total
      FROM dates
      JOIN users u ON ${userFilterSql}
    `, [startDate, endDate, userId]);
    
    console.log('统计结果:', countRows[0]);
    
    await connection.end();
    
  } catch (error) {
    console.error('错误:', error.message);
  }
}

debugDailyAttendance();
































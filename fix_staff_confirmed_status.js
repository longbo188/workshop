// 修复已确认但状态错误的报告
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function fixStatus() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！\n');

    // 查找有确认时间但状态不是staff_confirmed的报告
    console.log('=== 修复有确认时间但状态错误的报告 ===');
    const [updateResult] = await connection.execute(`
      UPDATE exception_reports 
      SET status = 'staff_confirmed'
      WHERE staff_confirmed_at IS NOT NULL 
        AND status != 'staff_confirmed'
        AND assigned_to_staff_id IS NOT NULL
    `);
    
    console.log(`✅ 已修复 ${updateResult.affectedRows} 条报告\n`);

    // 验证修复结果
    console.log('=== 验证修复结果 ===');
    const [confirmed] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM exception_reports
      WHERE status = 'staff_confirmed'
    `);
    console.log(`staff_confirmed状态的报告数量: ${confirmed[0].count}\n`);

  } catch (error) {
    console.error('修复失败：', error.message);
    console.error('详细错误：', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭。');
    }
  }
}

console.log('========================================');
console.log('修复Staff已确认但状态错误的报告');
console.log('========================================\n');
fixStatus();








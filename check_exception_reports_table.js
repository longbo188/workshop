// 检查exception_reports表结构
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function checkTable() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！\n');

    // 1. 检查表结构
    console.log('=== exception_reports表结构 ===');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'workshop_db' AND TABLE_NAME = 'exception_reports'
      AND COLUMN_NAME = 'status'
    `);
    
    if (columns.length > 0) {
      const statusCol = columns[0];
      console.log(`字段名: ${statusCol.COLUMN_NAME}`);
      console.log(`数据类型: ${statusCol.DATA_TYPE}`);
      console.log(`完整类型: ${statusCol.COLUMN_TYPE}`);
      console.log(`可空: ${statusCol.IS_NULLABLE}`);
      console.log(`默认值: ${statusCol.COLUMN_DEFAULT || '(无)'}`);
    }
    
    // 2. 检查所有报告的状态
    console.log('\n=== 所有异常报告状态 ===');
    const [allReports] = await connection.execute(`
      SELECT id, status, first_approver_id, second_approver_id,
             first_approved_at, second_approved_at
      FROM exception_reports
      ORDER BY id
    `);
    
    console.log(`总共 ${allReports.length} 条报告：\n`);
    allReports.forEach(report => {
      const status = report.status === null || report.status === '' ? '(空)' : report.status;
      console.log(`  ID: ${report.id}, 状态: ${status}, 一级审批: ${report.first_approver_id || '无'}, 二级审批: ${report.second_approver_id || '无'}`);
    });
    
    // 3. 尝试直接更新状态
    console.log('\n=== 尝试修复状态 ===');
    const [updateResult] = await connection.execute(`
      UPDATE exception_reports 
      SET status = CASE
        WHEN second_approver_id IS NOT NULL THEN 'approved'
        WHEN first_approver_id IS NOT NULL THEN 'pending_second_approval'
        ELSE 'pending'
      END
      WHERE status = '' OR status IS NULL
    `);
    
    console.log(`更新了 ${updateResult.affectedRows} 条记录`);
    
    // 4. 再次检查状态
    console.log('\n=== 修复后的状态统计 ===');
    const [finalStats] = await connection.execute(`
      SELECT status, COUNT(*) as count 
      FROM exception_reports 
      GROUP BY status
      ORDER BY count DESC
    `);
    
    finalStats.forEach(stat => {
      const status = stat.status === null || stat.status === '' ? '(空)' : stat.status;
      console.log(`  ${status}: ${stat.count} 条`);
    });
    
    // 5. 检查待二级审批的报告
    console.log('\n=== 待二级审批的报告 ===');
    const [pendingSecond] = await connection.execute(`
      SELECT id, task_id, user_id, status, first_approver_id, first_approved_at
      FROM exception_reports 
      WHERE status = 'pending_second_approval'
    `);
    
    console.log(`找到 ${pendingSecond.length} 条待二级审批的报告`);
    if (pendingSecond.length > 0) {
      pendingSecond.forEach(report => {
        console.log(`  ID: ${report.id}, 任务ID: ${report.task_id}, 一级审批人: ${report.first_approver_id}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ 检查失败！');
    console.error('错误信息:', error.message);
    console.error('详细错误:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭。');
    }
  }
}

console.log('========================================');
console.log('检查exception_reports表');
console.log('========================================\n');
checkTable();















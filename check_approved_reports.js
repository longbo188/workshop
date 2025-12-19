// 检查已审批的异常报告
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function checkReports() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！\n');

    // 1. 检查所有异常报告的状态分布
    console.log('=== 异常报告状态统计 ===');
    const [statusStats] = await connection.execute(`
      SELECT status, COUNT(*) as count 
      FROM exception_reports 
      GROUP BY status
      ORDER BY count DESC
    `);
    
    statusStats.forEach(stat => {
      const status = stat.status === null || stat.status === '' ? '(空)' : stat.status;
      console.log(`  ${status}: ${stat.count} 条`);
    });
    
    // 2. 检查approved状态的报告
    console.log('\n=== 已审批的报告（approved状态）===');
    const [approved] = await connection.execute(`
      SELECT er.id, er.task_id, er.user_id, er.status,
             er.exception_type, er.description,
             er.first_approver_id, er.first_approved_at,
             er.second_approver_id, er.second_approved_at,
             u.name as user_name,
             first_approver.name as first_approver_name,
             second_approver.name as second_approver_name,
             t.name as task_name
      FROM exception_reports er
      LEFT JOIN users u ON er.user_id = u.id
      LEFT JOIN users first_approver ON er.first_approver_id = first_approver.id
      LEFT JOIN users second_approver ON er.second_approver_id = second_approver.id
      LEFT JOIN tasks t ON er.task_id = t.id
      WHERE er.status = 'approved'
      ORDER BY er.submitted_at DESC
    `);
    
    if (approved.length === 0) {
      console.log('  暂无approved状态的报告');
    } else {
      console.log(`  找到 ${approved.length} 条approved状态的报告：\n`);
      approved.forEach((report, index) => {
        console.log(`  报告 ${index + 1}:`);
        console.log(`    ID: ${report.id}`);
        console.log(`    任务: ${report.task_name || '未知'} (ID: ${report.task_id})`);
        console.log(`    上报人: ${report.user_name || '未知'} (ID: ${report.user_id})`);
        console.log(`    异常类型: ${report.exception_type}`);
        console.log(`    一级审批人: ${report.first_approver_name || '无'} (ID: ${report.first_approver_id || '无'})`);
        console.log(`    一级审批时间: ${report.first_approved_at || '无'}`);
        console.log(`    二级审批人: ${report.second_approver_name || '无'} (ID: ${report.second_approver_id || '无'})`);
        console.log(`    二级审批时间: ${report.second_approved_at || '无'}`);
        console.log('');
      });
    }
    
    // 3. 检查是否有只有一级审批但没有二级审批的approved报告
    console.log('=== 检查approved报告的审批情况 ===');
    const [approvedDetails] = await connection.execute(`
      SELECT id, first_approver_id, second_approver_id, status
      FROM exception_reports 
      WHERE status = 'approved'
    `);
    
    approvedDetails.forEach(report => {
      if (!report.second_approver_id) {
        console.log(`  警告：报告ID ${report.id} 状态为approved但没有二级审批人（可能是旧数据）`);
      }
    });
    
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
console.log('检查已审批的异常报告');
console.log('========================================\n');
checkReports();















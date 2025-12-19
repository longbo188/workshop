// 检查待一级审批的异常报告
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
    
    // 2. 检查pending状态的报告
    console.log('\n=== 待一级审批的报告（pending状态）===');
    const [pending] = await connection.execute(`
      SELECT er.id, er.task_id, er.user_id, er.status,
             er.exception_type, er.description,
             er.exception_start_datetime, er.exception_end_datetime,
             u.name as user_name,
             t.name as task_name
      FROM exception_reports er
      LEFT JOIN users u ON er.user_id = u.id
      LEFT JOIN tasks t ON er.task_id = t.id
      WHERE er.status = 'pending'
      ORDER BY er.submitted_at DESC
    `);
    
    if (pending.length === 0) {
      console.log('  暂无pending状态的报告');
      console.log('\n提示：');
      console.log('  1. 工人需要先提交异常报告');
      console.log('  2. 或者所有报告都已被审批');
    } else {
      console.log(`  找到 ${pending.length} 条pending状态的报告：\n`);
      pending.forEach((report, index) => {
        console.log(`  报告 ${index + 1}:`);
        console.log(`    ID: ${report.id}`);
        console.log(`    任务: ${report.task_name || '未知'} (ID: ${report.task_id})`);
        console.log(`    上报人: ${report.user_name || '未知'} (ID: ${report.user_id})`);
        console.log(`    异常类型: ${report.exception_type}`);
        console.log(`    提交时间: ${report.exception_start_datetime || '未知'}`);
        console.log('');
      });
    }
    
    // 3. 检查pending_second_approval状态的报告
    console.log('=== 待二级审批的报告（pending_second_approval状态）===');
    const [pendingSecond] = await connection.execute(`
      SELECT er.id, er.task_id, er.user_id, er.status,
             er.first_approver_id, er.first_approved_at,
             u.name as user_name,
             first_approver.name as first_approver_name,
             t.name as task_name
      FROM exception_reports er
      LEFT JOIN users u ON er.user_id = u.id
      LEFT JOIN users first_approver ON er.first_approver_id = first_approver.id
      LEFT JOIN tasks t ON er.task_id = t.id
      WHERE er.status = 'pending_second_approval'
      ORDER BY er.submitted_at DESC
    `);
    
    console.log(`  找到 ${pendingSecond.length} 条pending_second_approval状态的报告`);
    
    // 4. 检查supervisor和admin用户
    console.log('\n=== Supervisor和Admin用户 ===');
    const [supervisors] = await connection.execute(`
      SELECT id, username, name, role, department 
      FROM users 
      WHERE role IN ('supervisor', 'admin')
    `);
    
    if (supervisors.length === 0) {
      console.log('  暂无supervisor或admin用户');
    } else {
      console.log(`  找到 ${supervisors.length} 个用户：\n`);
      supervisors.forEach(user => {
        console.log(`    ID: ${user.id}, 用户名: ${user.username}, 姓名: ${user.name}, 角色: ${user.role}, 部门: ${user.department || '未设置'}`);
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
console.log('检查待一级审批的异常报告');
console.log('========================================\n');
checkReports();















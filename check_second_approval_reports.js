// 检查待二级审批的异常报告
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
      console.log(`  ${stat.status}: ${stat.count} 条`);
    });
    
    // 2. 检查待二级审批的报告
    console.log('\n=== 待二级审批的报告 ===');
    const [pendingSecond] = await connection.execute(`
      SELECT er.id, er.task_id, er.user_id, er.status, 
             er.exception_type, er.description,
             er.first_approver_id, er.first_approved_at,
             er.modified_exception_type, er.modified_description,
             u.name as user_name,
             first_approver.name as first_approver_name
      FROM exception_reports er
      LEFT JOIN users u ON er.user_id = u.id
      LEFT JOIN users first_approver ON er.first_approver_id = first_approver.id
      WHERE er.status = 'pending_second_approval'
      ORDER BY er.submitted_at DESC
    `);
    
    if (pendingSecond.length === 0) {
      console.log('  暂无待二级审批的报告');
      console.log('\n提示：');
      console.log('  1. 检查是否有主管已批准但状态未正确更新的报告');
      console.log('  2. 检查一级审批时是否正确更新了状态为pending_second_approval');
    } else {
      console.log(`  找到 ${pendingSecond.length} 条待二级审批的报告：\n`);
      pendingSecond.forEach((report, index) => {
        console.log(`  报告 ${index + 1}:`);
        console.log(`    ID: ${report.id}`);
        console.log(`    任务ID: ${report.task_id}`);
        console.log(`    上报人: ${report.user_name} (ID: ${report.user_id})`);
        console.log(`    异常类型: ${report.modified_exception_type || report.exception_type}`);
        console.log(`    一级审批人: ${report.first_approver_name || '未知'} (ID: ${report.first_approver_id})`);
        console.log(`    一级审批时间: ${report.first_approved_at || '未知'}`);
        console.log(`    是否修改: ${report.modified_exception_type ? '是' : '否'}`);
        console.log('');
      });
    }
    
    // 3. 检查最近的一级审批记录
    console.log('=== 最近的一级审批记录（前5条）===');
    const [recentFirst] = await connection.execute(`
      SELECT er.id, er.status, er.first_approver_id, er.first_approved_at,
             first_approver.name as first_approver_name,
             u.name as user_name
      FROM exception_reports er
      LEFT JOIN users first_approver ON er.first_approver_id = first_approver.id
      LEFT JOIN users u ON er.user_id = u.id
      WHERE er.first_approver_id IS NOT NULL
      ORDER BY er.first_approved_at DESC
      LIMIT 5
    `);
    
    if (recentFirst.length === 0) {
      console.log('  暂无一级审批记录');
    } else {
      recentFirst.forEach((report, index) => {
        console.log(`  ${index + 1}. 报告ID: ${report.id}, 状态: ${report.status}, 审批人: ${report.first_approver_name}, 时间: ${report.first_approved_at}`);
      });
    }
    
    // 4. 检查manager角色的用户
    console.log('\n=== Manager角色用户 ===');
    const [managers] = await connection.execute(`
      SELECT id, username, name, role, department 
      FROM users 
      WHERE role = 'manager'
    `);
    
    if (managers.length === 0) {
      console.log('  暂无manager角色的用户');
      console.log('  提示：请确保用户ID 86的角色已更新为manager');
    } else {
      console.log(`  找到 ${managers.length} 个manager用户：\n`);
      managers.forEach(manager => {
        console.log(`    ID: ${manager.id}, 用户名: ${manager.username}, 姓名: ${manager.name}, 部门: ${manager.department || '未设置'}`);
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
console.log('检查待二级审批的异常报告');
console.log('========================================\n');
checkReports();















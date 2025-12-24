// 检查staff已确认的异常报告
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function checkStaffConfirmed() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！\n');

    // 1. 检查所有staff_confirmed状态的报告
    console.log('=== 所有staff_confirmed状态的报告 ===');
    const [confirmed] = await connection.execute(`
      SELECT er.id, er.status, er.assigned_to_staff_id, 
             er.staff_confirmed_at, er.staff_confirmation_note,
             u.name as user_name,
             t.name as task_name,
             staff.name as assigned_staff_name,
             staff.department as staff_department
      FROM exception_reports er
      LEFT JOIN users u ON er.user_id = u.id
      LEFT JOIN tasks t ON er.task_id = t.id
      LEFT JOIN users staff ON er.assigned_to_staff_id = staff.id
      WHERE er.status = 'staff_confirmed'
      ORDER BY er.staff_confirmed_at DESC
    `);
    
    if (confirmed.length === 0) {
      console.log('  暂无staff_confirmed状态的报告\n');
    } else {
      console.log(`  共 ${confirmed.length} 条已确认报告：\n`);
      confirmed.forEach(report => {
        console.log(`  ID: ${report.id}`);
        console.log(`    任务: ${report.task_name || '未知'}`);
        console.log(`    上报人: ${report.user_name || '未知'}`);
        console.log(`    分配Staff: ${report.assigned_staff_name || '未知'} (ID: ${report.assigned_to_staff_id}, 部门: ${report.staff_department || '无'})`);
        console.log(`    确认时间: ${report.staff_confirmed_at || '无'}`);
        console.log(`    确认备注: ${report.staff_confirmation_note || '无'}`);
        console.log('');
      });
    }

    // 2. 检查有staff_confirmed_at但没有status为staff_confirmed的报告
    console.log('=== 有确认时间但状态不是staff_confirmed的报告 ===');
    const [inconsistent] = await connection.execute(`
      SELECT er.id, er.status, er.assigned_to_staff_id, 
             er.staff_confirmed_at
      FROM exception_reports er
      WHERE er.staff_confirmed_at IS NOT NULL 
        AND er.status != 'staff_confirmed'
    `);
    
    if (inconsistent.length === 0) {
      console.log('  没有不一致的报告\n');
    } else {
      console.log(`  共 ${inconsistent.length} 条不一致的报告：\n`);
      inconsistent.forEach(report => {
        console.log(`  ID: ${report.id}, 状态: ${report.status || '(null)'}, 确认时间: ${report.staff_confirmed_at}`);
      });
      console.log('');
    }

    // 3. 测试查询：模拟staff用户ID 89查询
    console.log('=== 模拟staff用户ID 89查询（应该能看到分配给自己的已确认报告）===');
    const staffId = 89;
    const [staffReports] = await connection.execute(`
      SELECT 
        er.*,
        t.name as task_name,
        u.name as user_name,
        approver.name as approver_name,
        first_approver.name as first_approver_name,
        second_approver.name as second_approver_name,
        staff.name as assigned_staff_name
      FROM exception_reports er
      LEFT JOIN tasks t ON er.task_id = t.id
      LEFT JOIN users u ON er.user_id = u.id
      LEFT JOIN users approver ON er.approved_by = approver.id
      LEFT JOIN users first_approver ON er.first_approver_id = first_approver.id
      LEFT JOIN users second_approver ON er.second_approver_id = second_approver.id
      LEFT JOIN users staff ON er.assigned_to_staff_id = staff.id
      WHERE er.assigned_to_staff_id = ?
        AND er.status IN ('pending_staff_confirmation', 'staff_confirmed')
      ORDER BY er.submitted_at DESC
    `, [staffId]);
    
    console.log(`  用户ID ${staffId} 应该看到的报告数量: ${staffReports.length}\n`);
    staffReports.forEach(report => {
      console.log(`  ID: ${report.id}, 状态: ${report.status}, 任务: ${report.task_name || '未知'}`);
    });

  } catch (error) {
    console.error('检查失败：', error.message);
    console.error('详细错误：', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭。');
    }
  }
}

console.log('========================================');
console.log('检查Staff已确认的异常报告');
console.log('========================================\n');
checkStaffConfirmed();









// 检查staff确认相关的异常报告
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function checkStaffConfirmation() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！\n');

    // 1. 检查pending_staff_confirmation状态的报告
    console.log('=== 待Staff确认的报告（pending_staff_confirmation状态）===');
    const [pendingStaff] = await connection.execute(`
      SELECT er.id, er.task_id, er.user_id, er.status,
             er.exception_type, er.modified_exception_type,
             er.assigned_to_staff_id,
             u.name as user_name,
             t.name as task_name,
             staff.name as assigned_staff_name,
             staff.department as staff_department
      FROM exception_reports er
      LEFT JOIN users u ON er.user_id = u.id
      LEFT JOIN tasks t ON er.task_id = t.id
      LEFT JOIN users staff ON er.assigned_to_staff_id = staff.id
      WHERE er.status = 'pending_staff_confirmation'
      ORDER BY er.submitted_at DESC
    `);
    
    if (pendingStaff.length === 0) {
      console.log('  暂无待Staff确认的报告\n');
    } else {
      console.log(`  共 ${pendingStaff.length} 条待确认报告：\n`);
      pendingStaff.forEach(report => {
        const exceptionType = report.modified_exception_type || report.exception_type;
        console.log(`  ID: ${report.id}`);
        console.log(`    任务: ${report.task_name || '未知'}`);
        console.log(`    上报人: ${report.user_name || '未知'}`);
        console.log(`    异常类型: ${exceptionType}`);
        console.log(`    分配Staff: ${report.assigned_staff_name || '未知'} (ID: ${report.assigned_to_staff_id || '无'}, 部门: ${report.staff_department || '无'})`);
        console.log('');
      });
    }

    // 2. 检查所有staff用户
    console.log('=== 所有Staff用户 ===');
    const [staffUsers] = await connection.execute(`
      SELECT id, username, name, role, department 
      FROM users 
      WHERE role = 'staff'
      ORDER BY department, name
    `);
    
    if (staffUsers.length === 0) {
      console.log('  暂无Staff用户\n');
    } else {
      console.log(`  共 ${staffUsers.length} 个Staff用户：\n`);
      staffUsers.forEach(user => {
        console.log(`  ID: ${user.id}, 姓名: ${user.name}, 部门: ${user.department || '未设置'}`);
      });
      console.log('');
    }

    // 3. 检查最近批准的异常报告（看看是否分配给了staff）
    console.log('=== 最近批准的异常报告（检查是否分配给了staff）===');
    const [recentApproved] = await connection.execute(`
      SELECT er.id, er.task_id, er.status,
             er.exception_type, er.modified_exception_type,
             er.assigned_to_staff_id,
             er.second_approved_at,
             u.name as user_name,
             t.name as task_name,
             staff.name as assigned_staff_name
      FROM exception_reports er
      LEFT JOIN users u ON er.user_id = u.id
      LEFT JOIN tasks t ON er.task_id = t.id
      LEFT JOIN users staff ON er.assigned_to_staff_id = staff.id
      WHERE er.second_approved_at IS NOT NULL
      ORDER BY er.second_approved_at DESC
      LIMIT 10
    `);
    
    if (recentApproved.length === 0) {
      console.log('  暂无已批准的异常报告\n');
    } else {
      console.log(`  最近 ${recentApproved.length} 条已批准的异常报告：\n`);
      recentApproved.forEach(report => {
        const exceptionType = report.modified_exception_type || report.exception_type;
        console.log(`  ID: ${report.id}, 状态: ${report.status}`);
        console.log(`    任务: ${report.task_name || '未知'}`);
        console.log(`    异常类型: ${exceptionType}`);
        console.log(`    分配Staff: ${report.assigned_staff_name || '无'} (ID: ${report.assigned_to_staff_id || '无'})`);
        console.log(`    批准时间: ${report.second_approved_at}`);
        console.log('');
      });
    }

    // 4. 检查异常类型和部门映射
    console.log('=== 异常类型和部门映射关系 ===');
    console.log('  缺料 → PMC');
    console.log('  来料不良 → 质量部');
    console.log('  改造类（研发售后或生产不良）或 改造类 → 售后');
    console.log('  临时安排任务 → 不分配（直接批准）\n');

  } catch (error) {
    console.error('检查失败：', error.message);
    console.error('详细错误：', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭。');
    }
  }
}

console.log('========================================');
console.log('检查Staff确认相关的异常报告');
console.log('========================================\n');
checkStaffConfirmation();











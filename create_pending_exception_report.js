// 创建一条pending状态的异常报告，供主管审批测试
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function createReport() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！\n');

    // 1. 获取一个worker用户
    const [workers] = await connection.execute(`
      SELECT id, username, name FROM users WHERE role = 'worker' LIMIT 1
    `);
    
    if (workers.length === 0) {
      console.log('❌ 没有找到worker用户，无法创建测试报告');
      return;
    }
    
    const worker = workers[0];
    console.log(`使用worker用户: ${worker.name} (ID: ${worker.id})`);
    
    // 2. 获取一个任务
    const [tasks] = await connection.execute(`
      SELECT id, name FROM tasks WHERE status != 'completed' LIMIT 1
    `);
    
    if (tasks.length === 0) {
      console.log('❌ 没有找到可用任务，无法创建测试报告');
      return;
    }
    
    const task = tasks[0];
    console.log(`使用任务: ${task.name} (ID: ${task.id})`);
    
    // 3. 获取一个supervisor用户作为审批人（可选）
    const [supervisors] = await connection.execute(`
      SELECT id, name FROM users WHERE role = 'supervisor' LIMIT 1
    `);
    
    const approverId = supervisors.length > 0 ? supervisors[0].id : null;
    console.log(`审批人: ${supervisors.length > 0 ? supervisors[0].name : '未设置'} (ID: ${approverId || '无'})`);
    
    // 4. 创建pending状态的异常报告
    const now = new Date();
    const startDateTime = new Date(now.getTime() - 3600000); // 1小时前
    const endDateTime = now;
    
    console.log('\n=== 创建pending状态的异常报告 ===');
    const [insertResult] = await connection.execute(`
      INSERT INTO exception_reports (
        task_id, user_id, exception_type, description,
        exception_start_datetime, exception_end_datetime,
        status, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
    `, [
      task.id,
      worker.id,
      '缺料',
      '测试异常报告 - 用于测试主管一级审批功能。这是一个测试报告，可以用于验证主管审批流程。',
      startDateTime.toISOString().slice(0, 19).replace('T', ' '),
      endDateTime.toISOString().slice(0, 19).replace('T', ' ')
    ]);
    
    console.log(`✅ 创建测试报告成功！`);
    console.log(`   报告ID: ${insertResult.insertId}`);
    console.log(`   任务: ${task.name} (ID: ${task.id})`);
    console.log(`   上报人: ${worker.name} (ID: ${worker.id})`);
    console.log(`   异常类型: 缺料`);
    console.log(`   状态: pending`);
    console.log(`   异常时间: ${startDateTime.toISOString().slice(0, 19).replace('T', ' ')} - ${endDateTime.toISOString().slice(0, 19).replace('T', ' ')}`);
    
    // 5. 验证创建结果
    console.log('\n=== 验证创建结果 ===');
    const [verify] = await connection.execute(`
      SELECT er.id, er.status, er.exception_type,
             u.name as user_name,
             t.name as task_name
      FROM exception_reports er
      LEFT JOIN users u ON er.user_id = u.id
      LEFT JOIN tasks t ON er.task_id = t.id
      WHERE er.id = ?
    `, [insertResult.insertId]);
    
    if (verify.length > 0) {
      const report = verify[0];
      console.log(`✅ 报告创建成功并验证通过`);
      console.log(`   ID: ${report.id}`);
      console.log(`   状态: ${report.status}`);
      console.log(`   任务: ${report.task_name}`);
      console.log(`   上报人: ${report.user_name}`);
    }
    
    // 6. 显示当前pending状态的报告总数
    console.log('\n=== 当前pending状态的报告统计 ===');
    const [pendingCount] = await connection.execute(`
      SELECT COUNT(*) as count FROM exception_reports WHERE status = 'pending'
    `);
    console.log(`当前有 ${pendingCount[0].count} 条pending状态的报告`);
    
    console.log('\n🎉 测试报告创建完成！');
    console.log('\n提示：');
    console.log('  1. 使用supervisor或admin角色登录系统');
    console.log('  2. 进入"异常审批"页面');
    console.log('  3. 应该能看到这条pending状态的报告');
    console.log('  4. 可以进行一级审批操作');
    
  } catch (error) {
    console.error('\n❌ 创建失败！');
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
console.log('创建pending状态的异常报告');
console.log('========================================\n');
createReport();















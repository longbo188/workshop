// 修复异常报告状态并创建测试数据
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function fixReports() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！\n');

    // 1. 检查状态为空的报告
    console.log('=== 检查状态为空的报告 ===');
    const [emptyStatus] = await connection.execute(`
      SELECT id, status, first_approver_id, first_approved_at, 
             second_approver_id, second_approved_at
      FROM exception_reports 
      WHERE status = '' OR status IS NULL
    `);
    
    console.log(`找到 ${emptyStatus.length} 条状态为空的报告`);
    
    if (emptyStatus.length > 0) {
      // 根据审批情况修复状态
      for (const report of emptyStatus) {
        if (report.second_approver_id) {
          // 有二级审批人，应该是approved或rejected
          // 需要检查second_approval_note来判断
          const [details] = await connection.execute(`
            SELECT second_approval_note FROM exception_reports WHERE id = ?
          `, [report.id]);
          
          // 如果有审批备注，通常是approved，否则可能是rejected
          // 这里假设有二级审批人就是approved
          await connection.execute(`
            UPDATE exception_reports 
            SET status = 'approved'
            WHERE id = ?
          `, [report.id]);
          console.log(`  修复报告ID ${report.id}: 设置为 approved`);
        } else if (report.first_approver_id) {
          // 有一级审批人但没有二级审批人，应该是pending_second_approval
          await connection.execute(`
            UPDATE exception_reports 
            SET status = 'pending_second_approval'
            WHERE id = ?
          `, [report.id]);
          console.log(`  修复报告ID ${report.id}: 设置为 pending_second_approval`);
        } else {
          // 没有审批人，应该是pending
          await connection.execute(`
            UPDATE exception_reports 
            SET status = 'pending'
            WHERE id = ?
          `, [report.id]);
          console.log(`  修复报告ID ${report.id}: 设置为 pending`);
        }
      }
    }
    
    // 2. 检查是否有待二级审批的报告
    console.log('\n=== 检查待二级审批的报告 ===');
    const [pendingSecond] = await connection.execute(`
      SELECT COUNT(*) as count FROM exception_reports 
      WHERE status = 'pending_second_approval'
    `);
    
    console.log(`当前有 ${pendingSecond[0].count} 条待二级审批的报告`);
    
    // 3. 如果没有待二级审批的报告，创建一个测试报告
    if (pendingSecond[0].count === 0) {
      console.log('\n=== 创建测试报告（用于测试二级审批）===');
      
      // 获取一个worker用户和一个supervisor用户
      const [workers] = await connection.execute(`
        SELECT id FROM users WHERE role = 'worker' LIMIT 1
      `);
      const [supervisors] = await connection.execute(`
        SELECT id FROM users WHERE role = 'supervisor' LIMIT 1
      `);
      const [tasks] = await connection.execute(`
        SELECT id FROM tasks LIMIT 1
      `);
      
      if (workers.length > 0 && supervisors.length > 0 && tasks.length > 0) {
        const workerId = workers[0].id;
        const supervisorId = supervisors[0].id;
        const taskId = tasks[0].id;
        
        // 创建一个测试异常报告
        const [insertResult] = await connection.execute(`
          INSERT INTO exception_reports (
            task_id, user_id, exception_type, description,
            exception_start_datetime, exception_end_datetime,
            status, first_approver_id, first_approved_at,
            first_approval_note, submitted_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'pending_second_approval', ?, NOW(), ?, NOW())
        `, [
          taskId,
          workerId,
          '缺料',
          '测试异常报告 - 用于测试二级审批功能',
          new Date().toISOString().slice(0, 19).replace('T', ' '),
          new Date(Date.now() + 3600000).toISOString().slice(0, 19).replace('T', ' '),
          supervisorId,
          '一级审批已通过，等待经理二级审批'
        ]);
        
        console.log(`✅ 创建测试报告成功，ID: ${insertResult.insertId}`);
        console.log(`   任务ID: ${taskId}`);
        console.log(`   上报人ID: ${workerId}`);
        console.log(`   一级审批人ID: ${supervisorId}`);
        console.log(`   状态: pending_second_approval`);
      } else {
        console.log('⚠️  无法创建测试报告：缺少必要的用户或任务数据');
      }
    }
    
    // 4. 最终统计
    console.log('\n=== 最终状态统计 ===');
    const [finalStats] = await connection.execute(`
      SELECT status, COUNT(*) as count 
      FROM exception_reports 
      GROUP BY status
      ORDER BY count DESC
    `);
    
    finalStats.forEach(stat => {
      console.log(`  ${stat.status || '(空)'}: ${stat.count} 条`);
    });
    
    // 5. 显示待二级审批的报告详情
    console.log('\n=== 待二级审批的报告详情 ===');
    const [pendingDetails] = await connection.execute(`
      SELECT er.id, er.task_id, er.user_id, er.status,
             er.exception_type, er.modified_exception_type,
             er.description, er.modified_description,
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
    
    if (pendingDetails.length === 0) {
      console.log('  暂无待二级审批的报告');
    } else {
      pendingDetails.forEach((report, index) => {
        console.log(`\n  报告 ${index + 1}:`);
        console.log(`    ID: ${report.id}`);
        console.log(`    任务: ${report.task_name || '未知'} (ID: ${report.task_id})`);
        console.log(`    上报人: ${report.user_name || '未知'} (ID: ${report.user_id})`);
        console.log(`    异常类型: ${report.modified_exception_type || report.exception_type}`);
        console.log(`    一级审批人: ${report.first_approver_name || '未知'} (ID: ${report.first_approver_id})`);
        console.log(`    一级审批时间: ${report.first_approved_at || '未知'}`);
        console.log(`    是否修改: ${report.modified_exception_type ? '是' : '否'}`);
      });
    }
    
    console.log('\n✅ 修复完成！');
    
  } catch (error) {
    console.error('\n❌ 修复失败！');
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
console.log('修复异常报告状态');
console.log('========================================\n');
fixReports();















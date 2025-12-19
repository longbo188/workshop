// 修改exception_reports表的status字段，添加pending_second_approval状态
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function migrate() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！\n');

    // 1. 检查当前status字段定义
    console.log('=== 检查当前status字段定义 ===');
    const [columns] = await connection.execute(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'workshop_db' 
      AND TABLE_NAME = 'exception_reports'
      AND COLUMN_NAME = 'status'
    `);
    
    if (columns.length > 0) {
      console.log(`当前ENUM定义: ${columns[0].COLUMN_TYPE}`);
      
      // 检查是否已包含pending_second_approval
      if (columns[0].COLUMN_TYPE.includes('pending_second_approval')) {
        console.log('✅ status字段已包含pending_second_approval，无需修改');
      } else {
        console.log('⚠️  status字段不包含pending_second_approval，需要修改');
        
        // 2. 修改ENUM定义，添加pending_second_approval
        console.log('\n=== 修改status字段ENUM定义 ===');
        await connection.execute(`
          ALTER TABLE exception_reports 
          MODIFY COLUMN status ENUM('pending', 'pending_second_approval', 'approved', 'rejected', 'processing', 'resolved') 
          DEFAULT 'pending'
        `);
        console.log('✅ status字段ENUM定义已更新');
      }
    }
    
    // 3. 修复现有数据的状态
    console.log('\n=== 修复现有数据的状态 ===');
    const [updateResult] = await connection.execute(`
      UPDATE exception_reports 
      SET status = CASE
        WHEN second_approver_id IS NOT NULL THEN 'approved'
        WHEN first_approver_id IS NOT NULL THEN 'pending_second_approval'
        ELSE 'pending'
      END
      WHERE status = '' OR status IS NULL
    `);
    
    console.log(`更新了 ${updateResult.affectedRows} 条记录的状态`);
    
    // 4. 验证修复结果
    console.log('\n=== 验证修复结果 ===');
    const [finalStats] = await connection.execute(`
      SELECT status, COUNT(*) as count 
      FROM exception_reports 
      GROUP BY status
      ORDER BY count DESC
    `);
    
    console.log('状态统计:');
    finalStats.forEach(stat => {
      const status = stat.status === null || stat.status === '' ? '(空)' : stat.status;
      console.log(`  ${status}: ${stat.count} 条`);
    });
    
    // 5. 检查待二级审批的报告
    console.log('\n=== 待二级审批的报告 ===');
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
    
    if (pendingSecond.length === 0) {
      console.log('  暂无待二级审批的报告');
    } else {
      console.log(`  找到 ${pendingSecond.length} 条待二级审批的报告：\n`);
      pendingSecond.forEach((report, index) => {
        console.log(`  报告 ${index + 1}:`);
        console.log(`    ID: ${report.id}`);
        console.log(`    任务: ${report.task_name || '未知'} (ID: ${report.task_id})`);
        console.log(`    上报人: ${report.user_name || '未知'} (ID: ${report.user_id})`);
        console.log(`    一级审批人: ${report.first_approver_name || '未知'} (ID: ${report.first_approver_id})`);
        console.log(`    一级审批时间: ${report.first_approved_at || '未知'}`);
      });
    }
    
    console.log('\n🎉 迁移完成！');
    
  } catch (error) {
    console.error('\n❌ 迁移失败！');
    console.error('错误信息:', error.message);
    console.error('详细错误:', error);
    
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n提示：数据库不存在，请先创建数据库 workshop_db');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n提示：数据库访问被拒绝，请检查用户名和密码');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n提示：无法连接到数据库，请确保MySQL服务正在运行');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭。');
    }
  }
}

console.log('========================================');
console.log('修改status字段，添加pending_second_approval状态');
console.log('========================================\n');
migrate();















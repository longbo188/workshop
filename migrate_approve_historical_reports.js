// 数据库迁移脚本：批量更新历史待审批记录为已审批
const mysql = require('mysql2/promise');

// 数据库配置（与backend/server.js保持一致）
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '', // XAMPP MySQL 默认密码（如果没改就是空字符串）
  database: 'workshop_db'
};

async function migrate() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！');

    // 1. 查看更新前的统计信息
    console.log('\n步骤1: 查看更新前的统计信息...');
    const [beforeStats] = await connection.execute(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN approval_status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN approval_status IS NULL THEN 1 END) as null_count,
        COUNT(CASE WHEN approval_status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN approval_status = 'rejected' THEN 1 END) as rejected_count
      FROM work_reports 
      WHERE work_type = 'complete'
    `);

    const stats = beforeStats[0];
    console.log('更新前的统计：');
    console.log(`  总记录数: ${stats.total}`);
    console.log(`  已审批: ${stats.approved_count}`);
    console.log(`  NULL: ${stats.null_count}`);
    console.log(`  待审批: ${stats.pending_count}`);
    console.log(`  已驳回: ${stats.rejected_count}`);

    const needUpdateCount = stats.null_count + stats.pending_count;
    if (needUpdateCount === 0) {
      console.log('\n✅ 没有需要更新的记录，迁移完成！');
      return;
    }

    // 2. 批量更新所有 NULL 或 'pending' 的完成报告为 'approved'
    console.log(`\n步骤2: 批量更新 ${needUpdateCount} 条历史待审批记录为已审批...`);
    const [updateResult] = await connection.execute(`
      UPDATE work_reports 
      SET approval_status = 'approved'
      WHERE work_type = 'complete' 
        AND (approval_status IS NULL OR approval_status = 'pending')
    `);

    console.log(`✅ 成功更新 ${updateResult.affectedRows} 条记录`);

    // 3. 验证更新结果
    console.log('\n步骤3: 验证更新结果...');
    const [afterStats] = await connection.execute(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN approval_status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN approval_status IS NULL THEN 1 END) as null_count,
        COUNT(CASE WHEN approval_status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN approval_status = 'rejected' THEN 1 END) as rejected_count
      FROM work_reports 
      WHERE work_type = 'complete'
    `);

    const afterStatsData = afterStats[0];
    console.log('更新后的统计：');
    console.log(`  总记录数: ${afterStatsData.total}`);
    console.log(`  已审批: ${afterStatsData.approved_count}`);
    console.log(`  NULL: ${afterStatsData.null_count}`);
    console.log(`  待审批: ${afterStatsData.pending_count}`);
    console.log(`  已驳回: ${afterStatsData.rejected_count}`);

    // 4. 检查是否还有待审批记录
    const [remainingPending] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM work_reports 
      WHERE work_type = 'complete' 
        AND (approval_status IS NULL OR approval_status = 'pending')
    `);

    if (remainingPending[0].count === 0) {
      console.log('\n🎉 迁移成功完成！所有历史待审批记录已更新为已审批。');
    } else {
      console.log(`\n⚠️  警告：仍有 ${remainingPending[0].count} 条待审批记录未更新。`);
    }

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

// 执行迁移
console.log('========================================');
console.log('数据库迁移：批量更新历史待审批记录');
console.log('========================================\n');
migrate();















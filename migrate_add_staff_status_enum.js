// 数据库迁移脚本：添加staff确认相关的状态到ENUM
const mysql = require('mysql2/promise');

// 数据库配置（与backend/server.js保持一致）
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

    // 1. 检查当前status字段类型
    console.log('步骤1: 检查当前status字段类型...');
    const [columns] = await connection.execute(`
      SHOW COLUMNS FROM exception_reports WHERE Field = 'status'
    `);
    
    if (columns.length > 0) {
      const col = columns[0];
      console.log(`当前类型: ${col.Type}`);
      console.log(`可空: ${col.Null}`);
      console.log(`默认值: ${col.Default || '(无)'}\n`);
    }

    // 2. 修改status字段的ENUM定义
    console.log('步骤2: 修改status字段的ENUM定义，添加pending_staff_confirmation和staff_confirmed...');
    try {
      await connection.execute(`
        ALTER TABLE exception_reports 
        MODIFY COLUMN status ENUM(
          'pending',
          'pending_second_approval',
          'pending_staff_confirmation',
          'staff_confirmed',
          'approved',
          'rejected',
          'processing',
          'resolved'
        ) DEFAULT 'pending'
      `);
      console.log('✅ status字段ENUM定义已更新\n');
    } catch (error) {
      console.error('❌ 更新ENUM定义失败:', error.message);
      throw error;
    }

    // 3. 修复已分配staff但status为空的报告
    console.log('步骤3: 修复已分配staff但status为空的报告...');
    const [updateResult] = await connection.execute(`
      UPDATE exception_reports 
      SET status = 'pending_staff_confirmation'
      WHERE (status = '' OR status IS NULL) 
        AND assigned_to_staff_id IS NOT NULL
    `);
    console.log(`✅ 已修复 ${updateResult.affectedRows} 条报告\n`);

    // 4. 验证修改结果
    console.log('步骤4: 验证修改结果...');
    const [statusStats] = await connection.execute(`
      SELECT status, COUNT(*) as count 
      FROM exception_reports 
      GROUP BY status
      ORDER BY count DESC
    `);
    
    console.log('状态统计：');
    statusStats.forEach(stat => {
      const status = stat.status === null || stat.status === '' ? '(空)' : stat.status;
      console.log(`  ${status}: ${stat.count} 条`);
    });
    console.log('');

    // 5. 检查待Staff确认的报告
    const [pendingStaff] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM exception_reports
      WHERE status = 'pending_staff_confirmation'
    `);
    console.log(`待Staff确认的报告数量: ${pendingStaff[0].count}\n`);

    console.log('🎉 迁移成功完成！');

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
console.log('数据库迁移：添加staff确认相关的状态到ENUM');
console.log('========================================\n');
migrate();






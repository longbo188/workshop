// 修复pending_staff_confirmation状态
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function fixStatus() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！\n');

    // 1. 检查status字段类型
    console.log('=== 检查status字段类型 ===');
    const [columns] = await connection.execute(`
      SHOW COLUMNS FROM exception_reports WHERE Field = 'status'
    `);
    
    if (columns.length > 0) {
      const col = columns[0];
      console.log(`字段名: ${col.Field}`);
      console.log(`数据类型: ${col.Type}`);
      console.log(`可空: ${col.Null}`);
      console.log(`默认值: ${col.Default || '(无)'}\n`);
      
      // 如果是ENUM类型，检查是否包含pending_staff_confirmation
      if (col.Type.includes('enum') || col.Type.includes('ENUM')) {
        console.log('⚠️  status字段是ENUM类型，需要添加pending_staff_confirmation和staff_confirmed值\n');
      }
    }

    // 2. 查找status为空字符串且已分配staff的报告
    console.log('=== 查找需要修复的报告 ===');
    const [reports] = await connection.execute(`
      SELECT id, status, assigned_to_staff_id, exception_type, modified_exception_type
      FROM exception_reports
      WHERE (status = '' OR status IS NULL) AND assigned_to_staff_id IS NOT NULL
    `);
    
    if (reports.length === 0) {
      console.log('  没有需要修复的报告\n');
    } else {
      console.log(`  找到 ${reports.length} 条需要修复的报告：\n`);
      reports.forEach(report => {
        console.log(`  ID: ${report.id}, 当前status: "${report.status || '(null)'}", assigned_to_staff_id: ${report.assigned_to_staff_id}`);
      });
      console.log('');
      
      // 3. 修复这些报告的status
      console.log('=== 修复status字段 ===');
      for (const report of reports) {
        try {
          await connection.execute(`
            UPDATE exception_reports 
            SET status = 'pending_staff_confirmation'
            WHERE id = ?
          `, [report.id]);
          console.log(`  ✅ 已修复报告 ID: ${report.id}`);
        } catch (error) {
          console.log(`  ❌ 修复报告 ID: ${report.id} 失败: ${error.message}`);
        }
      }
      console.log('');
    }

    // 4. 验证修复结果
    console.log('=== 验证修复结果 ===');
    const [pendingStaff] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM exception_reports
      WHERE status = 'pending_staff_confirmation'
    `);
    console.log(`  待Staff确认的报告数量: ${pendingStaff[0].count}\n`);

  } catch (error) {
    console.error('操作失败：', error.message);
    console.error('详细错误：', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭。');
    }
  }
}

console.log('========================================');
console.log('修复pending_staff_confirmation状态');
console.log('========================================\n');
fixStatus();










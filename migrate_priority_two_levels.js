// 数据库迁移脚本：将任务优先级精简为“紧急/非紧急”
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
    console.log('✅ 数据库连接成功');

    console.log('\nStep 1/3：扩展 priority 枚举，允许 normal 临时写入');
    try {
      await connection.execute(`
        ALTER TABLE tasks 
        MODIFY COLUMN priority ENUM('low','medium','high','urgent','normal') NOT NULL DEFAULT 'medium'
      `);
      console.log('✅ priority 列已允许 normal');
    } catch (error) {
      if (error.message.includes('Invalid ENUM value') || error.message.includes('data truncated')) {
        throw error;
      }
      console.log('⚠️  priority 列可能已包含 normal，跳过此步');
    }

    console.log('\nStep 2/3：标准化现有数据');
    const [updateNormal] = await connection.execute(`
      UPDATE tasks 
      SET priority = 'normal' 
      WHERE priority IN ('low','medium','high') OR priority IS NULL OR priority = ''
    `);
    console.log(`- 已将 ${updateNormal.affectedRows} 条记录设置为 normal`);

    const [updateUrgent] = await connection.execute(`
      UPDATE tasks 
      SET priority = 'urgent' 
      WHERE priority NOT IN ('normal','urgent') AND priority IS NOT NULL AND priority <> ''
    `);
    if (updateUrgent.affectedRows > 0) {
      console.log(`- 发现 ${updateUrgent.affectedRows} 条异常优先级，已统一设为 urgent`);
    } else {
      console.log('- 未发现额外的异常优先级');
    }

    console.log('\nStep 3/3：收缩 priority 枚举为 normal/urgent');
    await connection.execute(`
      ALTER TABLE tasks 
      MODIFY COLUMN priority ENUM('normal','urgent') NOT NULL DEFAULT 'normal'
    `);
    console.log('✅ priority 列已限制为 normal/urgent');

    console.log('\n🎉 迁移完成');
  } catch (error) {
    console.error('❌ 迁移失败：', error.message || error);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

migrate();











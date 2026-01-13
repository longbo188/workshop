const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function fixForeignKeyConstraints() {
  let connection;
  try {
    console.log('连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('开始修复外键约束问题...');

    // 1. 检查当前的外键约束
    console.log('\n1. 检查当前的外键约束...');
    const [constraints] = await connection.execute(`
      SELECT 
        CONSTRAINT_NAME,
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE REFERENCED_TABLE_NAME = 'tasks' 
      AND TABLE_SCHEMA = 'workshop_db'
    `);
    
    console.log('当前外键约束:');
    constraints.forEach((constraint) => {
      console.log(`  ${constraint.CONSTRAINT_NAME}: ${constraint.TABLE_NAME}.${constraint.COLUMN_NAME} -> ${constraint.REFERENCED_TABLE_NAME}.${constraint.REFERENCED_COLUMN_NAME}`);
    });

    // 2. 检查work_reports表中的数据
    console.log('\n2. 检查work_reports表中的数据...');
    const [workReports] = await connection.execute(`
      SELECT wr.*, t.status as task_status 
      FROM work_reports wr 
      LEFT JOIN tasks t ON wr.task_id = t.id 
      ORDER BY wr.id DESC 
      LIMIT 10
    `);
    
    console.log(`work_reports表中有 ${workReports.length} 条记录（显示最近10条）:`);
    workReports.forEach((report, index) => {
      console.log(`  ${index + 1}. ID: ${report.id}, Task ID: ${report.task_id}, Work Type: ${report.work_type}, Task Status: ${report.task_status}`);
    });

    // 3. 检查是否有孤立的work_reports记录
    console.log('\n3. 检查孤立的work_reports记录...');
    const [orphanedReports] = await connection.execute(`
      SELECT wr.id, wr.task_id, wr.work_type, wr.created_at
      FROM work_reports wr 
      LEFT JOIN tasks t ON wr.task_id = t.id 
      WHERE t.id IS NULL
    `);
    
    if (orphanedReports.length > 0) {
      console.log(`发现 ${orphanedReports.length} 条孤立的work_reports记录:`);
      orphanedReports.forEach((report) => {
        console.log(`  ID: ${report.id}, Task ID: ${report.task_id}, Work Type: ${report.work_type}, Created: ${report.created_at}`);
      });
    } else {
      console.log('没有发现孤立的work_reports记录');
    }

    // 4. 提供解决方案选项
    console.log('\n4. 解决方案选项:');
    console.log('A. 删除孤立的work_reports记录（如果存在）');
    console.log('B. 删除所有work_reports记录（清空报工历史）');
    console.log('C. 修改外键约束为CASCADE（自动级联删除）');
    console.log('D. 暂时禁用外键约束');

    // 5. 执行选项A：删除孤立的记录
    if (orphanedReports.length > 0) {
      console.log('\n5. 执行选项A：删除孤立的work_reports记录...');
      await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
      
      const [deleteResult] = await connection.execute(`
        DELETE wr FROM work_reports wr 
        LEFT JOIN tasks t ON wr.task_id = t.id 
        WHERE t.id IS NULL
      `);
      
      await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
      console.log(`删除了 ${deleteResult.affectedRows} 条孤立的记录`);
    }

    // 6. 执行选项C：修改外键约束为CASCADE
    console.log('\n6. 执行选项C：修改外键约束为CASCADE...');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    
    // 删除现有的外键约束
    try {
      await connection.execute('ALTER TABLE work_reports DROP FOREIGN KEY fk_work_reports_task_id');
      console.log('删除了现有的外键约束');
    } catch (error) {
      console.log('删除外键约束时出现警告（可能不存在）:', error.message);
    }
    
    // 重新创建外键约束，使用CASCADE
    try {
      await connection.execute(`
        ALTER TABLE work_reports 
        ADD CONSTRAINT fk_work_reports_task_id 
        FOREIGN KEY (task_id) REFERENCES tasks(id) 
        ON DELETE CASCADE ON UPDATE CASCADE
      `);
      console.log('重新创建了外键约束（CASCADE模式）');
    } catch (error) {
      console.log('创建外键约束时出现错误:', error.message);
    }
    
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    // 7. 验证修复结果
    console.log('\n7. 验证修复结果...');
    const [newConstraints] = await connection.execute(`
      SELECT 
        CONSTRAINT_NAME,
        DELETE_RULE,
        UPDATE_RULE
      FROM information_schema.REFERENTIAL_CONSTRAINTS 
      WHERE CONSTRAINT_NAME = 'fk_work_reports_task_id'
      AND CONSTRAINT_SCHEMA = 'workshop_db'
    `);
    
    if (newConstraints.length > 0) {
      console.log('外键约束已更新:');
      newConstraints.forEach((constraint) => {
        console.log(`  约束名: ${constraint.CONSTRAINT_NAME}`);
        console.log(`  删除规则: ${constraint.DELETE_RULE}`);
        console.log(`  更新规则: ${constraint.UPDATE_RULE}`);
      });
    }

    console.log('\n✅ 外键约束修复完成！');
    console.log('\n现在您可以安全地删除或更新任务，相关的work_reports记录会自动级联删除。');

  } catch (error) {
    console.error('❌ 修复外键约束失败：', error.message);
    console.error('错误详情:', error);
  } finally {
    if (connection) {
      // 确保重新启用外键检查
      try {
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
      } catch (e) {
        console.log('重新启用外键检查时出现警告:', e.message);
      }
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

fixForeignKeyConstraints();













































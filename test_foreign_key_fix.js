const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function testForeignKeyFix() {
  let connection;
  try {
    console.log('连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('测试外键约束修复...');

    // 1. 检查当前状态
    console.log('\n1. 检查当前状态...');
    const [tasks] = await connection.execute('SELECT id, name, status FROM tasks ORDER BY id DESC LIMIT 5');
    const [workReports] = await connection.execute('SELECT id, task_id, work_type FROM work_reports ORDER BY id DESC LIMIT 5');
    
    console.log('最近5个任务:');
    tasks.forEach((task) => {
      console.log(`  ID: ${task.id}, Name: ${task.name}, Status: ${task.status}`);
    });
    
    console.log('\n最近5个报工记录:');
    workReports.forEach((report) => {
      console.log(`  ID: ${report.id}, Task ID: ${report.task_id}, Work Type: ${report.work_type}`);
    });

    // 2. 测试删除一个任务（如果有的话）
    console.log('\n2. 测试删除任务...');
    const [testTasks] = await connection.execute('SELECT id, name FROM tasks WHERE id > 1100 LIMIT 1');
    
    if (testTasks.length > 0) {
      const testTask = testTasks[0];
      console.log(`尝试删除任务 ID: ${testTask.id}, Name: ${testTask.name}`);
      
      // 检查这个任务是否有相关的work_reports
      const [relatedReports] = await connection.execute(
        'SELECT COUNT(*) as count FROM work_reports WHERE task_id = ?',
        [testTask.id]
      );
      console.log(`该任务有 ${relatedReports[0].count} 条相关的报工记录`);
      
      // 删除任务
      const [deleteResult] = await connection.execute('DELETE FROM tasks WHERE id = ?', [testTask.id]);
      console.log(`删除结果: 影响了 ${deleteResult.affectedRows} 行`);
      
      // 检查相关的work_reports是否也被删除
      const [remainingReports] = await connection.execute(
        'SELECT COUNT(*) as count FROM work_reports WHERE task_id = ?',
        [testTask.id]
      );
      console.log(`删除后，该任务的报工记录剩余: ${remainingReports[0].count} 条`);
      
      if (remainingReports[0].count === 0) {
        console.log('✅ 外键约束CASCADE工作正常！');
      } else {
        console.log('❌ 外键约束CASCADE可能有问题');
      }
    } else {
      console.log('没有找到合适的测试任务');
    }

    // 3. 检查最终状态
    console.log('\n3. 检查最终状态...');
    const [finalTasks] = await connection.execute('SELECT COUNT(*) as count FROM tasks');
    const [finalReports] = await connection.execute('SELECT COUNT(*) as count FROM work_reports');
    
    console.log(`最终状态: ${finalTasks[0].count} 个任务, ${finalReports[0].count} 条报工记录`);

    console.log('\n✅ 外键约束测试完成！');

  } catch (error) {
    console.error('❌ 测试失败：', error.message);
    console.error('错误详情:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

testForeignKeyFix();













































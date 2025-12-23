const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'work_app'
};

async function debugTask752() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    // 检查任务752的状态
    console.log('=== 任务752状态 ===');
    const [taskRows] = await connection.execute('SELECT * FROM tasks WHERE id = 752');
    console.log(JSON.stringify(taskRows[0], null, 2));
    
    // 检查任务752的work_reports记录
    console.log('\n=== 任务752的work_reports记录 ===');
    const [reportRows] = await connection.execute('SELECT * FROM work_reports WHERE task_id = 752 ORDER BY created_at DESC');
    console.log(JSON.stringify(reportRows, null, 2));
    
    // 检查用户3的所有work_reports记录
    console.log('\n=== 用户3的所有work_reports记录 ===');
    const [userReports] = await connection.execute('SELECT * FROM work_reports WHERE user_id = 3 ORDER BY created_at DESC LIMIT 10');
    console.log(JSON.stringify(userReports, null, 2));
    
    // 测试查询条件
    console.log('\n=== 测试查询条件 ===');
    const [testRows] = await connection.execute(`
      SELECT DISTINCT t.id, t.name, t.machining_phase, t.electrical_phase, t.pre_assembly_phase, t.post_assembly_phase, t.debugging_phase, t.status
      FROM tasks t
      WHERE t.id IN (
        SELECT DISTINCT task_id FROM work_reports 
        WHERE user_id = 3 AND work_type = 'complete'
      )
      AND (
        t.status = 'completed' 
        OR t.machining_phase = 1 
        OR t.electrical_phase = 1 
        OR t.pre_assembly_phase = 1 
        OR t.post_assembly_phase = 1 
        OR t.debugging_phase = 1
      )
    `);
    console.log(JSON.stringify(testRows, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

debugTask752();







































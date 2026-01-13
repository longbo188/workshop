const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'work_app'
};

async function testQuery() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    // 测试子查询：用户3完成的任务ID
    console.log('=== 用户3完成的任务ID ===');
    const [taskIds] = await connection.execute(`
      SELECT DISTINCT task_id FROM work_reports 
      WHERE user_id = 3 AND work_type = 'complete'
    `);
    console.log('任务ID列表:', taskIds.map(r => r.task_id));
    
    // 测试任务752是否在列表中
    const task752InList = taskIds.some(r => r.task_id === 752);
    console.log('任务752是否在列表中:', task752InList);
    
    // 测试任务752的阶段状态
    console.log('\n=== 任务752的阶段状态 ===');
    const [task752] = await connection.execute(`
      SELECT id, name, status, machining_phase, electrical_phase, pre_assembly_phase, post_assembly_phase, debugging_phase
      FROM tasks WHERE id = 752
    `);
    console.log(JSON.stringify(task752[0], null, 2));
    
    // 测试完整查询
    console.log('\n=== 完整查询结果 ===');
    const [results] = await connection.execute(`
      SELECT DISTINCT t.id, t.name, t.status, t.machining_phase, t.electrical_phase, t.pre_assembly_phase, t.post_assembly_phase, t.debugging_phase
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
      ORDER BY t.id
    `);
    console.log('查询结果数量:', results.length);
    results.forEach(r => {
      console.log(`任务${r.id}: ${r.name}, 状态: ${r.status}, 机加: ${r.machining_phase}, 电控: ${r.electrical_phase}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

testQuery();












































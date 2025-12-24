const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function setTask1421StandardHours() {
  let connection;
  try {
    console.log('为任务1421设置标准工时...');
    connection = await mysql.createConnection(dbConfig);
    
    // 使用A1000D的标准工时设置
    const [result] = await connection.execute(`
      UPDATE tasks SET 
        machining_hours_est = ?,
        electrical_hours_est = ?,
        pre_assembly_hours_est = ?,
        post_assembly_hours_est = ?,
        debugging_hours_est = ?
      WHERE id = 1421
    `, [11.80, 5.00, 10.50, 11.60, 3.20]);
    
    console.log(`更新结果: 影响了 ${result.affectedRows} 行`);
    
    // 验证设置结果
    const [rows] = await connection.execute(`
      SELECT id, name, product_model,
             machining_hours_est, electrical_hours_est, 
             pre_assembly_hours_est, post_assembly_hours_est, debugging_hours_est
      FROM tasks WHERE id = 1421
    `);
    
    if (rows.length > 0) {
      const task = rows[0];
      console.log('=== 任务1421更新后的工时信息 ===');
      console.log(`任务ID: ${task.id}`);
      console.log(`任务名称: ${task.name}`);
      console.log(`产品型号: ${task.product_model}`);
      console.log(`机加工时: ${task.machining_hours_est}`);
      console.log(`电控工时: ${task.electrical_hours_est}`);
      console.log(`总装前段工时: ${task.pre_assembly_hours_est}`);
      console.log(`总装后段工时: ${task.post_assembly_hours_est}`);
      console.log(`调试工时: ${task.debugging_hours_est}`);
    }
    
  } catch (error) {
    console.error('设置失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setTask1421StandardHours();


































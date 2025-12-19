const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function checkTask1421StandardHours() {
  let connection;
  try {
    console.log('检查任务1421的标准工时设置...');
    connection = await mysql.createConnection(dbConfig);
    
    // 查询任务1421的工时相关字段
    const [rows] = await connection.execute(`
      SELECT id, name, current_phase, product_model,
             machining_hours_est, electrical_hours_est, 
             pre_assembly_hours_est, post_assembly_hours_est, debugging_hours_est,
             estimated_hours, actual_hours
      FROM tasks 
      WHERE id = 1421
    `);
    
    if (rows.length > 0) {
      const task = rows[0];
      console.log('=== 任务1421工时信息 ===');
      console.log(`任务ID: ${task.id}`);
      console.log(`任务名称: ${task.name}`);
      console.log(`当前阶段: ${task.current_phase}`);
      console.log(`产品型号: ${task.product_model}`);
      console.log('');
      console.log('=== 各阶段预估工时 ===');
      console.log(`机加预估工时: ${task.machining_hours_est}`);
      console.log(`电控预估工时: ${task.electrical_hours_est}`);
      console.log(`总装前段预估工时: ${task.pre_assembly_hours_est}`);
      console.log(`总装后段预估工时: ${task.post_assembly_hours_est}`);
      console.log(`调试预估工时: ${task.debugging_hours_est}`);
      console.log('');
      console.log('=== 总体工时 ===');
      console.log(`预估总工时: ${task.estimated_hours}`);
      console.log(`实际总工时: ${task.actual_hours}`);
    } else {
      console.log('任务1421不存在');
    }
    
  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkTask1421StandardHours();

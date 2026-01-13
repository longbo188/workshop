const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function checkProductModelA1000D() {
  let connection;
  try {
    console.log('检查产品型号A1000D的使用情况...');
    connection = await mysql.createConnection(dbConfig);
    
    // 查询所有使用A1000D产品型号的任务
    const [rows] = await connection.execute(`
      SELECT id, name, product_model, 
             machining_hours_est, electrical_hours_est, 
             pre_assembly_hours_est, post_assembly_hours_est, debugging_hours_est
      FROM tasks 
      WHERE UPPER(TRIM(product_model)) = UPPER(TRIM(?))
      ORDER BY id
    `, ['A1000D']);
    
    console.log(`=== 产品型号A1000D的任务列表 (共${rows.length}个) ===`);
    rows.forEach((task, index) => {
      console.log(`${index + 1}. 任务ID: ${task.id}`);
      console.log(`   任务名称: ${task.name}`);
      console.log(`   产品型号: ${task.product_model}`);
      console.log(`   机加工时: ${task.machining_hours_est}`);
      console.log(`   电控工时: ${task.electrical_hours_est}`);
      console.log(`   总装前段工时: ${task.pre_assembly_hours_est}`);
      console.log(`   总装后段工时: ${task.post_assembly_hours_est}`);
      console.log(`   调试工时: ${task.debugging_hours_est}`);
      console.log('');
    });
    
    // 检查是否有任何任务已经设置了标准工时
    const hasStandardHours = rows.some(task => 
      task.machining_hours_est || task.electrical_hours_est || 
      task.pre_assembly_hours_est || task.post_assembly_hours_est || 
      task.debugging_hours_est
    );
    
    console.log(`是否有任务已设置标准工时: ${hasStandardHours ? '是' : '否'}`);
    
  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkProductModelA1000D();






































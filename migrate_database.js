const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '', // XAMPP MySQL 默认密码为空
  database: 'workshop_db'
};

async function migrateDatabase() {
  let connection;
  
  try {
    console.log('连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('开始执行数据库迁移...');
    
    // 为tasks表添加新字段（导入任务扩展）
    console.log('添加 device_number 字段...');
    await connection.execute('ALTER TABLE tasks ADD COLUMN device_number VARCHAR(100) AFTER actual_hours');
    
    console.log('添加 product_model 字段...');
    await connection.execute('ALTER TABLE tasks ADD COLUMN product_model VARCHAR(100) AFTER device_number');
    
    console.log('添加 order_status 字段...');
    await connection.execute('ALTER TABLE tasks ADD COLUMN order_status VARCHAR(50) AFTER product_model');
    
    console.log('添加 production_time 字段...');
    await connection.execute('ALTER TABLE tasks ADD COLUMN production_time DATETIME AFTER order_status');
    
    // 添加索引
    console.log('添加索引...');
    await connection.execute('CREATE INDEX idx_tasks_device_number ON tasks(device_number)');
    await connection.execute('CREATE INDEX idx_tasks_product_model ON tasks(product_model)');
    await connection.execute('CREATE INDEX idx_tasks_order_status ON tasks(order_status)');
    await connection.execute('CREATE INDEX idx_tasks_production_time ON tasks(production_time)');
    
    // 为标准工时添加新字段（如果不存在）
    console.log('添加标准工时字段...');
    try { await connection.execute("ALTER TABLE tasks ADD COLUMN machining_hours_est DECIMAL(5,2) NULL AFTER actual_hours"); } catch(e) {}
    try { await connection.execute("ALTER TABLE tasks ADD COLUMN electrical_hours_est DECIMAL(5,2) NULL AFTER machining_hours_est"); } catch(e) {}
    try { await connection.execute("ALTER TABLE tasks ADD COLUMN pre_assembly_hours_est DECIMAL(5,2) NULL AFTER electrical_hours_est"); } catch(e) {}
    try { await connection.execute("ALTER TABLE tasks ADD COLUMN post_assembly_hours_est DECIMAL(5,2) NULL AFTER pre_assembly_hours_est"); } catch(e) {}
    try { await connection.execute("ALTER TABLE tasks ADD COLUMN debugging_hours_est DECIMAL(5,2) NULL AFTER post_assembly_hours_est"); } catch(e) {}

    console.log('数据库迁移完成！');
    
    // 显示更新后的表结构
    const [columns] = await connection.execute('DESCRIBE tasks');
    console.log('\n更新后的tasks表结构:');
    columns.forEach(col => {
      console.log(`${col.Field} - ${col.Type} - ${col.Null} - ${col.Key} - ${col.Default}`);
    });
    
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('字段已存在，跳过添加...');
    } else if (error.code === 'ER_DUP_KEYNAME') {
      console.log('索引已存在，跳过创建...');
    } else {
      console.error('迁移失败:', error.message);
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

migrateDatabase();

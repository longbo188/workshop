// 数据库迁移脚本 - 添加时间段和确认状态字段
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db',
  charset: 'utf8mb4'
};

async function migrateDatabase() {
  let connection;
  
  try {
    console.log('开始数据库迁移...');
    connection = await mysql.createConnection(dbConfig);
    
    // 检查表是否存在
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = 'workshop_db' 
      AND TABLE_NAME = 'daily_attendance'
    `);
    
    if (tables.length === 0) {
      console.log('daily_attendance表不存在，创建新表...');
      await connection.execute(`
        CREATE TABLE daily_attendance (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          date DATE NOT NULL,
          standard_attendance_hours DECIMAL(5,2) NOT NULL DEFAULT 0.00,
          overtime_hours DECIMAL(5,2) NOT NULL DEFAULT 0.00,
          leave_hours DECIMAL(5,2) NOT NULL DEFAULT 0.00,
          overtime_start_time TIME NULL,
          overtime_end_time TIME NULL,
          leave_start_time TIME NULL,
          leave_end_time TIME NULL,
          actual_hours DECIMAL(5,2) GENERATED ALWAYS AS (standard_attendance_hours + overtime_hours - leave_hours) STORED,
          is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
          confirmed_by INT NULL,
          confirmed_at TIMESTAMP NULL,
          note TEXT NULL,
          adjusted_by INT NULL,
          adjusted_at TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_user_date (user_id, date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('daily_attendance表创建成功');
    } else {
      console.log('daily_attendance表已存在，检查字段...');
      
      // 检查并添加时间段字段
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = 'workshop_db' 
        AND TABLE_NAME = 'daily_attendance'
        AND COLUMN_NAME IN ('overtime_start_time', 'overtime_end_time', 'leave_start_time', 'leave_end_time')
      `);
      
      const existingColumns = columns.map(col => col.COLUMN_NAME);
      
      if (!existingColumns.includes('overtime_start_time')) {
        console.log('添加overtime_start_time字段...');
        await connection.execute(`
          ALTER TABLE daily_attendance 
          ADD COLUMN overtime_start_time TIME NULL
        `);
      }
      
      if (!existingColumns.includes('overtime_end_time')) {
        console.log('添加overtime_end_time字段...');
        await connection.execute(`
          ALTER TABLE daily_attendance 
          ADD COLUMN overtime_end_time TIME NULL
        `);
      }
      
      if (!existingColumns.includes('leave_start_time')) {
        console.log('添加leave_start_time字段...');
        await connection.execute(`
          ALTER TABLE daily_attendance 
          ADD COLUMN leave_start_time TIME NULL
        `);
      }
      
      if (!existingColumns.includes('leave_end_time')) {
        console.log('添加leave_end_time字段...');
        await connection.execute(`
          ALTER TABLE daily_attendance 
          ADD COLUMN leave_end_time TIME NULL
        `);
      }
      
      // 检查并添加确认状态字段
      const [confirmColumns] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = 'workshop_db' 
        AND TABLE_NAME = 'daily_attendance'
        AND COLUMN_NAME IN ('is_confirmed', 'confirmed_by', 'confirmed_at')
      `);
      
      const existingConfirmColumns = confirmColumns.map(col => col.COLUMN_NAME);
      
      if (!existingConfirmColumns.includes('is_confirmed')) {
        console.log('添加is_confirmed字段...');
        await connection.execute(`
          ALTER TABLE daily_attendance 
          ADD COLUMN is_confirmed BOOLEAN NOT NULL DEFAULT FALSE
        `);
      }
      
      if (!existingConfirmColumns.includes('confirmed_by')) {
        console.log('添加confirmed_by字段...');
        await connection.execute(`
          ALTER TABLE daily_attendance 
          ADD COLUMN confirmed_by INT NULL
        `);
      }
      
      if (!existingConfirmColumns.includes('confirmed_at')) {
        console.log('添加confirmed_at字段...');
        await connection.execute(`
          ALTER TABLE daily_attendance 
          ADD COLUMN confirmed_at TIMESTAMP NULL
        `);
      }
      
      console.log('字段检查完成');
    }
    
    // 验证表结构
    const [finalColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'workshop_db' 
      AND TABLE_NAME = 'daily_attendance'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('\n当前表结构:');
    finalColumns.forEach(col => {
      console.log(`  ${col.COLUMN_NAME}: ${col.DATA_TYPE} ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'} ${col.COLUMN_DEFAULT ? `DEFAULT ${col.COLUMN_DEFAULT}` : ''}`);
    });
    
    console.log('\n数据库迁移完成！');
    
  } catch (error) {
    console.error('数据库迁移失败:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 运行迁移
migrateDatabase()
  .then(() => {
    console.log('迁移脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('迁移脚本执行失败:', error);
    process.exit(1);
  });

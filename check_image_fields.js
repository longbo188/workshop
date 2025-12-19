const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function checkImageFields() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // 查看exception_reports表结构
    const [columns] = await connection.execute('DESCRIBE exception_reports');
    console.log('📋 exception_reports 表结构:');
    console.table(columns);
    
    // 检查是否有图片相关字段
    const imageFields = columns.filter(col => 
      col.Field.includes('image') || 
      col.Field.includes('photo') || 
      col.Field.includes('file') ||
      col.Field.includes('attachment')
    );
    
    console.log('\n🖼️ 图片相关字段:');
    if (imageFields.length > 0) {
      console.table(imageFields);
    } else {
      console.log('❌ 没有找到图片相关字段');
    }
    
    // 查看现有数据中是否有图片信息
    const [rows] = await connection.execute(`
      SELECT id, description, exception_type, status 
      FROM exception_reports 
      ORDER BY id DESC 
      LIMIT 5
    `);
    
    console.log('\n📋 最近的异常报告数据:');
    console.table(rows);
    
  } catch (error) {
    console.error('❌ 数据库操作失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkImageFields();




































const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function addTaskOrderFields() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log('开始添加任务排序字段...');

    // 检查字段是否已存在
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = 'work_app' 
       AND TABLE_NAME = 'tasks' 
       AND COLUMN_NAME IN (
         'machining_order', 
         'electrical_order', 
         'pre_assembly_order', 
         'post_assembly_order', 
         'debugging_order'
       )`
    );

    const existingFields = columns.map(col => col.COLUMN_NAME);

    // 添加缺失的字段
    const orderFields = [
      { name: 'machining_order', desc: '机加阶段紧急顺序' },
      { name: 'electrical_order', desc: '电控阶段紧急顺序' },
      { name: 'pre_assembly_order', desc: '预装阶段紧急顺序' },
      { name: 'post_assembly_order', desc: '总装阶段紧急顺序' },
      { name: 'debugging_order', desc: '调试阶段紧急顺序' }
    ];

    for (const field of orderFields) {
      if (!existingFields.includes(field.name)) {
        await connection.execute(
          `ALTER TABLE tasks ADD COLUMN ${field.name} INT DEFAULT NULL COMMENT '${field.desc}，数字越小越紧急'`
        );
        console.log(`✓ 已添加字段: ${field.name}`);
      } else {
        console.log(`- 字段已存在: ${field.name}`);
      }
    }

    console.log('任务排序字段添加完成');
  } catch (error) {
    console.error('添加任务排序字段失败:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// 运行迁移
addTaskOrderFields()
  .then(() => {
    console.log('✓ 迁移完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('✗ 迁移失败:', error);
    process.exit(1);
  });


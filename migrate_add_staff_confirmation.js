// 数据库迁移脚本：添加staff确认功能
const mysql = require('mysql2/promise');

// 数据库配置（与backend/server.js保持一致）
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function migrate() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！\n');

    // 1. 检查表结构
    console.log('步骤1: 检查exception_reports表结构...');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'workshop_db' 
      AND TABLE_NAME = 'exception_reports'
    `);
    
    const columnNames = columns.map(col => col.COLUMN_NAME);
    console.log(`当前表有 ${columnNames.length} 个字段`);

    // 2. 添加staff确认相关字段
    const fieldsToAdd = [
      { 
        name: 'assigned_to_staff_id', 
        type: 'INT', 
        nullable: 'NULL', 
        comment: '转给staff确认的用户ID' 
      },
      { 
        name: 'staff_confirmed_at', 
        type: 'DATETIME', 
        nullable: 'NULL', 
        comment: 'staff确认时间' 
      },
      { 
        name: 'staff_confirmation_note', 
        type: 'TEXT', 
        nullable: 'NULL', 
        comment: 'staff确认备注' 
      }
    ];

    console.log('\n步骤2: 添加staff确认相关字段...');
    for (const field of fieldsToAdd) {
      if (!columnNames.includes(field.name)) {
        try {
          await connection.execute(`
            ALTER TABLE exception_reports 
            ADD COLUMN ${field.name} ${field.type} ${field.nullable} COMMENT '${field.comment}'
          `);
          console.log(`✅ 添加字段 ${field.name} 成功`);
        } catch (error) {
          if (error.code === 'ER_DUP_FIELDNAME') {
            console.log(`⚠️  字段 ${field.name} 已存在，跳过`);
          } else {
            throw error;
          }
        }
      } else {
        console.log(`⚠️  字段 ${field.name} 已存在，跳过`);
      }
    }

    // 3. 添加外键约束（如果不存在）
    console.log('\n步骤3: 检查并添加外键约束...');
    try {
      // 先检查外键是否存在
      const [fkRows] = await connection.execute(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = 'workshop_db' 
        AND TABLE_NAME = 'exception_reports' 
        AND COLUMN_NAME = 'assigned_to_staff_id'
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `);
      
      if (fkRows.length === 0) {
        await connection.execute(`
          ALTER TABLE exception_reports 
          ADD FOREIGN KEY (assigned_to_staff_id) REFERENCES users(id) ON DELETE SET NULL
        `);
        console.log('✅ 添加外键约束成功');
      } else {
        console.log('⚠️  外键约束已存在，跳过');
      }
    } catch (error) {
      if (error.code === 'ER_DUP_KEY' || error.code === 'ER_FK_DUP_NAME') {
        console.log('⚠️  外键约束已存在，跳过');
      } else {
        console.log(`⚠️  添加外键约束时出错: ${error.message}，继续执行`);
      }
    }

    // 4. 验证修改结果
    console.log('\n步骤4: 验证修改结果...');
    const [finalColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'workshop_db' 
      AND TABLE_NAME = 'exception_reports'
      AND COLUMN_NAME IN ('assigned_to_staff_id', 'staff_confirmed_at', 'staff_confirmation_note')
    `);
    
    if (finalColumns.length > 0) {
      console.log('\n已添加的字段：');
      finalColumns.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? '可空' : '非空'}) - ${col.COLUMN_COMMENT || '无注释'}`);
      });
    }

    console.log('\n🎉 迁移成功完成！');

  } catch (error) {
    console.error('\n❌ 迁移失败！');
    console.error('错误信息:', error.message);
    console.error('详细错误:', error);
    
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n提示：数据库不存在，请先创建数据库 workshop_db');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n提示：数据库访问被拒绝，请检查用户名和密码');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n提示：无法连接到数据库，请确保MySQL服务正在运行');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭。');
    }
  }
}

// 执行迁移
console.log('========================================');
console.log('数据库迁移：添加staff确认功能');
console.log('========================================\n');
migrate();








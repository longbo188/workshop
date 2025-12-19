// 数据库迁移脚本：添加二级审批功能
const mysql = require('mysql2/promise');

// 数据库配置（与backend/server.js保持一致）
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '', // XAMPP MySQL 默认密码（如果没改就是空字符串）
  database: 'workshop_db'
};

async function migrate() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！');

    // 1. 检查表结构
    console.log('\n步骤1: 检查exception_reports表结构...');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'workshop_db' AND TABLE_NAME = 'exception_reports'
      ORDER BY ORDINAL_POSITION
    `);
    
    const columnNames = columns.map(col => col.COLUMN_NAME);
    console.log(`当前表有 ${columnNames.length} 个字段`);

    // 2. 添加一级审批字段（如果不存在）
    const fieldsToAdd = [
      { name: 'first_approver_id', type: 'INT', nullable: 'NULL', comment: '一级审批人ID（主管）' },
      { name: 'first_approved_at', type: 'DATETIME', nullable: 'NULL', comment: '一级审批时间' },
      { name: 'first_approval_note', type: 'TEXT', nullable: 'NULL', comment: '一级审批备注' },
      { name: 'second_approver_id', type: 'INT', nullable: 'NULL', comment: '二级审批人ID（经理）' },
      { name: 'second_approved_at', type: 'DATETIME', nullable: 'NULL', comment: '二级审批时间' },
      { name: 'second_approval_note', type: 'TEXT', nullable: 'NULL', comment: '二级审批备注' },
      { name: 'modified_exception_type', type: 'VARCHAR(100)', nullable: 'NULL', comment: '主管修改后的异常类型' },
      { name: 'modified_description', type: 'TEXT', nullable: 'NULL', comment: '主管修改后的异常描述' },
      { name: 'modified_start_datetime', type: 'DATETIME', nullable: 'NULL', comment: '主管修改后的异常开始时间' },
      { name: 'modified_end_datetime', type: 'DATETIME', nullable: 'NULL', comment: '主管修改后的异常结束时间' }
    ];

    console.log('\n步骤2: 添加二级审批相关字段...');
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
      const [foreignKeys] = await connection.execute(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = 'workshop_db' 
        AND TABLE_NAME = 'exception_reports' 
        AND COLUMN_NAME IN ('first_approver_id', 'second_approver_id')
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `);

      const existingKeys = foreignKeys.map(fk => fk.CONSTRAINT_NAME);

      if (!existingKeys.some(key => key.includes('first_approver'))) {
        await connection.execute(`
          ALTER TABLE exception_reports 
          ADD CONSTRAINT fk_first_approver 
          FOREIGN KEY (first_approver_id) REFERENCES users(id) ON DELETE SET NULL
        `);
        console.log('✅ 添加first_approver_id外键成功');
      } else {
        console.log('⚠️  first_approver_id外键已存在，跳过');
      }

      if (!existingKeys.some(key => key.includes('second_approver'))) {
        await connection.execute(`
          ALTER TABLE exception_reports 
          ADD CONSTRAINT fk_second_approver 
          FOREIGN KEY (second_approver_id) REFERENCES users(id) ON DELETE SET NULL
        `);
        console.log('✅ 添加second_approver_id外键成功');
      } else {
        console.log('⚠️  second_approver_id外键已存在，跳过');
      }
    } catch (error) {
      if (error.code === 'ER_DUP_KEY' || error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️  外键已存在，跳过');
      } else {
        console.log('⚠️  添加外键时出错（可能已存在）:', error.message);
      }
    }

    // 4. 验证修改结果
    console.log('\n步骤4: 验证修改结果...');
    const [finalColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'workshop_db' AND TABLE_NAME = 'exception_reports'
      AND COLUMN_NAME IN (
        'first_approver_id', 'first_approved_at', 'first_approval_note',
        'second_approver_id', 'second_approved_at', 'second_approval_note',
        'modified_exception_type', 'modified_description',
        'modified_start_datetime', 'modified_end_datetime'
      )
      ORDER BY COLUMN_NAME
    `);

    if (finalColumns.length > 0) {
      console.log(`\n✅ 成功添加 ${finalColumns.length} 个字段：`);
      finalColumns.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE}, ${col.IS_NULLABLE === 'YES' ? '可空' : '非空'})`);
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
console.log('数据库迁移：添加二级审批功能');
console.log('========================================\n');
migrate();















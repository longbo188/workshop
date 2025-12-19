// 数据库迁移脚本：添加manager角色并更新用户ID 86的角色
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

    // 1. 修改users表的role字段，添加manager角色
    console.log('\n步骤1: 修改users表的role字段，添加manager角色...');
    await connection.execute(`
      ALTER TABLE users MODIFY COLUMN role ENUM('worker', 'supervisor', 'admin', 'manager') DEFAULT 'worker'
    `);
    console.log('✅ role字段修改成功！');

    // 2. 检查用户ID 86是否存在
    console.log('\n步骤2: 检查用户ID 86是否存在...');
    const [userRows] = await connection.execute(
      'SELECT id, username, name, role, department FROM users WHERE id = ?',
      [86]
    );

    if (userRows.length === 0) {
      console.log('⚠️  警告：用户ID 86不存在！');
      console.log('迁移将继续，但不会更新任何用户的角色。');
    } else {
      const user = userRows[0];
      console.log(`找到用户: ID=${user.id}, 用户名=${user.username}, 姓名=${user.name}, 当前角色=${user.role}`);

      // 3. 将用户ID 86的角色更新为manager
      console.log('\n步骤3: 将用户ID 86的角色更新为manager...');
      const [updateResult] = await connection.execute(
        'UPDATE users SET role = ? WHERE id = ?',
        ['manager', 86]
      );

      if (updateResult.affectedRows > 0) {
        console.log(`✅ 用户ID 86的角色已成功更新为manager！`);
      } else {
        console.log('⚠️  警告：更新操作未影响任何行。');
      }

      // 4. 验证更新结果
      console.log('\n步骤4: 验证更新结果...');
      const [verifyRows] = await connection.execute(
        'SELECT id, username, name, role, department FROM users WHERE id = ?',
        [86]
      );

      if (verifyRows.length > 0) {
        const updatedUser = verifyRows[0];
        console.log('验证结果:');
        console.log(`  ID: ${updatedUser.id}`);
        console.log(`  用户名: ${updatedUser.username}`);
        console.log(`  姓名: ${updatedUser.name}`);
        console.log(`  角色: ${updatedUser.role} ${updatedUser.role === 'manager' ? '✅' : '❌'}`);
        console.log(`  部门: ${updatedUser.department || '未设置'}`);

        if (updatedUser.role === 'manager') {
          console.log('\n🎉 迁移成功完成！');
        } else {
          console.log('\n⚠️  警告：角色更新可能未成功，请检查！');
        }
      }
    }

    // 5. 显示所有manager角色的用户
    console.log('\n步骤5: 查询所有manager角色的用户...');
    const [managerUsers] = await connection.execute(
      'SELECT id, username, name, role, department FROM users WHERE role = ?',
      ['manager']
    );

    if (managerUsers.length > 0) {
      console.log(`找到 ${managerUsers.length} 个manager角色的用户：`);
      managerUsers.forEach(user => {
        console.log(`  - ID: ${user.id}, 用户名: ${user.username}, 姓名: ${user.name}, 部门: ${user.department || '未设置'}`);
      });
    } else {
      console.log('当前没有manager角色的用户。');
    }

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
console.log('数据库迁移：添加manager角色');
console.log('========================================\n');
migrate();















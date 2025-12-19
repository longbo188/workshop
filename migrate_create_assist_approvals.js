const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'workshop_db',
  multipleStatements: true,
};

async function migrate() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS assist_approvals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT NOT NULL,
        phase_key VARCHAR(50) NOT NULL,
        assistant_user_id INT NOT NULL,
        assist_start DATETIME NOT NULL,
        assist_end DATETIME NOT NULL,
        manager_id INT NOT NULL,
        requested_by INT NOT NULL,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        decision_note TEXT NULL,
        decision_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        FOREIGN KEY (assistant_user_id) REFERENCES users(id),
        FOREIGN KEY (manager_id) REFERENCES users(id),
        FOREIGN KEY (requested_by) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('assist_approvals 表已就绪');
  } catch (error) {
    console.error('迁移失败:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrate()
  .then(() => {
    console.log('迁移脚本执行成功');
    process.exit(0);
  })
  .catch((error) => {
    console.error('迁移脚本执行失败:', error);
    process.exit(1);
  });








const express = require('express'); // 后端框架
const mysql = require('mysql2/promise'); // 连接 MySQL
const cors = require('cors'); // 解决跨域问题（前端和后端端口不同时需要）
const multer = require('multer'); // 文件上传中间件
const XLSX = require('xlsx'); // Excel文件解析库
const path = require('path'); // 路径处理模块
const fs = require('fs'); // 文件系统模块
const https = require('https'); // HTTP客户端，用于调用GitHub API
const archiver = require('archiver'); // 用于打包zip

// 2. 创建后端服务
const app = express();
app.use(cors()); // 允许跨域请求
app.use(express.json()); // 支持接收 JSON 格式的数据
app.use(express.urlencoded({ extended: true })); // 支持接收表单数据

// 配置文件上传
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  },
  fileFilter: (req, file, cb) => {
    // 允许Excel文件和图片文件
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只支持Excel文件和图片格式'), false);
    }
  }
});

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 3. 配置数据库连接（关键！填你的 MySQL 信息）
const dbConfig = {
  host: 'localhost', // 本地数据库（XAMPP 默认）
  user: 'root', // XAMPP MySQL 默认用户名
  port:3307,
  password: 'Magicray2025!', // XAMPP MySQL 默认密码（如果没改就是空字符串）
  database: 'workshop_db' // 你创建的数据库名
};

function normalizePriority(value) {
  if (!value && value !== 0) {
    return 'normal';
  }
  const text = String(value).toLowerCase().trim();
  if (
    text === 'urgent' ||
    text === 'high' ||
    text === '紧急' ||
    text === '高' ||
    text.includes('紧急') ||
    text.includes('高') ||
    text === 'y' ||
    text === 'yes' ||
    text === 'true'
  ) {
    return 'urgent';
  }
  if (text === '1') {
    return 'urgent';
  }
  return 'normal';
}

// 初始化：创建日考勤表和法定节假日表
(async () => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // 创建日考勤表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS daily_attendance (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('考勤表校验完成');
    
    // 迁移时间字段格式：TIME -> VARCHAR(5) 支持HH:MM格式
    try {
      await connection.execute(`
        ALTER TABLE daily_attendance 
        MODIFY COLUMN overtime_start_time VARCHAR(5) NULL,
        MODIFY COLUMN overtime_end_time VARCHAR(5) NULL,
        MODIFY COLUMN leave_start_time VARCHAR(5) NULL,
        MODIFY COLUMN leave_end_time VARCHAR(5) NULL
      `);
      console.log('daily_attendance时间字段格式迁移完成');
    } catch (error) {
      // 如果字段已经是VARCHAR类型，忽略错误
      if (!error.message.includes('Duplicate column name') && !error.message.includes('already exists')) {
        console.log('daily_attendance时间字段格式迁移跳过（可能已经完成）');
      }
    }

    // 迁移工作时间设置表的时间字段格式
    try {
      await connection.execute(`
        ALTER TABLE work_time_settings 
        MODIFY COLUMN start_time VARCHAR(5) NOT NULL,
        MODIFY COLUMN end_time VARCHAR(5) NOT NULL,
        MODIFY COLUMN lunch_start_time VARCHAR(5) NOT NULL,
        MODIFY COLUMN lunch_end_time VARCHAR(5) NOT NULL,
        MODIFY COLUMN other_break_start_time VARCHAR(5),
        MODIFY COLUMN other_break_end_time VARCHAR(5)
      `);
      console.log('work_time_settings时间字段格式迁移完成');
    } catch (error) {
      // 如果字段已经是VARCHAR类型，忽略错误
      if (!error.message.includes('Duplicate column name') && !error.message.includes('already exists')) {
        console.log('work_time_settings时间字段格式迁移跳过（可能已经完成）');
      }
    }
    
    // 创建法定节假日表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS holidays (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date DATE NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        type ENUM('national', 'company') DEFAULT 'national',
        is_working_day BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('节假日表校验完成');
    
    // 创建任务表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
        priority ENUM('normal', 'urgent') DEFAULT 'normal',
        created_by INT,
        start_time DATETIME,
        end_time DATETIME,
        estimated_hours DECIMAL(5,2),
        actual_hours DECIMAL(5,2),
        machining_hours_est DECIMAL(5,2) NULL,
        electrical_hours_est DECIMAL(5,2) NULL,
        pre_assembly_hours_est DECIMAL(5,2) NULL,
        post_assembly_hours_est DECIMAL(5,2) NULL,
        debugging_hours_est DECIMAL(5,2) NULL,
        machining_phase TINYINT(1) DEFAULT 0,
        electrical_phase TINYINT(1) DEFAULT 0,
        pre_assembly_phase TINYINT(1) DEFAULT 0,
        post_assembly_phase TINYINT(1) DEFAULT 0,
        debugging_phase TINYINT(1) DEFAULT 0,
        device_number VARCHAR(100),
        product_model VARCHAR(100),
        order_status VARCHAR(50),
        production_time DATETIME,
        promised_completion_time DATETIME,
        is_non_standard TINYINT(1) DEFAULT 0 COMMENT '是否非标：0=否，1=是',
        current_phase VARCHAR(50),
        current_phase_assignee INT,
        machining_assignee INT NULL,
        electrical_assignee INT NULL,
        machining_start_time DATETIME NULL,
        electrical_start_time DATETIME NULL,
        pre_assembly_start_time DATETIME NULL,
        post_assembly_start_time DATETIME NULL,
        debugging_start_time DATETIME NULL,
        machining_complete_time DATETIME NULL,
        electrical_complete_time DATETIME NULL,
        pre_assembly_complete_time DATETIME NULL,
        post_assembly_complete_time DATETIME NULL,
        debugging_complete_time DATETIME NULL,
        task_pool_status ENUM('unassigned', 'assigned', 'in_progress', 'completed') DEFAULT 'unassigned',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (current_phase_assignee) REFERENCES users(id),
        FOREIGN KEY (machining_assignee) REFERENCES users(id),
        FOREIGN KEY (electrical_assignee) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('任务表校验完成');
    
    // 创建报工记录表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS work_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT NOT NULL,
        user_id INT NOT NULL,
        work_type ENUM('start', 'pause', 'resume', 'complete', 'quality_check', 'assist') NOT NULL,
        assist_phase VARCHAR(50) DEFAULT NULL,
        assist_start DATETIME NULL,
        assist_end DATETIME NULL,
        start_time DATETIME,
        end_time DATETIME,
        hours_worked DECIMAL(5,2),
        quantity_completed INT DEFAULT 0,
        quality_notes TEXT,
        issues TEXT,
        approval_status ENUM('pending', 'approved', 'rejected') DEFAULT NULL,
        approval_note TEXT,
        approved_by INT,
        approved_at DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (approved_by) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('报工记录表校验完成');
    
    // 任务表字段已在创建时包含，无需额外添加
    
    // 插入2025年法定节假日数据
    await connection.execute(`
      INSERT IGNORE INTO holidays (date, name, type, is_working_day) VALUES
      ('2025-01-01', '元旦', 'national', FALSE),
      ('2025-01-28', '春节', 'national', FALSE),
      ('2025-01-29', '春节', 'national', FALSE),
      ('2025-01-30', '春节', 'national', FALSE),
      ('2025-01-31', '春节', 'national', FALSE),
      ('2025-02-01', '春节', 'national', FALSE),
      ('2025-02-02', '春节', 'national', FALSE),
      ('2025-02-03', '春节', 'national', FALSE),
      ('2025-04-05', '清明节', 'national', FALSE),
      ('2025-04-06', '清明节', 'national', FALSE),
      ('2025-04-07', '清明节', 'national', FALSE),
      ('2025-05-01', '劳动节', 'national', FALSE),
      ('2025-05-02', '劳动节', 'national', FALSE),
      ('2025-05-03', '劳动节', 'national', FALSE),
      ('2025-05-04', '劳动节', 'national', FALSE),
      ('2025-05-05', '劳动节', 'national', FALSE),
      ('2025-06-14', '端午节', 'national', FALSE),
      ('2025-09-15', '中秋节', 'national', FALSE),
      ('2025-09-16', '中秋节', 'national', FALSE),
      ('2025-09-17', '中秋节', 'national', FALSE),
      ('2025-10-01', '国庆节', 'national', FALSE),
      ('2025-10-02', '国庆节', 'national', FALSE),
      ('2025-10-03', '国庆节', 'national', FALSE),
      ('2025-10-04', '国庆节', 'national', FALSE),
      ('2025-10-05', '国庆节', 'national', FALSE),
      ('2025-10-06', '国庆节', 'national', FALSE),
      ('2025-10-07', '国庆节', 'national', FALSE)
    `);
    console.log('法定节假日数据初始化完成');
    
    await connection.end();
  } catch (e) {
    console.error('数据库初始化失败：', e.message);
  }
})();

// 4. 用户认证接口
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const connection = await mysql.createConnection(dbConfig);
    
    const [rows] = await connection.execute(
      'SELECT id, username, name, role, department, user_group FROM users WHERE username = ? AND password = ?',
      [username, password]
    );
    
    await connection.end();
    
    if (rows.length > 0) {
      res.json({ success: true, user: rows[0] });
    } else {
      res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
  } catch (error) {
    res.status(500).json({ error: '登录失败：' + error.message });
  }
});

// 5. 获取所有生产任务
app.get('/api/tasks', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(`
      SELECT t.*, 
             u1.name as machining_assignee_name,
             u2.name as electrical_assignee_name,
             u3.name as pre_assembly_assignee_name,
             u4.name as post_assembly_assignee_name,
             u5.name as debugging_assignee_name,
             wr.approval_status as latest_completion_status,
             wr.created_at as latest_completion_created_at,
             t.machining_start_time, t.electrical_start_time, t.pre_assembly_start_time, 
             t.post_assembly_start_time, t.debugging_start_time,
             t.machining_complete_time, t.electrical_complete_time, t.pre_assembly_complete_time, 
             t.post_assembly_complete_time, t.debugging_complete_time
      FROM tasks t
      LEFT JOIN users u1 ON t.machining_assignee = u1.id
      LEFT JOIN users u2 ON t.electrical_assignee = u2.id
      LEFT JOIN users u3 ON t.pre_assembly_assignee = u3.id
      LEFT JOIN users u4 ON t.post_assembly_assignee = u4.id
      LEFT JOIN users u5 ON t.debugging_assignee = u5.id
      LEFT JOIN (
        SELECT x.task_id, w.approval_status, w.created_at
        FROM (
          SELECT task_id, MAX(id) AS last_id
          FROM work_reports
          WHERE work_type = 'complete'
          GROUP BY task_id
        ) x
        JOIN work_reports w ON w.id = x.last_id
      ) wr ON wr.task_id = t.id
      ORDER BY t.created_at DESC
    `);
    
    // 为每个任务添加协助人员信息
    const enrichedTasks = [];
    for (let task of rows) {
      const [assistColumn] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME='work_reports' 
          AND TABLE_SCHEMA=DATABASE()
          AND COLUMN_NAME='assist_start'
      `);
      const hasAssistColumns = assistColumn.length > 0;
      const [assistants] = await connection.execute(`
        SELECT 
          wr.user_id as id,
          u.name as name,
          wr.quality_notes as reason,
          wr.assist_phase,
          ${hasAssistColumns ? 'wr.assist_start, wr.assist_end,' : 'NULL as assist_start, NULL as assist_end,'}
          wr.created_at
        FROM work_reports wr
        JOIN users u ON wr.user_id = u.id
        WHERE wr.task_id = ? 
          AND wr.work_type = 'assist' 
          AND wr.approval_status = 'approved'
        ORDER BY wr.created_at DESC
      `, [task.id]);
      enrichedTasks.push({
        ...task,
        assistants: assistants || []
      });
    }

    await connection.end();
    res.json(enrichedTasks);
  } catch (error) {
    res.status(500).json({ error: '获取任务失败：' + error.message });
  }
});

// 5.1 获取单个任务详情
app.get('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(`
      SELECT t.*, 
             u1.name as machining_assignee_name,
             u2.name as electrical_assignee_name,
             u3.name as pre_assembly_assignee_name,
             u4.name as post_assembly_assignee_name,
             u5.name as debugging_assignee_name,
             wr.approval_status as latest_completion_status,
             wr.created_at as latest_completion_created_at,
             t.machining_start_time, t.electrical_start_time, t.pre_assembly_start_time, 
             t.post_assembly_start_time, t.debugging_start_time,
             t.machining_complete_time, t.electrical_complete_time, t.pre_assembly_complete_time, 
             t.post_assembly_complete_time, t.debugging_complete_time
      FROM tasks t
      LEFT JOIN users u1 ON t.machining_assignee = u1.id
      LEFT JOIN users u2 ON t.electrical_assignee = u2.id
      LEFT JOIN users u3 ON t.pre_assembly_assignee = u3.id
      LEFT JOIN users u4 ON t.post_assembly_assignee = u4.id
      LEFT JOIN users u5 ON t.debugging_assignee = u5.id
      LEFT JOIN (
        SELECT x.task_id, w.approval_status, w.created_at
        FROM (
          SELECT task_id, MAX(id) AS last_id
          FROM work_reports
          WHERE work_type = 'complete'
          GROUP BY task_id
        ) x
        JOIN work_reports w ON w.id = x.last_id
      ) wr ON wr.task_id = t.id
      WHERE t.id = ?
    `, [id]);
    await connection.end();
    
    if (rows.length === 0) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ error: '获取任务失败：' + error.message });
  }
});

// 5.1 创建任务
app.post('/api/tasks', async (req, res) => {
  try {
    const { name, description, status, priority, device_number, product_model, order_status, production_time, promised_completion_time, created_by } = req.body;
    const normalizedPriority = normalizePriority(priority);
    
    if (!name) {
      return res.status(400).json({ success: false, message: '任务名称必填' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      `INSERT INTO tasks (name, description, status, priority, device_number, product_model, order_status, production_time, promised_completion_time, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description || null, status || 'pending', normalizedPriority, device_number || null, product_model || null, order_status || null, production_time || null, promised_completion_time || null, created_by || null]
    );
    await connection.end();
    
    res.json({ success: true, message: '任务创建成功', id: result.insertId });
  } catch (error) {
    console.error('创建任务失败:', error);
    res.status(500).json({ success: false, message: '创建任务失败: ' + error.message });
  }
});

// 5.2 更新任务（保护阶段和进度相关字段）
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const updateData = req.body;
    
    // 允许更新的字段列表（排除阶段和进度相关字段，防止误操作）
    const allowedFields = [
      'name', 'description', 'status', 'priority', 
      'device_number', 'product_model', 'order_status',
      'production_time', 'promised_completion_time',
      'estimated_hours', 'machining_hours_est', 'electrical_hours_est',
      'pre_assembly_hours_est', 'post_assembly_hours_est', 'debugging_hours_est',
      'machining_assignee', 'electrical_assignee', 'pre_assembly_assignee',
      'post_assembly_assignee', 'debugging_assignee',
      'machining_order', 'electrical_order', 'pre_assembly_order', 
      'post_assembly_order', 'debugging_order'
    ];
    
    // 过滤不允许更新的字段
    const fields = Object.keys(updateData).filter(field => allowedFields.includes(field));
    const values = fields.map(field => {
      if (field === 'priority') {
        return normalizePriority(updateData[field]);
      }
      return updateData[field];
    });
    
    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: '没有提供有效的更新数据' });
    }
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const sql = `UPDATE tasks SET ${setClause} WHERE id = ?`;
    
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute(sql, [...values, taskId]);
    await connection.end();
    
    res.json({ success: true, message: '任务更新成功' });
  } catch (error) {
    console.error('更新任务失败:', error);
    res.status(500).json({ success: false, message: '更新任务失败' });
  }
});

// 5.3 删除任务
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const connection = await mysql.createConnection(dbConfig);
    
    // 检查任务是否存在
    const [rows] = await connection.execute('SELECT id FROM tasks WHERE id = ?', [taskId]);
    if (rows.length === 0) {
      await connection.end();
      return res.status(404).json({ success: false, message: '任务不存在' });
    }
    
    // 删除任务
    await connection.execute('DELETE FROM tasks WHERE id = ?', [taskId]);
    await connection.end();
    
    res.json({ success: true, message: '任务删除成功' });
  } catch (error) {
    console.error('删除任务失败:', error);
    res.status(500).json({ success: false, message: '删除任务失败: ' + error.message });
  }
});

// 5.3 创建报工记录
app.post('/api/work-reports', async (req, res) => {
  try {
    const { task_id, user_id, work_type, phase, actual_hours, note } = req.body;
    
    if (!task_id || !user_id || !work_type || !phase || !actual_hours) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }
    
    // 使用数据库实际的字段名
    const sql = `INSERT INTO work_reports (task_id, user_id, work_type, hours_worked, quality_notes, created_at) VALUES (?, ?, ?, ?, ?, NOW())`;
    
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(sql, [task_id, user_id, work_type, actual_hours, note]);
    await connection.end();
    
    res.json({ success: true, message: '报工记录创建成功', id: result.insertId });
  } catch (error) {
    console.error('创建报工记录失败:', error);
    res.status(500).json({ success: false, message: '创建报工记录失败' });
  }
});

// 6. 获取用户已完成的任务（必须在通用路由之前）
app.get('/api/tasks/user/:userId/completed', async (req, res) => {
  try {
    const { userId } = req.params;
    const connection = await mysql.createConnection(dbConfig);
    
    // 使用经过测试的查询
    const [rows] = await connection.execute(`
      SELECT DISTINCT t.*, 
             wr.approval_status as latest_completion_status, 
             wr.created_at as latest_completion_created_at,
             t.machining_start_time, t.electrical_start_time, t.pre_assembly_start_time, 
             t.post_assembly_start_time, t.debugging_start_time,
             t.machining_complete_time, t.electrical_complete_time, t.pre_assembly_complete_time, 
             t.post_assembly_complete_time, t.debugging_complete_time
      FROM tasks t
      LEFT JOIN (
        SELECT x.task_id, w.approval_status, w.created_at
        FROM (
          SELECT task_id, MAX(id) AS last_id
          FROM work_reports
          WHERE work_type = 'complete'
          GROUP BY task_id
        ) x
        JOIN work_reports w ON w.id = x.last_id
      ) wr ON wr.task_id = t.id
      WHERE t.id IN (
        SELECT DISTINCT task_id FROM work_reports 
        WHERE user_id = ? AND work_type = 'complete'
      )
      AND (
        t.status = 'completed' 
        OR t.machining_phase = 1 
        OR t.electrical_phase = 1 
        OR t.pre_assembly_phase = 1 
        OR t.post_assembly_phase = 1 
        OR t.debugging_phase = 1
      )
      ORDER BY COALESCE(t.end_time, wr.created_at) DESC
    `, [userId]);
    
    await connection.end();
    res.json(rows);
    
  } catch (error) {
    console.error('获取已完成任务失败:', error);
    res.status(500).json({ error: '获取已完成任务失败：' + error.message });
  }
});

// 7. 获取用户任务
app.get('/api/tasks/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const connection = await mysql.createConnection(dbConfig);
    
    // 基于阶段负责人查询任务
    const [rows] = await connection.execute(`
      SELECT t.*, 
             u1.name as machining_assignee_name,
             u2.name as electrical_assignee_name,
             u3.name as pre_assembly_assignee_name,
             u4.name as post_assembly_assignee_name,
             u5.name as debugging_assignee_name,
             wr.approval_status as latest_completion_status, 
             wr.created_at as latest_completion_created_at,
             t.machining_start_time, t.electrical_start_time, t.pre_assembly_start_time, 
             t.post_assembly_start_time, t.debugging_start_time,
             t.machining_complete_time, t.electrical_complete_time, t.pre_assembly_complete_time, 
             t.post_assembly_complete_time, t.debugging_complete_time,
             CASE 
               WHEN t.machining_assignee = ? THEN COALESCE(t.machining_order, 999)
               WHEN t.electrical_assignee = ? THEN COALESCE(t.electrical_order, 999)
               WHEN t.pre_assembly_assignee = ? THEN COALESCE(t.pre_assembly_order, 999)
               WHEN t.post_assembly_assignee = ? THEN COALESCE(t.post_assembly_order, 999)
               WHEN t.debugging_assignee = ? THEN COALESCE(t.debugging_order, 999)
               ELSE 999
             END as task_priority_order
      FROM tasks t
      LEFT JOIN users u1 ON t.machining_assignee = u1.id
      LEFT JOIN users u2 ON t.electrical_assignee = u2.id
      LEFT JOIN users u3 ON t.pre_assembly_assignee = u3.id
      LEFT JOIN users u4 ON t.post_assembly_assignee = u4.id
      LEFT JOIN users u5 ON t.debugging_assignee = u5.id
      LEFT JOIN (
        SELECT x.task_id, w.approval_status, w.created_at
        FROM (
          SELECT task_id, MAX(id) AS last_id
          FROM work_reports
          WHERE work_type = 'complete'
          GROUP BY task_id
        ) x
        JOIN work_reports w ON w.id = x.last_id
      ) wr ON wr.task_id = t.id
      WHERE t.status != 'completed' AND (
        -- 用户在某个阶段被分配，且该阶段未完成
        (t.machining_assignee = ? AND COALESCE(t.machining_phase, 0) = 0) OR
        (t.electrical_assignee = ? AND COALESCE(t.electrical_phase, 0) = 0) OR
        (t.pre_assembly_assignee = ? AND COALESCE(t.pre_assembly_phase, 0) = 0) OR
        (t.post_assembly_assignee = ? AND COALESCE(t.post_assembly_phase, 0) = 0) OR
        (t.debugging_assignee = ? AND COALESCE(t.debugging_phase, 0) = 0)
      )
      ORDER BY task_priority_order ASC, t.created_at DESC
    `, [userId, userId, userId, userId, userId, userId, userId, userId, userId, userId]);
    
    await connection.end();
    res.json(rows);
    
  } catch (error) {
    console.error('获取用户任务失败:', error);
    res.status(500).json({ error: '获取用户任务失败：' + error.message });
  }
});




// 9. 获取报工记录
app.get('/api/work-reports/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(`
      SELECT wr.*, t.name as task_name 
      FROM work_reports wr 
      JOIN tasks t ON wr.task_id = t.id 
      WHERE wr.user_id = ? 
      ORDER BY wr.created_at DESC
    `, [userId]);
    await connection.end();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: '获取报工记录失败：' + error.message });
  }
});

// 12.x 导入标准工时（管理员/主管）
app.post('/api/standard-hours/import', upload.single('file'), async (req, res) => {
  let connection;
  try {
    const { userId, phase } = req.body || {};
    if (!userId) return res.status(400).json({ error: '用户ID必填' });

    connection = await mysql.createConnection(dbConfig);
    const [userRows] = await connection.execute('SELECT role, department FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '用户不存在' });
    }
    const role = userRows[0].role;
    const department = userRows[0].department;
    // 只允许admin和工程部的staff导入标准工时
    if (role !== 'admin' && !(role === 'staff' && department === '工程部')) {
      await connection.end();
      return res.status(403).json({ error: '权限不足，只有管理员和工程部可以导入标准工时' });
    }

    if (!req.file) {
      await connection.end();
      return res.status(400).json({ error: '请选择Excel文件' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });
    // 通用日期解析：支持Excel序列号和字符串
    const parseExcelDate = (val) => {
      if (val == null || val === '') return null;
      if (typeof val === 'number') {
        try {
          const dc = XLSX.SSF && XLSX.SSF.parse_date_code ? XLSX.SSF.parse_date_code(val) : null;
          if (dc && dc.y && dc.m && dc.d) {
            // 使用本地时间
            return new Date(dc.y, dc.m - 1, dc.d, dc.H || 0, dc.M || 0, Math.floor(dc.S || 0));
          }
        } catch (_) {}
      }
      // 字符串日期
      const s = String(val).trim().replace(/\./g, '-').replace(/\//g, '/');
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d;
      return null;
    };
    if (data.length < 2) {
      await connection.end();
      return res.status(400).json({ error: 'Excel文件数据不足，至少需要2行数据' });
    }

    // 解析：B列=产品型号，C-G为五种工种标准工时
    let updated = 0;
    let matchedModels = 0;
    const errors = [];
    const seenModels = new Set();
    for (let i = 1; i < data.length; i++) {
      const row = data[i] || [];
      const rawModel = row[1] != null ? String(row[1]) : '';
      const productModel = rawModel.trim();

      // 解析数字，处理包含逗号/字符串的情况
      const parseNum = (v) => {
        if (v == null || v === '') return null;
        const n = parseFloat(String(v).toString().replace(/,/g, ''));
        return isNaN(n) ? null : n;
      };
      const machining = parseNum(row[2]);
      const electrical = parseNum(row[3]);
      const preAsm = parseNum(row[4]);
      const postAsm = parseNum(row[5]);
      const debugging = parseNum(row[6]);

      if (!productModel) {
        errors.push(`第${i + 1}行：产品型号(B列)为空`);
        continue;
      }

      // 使用不区分大小写且去空格的匹配方式
      // 只匹配标准任务（is_non_standard = 0 或 NULL），跳过非标任务（is_non_standard = 1）
      const [result] = await connection.execute(
        `UPDATE tasks SET 
           machining_hours_est = COALESCE(?, machining_hours_est),
           electrical_hours_est = COALESCE(?, electrical_hours_est),
           pre_assembly_hours_est = COALESCE(?, pre_assembly_hours_est),
           post_assembly_hours_est = COALESCE(?, post_assembly_hours_est),
           debugging_hours_est = COALESCE(?, debugging_hours_est)
         WHERE UPPER(TRIM(product_model)) = UPPER(TRIM(?))
           AND (is_non_standard = 0 OR is_non_standard IS NULL)`,
        [machining, electrical, preAsm, postAsm, debugging, productModel]
      );

      if (!seenModels.has(productModel)) {
        matchedModels += (result.affectedRows || 0) > 0 ? 1 : 0;
        seenModels.add(productModel);
      }
      updated += result.affectedRows || 0;
    }

    await connection.end();
    return res.json({ success: true, updatedCount: updated, matchedModels, errors });
  } catch (e) {
    if (connection) await connection.end();
    console.error('导入标准工时失败：', e);
    return res.status(500).json({ error: '导入标准工时失败：' + e.message });
  }
});

// 12.y 下载标准工时Excel模板
app.get('/api/standard-hours/template', async (req, res) => {
  try {
    const workbook = XLSX.utils.book_new();
    const sheetData = [
      [
        '',
        '产品型号',
        '机加标准工时(小时)',
        '电控标准工时(小时)',
        '总装前段标准工时(小时)',
        '总装后段标准工时(小时)',
        '调试标准工时(小时)'
      ]
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, '标准工时模板');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="standard_hours_template.xlsx"'
    );
    res.send(buffer);
  } catch (error) {
    console.error('生成标准工时模板失败：', error);
    res.status(500).json({ error: '生成模板失败：' + error.message });
  }
});

// 9.2 待审批列表（主管/管理员查看所有 pending 的完成记录）
app.get('/api/approvals/pending', async (req, res) => {
  try {
    const approverId = req.query.approverId; // 从查询参数获取审批人ID
    
    if (!approverId) {
      return res.status(400).json({ error: '缺少审批人ID参数' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // 获取审批人的部门信息
    const [approverRows] = await connection.execute(
      'SELECT department, user_group FROM users WHERE id = ?',
      [approverId]
    );
    
    if (approverRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '审批人不存在' });
    }
    
    const approver = approverRows[0];
    const approverDepartment = approver.department;
    const approverUserGroup = approver.user_group;
    
    // 根据审批人的部门或用户组过滤待审批任务
    // 只显示同一部门或同一用户组的任务完成报告
    let query = `
      SELECT wr.*, t.name as task_name, u.name as user_name, u.department, u.user_group
      FROM work_reports wr
      JOIN tasks t ON wr.task_id = t.id
      JOIN users u ON wr.user_id = u.id
      WHERE wr.work_type = 'complete' 
        AND (wr.approval_status IS NULL OR wr.approval_status = 'pending')
        AND (
          u.department = ?
    `;
    const params = [approverDepartment];
    
    // 如果审批人有用户组，也显示同组的任务
    if (approverUserGroup) {
      query += ` OR (u.user_group IS NOT NULL AND u.user_group = ?)`;
      params.push(approverUserGroup);
    }
    
    query += ` ) ORDER BY wr.id DESC`;
    
    const [rows] = await connection.execute(query, params);
    
    await connection.end();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: '获取待审批列表失败：' + error.message });
  }
});

// 9.3 审批通过
app.post('/api/approvals/:reportId/approve', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { note } = req.body || {};
    const connection = await mysql.createConnection(dbConfig);
    // 更新完成记录审批状态与备注
    await connection.execute('UPDATE work_reports SET approval_status = ?, approval_note = ? WHERE id = ?', ['approved', note || null, reportId]);
    // 将对应任务置为已完成并记录完成时间
    await connection.execute('UPDATE tasks SET status = ?, end_time = NOW() WHERE id = (SELECT task_id FROM work_reports WHERE id = ?)', ['completed', reportId]);
    await connection.end();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '审批通过失败：' + error.message });
  }
});

// 9.4 驳回（回退任务为进行中）
app.post('/api/approvals/:reportId/reject', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { note } = req.body || {};
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute('UPDATE work_reports SET approval_status = ?, approval_note = ? WHERE id = ?', ['rejected', note || null, reportId]);
    await connection.execute('UPDATE tasks SET status = ? WHERE id = (SELECT task_id FROM work_reports WHERE id = ?)', ['in_progress', reportId]);
    await connection.end();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '审批驳回失败：' + error.message });
  }
});
// 9.1 按任务获取历史报工记录（用于任务详情页）
app.get('/api/work-reports/by-task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(`
      SELECT wr.*, u.name as user_name
      FROM work_reports wr
      JOIN users u ON wr.user_id = u.id
      WHERE wr.task_id = ?
      ORDER BY wr.id DESC
    `, [taskId]);
    await connection.end();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: '获取任务历史失败：' + error.message });
  }
});

// 10. 获取所有用户（用于主管派工界面）
app.get('/api/users', async (_req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT id, username, name, role, department, user_group FROM users ORDER BY role DESC, name ASC'
    );
    await connection.end();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: '获取用户失败：' + error.message });
  }
});

// 10.1. 下载员工导入模板
app.get('/api/users/template', (_req, res) => {
  try {
    const data = [
      ['username', 'name', 'role', 'department', 'user_group', 'password']
      // 注意：第一行为列名，从第二行开始填写数据
      // user_group为可选字段，填写该员工所属的组（如：宋明雄组、组长等）
      // 示例: ['zhang3', '张三', 'worker', '组装车间', '宋明雄组', '123456']
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    // 使用URL编码处理中文字符
    const filename = encodeURIComponent('员工信息导入模板.xlsx');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: '下载模板失败：' + error.message });
  }
});

// 10.2. 导入员工信息
app.post('/api/users/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请上传文件' });
    }
    
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    console.log('解析到的数据:', JSON.stringify(data, null, 2));
    
    const connection = await mysql.createConnection(dbConfig);
    let successCount = 0;
    let failCount = 0;
    const errors = [];
    
    for (const row of data) {
      try {
        console.log('处理行:', row);
        // 验证必填字段
        if (!row.username || !row.name || !row.role || !row.department) {
          const missingFields = [];
          if (!row.username) missingFields.push('username');
          if (!row.name) missingFields.push('name');
          if (!row.role) missingFields.push('role');
          if (!row.department) missingFields.push('department');
          errors.push(`${row.username || '第' + (failCount + successCount + 1) + '行'}: 必填字段缺失(${missingFields.join(', ')})`);
          console.log('字段验证失败:', missingFields);
          failCount++;
          continue;
        }
        
        // user_group是可选的，确保有值
        const userGroup = row.user_group || null;
        
        // 验证角色是否有效
        if (!['worker', 'supervisor', 'admin', 'manager', 'staff'].includes(row.role)) {
          errors.push(`${row.username}: 角色无效，必须是 worker/supervisor/admin/manager/staff`);
          failCount++;
          continue;
        }
        
        // 检查用户名是否已存在
        const [existing] = await connection.execute(
          'SELECT id FROM users WHERE username = ?',
          [row.username]
        );
        
        if (existing.length > 0) {
          errors.push(`${row.username}: 用户名已存在`);
          failCount++;
          continue;
        }
        
        // 插入用户
        const password = String(row.password || '123456'); // 默认密码，确保是字符串
        await connection.execute(
          'INSERT INTO users (username, password, name, role, department, user_group) VALUES (?, ?, ?, ?, ?, ?)',
          [row.username, password, row.name, row.role, row.department, userGroup]
        );
        
        successCount++;
      } catch (error) {
        errors.push(`${row.username || '未知'}: ${error.message}`);
        failCount++;
      }
    }
    
    await connection.end();
    
    // 删除临时文件（如果存在）
    if (req.file && req.file.path) {
      try {
        require('fs').unlinkSync(req.file.path);
      } catch (fileError) {
        console.warn('删除临时文件失败:', fileError.message);
      }
    }
    
    res.json({
      success: true,
      message: `导入完成：成功 ${successCount} 条，失败 ${failCount} 条`,
      successCount,
      failCount,
      errors
    });
  } catch (error) {
    console.error('导入员工失败:', error);
    res.status(500).json({ success: false, message: '导入失败：' + error.message });
  }
});

// 11. 分配任务到用户（主管/管理员）
app.post('/api/tasks/assign', async (req, res) => {
  try {
    let { taskId, userId, phaseKey } = req.body || {};
    
    // 调试信息：记录接收到的参数
    console.log('后端 /api/tasks/assign 接收到的参数:', {
      taskId,
      userId,
      phaseKey,
      phaseKey_type: typeof phaseKey,
      requestBody: JSON.stringify(req.body)
    });
    
    // 规范入参类型，兼容字符串/null/空串
    if (typeof taskId === 'string') taskId = taskId.trim();
    if (taskId === '') taskId = null;
    taskId = taskId != null ? Number(taskId) : null;

    if (typeof userId === 'string') {
      const s = userId.trim().toLowerCase();
      if (s === '' || s === 'null' || s === 'undefined') userId = null;
      else userId = Number(userId);
    }
    
    // 规范化 phaseKey（去除前后空格，转为小写）
    if (typeof phaseKey === 'string') {
      phaseKey = phaseKey.trim();
      if (phaseKey === '') phaseKey = undefined;
    }
    
    // 调试信息：记录规范化后的参数
    console.log('后端 /api/tasks/assign 规范化后的参数:', {
      taskId,
      userId,
      phaseKey,
      phaseKey_type: typeof phaseKey
    });

    // 允许 userId 为空/0 表示清空分配，仅校验 taskId
    if (taskId === undefined || taskId === null || Number.isNaN(taskId)) {
      return res.status(400).json({ error: '参数不完整：taskId 必填' });
    }

    const connection = await mysql.createConnection(dbConfig);

    // 检查任务存在
    const [tasks] = await connection.execute('SELECT id, status, current_phase FROM tasks WHERE id = ?', [taskId]);
    if (tasks.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '任务不存在' });
    }

    const task = tasks[0];

    // 如果是设置分配（而不是清空），检查用户存在
    let newAssigned = null;
    if (userId !== null && userId !== undefined && Number(userId) > 0) {
      const [users] = await connection.execute('SELECT id FROM users WHERE id = ?', [userId]);
      if (users.length === 0) {
        await connection.end();
        return res.status(404).json({ error: '用户不存在' });
      }
      newAssigned = userId;
    }

    // 如果指定了阶段，进行阶段分配
    if (phaseKey && (phaseKey === 'machining' || phaseKey === 'electrical' || phaseKey === 'pre_assembly' || phaseKey === 'post_assembly' || phaseKey === 'debugging')) {
      // 检查阶段是否可以开始
      // 注意：需要获取完整的任务信息（包括各阶段的assignee）来检查前置条件
      const [fullTask] = await connection.execute(`
        SELECT id, status, current_phase, 
               machining_assignee, machining_phase,
               electrical_assignee, electrical_phase,
               pre_assembly_assignee, pre_assembly_phase,
               post_assembly_assignee, post_assembly_phase,
               debugging_assignee, debugging_phase
        FROM tasks WHERE id = ?
      `, [taskId]);
      const taskForCheck = fullTask[0] || task;
      
      // 调试信息：记录检查前置条件时的任务状态
      if (phaseKey === 'pre_assembly') {
        console.log('检查总装前段前置条件 - 任务数据:', {
          taskId,
          machining_assignee: taskForCheck.machining_assignee,
          machining_assignee_type: typeof taskForCheck.machining_assignee,
          machining_phase: taskForCheck.machining_phase,
          machining_phase_type: typeof taskForCheck.machining_phase,
          pre_assembly_phase: taskForCheck.pre_assembly_phase,
          pre_assembly_assignee: taskForCheck.pre_assembly_assignee,
          fullTaskData: JSON.stringify(taskForCheck)
        });
      }
      
      const canStart = canStartPhase(taskForCheck, phaseKey);
      
      if (!canStart) {
        await connection.end();
        // 提供更详细的错误信息
        let errorMsg = `无法分配${getPhaseName(phaseKey)}阶段，请检查前置条件`;
        if (phaseKey === 'pre_assembly') {
          const machiningAssignee = taskForCheck.machining_assignee;
          const machiningPhase = taskForCheck.machining_phase;
          const machiningAssigned = machiningAssignee != null && 
                                     machiningAssignee !== '' && 
                                     machiningAssignee !== 0 && 
                                     machiningAssignee !== '0';
          const machiningCompleted = machiningPhase === 1 || machiningPhase === '1';
          errorMsg += `。需要：机加阶段已派工（machining_assignee不为空）或已完成（machining_phase=1）。当前：machining_assignee=${machiningAssignee}（类型：${typeof machiningAssignee}，已派工：${machiningAssigned}），machining_phase=${machiningPhase}（类型：${typeof machiningPhase}，已完成：${machiningCompleted}）`;
          console.error('总装前段分配失败 - 前置条件不满足:', {
            taskId,
            machining_assignee: machiningAssignee,
            machining_assignee_type: typeof machiningAssignee,
            machining_assignee_assigned: machiningAssigned,
            machining_phase: machiningPhase,
            machining_phase_type: typeof machiningPhase,
            machining_phase_completed: machiningCompleted,
            canStartResult: canStart,
            taskForCheck: JSON.stringify(taskForCheck)
          });
        }
        return res.status(400).json({ error: errorMsg });
      }

      // 更新阶段分配 - 支持所有阶段
      try {
        if (phaseKey === 'machining') {
          // 机加分配：如果机加未完成，设置为机加阶段（允许与电控并行）
          await connection.execute(`
            UPDATE tasks SET 
              machining_assignee = ?,
              current_phase = CASE 
                WHEN machining_phase = 0 THEN 'machining'
                ELSE current_phase
              END
            WHERE id = ?
          `, [newAssigned, taskId]);
        } else if (phaseKey === 'electrical') {
          // 电控分配：如果机加未完成，设置为电控阶段（允许与机加并行）
          await connection.execute(`
            UPDATE tasks SET 
              electrical_assignee = ?,
              current_phase = CASE 
                WHEN machining_phase = 0 THEN 'electrical'
                ELSE current_phase
              END
            WHERE id = ?
          `, [newAssigned, taskId]);
        } else if (phaseKey === 'pre_assembly') {
          // 总装前段分配：需要机加已完成，且总装前段未完成
          await connection.execute(`
            UPDATE tasks SET 
              pre_assembly_assignee = ?,
              current_phase = CASE 
                WHEN machining_phase = 1 AND pre_assembly_phase = 0 THEN 'pre_assembly'
                ELSE current_phase
              END
            WHERE id = ?
          `, [newAssigned, taskId]);
        } else if (phaseKey === 'post_assembly') {
          // 总装后段分配：需要总装前段已派工，且总装后段未完成
          await connection.execute(`
            UPDATE tasks SET 
              post_assembly_assignee = ?,
              current_phase = CASE 
                WHEN pre_assembly_assignee IS NOT NULL 
                 AND pre_assembly_assignee != '' 
                 AND pre_assembly_assignee != 0 
                 AND pre_assembly_assignee != '0'
                 AND post_assembly_phase = 0 THEN 'post_assembly'
                ELSE current_phase
              END
            WHERE id = ?
          `, [newAssigned, taskId]);
        } else if (phaseKey === 'debugging') {
          // 调试阶段分配：需要总装后段已派工，且调试未完成
          await connection.execute(`
            UPDATE tasks SET 
              debugging_assignee = ?,
              current_phase = CASE 
                WHEN post_assembly_assignee IS NOT NULL 
                 AND post_assembly_assignee != '' 
                 AND post_assembly_assignee != 0 
                 AND post_assembly_assignee != '0'
                 AND debugging_phase = 0 THEN 'debugging'
                ELSE current_phase
              END
            WHERE id = ?
          `, [newAssigned, taskId]);
        }
      } catch (error) {
        // 如果新字段不存在，使用旧的方式
        await connection.execute(`
          UPDATE tasks SET 
            current_phase = ?
          WHERE id = ?
        `, [phaseKey, taskId]);
      }
      
      // 验证更新是否成功
      try {
        const [verifyTask] = await connection.execute(`
          SELECT ${phaseKey}_assignee FROM tasks WHERE id = ?
        `, [taskId]);
        
        if (verifyTask.length > 0) {
          const assignedValue = verifyTask[0][`${phaseKey}_assignee`];
          // 如果是要分配（newAssigned不为null），检查是否真的分配了
          if (newAssigned !== null && assignedValue != newAssigned) {
            await connection.end();
            return res.status(500).json({ error: `任务分配失败：数据库更新未生效。期望: ${newAssigned}, 实际: ${assignedValue}` });
          }
          // 如果是要清空分配（newAssigned为null），检查是否真的清空了
          if (newAssigned === null && assignedValue !== null) {
            await connection.end();
            return res.status(500).json({ error: '任务分配清空失败：数据库更新未生效' });
          }
        }
      } catch (verifyError) {
        // 如果验证失败，记录错误但继续执行（可能是字段不存在）
        console.error('验证任务分配失败:', verifyError);
      }
    } else {
      // 如果没有指定阶段或指定了无效阶段，返回错误
      await connection.end();
      return res.status(400).json({ error: '必须指定有效的阶段进行分配（机加、电控、总装前段、总装后段或调试）' });
    }

    await connection.end();
    res.json({ success: true, message: '任务分配成功' });
  } catch (error) {
    res.status(500).json({ error: '分配任务失败：' + error.message });
  }
});

// 12. 导入任务（管理员/主管）
app.post('/api/tasks/import', upload.single('file'), async (req, res) => {
  try {
    const { userId } = req.body || {};
    
    // 权限验证：只有管理员和主管可以导入任务
    if (!userId) {
      return res.status(400).json({ error: '用户ID必填' });
    }

    const connection = await mysql.createConnection(dbConfig);
    const [userRows] = await connection.execute(
      'SELECT role FROM users WHERE id = ?',
      [userId]
    );
    
    if (userRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const userRole = userRows[0].role;
    if (userRole !== 'admin' && userRole !== 'supervisor' && userRole !== 'manager') {
      await connection.end();
      return res.status(403).json({ error: '权限不足，只有管理员、主管和经理可以导入任务' });
    }

    if (!req.file) {
      await connection.end();
      return res.status(400).json({ error: '请选择Excel文件' });
    }

    // 解析Excel文件
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

    // 通用日期解析：支持Excel序列号和字符串
    const parseExcelDate = (val) => {
      if (val == null || val === '') return null;
      if (typeof val === 'number') {
        try {
          const dc = XLSX.SSF && XLSX.SSF.parse_date_code ? XLSX.SSF.parse_date_code(val) : null;
          if (dc && dc.y && dc.m && dc.d) {
            const dt = new Date(dc.y, dc.m - 1, dc.d);
            dt.setHours(0, 0, 0, 0);
            return dt;
          }
        } catch (_) {}
      }
      const s = String(val).trim().replace(/\./g, '-').replace(/\//g, '/');
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        return d;
      }
      return null;
    };

    console.log('Excel数据行数:', data.length);
    console.log('前几行数据:', data.slice(0, 3));

    if (data.length < 2) {
      await connection.end();
      return res.status(400).json({ error: 'Excel文件数据不足，至少需要2行数据' });
    }

    const tasks = [];
    const errors = [];

    // 从第2行开始解析（跳过标题行）
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // 检查行是否存在
      if (!row) {
        errors.push(`第${i + 1}行：数据为空`);
        continue;
      }

      console.log(`处理第${i + 1}行，列数: ${row.length}`, row);

      // 检查必要列是否存在（至少需要6列：A-F）
      if (row.length < 6) {
        errors.push(`第${i + 1}行：数据列数不足，至少需要6列，当前只有${row.length}列`);
        continue;
      }

      const deviceNumber = row[2] ? String(row[2]).trim() : ''; // C列：设备号
      const productModel = row[5] ? String(row[5]).trim() : ''; // F列：产品型号
      const nonStandardRaw = row[4] ? String(row[4]).trim() : ''; // E列：是否非标（如果存在）
      const orderStatus = row[21] ? String(row[21]).trim() : ''; // V列：订单状态（如果存在）
      const productionRaw = row[16]; // Q列：投产时间（如果存在）
      const promisedRaw = row[14]; // O列：承诺完成时间（如果存在）
      const priorityFromAL = row[37] ? String(row[37]).trim() : ''; // AL列：紧急程度（如果存在）

      // 验证必要字段
      if (!deviceNumber) {
        errors.push(`第${i + 1}行：设备号不能为空`);
        continue;
      }

      if (!productModel) {
        errors.push(`第${i + 1}行：产品型号不能为空`);
        continue;
      }

      // 跳过已完成或已交货的任务
      if (orderStatus && (orderStatus.includes('已完成') || orderStatus.includes('已交货') || orderStatus.includes('完成') || orderStatus.includes('交货'))) {
        console.log(`跳过第${i + 1}行：任务状态为"${orderStatus}"，已跳过`);
        continue;
      }

      // 解析投产时间（Q列）
      let productionTime = parseExcelDate(productionRaw);
      if (productionRaw != null && productionRaw !== '' && !productionTime) {
        errors.push(`第${i + 1}行：投产时间格式不正确`);
        continue;
      }

      // 解析承诺完成时间（O列）
      let promisedCompletionTime = parseExcelDate(promisedRaw);
      if (promisedRaw != null && promisedRaw !== '' && !promisedCompletionTime) {
        errors.push(`第${i + 1}行：承诺完成时间格式不正确`);
        continue;
      }

      // 使用AL列直接映射优先级（若提供），否则默认普通
      const priority = normalizePriority(priorityFromAL || null);

      // 解析E列：是否非标（"是"→1，"否"→0，其他→0）
      const isNonStandard = nonStandardRaw === '是' ? 1 : 0;

      // 生成任务名称
      const taskName = `${deviceNumber} - ${productModel}`;

      tasks.push({
        name: taskName,
        description: `设备号：${deviceNumber}，产品型号：${productModel}，订单状态：${orderStatus}`,
        status: 'pending',
        priority: priority,
        device_number: deviceNumber,
        product_model: productModel,
        order_status: orderStatus,
        production_time: productionTime,
        promised_completion_time: promisedCompletionTime,
        is_non_standard: isNonStandard,
        created_by: userId
      });
    }

    console.log('解析完成，有效任务数:', tasks.length);
    console.log('错误数:', errors.length);
    console.log('错误详情:', errors);

    if (tasks.length === 0) {
      await connection.end();
      return res.status(400).json({ 
        error: '没有有效的任务数据', 
        details: errors,
        debug: {
          totalRows: data.length,
          processedRows: data.length - 1,
          validTasks: tasks.length,
          errors: errors.length
        }
      });
    }

    // 批量插入任务
    const insertPromises = tasks.map(task => {
      return connection.execute(
        `INSERT INTO tasks (name, description, status, priority, device_number, product_model, order_status, production_time, promised_completion_time, is_non_standard, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task.name,
          task.description,
          task.status,
          task.priority,
          task.device_number,
          task.product_model,
          task.order_status,
          task.production_time,
          task.promised_completion_time,
          task.is_non_standard,
          task.created_by
        ]
      );
    });

    await Promise.all(insertPromises);
    await connection.end();

    res.json({ 
      success: true, 
      message: `成功导入${tasks.length}个任务`,
      importedCount: tasks.length,
      errors: errors.length > 0 ? errors : null
    });

  } catch (error) {
    console.error('导入任务失败：', error);
    res.status(500).json({ error: '导入任务失败：' + error.message });
  }
});

// ============= 以下为考勤（上工/下工）接口，含休息时间排除与总时长计算 =============
// 初始化考勤表（若不存在则创建）
(async () => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        clock_in DATETIME NOT NULL,
        clock_out DATETIME NULL,
        total_minutes INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_date (user_id, clock_in)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await connection.end();
    console.log('考勤表校验完成');
  } catch (e) {
    console.error('初始化考勤表失败：', e.message);
  }
})();

// 工具：计算两个时间段与休息区间的重叠（分钟）
function minutesOverlap(start, end, restStart, restEnd) {
  const s = Math.max(start.getTime(), restStart.getTime());
  const e = Math.min(end.getTime(), restEnd.getTime());
  if (e <= s) return 0;
  return Math.round((e - s) / 60000);
}

// 工具：根据北京时间的当日，计算应扣除的休息分钟数
function calcRestMinutesBeijing(clockIn, clockOut) {
  const start = new Date(clockIn);
  const end = new Date(clockOut);
  if (end <= start) return 0;

  // 允许跨天：逐天计算中午(11:50-13:20)与下午(16:00-16:15)休息
  let totalRest = 0;
  let cursor = new Date(start);
  while (cursor < end) {
    const day = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    const noonStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 11, 50, 0);
    const noonEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 13, 20, 0);
    const pmStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 16, 0, 0);
    const pmEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 16, 15, 0);

    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    const segStart = cursor;
    const segEnd = end < dayEnd ? end : dayEnd;

    totalRest += minutesOverlap(segStart, segEnd, noonStart, noonEnd);
    totalRest += minutesOverlap(segStart, segEnd, pmStart, pmEnd);

    cursor = segEnd;
  }
  return totalRest;
}

// 上工：创建或返回未下工记录
app.post('/api/attendance/clock-in', async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId 必填' });

    const connection = await mysql.createConnection(dbConfig);
    const [openRows] = await connection.execute(
      'SELECT id FROM attendance_records WHERE user_id = ? AND clock_out IS NULL ORDER BY id DESC LIMIT 1',
      [userId]
    );
    if (openRows.length > 0) {
      await connection.end();
      return res.json({ success: true, message: '已在上工中', recordId: openRows[0].id });
    }

    const [result] = await connection.execute(
      'INSERT INTO attendance_records (user_id, clock_in) VALUES (?, NOW())',
      [userId]
    );
    await connection.end();
    res.json({ success: true, recordId: result.insertId });
  } catch (error) {
    res.status(500).json({ error: '上工失败：' + error.message });
  }
});

// 下工：补全 clock_out 并计算总时长（扣除休息）
app.post('/api/attendance/clock-out', async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId 必填' });

    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT id, clock_in FROM attendance_records WHERE user_id = ? AND clock_out IS NULL ORDER BY id DESC LIMIT 1',
      [userId]
    );
    if (rows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '未找到上工记录' });
    }

    const recordId = rows[0].id;
    const clockIn = new Date(rows[0].clock_in);
    const clockOut = new Date();

    const totalMinutesAll = Math.round((clockOut.getTime() - clockIn.getTime()) / 60000);
    const restMinutes = calcRestMinutesBeijing(clockIn, clockOut);
    const totalMinutes = Math.max(0, totalMinutesAll - restMinutes);

    await connection.execute(
      'UPDATE attendance_records SET clock_out = NOW(), total_minutes = ? WHERE id = ?',
      [totalMinutes, recordId]
    );
    await connection.end();
    res.json({ success: true, recordId, totalMinutes, restMinutes });
  } catch (error) {
    res.status(500).json({ error: '下工失败：' + error.message });
  }
});

// 今日考勤状态（返回最近一条记录）
app.get('/api/attendance/today/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      `SELECT id, user_id, clock_in, clock_out, total_minutes
       FROM attendance_records
       WHERE user_id = ?
       ORDER BY id DESC LIMIT 1`,
      [userId]
    );
    await connection.end();
    res.json(rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: '获取今日考勤失败：' + error.message });
  }
});

// 管理员考勤列表（支持筛选与分页）
// GET /api/attendance/admin?start=2025-10-01&end=2025-10-31&userId=3&page=1&pageSize=20
app.get('/api/attendance/admin', async (req, res) => {
  try {
    const { start, end, userId } = req.query || {};
    let page = Number(req.query.page || 1);
    let pageSize = Number(req.query.pageSize || 20);
    if (!Number.isFinite(page) || page < 1) page = 1;
    if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 200) pageSize = 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    const params = [];
    if (start) {
      conditions.push('ar.clock_in >= ?');
      params.push(start + ' 00:00:00');
    }
    if (end) {
      conditions.push('ar.clock_in <= ?');
      params.push(end + ' 23:59:59');
    }
    if (userId) {
      conditions.push('ar.user_id = ?');
      params.push(Number(userId));
    }
    const whereSql = conditions.length ? ('WHERE ' + conditions.join(' AND ')) : '';

    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      `SELECT ar.id, ar.user_id, u.name as user_name, ar.clock_in, ar.clock_out, ar.total_minutes,
              ar.standard_hours, ar.overtime_minutes, ar.leave_minutes, ar.adjustment_note,
              ar.adjusted_by, ar.adjusted_at, adjuster.name as adjuster_name
       FROM attendance_records ar
       JOIN users u ON u.id = ar.user_id
       LEFT JOIN users adjuster ON adjuster.id = ar.adjusted_by
       ${whereSql}
       ORDER BY ar.clock_in DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    const [countRows] = await connection.execute(
      `SELECT COUNT(1) as total
       FROM attendance_records ar
       ${whereSql.replace(/JOIN users u ON u.id = ar.user_id/g, '')}`,
      params
    );
    await connection.end();
    const total = (countRows && countRows[0] && countRows[0].total) ? Number(countRows[0].total) : 0;
    res.json({ list: rows || [], page, pageSize, total });
  } catch (error) {
    res.status(500).json({ error: '获取考勤列表失败：' + error.message });
  }
});

// 考勤时长调整API
app.post('/api/attendance/:recordId/adjust', async (req, res) => {
  try {
    const { recordId } = req.params;
    const { overtimeMinutes, leaveMinutes, adjustmentNote, adjustedBy } = req.body;
    
    if (!adjustedBy) {
      return res.status(400).json({ error: '调整人ID不能为空' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // 检查考勤记录是否存在
    const [recordRows] = await connection.execute(`
      SELECT * FROM attendance_records WHERE id = ?
    `, [recordId]);
    
    if (recordRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '考勤记录不存在' });
    }
    
    // 更新考勤记录
    await connection.execute(`
      UPDATE attendance_records 
      SET overtime_minutes = ?, leave_minutes = ?, adjustment_note = ?, 
          adjusted_by = ?, adjusted_at = NOW()
      WHERE id = ?
    `, [overtimeMinutes || 0, leaveMinutes || 0, adjustmentNote || '', adjustedBy, recordId]);
    
    await connection.end();
    
    res.json({ 
      success: true, 
      message: '考勤时长调整成功' 
    });
    
  } catch (error) {
    res.status(500).json({ error: '调整考勤时长失败：' + error.message });
  }
});

// 考勤统计API
app.get('/api/attendance/stats', async (req, res) => {
  try {
    const { start, end, userId } = req.query || {};
    
    const conditions = [];
    const params = [];
    if (start) {
      conditions.push('ar.clock_in >= ?');
      params.push(start + ' 00:00:00');
    }
    if (end) {
      conditions.push('ar.clock_in <= ?');
      params.push(end + ' 23:59:59');
    }
    if (userId) {
      conditions.push('ar.user_id = ?');
      params.push(Number(userId));
    }
    const whereSql = conditions.length ? ('WHERE ' + conditions.join(' AND ')) : '';
    
    const connection = await mysql.createConnection(dbConfig);
    
    // 获取统计信息
    const [statsRows] = await connection.execute(`
      SELECT 
        COUNT(*) as total_records,
        SUM(ar.standard_hours) as total_standard_hours,
        SUM(ar.overtime_minutes) as total_overtime_minutes,
        SUM(ar.leave_minutes) as total_leave_minutes,
        AVG(ar.standard_hours) as avg_standard_hours,
        AVG(ar.overtime_minutes) as avg_overtime_minutes,
        AVG(ar.leave_minutes) as avg_leave_minutes
      FROM attendance_records ar
      ${whereSql}
    `, params);
    
    // 获取按用户分组的统计
    const [userStatsRows] = await connection.execute(`
      SELECT 
        ar.user_id,
        u.name as user_name,
        COUNT(*) as record_count,
        SUM(ar.standard_hours) as total_standard_hours,
        SUM(ar.overtime_minutes) as total_overtime_minutes,
        SUM(ar.leave_minutes) as total_leave_minutes,
        AVG(ar.standard_hours) as avg_standard_hours,
        AVG(ar.overtime_minutes) as avg_overtime_minutes,
        AVG(ar.leave_minutes) as avg_leave_minutes
      FROM attendance_records ar
      JOIN users u ON u.id = ar.user_id
      ${whereSql}
      GROUP BY ar.user_id, u.name
      ORDER BY u.name
    `, params);
    
    await connection.end();
    
    res.json({
      success: true,
      overall: statsRows[0] || {},
      byUser: userStatsRows || []
    });
    
  } catch (error) {
    res.status(500).json({ error: '获取考勤统计失败：' + error.message });
  }
});

// ============= 日考勤（小时） 独立模块 =============
// 查询某天或区间的日考勤列表（可按用户过滤）
app.get('/api/daily-attendance', async (req, res) => {
  try {
    const { start, end, userId, page, pageSize } = req.query || {};
    // 若未传时间范围，默认今天
    const startDate = start || new Date().toISOString().slice(0, 10);
    const endDate = end || startDate;
    let p = Number(page || 1);
    let ps = Number(pageSize || 50);
    if (!Number.isFinite(p) || p < 1) p = 1;
    if (!Number.isFinite(ps) || ps < 1 || ps > 200) ps = 50;
    const offset = (p - 1) * ps;

    const connection = await mysql.createConnection(dbConfig);
    
    // 获取动态标准工作时长
    const workTimeSettings = await getStandardWorkHours(connection);
    const standardWorkHours = workTimeSettings.standardHours;
    const workTimeUpdatedAt = workTimeSettings.updatedAt;
    
    // 获取GitHub节假日数据（获取日期范围内的所有年份）
    // 使用Promise.all并行获取，提高效率，并设置超时保护
    const startYear = new Date(startDate).getFullYear();
    const endYear = new Date(endDate).getFullYear();
    const holidaySets = new Map();
    const workingDaySets = new Map(); // 存储调休日（isWorkingDay === true）
    
    try {
      // 并行获取所有年份的数据，设置总体超时（每个年份5秒，总体最多15秒）
      const yearPromises = [];
      for (let year = startYear; year <= endYear; year++) {
        yearPromises.push(getHolidaysFromGitHub(year));
      }
      
      // 等待所有请求完成，但设置总体超时
      const results = await Promise.allSettled(yearPromises);
      
      // 处理结果
      let yearIndex = 0;
      for (let year = startYear; year <= endYear; year++) {
        const result = results[yearIndex];
        if (result.status === 'fulfilled') {
          holidaySets.set(year, result.value.holidays);
          workingDaySets.set(year, result.value.workingDays);
        } else {
          console.warn(`[后端] 获取${year}年节假日数据失败，使用空集合:`, result.reason);
          holidaySets.set(year, new Set());
          workingDaySets.set(year, new Set());
        }
        yearIndex++;
      }
    } catch (error) {
      console.error('[后端] 获取节假日数据失败，使用空集合:', error);
      // 失败时使用空集合，不阻塞主请求
      for (let year = startYear; year <= endYear; year++) {
        holidaySets.set(year, new Set());
        workingDaySets.set(year, new Set());
      }
    }
    
    const params = [startDate, endDate];
    let userFilterSql = 'u.role = \"worker\"';
    if (userId) {
      userFilterSql += ' AND u.id = ?';
      // userId参数将在SQL执行时正确插入
    }

    // 使用递归CTE生成日期范围，并与工人列表笛卡尔积，左连接已存在的日考勤信息
    // 标准考勤时长将在JavaScript中根据GitHub节假日数据计算
    const [rows] = await connection.execute(`
      WITH RECURSIVE dates(d) AS (
        SELECT ?
        UNION ALL
        SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM dates WHERE d < ?
      )
      SELECT 
        da.id,
        u.id as user_id,
        u.name as user_name,
        u.department,
        dates.d as date,
        da.standard_attendance_hours,
        COALESCE(da.overtime_hours, 0.00) as overtime_hours,
        COALESCE(da.leave_hours, 0.00) as leave_hours,
        da.overtime_start_time,
        da.overtime_end_time,
        da.leave_start_time,
        da.leave_end_time,
        da.is_confirmed,
        da.confirmed_by,
        da.confirmed_at,
        confirmer.name as confirmer_name,
        da.actual_hours,
        da.note,
        da.adjusted_by,
        da.adjusted_at
      FROM dates
      JOIN users u ON ${userFilterSql}
      LEFT JOIN daily_attendance da ON da.user_id = u.id AND da.date = dates.d
      LEFT JOIN users confirmer ON confirmer.id = da.confirmed_by
      ORDER BY dates.d DESC, u.name ASC
    `, [...params, ...(userId ? [Number(userId)] : [])]);
    
    // 根据GitHub节假日数据计算标准考勤时长
    const processedRows = rows.map(row => {
      const dateStr = row.date instanceof Date 
        ? row.date.toISOString().slice(0, 10) 
        : row.date;
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const dayOfWeek = date.getDay(); // 0=周日, 6=周六
      
      // 如果已有标准考勤时长，直接使用
      if (row.standard_attendance_hours !== null && row.standard_attendance_hours !== undefined) {
        return row;
      }
      
      // 根据GitHub节假日数据计算标准考勤时长
      // 使用 holiday-cn 的 isOffDay 字段：false=工作日，true=节假日
      const holidays = holidaySets.get(year) || new Set();
      const isHoliday = holidays.has(dateStr); // isOffDay === true
      
      // 调试日志：检查特定日期
      if (dateStr === '2025-01-02' || dateStr === '2026-01-04') {
        console.log(`[后端调试] ${dateStr} 判断结果:`, {
          dateStr,
          isHoliday,
          standardWorkHours,
          workTimeUpdatedAt
        });
      }
      
      let calculatedStandardHours = 0.00;
      // 根据 holiday-cn 的 isOffDay 字段判断
      if (!isHoliday) {
        // isOffDay === false：工作日（包括调休日和普通工作日）
        // 如果日期 >= 工作时间设置更新时间，使用标准工作时长
        if (workTimeUpdatedAt && date >= new Date(workTimeUpdatedAt)) {
          calculatedStandardHours = standardWorkHours || 0.00;
        }
      } else {
        // isOffDay === true：节假日，标准考勤时长为0
        calculatedStandardHours = 0.00;
      }
      
      row.standard_attendance_hours = calculatedStandardHours;
      
      // 重新计算实际工时
      if (row.actual_hours === null || row.actual_hours === undefined) {
        row.actual_hours = calculatedStandardHours + (row.overtime_hours || 0) - (row.leave_hours || 0);
      }
      
      return row;
    });

    // 统计总数（用于分页）
    const [countRows] = await connection.execute(`
      WITH RECURSIVE dates(d) AS (
        SELECT ?
        UNION ALL
        SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM dates WHERE d < ?
      )
      SELECT COUNT(1) as total
      FROM dates
      JOIN users u ON ${userFilterSql}
    `, [...params, ...(userId ? [Number(userId)] : [])]);
    await connection.end();
    const total = (countRows && countRows[0] && countRows[0].total) ? Number(countRows[0].total) : 0;
    res.json({ list: processedRows || [], page: p, pageSize: ps, total });
  } catch (error) {
    res.status(500).json({ error: '获取日考勤失败：' + error.message });
  }
});

// 新增或更新某员工某天的日考勤（幂等：同(user_id,date)唯一）
app.post('/api/daily-attendance', async (req, res) => {
  try {
    const { 
      userId, 
      date, 
      standardAttendanceHours, 
      overtimeHours, 
      leaveHours, 
      overtimeStartTime,
      overtimeEndTime,
      leaveStartTime,
      leaveEndTime,
      note, 
      adjustedBy 
    } = req.body || {};
    if (!userId || !date) {
      return res.status(400).json({ error: 'userId 和 date 为必填' });
    }
    // 只有当 standardAttendanceHours 明确传递时才使用，否则保持undefined
    const sah = standardAttendanceHours !== undefined ? Number(standardAttendanceHours) : undefined;
    const oh = Number(overtimeHours ?? 0);
    const lh = Number(leaveHours ?? 0);
    if (!Number.isFinite(oh) || !Number.isFinite(lh)) {
      return res.status(400).json({ error: '加班和请假小时数必须为数字' });
    }
    if (standardAttendanceHours !== undefined && !Number.isFinite(sah)) {
      return res.status(400).json({ error: '标准考勤小时数必须为数字' });
    }
    const connection = await mysql.createConnection(dbConfig);
    // 先检查记录是否存在
    const [existingRecords] = await connection.execute(
      'SELECT id, standard_attendance_hours FROM daily_attendance WHERE user_id = ? AND date = ?',
      [userId, date]
    );
    
    if (existingRecords.length > 0) {
      // 记录存在
      console.log(`记录存在，用户ID: ${userId}, 日期: ${date}, 原有标准工时: ${existingRecords[0].standard_attendance_hours}`);
      
      if (standardAttendanceHours !== undefined) {
        // 如果传递了 standardAttendanceHours，则更新标准工时
        const finalSah = Number(standardAttendanceHours);
        console.log(`更新标准工时为: ${finalSah}`);
        await connection.execute(`
          UPDATE daily_attendance 
          SET standard_attendance_hours = ?, overtime_hours = ?, leave_hours = ?, 
              overtime_start_time = ?, overtime_end_time = ?, 
              leave_start_time = ?, leave_end_time = ?, 
              note = ?, adjusted_by = ?, adjusted_at = NOW()
          WHERE user_id = ? AND date = ?
        `, [finalSah, oh, lh, overtimeStartTime || null, overtimeEndTime || null, 
            leaveStartTime || null, leaveEndTime || null, 
            note || null, adjustedBy || null, userId, date]);
      } else {
        // 如果没有传递 standardAttendanceHours，只更新加班、请假和备注，保持原有的标准考勤时间
        console.log(`保持原有标准工时: ${existingRecords[0].standard_attendance_hours}`);
        await connection.execute(`
          UPDATE daily_attendance 
          SET overtime_hours = ?, leave_hours = ?, 
              overtime_start_time = ?, overtime_end_time = ?, 
              leave_start_time = ?, leave_end_time = ?, 
              note = ?, adjusted_by = ?, adjusted_at = NOW()
          WHERE user_id = ? AND date = ?
        `, [oh, lh, overtimeStartTime || null, overtimeEndTime || null, 
            leaveStartTime || null, leaveEndTime || null, 
            note || null, adjustedBy || null, userId, date]);
      }
    } else {
      // 记录不存在，创建新记录
      // 如果 standardAttendanceHours 没有传递，使用默认值8
      const finalSah = standardAttendanceHours !== undefined ? Number(standardAttendanceHours) : 8;
      console.log(`记录不存在，用户ID: ${userId}, 日期: ${date}, 使用标准工时: ${finalSah}`);
      await connection.execute(`
        INSERT INTO daily_attendance (user_id, date, standard_attendance_hours, overtime_hours, leave_hours, 
                                     overtime_start_time, overtime_end_time, leave_start_time, leave_end_time, 
                                     note, adjusted_by, adjusted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [userId, date, finalSah, oh, lh, overtimeStartTime || null, overtimeEndTime || null, 
          leaveStartTime || null, leaveEndTime || null, note || null, adjustedBy || null]);
    }
    await connection.end();
    res.json({ success: true, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ error: '保存日考勤失败：' + error.message });
  }
});

// 单条调整（仅修改加班/请假/备注）
app.post('/api/daily-attendance/:id/adjust', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      overtimeHours, 
      leaveHours, 
      overtimeStartTime,
      overtimeEndTime,
      leaveStartTime,
      leaveEndTime,
      note, 
      adjustedBy 
    } = req.body || {};
    const oh = Number(overtimeHours ?? 0);
    const lh = Number(leaveHours ?? 0);
    if (!Number.isFinite(oh) || !Number.isFinite(lh)) {
      return res.status(400).json({ error: '小时数必须为数字' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // 如果id为null或不存在，需要先创建记录
    if (!id || id === 'null' || id === 'undefined') {
      await connection.end();
      return res.status(400).json({ error: '记录ID无效，无法调整' });
    }
    
    const [rows] = await connection.execute(`SELECT id FROM daily_attendance WHERE id = ?`, [id]);
    if (!rows || rows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '记录不存在' });
    }
    
    await connection.execute(`
      UPDATE daily_attendance 
      SET overtime_hours = ?, leave_hours = ?, 
          overtime_start_time = ?, overtime_end_time = ?, 
          leave_start_time = ?, leave_end_time = ?, 
          note = ?, adjusted_by = ?, adjusted_at = NOW()
      WHERE id = ?
    `, [oh, lh, overtimeStartTime || null, overtimeEndTime || null, 
        leaveStartTime || null, leaveEndTime || null, 
        note || null, adjustedBy || null, id]);
    await connection.end();
    res.json({ success: true, message: '调整成功' });
  } catch (error) {
    res.status(500).json({ error: '调整失败：' + error.message });
  }
});

// 确认考勤记录
app.post('/api/daily-attendance/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmedBy } = req.body || {};
    
    if (!confirmedBy) {
      return res.status(400).json({ error: '确认人ID不能为空' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // 检查记录是否存在
    const [rows] = await connection.execute(`SELECT id FROM daily_attendance WHERE id = ?`, [id]);
    if (!rows || rows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '记录不存在' });
    }
    
    // 更新确认状态
    await connection.execute(`
      UPDATE daily_attendance 
      SET is_confirmed = TRUE, confirmed_by = ?, confirmed_at = NOW()
      WHERE id = ?
    `, [confirmedBy, id]);
    
    await connection.end();
    res.json({ success: true, message: '考勤确认成功' });
  } catch (error) {
    res.status(500).json({ error: '确认失败：' + error.message });
  }
});

// 取消确认考勤记录
app.post('/api/daily-attendance/:id/unconfirm', async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await mysql.createConnection(dbConfig);
    
    // 检查记录是否存在
    const [rows] = await connection.execute(`SELECT id FROM daily_attendance WHERE id = ?`, [id]);
    if (!rows || rows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '记录不存在' });
    }
    
    // 取消确认状态
    await connection.execute(`
      UPDATE daily_attendance 
      SET is_confirmed = FALSE, confirmed_by = NULL, confirmed_at = NULL
      WHERE id = ?
    `, [id]);
    
    await connection.end();
    res.json({ success: true, message: '取消确认成功' });
  } catch (error) {
    res.status(500).json({ error: '取消确认失败：' + error.message });
  }
});

// 统计：总体与按用户（小时单位）
app.get('/api/daily-attendance/stats', async (req, res) => {
  try {
    const { start, end, userId } = req.query || {};
    const startDate = start || new Date().toISOString().slice(0, 10);
    const endDate = end || startDate;

    const connection = await mysql.createConnection(dbConfig);
    
    // 获取动态标准工作时长
    const workTimeSettings = await getStandardWorkHours(connection);
    const standardWorkHours = workTimeSettings.standardHours;
    const workTimeUpdatedAt = workTimeSettings.updatedAt;
    
    // 获取GitHub节假日数据（使用并行获取和错误处理）
    const startYear = new Date(startDate).getFullYear();
    const endYear = new Date(endDate).getFullYear();
    const holidaySets = new Map();
    const workingDaySets = new Map(); // 存储调休日
    
    try {
      // 并行获取所有年份的数据
      const yearPromises = [];
      for (let year = startYear; year <= endYear; year++) {
        yearPromises.push(getHolidaysFromGitHub(year));
      }
      
      const results = await Promise.allSettled(yearPromises);
      
      // 处理结果
      let yearIndex = 0;
      for (let year = startYear; year <= endYear; year++) {
        const result = results[yearIndex];
        if (result.status === 'fulfilled') {
          holidaySets.set(year, result.value.holidays);
          workingDaySets.set(year, result.value.workingDays);
        } else {
          console.warn(`[后端] 获取${year}年节假日数据失败，使用空集合:`, result.reason);
          holidaySets.set(year, new Set());
          workingDaySets.set(year, new Set());
        }
        yearIndex++;
      }
    } catch (error) {
      console.error('[后端] 获取节假日数据失败，使用空集合:', error);
      for (let year = startYear; year <= endYear; year++) {
        holidaySets.set(year, new Set());
        workingDaySets.set(year, new Set());
      }
    }
    
    const params = [startDate, endDate];
    let userFilterSql = 'u.role = \"worker\"';
    if (userId) {
      userFilterSql += ' AND u.id = ?';
      params.push(Number(userId));
    }

    // 获取所有考勤记录数据
    const [allRecords] = await connection.execute(`
      WITH RECURSIVE dates(d) AS (
        SELECT ?
        UNION ALL
        SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM dates WHERE d < ?
      )
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.department,
        dates.d as date,
        da.standard_attendance_hours,
        COALESCE(da.overtime_hours, 0.00) as overtime_hours,
        COALESCE(da.leave_hours, 0.00) as leave_hours,
        da.actual_hours
      FROM dates
      JOIN users u ON ${userFilterSql}
      LEFT JOIN daily_attendance da ON da.user_id = u.id AND da.date = dates.d
    `, params);
    
    // 根据GitHub节假日数据计算标准考勤时长并聚合统计
    const overallStats = {
      total_days: 0,
      total_standard_hours: 0,
      total_overtime_hours: 0,
      total_leave_hours: 0,
      total_actual_hours: 0
    };
    
    const byUserStats = new Map();
    
    allRecords.forEach(record => {
      const dateStr = record.date instanceof Date 
        ? record.date.toISOString().slice(0, 10) 
        : record.date;
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const dayOfWeek = date.getDay();
      
      // 计算标准考勤时长
      let standardHours = record.standard_attendance_hours;
      if (standardHours === null || standardHours === undefined) {
        const holidays = holidaySets.get(year) || new Set();
        const isHoliday = holidays.has(dateStr); // isOffDay === true
        
        // 根据 holiday-cn 的 isOffDay 字段判断
        if (!isHoliday) {
          // isOffDay === false：工作日
          if (workTimeUpdatedAt && date >= new Date(workTimeUpdatedAt)) {
            standardHours = standardWorkHours || 0.00;
          } else {
            standardHours = 0.00;
          }
        } else {
          // isOffDay === true：节假日
          standardHours = 0.00;
        }
      }
      
      // 计算实际工时
      const actualHours = record.actual_hours !== null && record.actual_hours !== undefined
        ? record.actual_hours
        : standardHours + (record.overtime_hours || 0) - (record.leave_hours || 0);
      
      // 聚合总体统计
      overallStats.total_days++;
      overallStats.total_standard_hours += standardHours;
      overallStats.total_overtime_hours += record.overtime_hours || 0;
      overallStats.total_leave_hours += record.leave_hours || 0;
      overallStats.total_actual_hours += actualHours;
      
      // 聚合按用户统计
      const userId = record.user_id;
      if (!byUserStats.has(userId)) {
        byUserStats.set(userId, {
          user_id: userId,
          user_name: record.user_name,
          department: record.department,
          days: 0,
          total_standard_hours: 0,
          total_overtime_hours: 0,
          total_leave_hours: 0,
          total_actual_hours: 0
        });
      }
      const userStat = byUserStats.get(userId);
      userStat.days++;
      userStat.total_standard_hours += standardHours;
      userStat.total_overtime_hours += record.overtime_hours || 0;
      userStat.total_leave_hours += record.leave_hours || 0;
      userStat.total_actual_hours += actualHours;
    });
    
    const overall = [overallStats];
    const byUser = Array.from(byUserStats.values()).sort((a, b) => a.user_name.localeCompare(b.user_name));
    await connection.end();
    res.json({ success: true, overall: overall?.[0] || {}, byUser: byUser || [] });
  } catch (error) {
    res.status(500).json({ error: '获取统计失败：' + error.message });
  }
});

// ============= 节假日管理 =============
// 获取节假日列表
app.get('/api/holidays', async (req, res) => {
  try {
    const { year, type } = req.query || {};
    const connection = await mysql.createConnection(dbConfig);
    
    let whereClause = '';
    const params = [];
    
    if (year) {
      whereClause += ' WHERE YEAR(date) = ?';
      params.push(Number(year));
    }
    
    if (type) {
      whereClause += whereClause ? ' AND type = ?' : ' WHERE type = ?';
      params.push(type);
    }
    
    const [rows] = await connection.execute(`
      SELECT * FROM holidays 
      ${whereClause}
      ORDER BY date ASC
    `, params);
    
    await connection.end();
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: '获取节假日列表失败：' + error.message });
  }
});

// 添加节假日
app.post('/api/holidays', async (req, res) => {
  try {
    const { date, name, type = 'national', is_working_day = false } = req.body;
    
    if (!date || !name) {
      return res.status(400).json({ error: '日期和名称不能为空' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(`
      INSERT INTO holidays (date, name, type, is_working_day) 
      VALUES (?, ?, ?, ?)
    `, [date, name, type, is_working_day]);
    
    await connection.end();
    res.json({ success: true, message: '节假日添加成功', id: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: '该日期已存在节假日记录' });
    } else {
      res.status(500).json({ error: '添加节假日失败：' + error.message });
    }
  }
});

// 更新节假日
app.put('/api/holidays/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, name, type, is_working_day } = req.body;
    
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(`
      UPDATE holidays 
      SET date = ?, name = ?, type = ?, is_working_day = ?
      WHERE id = ?
    `, [date, name, type, is_working_day, id]);
    
    await connection.end();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '节假日记录不存在' });
    }
    
    res.json({ success: true, message: '节假日更新成功' });
  } catch (error) {
    res.status(500).json({ error: '更新节假日失败：' + error.message });
  }
});

// 删除节假日
app.delete('/api/holidays/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await mysql.createConnection(dbConfig);
    
    const [result] = await connection.execute(`
      DELETE FROM holidays WHERE id = ?
    `, [id]);
    
    await connection.end();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '节假日记录不存在' });
    }
    
    res.json({ success: true, message: '节假日删除成功' });
  } catch (error) {
    res.status(500).json({ error: '删除节假日失败：' + error.message });
  }
});

// 清空当天考勤（设置所有工人当天考勤为0）
app.post('/api/daily-attendance/clear', async (req, res) => {
  try {
    const { date, adjustedBy } = req.body;
    
    if (!date || !adjustedBy) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // 获取所有工人
    const [workers] = await connection.execute(
      'SELECT id FROM users WHERE role = "worker"'
    );
    
    if (workers.length === 0) {
      await connection.end();
      return res.json({ success: true, message: '没有工人需要处理', affected: 0 });
    }
    
    // 为每个工人创建或更新考勤记录，设置为0
    let affected = 0;
    for (const worker of workers) {
      const [result] = await connection.execute(`
        INSERT INTO daily_attendance (user_id, date, standard_attendance_hours, overtime_hours, leave_hours, actual_hours, note, adjusted_by, adjusted_at)
        VALUES (?, ?, 0.00, 0.00, 0.00, 0.00, '管理员清空当天考勤', ?, NOW())
        ON DUPLICATE KEY UPDATE
        standard_attendance_hours = 0.00,
        overtime_hours = 0.00,
        leave_hours = 0.00,
        actual_hours = 0.00,
        note = '管理员清空当天考勤',
        adjusted_by = ?,
        adjusted_at = NOW()
      `, [worker.id, date, adjustedBy, adjustedBy]);
      
      if (result.affectedRows > 0) {
        affected++;
      }
    }
    
    await connection.end();
    res.json({ success: true, message: `成功清空${affected}名工人的当天考勤` });
    
  } catch (error) {
    res.status(500).json({ error: '清空考勤失败：' + error.message });
  }
});

// 设置当天考勤（拒绝使用默认工时，必须配置工作时间设置）
app.post('/api/daily-attendance/set', async (req, res) => {
  try {
    const { date, adjustedBy } = req.body;
    
    if (!date || !adjustedBy) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // 获取动态标准工作时长（拒绝使用默认值）
    const workTimeSettings = await getStandardWorkHours(connection);
    const standardWorkHours = workTimeSettings.standardHours;
    
    if (standardWorkHours === null) {
      await connection.end();
      return res.status(400).json({ 
        error: '拒绝使用默认工时，请先配置工作时间设置' 
      });
    }
    
    // 获取所有工人
    const [workers] = await connection.execute(
      'SELECT id FROM users WHERE role = "worker"'
    );
    
    if (workers.length === 0) {
      await connection.end();
      return res.json({ success: true, message: '没有工人需要处理', affected: 0 });
    }
    
    // 为每个工人创建或更新考勤记录，设置为动态标准工作时长
    let affected = 0;
    for (const worker of workers) {
      const [result] = await connection.execute(`
        INSERT INTO daily_attendance (user_id, date, standard_attendance_hours, overtime_hours, leave_hours, actual_hours, note, adjusted_by, adjusted_at)
        VALUES (?, ?, ?, 0.00, 0.00, ?, '管理员设置当天考勤', ?, NOW())
        ON DUPLICATE KEY UPDATE
        standard_attendance_hours = ?,
        overtime_hours = 0.00,
        leave_hours = 0.00,
        actual_hours = ?,
        note = '管理员设置当天考勤',
        adjusted_by = ?,
        adjusted_at = NOW()
      `, [worker.id, date, standardWorkHours, standardWorkHours, adjustedBy, standardWorkHours, standardWorkHours, adjustedBy]);
      
      if (result.affectedRows > 0) {
        affected++;
      }
    }
    
    await connection.end();
    res.json({ success: true, message: `成功设置${affected}名工人的当天考勤` });
    
  } catch (error) {
    res.status(500).json({ error: '设置考勤失败：' + error.message });
  }
});

// ============= 按任务计时（上工/下工迁移到任务维度） =============
// 初始化任务计时表（若不存在则创建）
(async () => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS task_time_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT NOT NULL,
        user_id INT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME NULL,
        total_minutes INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_task_user (task_id, user_id),
        INDEX idx_user_open (user_id, end_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await connection.end();
    console.log('任务计时表校验完成');
  } catch (e) {
    console.error('初始化任务计时表失败：', e.message);
  }
})();

// 开始任务计时：一个用户同一时间只允许一条进行中的计时
app.post('/api/task-time/start', async (req, res) => {
  try {
    const { taskId, userId } = req.body || {};
    if (!taskId || !userId) return res.status(400).json({ error: 'taskId 与 userId 必填' });

    const connection = await mysql.createConnection(dbConfig);
    // 校验任务归属（检查用户是否为任何阶段的负责人）
    const [trows] = await connection.execute(`
      SELECT id, machining_assignee, electrical_assignee, pre_assembly_assignee, post_assembly_assignee, debugging_assignee 
      FROM tasks WHERE id = ?
    `, [taskId]);
    if (!trows.length) {
      await connection.end();
      return res.status(404).json({ error: '任务不存在' });
    }
    
    const task = trows[0];
    const isAssignee = task.machining_assignee == userId || 
                      task.electrical_assignee == userId || 
                      task.pre_assembly_assignee == userId || 
                      task.post_assembly_assignee == userId || 
                      task.debugging_assignee == userId;
    
    if (!isAssignee) {
      await connection.end();
      return res.status(403).json({ error: '任务未分配给该用户' });
    }

    // 是否有未结束的计时
    const [openRows] = await connection.execute(
      'SELECT id FROM task_time_logs WHERE user_id = ? AND end_time IS NULL ORDER BY id DESC LIMIT 1',
      [userId]
    );
    if (openRows.length > 0) {
      await connection.end();
      return res.status(400).json({ error: '已有进行中的计时，请先停止' });
    }

    const [result] = await connection.execute(
      'INSERT INTO task_time_logs (task_id, user_id, start_time) VALUES (?, ?, NOW())',
      [taskId, userId]
    );
    // 同步任务表的开始时间（只在为空时写入）
    await connection.execute('UPDATE tasks SET start_time = COALESCE(start_time, NOW()) WHERE id = ?', [taskId]);
    await connection.end();
    res.json({ success: true, logId: result.insertId });
  } catch (error) {
    res.status(500).json({ error: '开始任务计时失败：' + error.message });
  }
});

// 停止任务计时：结束当前用户对指定任务的未结束记录
app.post('/api/task-time/stop', async (req, res) => {
  try {
    const { taskId, userId } = req.body || {};
    if (!taskId || !userId) return res.status(400).json({ error: 'taskId 与 userId 必填' });

    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT id, start_time FROM task_time_logs WHERE task_id = ? AND user_id = ? AND end_time IS NULL ORDER BY id DESC LIMIT 1',
      [taskId, userId]
    );
    if (!rows.length) {
      await connection.end();
      return res.status(404).json({ error: '未找到进行中的计时' });
    }
    const logId = rows[0].id;
    const startTime = new Date(rows[0].start_time);
    const endTime = new Date();
    const totalMinutes = Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60000));

    await connection.execute('UPDATE task_time_logs SET end_time = NOW(), total_minutes = ? WHERE id = ?', [totalMinutes, logId]);
    await connection.end();
    res.json({ success: true, logId, totalMinutes });
  } catch (error) {
    res.status(500).json({ error: '停止任务计时失败：' + error.message });
  }
});

// 查询用户当前是否有进行中的任务计时
app.get('/api/task-time/active/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      `SELECT ttl.*, t.name AS task_name FROM task_time_logs ttl
       JOIN tasks t ON t.id = ttl.task_id
       WHERE ttl.user_id = ? AND ttl.end_time IS NULL
       ORDER BY ttl.id DESC LIMIT 1`,
      [userId]
    );
    await connection.end();
    res.json(rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: '查询进行中计时失败：' + error.message });
  }
});

// 某任务累计分钟数（该任务下所有计时的总和）
app.get('/api/task-time/summary/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT COALESCE(SUM(total_minutes), 0) AS total FROM task_time_logs WHERE task_id = ?',
      [taskId]
    );
    await connection.end();
    const total = rows && rows[0] && rows[0].total ? Number(rows[0].total) : 0;
    res.json({ taskId: Number(taskId), totalMinutes: total });
  } catch (error) {
    res.status(500).json({ error: '获取任务累计时长失败：' + error.message });
  }
});

// 管理员/主管：可视化工人报工记录（合并完成记录与任务计时）
// GET /api/work-records?start=2025-10-01&end=2025-10-31&userId=3&taskId=12
app.get('/api/work-records', async (req, res) => {
  try {
    const { start, end, userId, taskId, workType } = req.query || {};
    const conditions = [];
    const params = [];
    
    // 对于协助记录（work_type='assist'），使用 assist_start 和 assist_end 来过滤
    // 对于其他记录，使用 created_at 来过滤
    if (start && end) {
      if (workType === 'assist') {
        // 协助记录：查询 assist_start 或 assist_end 在时间范围内的记录
        conditions.push('(wr.assist_start IS NOT NULL AND wr.assist_start <= ? AND (wr.assist_end IS NULL OR wr.assist_end >= ?))');
        params.push(end + ' 23:59:59');
        params.push(start + ' 00:00:00');
      } else {
        // 其他记录：使用 created_at
        conditions.push('wr.created_at >= ?'); 
        params.push(start + ' 00:00:00');
        conditions.push('wr.created_at <= ?'); 
        params.push(end + ' 23:59:59');
      }
    } else {
      // 如果没有指定时间范围，使用 created_at（向后兼容）
      if (start) { conditions.push('wr.created_at >= ?'); params.push(start + ' 00:00:00'); }
      if (end) { conditions.push('wr.created_at <= ?'); params.push(end + ' 23:59:59'); }
    }
    
    if (userId) { conditions.push('wr.user_id = ?'); params.push(Number(userId)); }
    if (taskId) { conditions.push('wr.task_id = ?'); params.push(Number(taskId)); }
    if (workType) { conditions.push('wr.work_type = ?'); params.push(workType); }
    const whereSql = conditions.length ? ('WHERE ' + conditions.join(' AND ')) : '';

    const connection = await mysql.createConnection(dbConfig);
    try {
      let rows;
      // 先尝试包含 assist_start 字段的查询
      try {
        [rows] = await connection.execute(
          `SELECT wr.id, wr.task_id, t.name as task_name, wr.user_id, u.name as user_name,
                  wr.work_type, wr.start_time, wr.end_time, wr.hours_worked,
                  wr.quantity_completed, wr.approval_status, wr.created_at,
                  wr.assist_start, wr.assist_end, wr.assist_phase
           FROM work_reports wr
           LEFT JOIN tasks t ON t.id = wr.task_id
           LEFT JOIN users u ON u.id = wr.user_id
           ${whereSql}
           ORDER BY wr.created_at DESC, wr.id DESC`
          , params);
      } catch (fieldError) {
        // 如果字段不存在（错误代码1054或错误信息包含'Unknown column'），使用不包含这些字段的查询
        const errorMsg = fieldError.message || '';
        const errorCode = fieldError.code || '';
        if (errorCode === 'ER_BAD_FIELD_ERROR' || errorMsg.includes('Unknown column') || errorMsg.includes('assist')) {
          [rows] = await connection.execute(
            `SELECT wr.id, wr.task_id, t.name as task_name, wr.user_id, u.name as user_name,
                    wr.work_type, wr.start_time, wr.end_time, wr.hours_worked,
                    wr.quantity_completed, wr.approval_status, wr.created_at,
                    NULL as assist_start, NULL as assist_end, NULL as assist_phase
             FROM work_reports wr
             LEFT JOIN tasks t ON t.id = wr.task_id
             LEFT JOIN users u ON u.id = wr.user_id
             ${whereSql}
             ORDER BY wr.created_at DESC, wr.id DESC`
            , params);
        } else {
          throw fieldError;
        }
      }
      await connection.end();
      res.json(rows || []);
    } catch (queryError) {
      await connection.end();
      throw queryError;
    }
  } catch (error) {
    console.error('获取报工记录失败:', error);
    res.status(500).json({ error: '获取报工记录失败：' + error.message, details: error.stack });
  }
});

// ============= 阶段流程控制API =============

// 获取任务阶段信息
app.get('/api/tasks/:taskId/phases', async (req, res) => {
  try {
    const { taskId } = req.params;
    const connection = await mysql.createConnection(dbConfig);
    
    const [rows] = await connection.execute(`
      SELECT 
        id, name, current_phase,
        machining_hours_est, electrical_hours_est, pre_assembly_hours_est, post_assembly_hours_est, debugging_hours_est,
        machining_phase, electrical_phase, pre_assembly_phase, post_assembly_phase, debugging_phase,
        machining_start_time, electrical_start_time, pre_assembly_start_time, post_assembly_start_time, debugging_start_time,
        machining_complete_time, electrical_complete_time, pre_assembly_complete_time, post_assembly_complete_time, debugging_complete_time
      FROM tasks 
      WHERE id = ?
    `, [taskId]);
    
    await connection.end();
    
    if (rows.length === 0) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    const task = rows[0];
    
    // 定义阶段顺序
    const phases = [
      { key: 'machining', name: '机加', order: 1 },
      { key: 'electrical', name: '电控', order: 2 },
      { key: 'pre_assembly', name: '总装前段', order: 3 },
      { key: 'post_assembly', name: '总装后段', order: 4 },
      { key: 'debugging', name: '调试', order: 5 }
    ];
    
    // 构建阶段状态
    const phaseStatus = phases.map(phase => ({
      key: phase.key,
      name: phase.name,
      order: phase.order,
      isCompleted: task[`${phase.key}_phase`] === 1,
      isCurrent: task.current_phase === phase.key,
      canStart: canStartPhase(task, phase.key),
      estimatedHours: task[`${phase.key}_hours_est`],
      startTime: task[`${phase.key}_start_time`],
      completeTime: task[`${phase.key}_complete_time`]
    }));
    
    res.json({
      taskId: task.id,
      taskName: task.name,
      currentPhase: task.current_phase,
      phases: phaseStatus
    });
    
  } catch (error) {
    res.status(500).json({ error: '获取任务阶段信息失败：' + error.message });
  }
});

// 检查是否可以开始某个阶段
function canStartPhase(task, phaseKey) {
  // 如果当前阶段已完成，不能重复开始
  if (task[`${phaseKey}_phase`] === 1) {
    return false;
  }
  
  // 机加和电控阶段可以并列开始（优先级相同）
  if (phaseKey === 'machining' || phaseKey === 'electrical') {
    return true;
  }
  
  // 总装前段需要机加阶段已派工或已完成
  if (phaseKey === 'pre_assembly') {
    // 检查机加阶段是否已派工
    const machiningAssignee = task.machining_assignee;
    const machiningAssigned = machiningAssignee != null && 
                              machiningAssignee !== '' && 
                              machiningAssignee !== 0 && 
                              machiningAssignee !== '0' &&
                              machiningAssignee !== 'null' &&
                              machiningAssignee !== 'undefined';
    // 检查机加阶段是否已完成
    const machiningCompleted = task.machining_phase === 1 || task.machining_phase === '1';
    // 已派工或已完成都可以
    return machiningAssigned || machiningCompleted;
  }
  
  // 总装后段需要总装前段已派工
  if (phaseKey === 'post_assembly') {
    // 检查总装前段是否已派工
    const preAssemblyAssignee = task.pre_assembly_assignee;
    const preAssemblyAssigned = preAssemblyAssignee != null && 
                                preAssemblyAssignee !== '' && 
                                preAssemblyAssignee !== 0 && 
                                preAssemblyAssignee !== '0' &&
                                preAssemblyAssignee !== 'null' &&
                                preAssemblyAssignee !== 'undefined';
    // 检查总装前段是否已完成（已完成也可以）
    const preAssemblyCompleted = task.pre_assembly_phase === 1 || task.pre_assembly_phase === '1';
    // 已派工或已完成都可以
    return preAssemblyAssigned || preAssemblyCompleted;
  }
  
  // 调试阶段需要总装后段已派工
  if (phaseKey === 'debugging') {
    // 检查总装后段是否已派工
    const postAssemblyAssignee = task.post_assembly_assignee;
    const postAssemblyAssigned = postAssemblyAssignee != null && 
                                postAssemblyAssignee !== '' && 
                                postAssemblyAssignee !== 0 && 
                                postAssemblyAssignee !== '0' &&
                                postAssemblyAssignee !== 'null' &&
                                postAssemblyAssignee !== 'undefined';
    // 检查总装后段是否已完成（已完成也可以）
    const postAssemblyCompleted = task.post_assembly_phase === 1 || task.post_assembly_phase === '1';
    // 已派工或已完成都可以
    return postAssemblyAssigned || postAssemblyCompleted;
  }
  
  return false;
}

// 开始阶段
app.post('/api/tasks/:taskId/phases/:phaseKey/start', async (req, res) => {
  try {
    const { taskId, phaseKey } = req.params;
    const { userId } = req.body || {};
    
    if (!userId) {
      return res.status(400).json({ error: '用户ID必填' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // 获取任务信息
    const [taskRows] = await connection.execute(`
      SELECT * FROM tasks WHERE id = ?
    `, [taskId]);
    
    if (taskRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '任务不存在' });
    }
    
    const task = taskRows[0];
    
    // 检查权限（只有分配给该用户的任务或当前阶段负责人才能操作）
    const hasPermission = task.machining_assignee == userId || task.electrical_assignee == userId || task.pre_assembly_assignee == userId || task.post_assembly_assignee == userId || task.debugging_assignee == userId || 
                          (task.current_phase_assignee && task.current_phase_assignee === parseInt(userId));
    
    if (!hasPermission) {
      await connection.end();
      return res.status(403).json({ error: '无权限操作此任务' });
    }
    
    // 检查是否可以开始该阶段
    if (!canStartPhase(task, phaseKey)) {
      await connection.end();
      return res.status(400).json({ error: '无法开始该阶段，请先完成前置阶段' });
    }
    
    // 检查是否已经在进行中
    if (task[`${phaseKey}_phase`] === 1) {
      await connection.end();
      return res.status(400).json({ error: '该阶段已完成' });
    }
    
    // 更新阶段状态（根据新逻辑更新 current_phase）
    if (phaseKey === 'machining' || phaseKey === 'electrical') {
      // 机加或电控：如果机加未完成，允许并行，设置为对应阶段
      await connection.execute(`
        UPDATE tasks 
        SET 
          current_phase = ?,
          ${phaseKey}_start_time = NOW()
        WHERE id = ?
      `, [phaseKey, taskId]);
    } else if (phaseKey === 'pre_assembly') {
      // 总装前段：需要机加已完成
      await connection.execute(`
        UPDATE tasks 
        SET 
          current_phase = ?,
          ${phaseKey}_start_time = NOW()
        WHERE id = ? AND machining_phase = 1
      `, [phaseKey, taskId]);
    } else if (phaseKey === 'post_assembly') {
      // 总装后段：需要总装前段已派工
      await connection.execute(`
        UPDATE tasks 
        SET 
          current_phase = ?,
          ${phaseKey}_start_time = NOW()
        WHERE id = ? 
          AND pre_assembly_assignee IS NOT NULL 
          AND pre_assembly_assignee != '' 
          AND pre_assembly_assignee != 0 
          AND pre_assembly_assignee != '0'
      `, [phaseKey, taskId]);
    } else if (phaseKey === 'debugging') {
      // 调试阶段：需要总装后段已派工
      await connection.execute(`
        UPDATE tasks 
        SET 
          current_phase = ?,
          ${phaseKey}_start_time = NOW()
        WHERE id = ? 
          AND post_assembly_assignee IS NOT NULL 
          AND post_assembly_assignee != '' 
          AND post_assembly_assignee != 0 
          AND post_assembly_assignee != '0'
      `, [phaseKey, taskId]);
    } else {
      // 其他阶段
      await connection.execute(`
        UPDATE tasks 
        SET 
          current_phase = ?,
          ${phaseKey}_start_time = NOW()
        WHERE id = ?
      `, [phaseKey, taskId]);
    }
    
    await connection.end();
    res.json({ success: true, message: `${getPhaseName(phaseKey)}阶段已开始` });
    
  } catch (error) {
    res.status(500).json({ error: '开始阶段失败：' + error.message });
  }
});

// 暂停阶段
app.post('/api/tasks/:taskId/phases/:phaseKey/pause', async (req, res) => {
  try {
    const { taskId, phaseKey } = req.params;
    const { userId, note } = req.body || {};
    
    if (!userId) {
      return res.status(400).json({ error: '用户ID必填' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // 获取任务信息
    const [taskRows] = await connection.execute(`
      SELECT * FROM tasks WHERE id = ?
    `, [taskId]);
    
    if (taskRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '任务不存在' });
    }
    
    const task = taskRows[0];
    
    // 检查权限
    const hasPermission = task.machining_assignee == userId || 
                          task.electrical_assignee == userId || 
                          task.pre_assembly_assignee == userId || 
                          task.post_assembly_assignee == userId || 
                          task.debugging_assignee == userId || 
                          (task.current_phase_assignee && task.current_phase_assignee === parseInt(userId));
    
    if (!hasPermission) {
      await connection.end();
      return res.status(403).json({ error: '无权限操作此任务' });
    }
    
    // 检查阶段是否已开始
    if (!task[`${phaseKey}_start_time`]) {
      await connection.end();
      return res.status(400).json({ error: '该阶段尚未开始，无法暂停' });
    }
    
    // 检查阶段是否已完成
    if (task[`${phaseKey}_phase`] === 1) {
      await connection.end();
      return res.status(400).json({ error: '该阶段已完成，无法暂停' });
    }
    
    // 检查阶段是否已暂停
    if (task[`${phaseKey}_paused_at`]) {
      await connection.end();
      return res.status(400).json({ error: '该阶段已处于暂停状态' });
    }
    
    // 更新阶段暂停状态和备注
    const updateFields = [`${phaseKey}_paused_at = NOW()`];
    const updateValues = [];
    
    if (note !== undefined && note !== null) {
      updateFields.push(`${phaseKey}_pause_note = ?`);
      updateValues.push(note || null);
    }
    
    await connection.execute(`
      UPDATE tasks 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, [...updateValues, taskId]);
    
    await connection.end();
    res.json({ success: true, message: `${getPhaseName(phaseKey)}阶段已暂停` });
    
  } catch (error) {
    res.status(500).json({ error: '暂停阶段失败：' + error.message });
  }
});

// 继续阶段
app.post('/api/tasks/:taskId/phases/:phaseKey/resume', async (req, res) => {
  try {
    const { taskId, phaseKey } = req.params;
    const { userId } = req.body || {};
    
    if (!userId) {
      return res.status(400).json({ error: '用户ID必填' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // 获取任务信息
    const [taskRows] = await connection.execute(`
      SELECT * FROM tasks WHERE id = ?
    `, [taskId]);
    
    if (taskRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '任务不存在' });
    }
    
    const task = taskRows[0];
    
    // 检查权限
    const hasPermission = task.machining_assignee == userId || 
                          task.electrical_assignee == userId || 
                          task.pre_assembly_assignee == userId || 
                          task.post_assembly_assignee == userId || 
                          task.debugging_assignee == userId || 
                          (task.current_phase_assignee && task.current_phase_assignee === parseInt(userId));
    
    if (!hasPermission) {
      await connection.end();
      return res.status(403).json({ error: '无权限操作此任务' });
    }
    
    // 检查阶段是否已暂停
    if (!task[`${phaseKey}_paused_at`]) {
      await connection.end();
      return res.status(400).json({ error: '该阶段未处于暂停状态' });
    }
    
    // 更新阶段继续状态（清除暂停时间）
    await connection.execute(`
      UPDATE tasks 
      SET ${phaseKey}_paused_at = NULL
      WHERE id = ?
    `, [taskId]);
    
    await connection.end();
    res.json({ success: true, message: `${getPhaseName(phaseKey)}阶段已继续` });
    
  } catch (error) {
    res.status(500).json({ error: '继续阶段失败：' + error.message });
  }
});

// 完成阶段
app.post('/api/tasks/:taskId/phases/:phaseKey/complete', async (req, res) => {
  try {
    const { taskId, phaseKey } = req.params;
    const { userId, quantity, qualityNotes, issues } = req.body || {};
    
    if (!userId) {
      return res.status(400).json({ error: '用户ID必填' });
    }
    
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: '完成数量必填且必须大于0' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // 获取任务信息
    const [taskRows] = await connection.execute(`
      SELECT * FROM tasks WHERE id = ?
    `, [taskId]);
    
    if (taskRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '任务不存在' });
    }
    
    const task = taskRows[0];
    
    // 检查权限（只有分配给该用户的任务或当前阶段负责人才能操作，协助人员不能完成阶段）
    const hasPermission = task.machining_assignee == userId || task.electrical_assignee == userId || task.pre_assembly_assignee == userId || task.post_assembly_assignee == userId || task.debugging_assignee == userId || 
                          (task.current_phase_assignee && task.current_phase_assignee === parseInt(userId));
    
    if (!hasPermission) {
      await connection.end();
      return res.status(403).json({ error: '无权限操作此任务，只有负责人可以完成阶段' });
    }
    
    // 检查当前阶段是否正确
    if (task.current_phase !== phaseKey) {
      await connection.end();
      return res.status(400).json({ error: '当前阶段不匹配' });
    }
    
    // 检查是否已经完成
    if (task[`${phaseKey}_phase`] === 1) {
      await connection.end();
      return res.status(400).json({ error: '该阶段已完成' });
    }
    
    // 开始事务
    await connection.beginTransaction();
    
    try {
      // 计算阶段实际工时
      const actualHours = await calculatePhaseActualHours(connection, taskId, userId, phaseKey, task);
      
      // 更新阶段完成状态
      await connection.execute(`
        UPDATE tasks 
        SET 
          ${phaseKey}_phase = 1,
          ${phaseKey}_complete_time = NOW()
        WHERE id = ?
      `, [taskId]);
      
      // 记录报工信息（直接设置为已审批，无需审批流程）
      await connection.execute(`
        INSERT INTO work_reports (
          task_id, user_id, work_type, 
          quantity_completed, quality_notes, issues,
          start_time, end_time, hours_worked, created_at,
          approval_status
        ) VALUES (?, ?, 'complete', ?, ?, ?, ?, ?, ?, NOW(), 'approved')
      `, [taskId, userId, quantity, qualityNotes || '', issues || '', task[`${phaseKey}_start_time`], new Date(), actualHours]);
      
      // 确定下一个阶段
      let nextPhase = null;
      let taskCompleted = false;
      
      // 检查是否所有阶段都已完成（使用更新后的状态）
      const updatedTask = { ...task, [`${phaseKey}_phase`]: 1 };
      const allPhasesCompleted = updatedTask.machining_phase === 1 && 
                                updatedTask.electrical_phase === 1 && 
                                updatedTask.pre_assembly_phase === 1 && 
                                updatedTask.post_assembly_phase === 1 && 
                                updatedTask.debugging_phase === 1;
      
      if (allPhasesCompleted) {
        // 所有阶段完成，任务完成
        try {
          // 尝试使用新字段
          await connection.execute(`
            UPDATE tasks SET 
              status = 'completed', 
              end_time = NOW(),
              task_pool_status = 'completed',
              last_phase_completed_at = NOW()
            WHERE id = ?
          `, [taskId]);
        } catch (error) {
          // 如果新字段不存在，使用旧的方式
          await connection.execute(`
            UPDATE tasks SET status = 'completed', end_time = NOW() WHERE id = ?
          `, [taskId]);
        }
        taskCompleted = true;
      } else {
        // 检查是否可以进入下一个阶段（使用更新后的状态，遵循新逻辑）
        if (phaseKey === 'machining') {
          // 机加完成后，如果总装前段未完成，进入总装前段
          if (updatedTask.pre_assembly_phase === 0) {
            nextPhase = 'pre_assembly';
          }
          // 如果总装前段已完成或进行中，但电控未完成，不设置 nextPhase（保持电控阶段，如果已分配）
        } else if (phaseKey === 'electrical') {
          // 电控完成后，如果机加未完成，保持机加阶段
          if (updatedTask.machining_phase === 0) {
            nextPhase = 'machining';
          } 
          // 如果机加已完成且总装前段未完成，进入总装前段
          else if (updatedTask.pre_assembly_phase === 0) {
            nextPhase = 'pre_assembly';
          }
        } else if (phaseKey === 'pre_assembly') {
          // 总装前段完成后，进入总装后段
          nextPhase = 'post_assembly';
        } else if (phaseKey === 'post_assembly') {
          // 总装后段完成后，进入调试阶段
          nextPhase = 'debugging';
        }
        
        // 如果有下一个阶段，更新当前阶段
        if (nextPhase) {
          try {
            // 如果是机加或电控阶段，需要设置对应的阶段负责人
            if (nextPhase === 'machining' && task.machining_assignee) {
              await connection.execute(`
                UPDATE tasks SET 
                  current_phase = ?, 
                  current_phase_assignee = ?,
                  task_pool_status = 'assigned',
                  last_phase_completed_at = NOW()
                WHERE id = ?
              `, [nextPhase, task.machining_assignee, taskId]);
            } else if (nextPhase === 'electrical' && task.electrical_assignee) {
              await connection.execute(`
                UPDATE tasks SET 
                  current_phase = ?, 
                  current_phase_assignee = ?,
                  task_pool_status = 'assigned',
                  last_phase_completed_at = NOW()
                WHERE id = ?
              `, [nextPhase, task.electrical_assignee, taskId]);
            } else {
              // 其他阶段或没有阶段负责人
              await connection.execute(`
                UPDATE tasks SET 
                  current_phase = ?, 
                  current_phase_assignee = NULL,
                  task_pool_status = 'in_pool',
                  last_phase_completed_at = NOW()
                WHERE id = ?
              `, [nextPhase, taskId]);
            }
          } catch (error) {
            // 如果新字段不存在，使用旧的方式
            await connection.execute(`
              UPDATE tasks SET 
                current_phase = ?
              WHERE id = ?
            `, [nextPhase, taskId]);
          }
        } else {
          // 没有下一个阶段可进入，任务进入等待状态
          try {
            await connection.execute(`
              UPDATE tasks SET 
                current_phase_assignee = NULL,
                task_pool_status = 'in_pool',
                last_phase_completed_at = NOW()
              WHERE id = ?
            `, [taskId]);
          } catch (error) {
            // 如果新字段不存在，使用旧的方式（无需更新）
            // 空操作，不执行任何更新
          }
        }
      }
      
      await connection.commit();
      
      res.json({ 
        success: true, 
        message: `${getPhaseName(phaseKey)}阶段已完成`,
        nextPhase: nextPhase,
        taskCompleted: taskCompleted,
        inTaskPool: !taskCompleted && nextPhase !== null,
        actualHours: actualHours
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    }
    
    await connection.end();
    
  } catch (error) {
    res.status(500).json({ error: '完成阶段失败：' + error.message });
  }
});

// 获取阶段名称
function getPhaseName(phaseKey) {
  const phaseNames = {
    'machining': '机加',
    'electrical': '电控',
    'pre_assembly': '总装前段',
    'post_assembly': '总装后段',
    'debugging': '调试'
  };
  return phaseNames[phaseKey] || phaseKey;
}

// ============= 协助人员管理API =============

// 指定协助人员
app.post('/api/tasks/:taskId/phases/:phaseKey/assign-assistant', async (req, res) => {
  try {
    const { taskId, phaseKey } = req.params;
    const { assistantUserId, reason, assistStart, assistEnd } = req.body;
    
    if (!assistantUserId) {
      return res.status(400).json({ error: '协助人员ID必填' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // 检查任务是否存在
    const [taskRows] = await connection.execute('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (taskRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '任务不存在' });
    }
    
    const task = taskRows[0];
    
    // 检查是否是负责人（负责人不能作为协助人员）
    if (task[`${phaseKey}_assignee`] == assistantUserId) {
      await connection.end();
      return res.status(400).json({ error: '该人员是负责人，不能指定为协助人员' });
    }
    
    // 允许已完成阶段也能添加协助人员（用于效率计算的协助时间扣减）
    // 注释掉以下检查，允许已完成阶段添加协助人员
    // if (task[`${phaseKey}_phase`] === 1) {
    //   await connection.end();
    //   return res.status(400).json({ error: '该阶段已完成，无需指定协助人员' });
    // }
    
    // 检查协助人员是否已存在（检查是否已协助当前阶段）
    // 注意：允许同一人员协助同一任务的不同阶段，但同一阶段不能重复添加
    const [existingAssist] = await connection.execute(`
      SELECT id FROM work_reports 
      WHERE task_id = ? AND user_id = ? AND work_type = 'assist' AND assist_phase = ? AND approval_status = 'approved'
      LIMIT 1
    `, [taskId, assistantUserId, phaseKey]);
    
    if (existingAssist.length > 0) {
      await connection.end();
      return res.status(400).json({ error: '该人员已被指定为该阶段的协助人员' });
    }
    
    // 记录协助人员（仅作为标记，不参与实际操作）
    await connection.execute(`
      INSERT INTO work_reports (
        task_id, user_id, work_type, assist_phase, assist_start, assist_end, quality_notes, 
        approval_status, created_at
      ) VALUES (?, ?, 'assist', ?, ?, ?, ?, 'approved', NOW())
    `, [
      taskId, 
      assistantUserId, 
      phaseKey, 
      assistStart ? new Date(assistStart) : null, 
      assistEnd ? new Date(assistEnd) : null,
      reason || '主管指定协助完成紧急任务'
    ]);
    
    await connection.end();
    res.json({ success: true, message: '协助人员指定成功' });
  } catch (error) {
    res.status(500).json({ error: '指定协助人员失败：' + error.message });
  }
});

// 更新协助时间
app.post('/api/tasks/:taskId/phases/:phaseKey/assistants/:assistantUserId/time', async (req, res) => {
  try {
    const { taskId, phaseKey, assistantUserId } = req.params;
    const { assistStart, assistEnd, managerId } = req.body;
    
    if (!managerId) {
      return res.status(400).json({ error: '审批经理必选' });
    }
    const connection = await mysql.createConnection(dbConfig);
    const [managerRows] = await connection.execute('SELECT id, role FROM users WHERE id = ?', [managerId]);
    if (managerRows.length === 0 || managerRows[0].role !== 'manager') {
      await connection.end();
      return res.status(400).json({ error: '审批人必须是经理' });
    }
    if (!assistStart || !assistEnd) {
      return res.status(400).json({ error: '协助开始和结束时间必填' });
    }

    const [result] = await connection.execute(`
      UPDATE work_reports
      SET assist_start = ?, assist_end = ?, approval_status = 'approved', approved_by = ?, approved_at = NOW()
      WHERE task_id = ? AND user_id = ? AND work_type = 'assist' AND assist_phase = ?
    `, [new Date(assistStart), new Date(assistEnd), managerId, taskId, assistantUserId, phaseKey]);

    await connection.end();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '协助记录不存在' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '更新协助时间失败：' + error.message });
  }
});

// 取消协助人员
app.delete('/api/tasks/:taskId/phases/:phaseKey/assistants/:assistantUserId', async (req, res) => {
  try {
    const { taskId, phaseKey, assistantUserId } = req.params;
    
    const connection = await mysql.createConnection(dbConfig);
    
    // 检查任务是否存在
    const [taskRows] = await connection.execute('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (taskRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '任务不存在' });
    }
    
    const task = taskRows[0];
    
    // 检查阶段是否已完成
    if (task[`${phaseKey}_phase`] === 1) {
      await connection.end();
      return res.status(400).json({ error: '该阶段已完成，无法取消协助' });
    }
    
    // 删除协助记录（软删除：将 approval_status 改为 'rejected'）
    const [result] = await connection.execute(`
      UPDATE work_reports 
      SET approval_status = 'rejected'
      WHERE task_id = ? AND user_id = ? AND work_type = 'assist' AND approval_status = 'approved' AND assist_phase = ?
    `, [taskId, assistantUserId, phaseKey]);
    
    if (result.affectedRows === 0) {
      await connection.end();
      return res.status(404).json({ error: '协助人员不存在' });
    }
    
    await connection.end();
    res.json({ success: true, message: '协助人员已取消' });
  } catch (error) {
    res.status(500).json({ error: '取消协助人员失败：' + error.message });
  }
});

// 获取任务的协助人员列表
app.get('/api/tasks/:taskId/phases/:phaseKey/assistants', async (req, res) => {
  try {
    const { taskId, phaseKey } = req.params;
    
    const connection = await mysql.createConnection(dbConfig);
    
    // 获取所有协助人员
    const [assistants] = await connection.execute(`
        SELECT 
          wr.user_id,
          u.name as user_name,
          wr.quality_notes as reason,
          wr.assist_phase,
          ${hasAssistColumns ? 'wr.assist_start, wr.assist_end,' : 'NULL as assist_start, NULL as assist_end,'}
          wr.created_at
        FROM work_reports wr
        JOIN users u ON wr.user_id = u.id
        WHERE wr.task_id = ? 
          AND wr.work_type = 'assist' 
          AND wr.approval_status = 'approved'
          AND wr.assist_phase = ?
        ORDER BY wr.created_at DESC
      `, [taskId, phaseKey]);
    
    await connection.end();
    res.json(assistants);
  } catch (error) {
    res.status(500).json({ error: '获取协助人员列表失败：' + error.message });
  }
});

// 协助时间审批请求 - 创建
app.post('/api/assist-approvals', async (req, res) => {
  try {
    const { taskId, phaseKey, assistantUserId, assistStart, assistEnd, managerId, requestedBy } = req.body || {};

    if (!taskId || !phaseKey || !assistantUserId || !assistStart || !assistEnd || !managerId || !requestedBy) {
      return res.status(400).json({ error: '任务、阶段、协助人员、时间段、审批经理及提交人均为必填' });
    }

    const startTime = new Date(assistStart);
    const endTime = new Date(assistEnd);
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime()) || startTime >= endTime) {
      return res.status(400).json({ error: '协助时间不合法' });
    }

    const connection = await mysql.createConnection(dbConfig);

    const [managerRows] = await connection.execute(
      'SELECT id FROM users WHERE id = ? AND role = ?',
      [managerId, 'manager']
    );
    if (managerRows.length === 0) {
      await connection.end();
      return res.status(400).json({ error: '审批人必须是经理' });
    }

    const [requesterRows] = await connection.execute(
      'SELECT id FROM users WHERE id = ?',
      [requestedBy]
    );
    if (requesterRows.length === 0) {
      await connection.end();
      return res.status(400).json({ error: '提交人不存在' });
    }

    const [taskRows] = await connection.execute('SELECT id FROM tasks WHERE id = ?', [taskId]);
    if (taskRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '任务不存在' });
    }

    const [assistRows] = await connection.execute(
      `SELECT id FROM work_reports 
       WHERE task_id = ? AND user_id = ? AND work_type = 'assist' AND assist_phase = ? AND approval_status = 'approved'
       ORDER BY id DESC LIMIT 1`,
      [taskId, assistantUserId, phaseKey]
    );
    if (assistRows.length === 0) {
      await connection.end();
      return res.status(400).json({ error: '协助人员尚未被指定，无法提交协助时间' });
    }

    const [pendingRows] = await connection.execute(
      `SELECT id FROM assist_approvals 
       WHERE task_id = ? AND phase_key = ? AND assistant_user_id = ? AND status = 'pending'`,
      [taskId, phaseKey, assistantUserId]
    );
    if (pendingRows.length > 0) {
      await connection.end();
      return res.status(400).json({ error: '已存在待审批请求，请勿重复提交' });
    }

    await connection.execute(
      `INSERT INTO assist_approvals
         (task_id, phase_key, assistant_user_id, assist_start, assist_end, manager_id, requested_by, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [taskId, phaseKey, assistantUserId, startTime, endTime, managerId, requestedBy]
    );

    await connection.end();
    res.json({ success: true, message: '协助时间已提交等待审批' });
  } catch (error) {
    res.status(500).json({ error: '提交协助审批失败：' + error.message });
  }
});

// 协助时间审批请求 - 待审批列表
app.get('/api/assist-approvals/pending', async (req, res) => {
  try {
    const { managerId } = req.query;
    if (!managerId) {
      return res.status(400).json({ error: 'managerId必填' });
    }

    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      `SELECT 
         aa.*, 
         t.device_number, 
         t.product_model,
         t.name as task_name,
         u.name as assistant_name,
         requester.name as requester_name
       FROM assist_approvals aa
       JOIN tasks t ON aa.task_id = t.id
       JOIN users u ON aa.assistant_user_id = u.id
       JOIN users requester ON aa.requested_by = requester.id
       WHERE aa.status = 'pending' AND aa.manager_id = ?
       ORDER BY aa.created_at ASC`,
      [managerId]
    );
    await connection.end();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: '获取待审批列表失败：' + error.message });
  }
});

// 协助时间审批请求 - 审批动作
app.post('/api/assist-approvals/:id/decision', async (req, res) => {
  const { id } = req.params;
  const { decision, managerId, note } = req.body || {};

  if (!managerId || !['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: '参数不完整或决策无效' });
  }

  const connection = await mysql.createConnection(dbConfig);
  await connection.beginTransaction();

  try {
    const [rows] = await connection.execute(
      'SELECT * FROM assist_approvals WHERE id = ? FOR UPDATE',
      [id]
    );
    if (rows.length === 0) {
      await connection.rollback();
      await connection.end();
      return res.status(404).json({ error: '审批请求不存在' });
    }

    const approval = rows[0];
    if (approval.status !== 'pending') {
      await connection.rollback();
      await connection.end();
      return res.status(400).json({ error: '该请求已处理' });
    }
    if (parseInt(managerId, 10) !== approval.manager_id) {
      await connection.rollback();
      await connection.end();
      return res.status(403).json({ error: '无权审批该请求' });
    }

    if (decision === 'approved') {
      await connection.execute(
        `UPDATE work_reports
         SET assist_start = ?, assist_end = ?, approved_by = ?, approved_at = NOW()
         WHERE task_id = ? AND user_id = ? AND work_type = 'assist' AND assist_phase = ?`,
        [
          approval.assist_start,
          approval.assist_end,
          managerId,
          approval.task_id,
          approval.assistant_user_id,
          approval.phase_key
        ]
      );
    }

    await connection.execute(
      `UPDATE assist_approvals
       SET status = ?, decision_note = ?, decision_at = NOW()
       WHERE id = ?`,
      [decision, note || null, id]
    );

    await connection.commit();
    await connection.end();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    await connection.end();
    res.status(500).json({ error: '审批失败：' + error.message });
  }
});

// ============= 任务池管理API =============

// 获取任务池列表
app.get('/api/task-pool', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    try {
      // 尝试使用新字段查询
      const [rows] = await connection.execute(`
        SELECT 
          t.id, t.name, t.description, t.priority, t.status, t.current_phase,
          t.task_pool_status, t.last_phase_completed_at,
          u1.name as machining_assignee_name,
          u2.name as current_phase_assignee_name
        FROM tasks t
        LEFT JOIN users u1 ON t.machining_assignee = u1.id
        LEFT JOIN users u2 ON t.current_phase_assignee = u2.id
        WHERE t.task_pool_status = 'in_pool' AND t.status != 'completed'
        ORDER BY t.last_phase_completed_at ASC
      `);
      
      await connection.end();
      res.json({ success: true, tasks: rows });
      
    } catch (error) {
      // 如果新字段不存在，返回空列表
      await connection.end();
      res.json({ success: true, tasks: [] });
    }
    
  } catch (error) {
    res.status(500).json({ error: '获取任务池失败：' + error.message });
  }
});

// 分配任务池中的任务给工人
app.post('/api/task-pool/:taskId/assign', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { userId } = req.body || {};
    
    if (!userId) {
      return res.status(400).json({ error: '用户ID必填' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // 检查任务是否存在
    const [taskRows] = await connection.execute(`
      SELECT * FROM tasks WHERE id = ?
    `, [taskId]);
    
    if (taskRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '任务不存在' });
    }
    
    const task = taskRows[0];

    // 校验：任务未完成，且当前阶段不可为已完成阶段
    if (task.status === 'completed') {
      await connection.end();
      return res.status(400).json({ error: '任务已完成，无法分配' });
    }

    // 计算下一个可分配阶段
    const phaseOrder = ['machining', 'electrical', 'pre_assembly', 'post_assembly', 'debugging'];
    const isPhaseDone = (p) => (task[`${p}_phase`] === 1 || task[`${p}_phase`] === '1');

    const allowedPhases = ['machining','electrical','pre_assembly','post_assembly','debugging'];
    let assignPhase = task.current_phase;

    // 若前端显式传入 phase，则以其为准，但需要校验合法与未完成
    if (phase && allowedPhases.includes(phase)) {
      if (task[`${phase}_phase`] === 1 || task[`${phase}_phase`] === '1') {
        await connection.end();
        return res.status(400).json({ error: `所选阶段(${phase})已完成，无法分配` });
      }
      assignPhase = phase;
    }
    // 若当前阶段为空或已完成，则定位到第一个未完成阶段
    if (!assignPhase || isPhaseDone(assignPhase)) {
      assignPhase = phaseOrder.find(p => !isPhaseDone(p));
    }

    if (!assignPhase) {
      await connection.end();
      return res.status(400).json({ error: '所有阶段均已完成，无法分配' });
    }
    
    // 检查用户是否存在
    const [userRows] = await connection.execute(`
      SELECT * FROM users WHERE id = ? AND role = 'worker'
    `, [userId]);
    
    if (userRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '用户不存在或不是工人' });
    }
    
    // 分配任务给工人
    try {
      // 针对分配阶段同步写入对应阶段负责人列，并确保 current_phase 指向该阶段
      let assigneeColumn = null;
      if (assignPhase === 'machining') assigneeColumn = 'machining_assignee';
      else if (assignPhase === 'electrical') assigneeColumn = 'electrical_assignee';
      else if (assignPhase === 'pre_assembly') assigneeColumn = 'pre_assembly_assignee';
      else if (assignPhase === 'post_assembly') assigneeColumn = 'post_assembly_assignee';
      else if (assignPhase === 'debugging') assigneeColumn = 'debugging_assignee';

      if (assigneeColumn) {
        await connection.execute(
          `UPDATE tasks SET current_phase = ?, current_phase_assignee = ?, ${assigneeColumn} = ?, task_pool_status = 'assigned' WHERE id = ?`,
          [assignPhase, userId, userId, taskId]
        );
      } else {
        await connection.execute(
          `UPDATE tasks SET current_phase = ?, current_phase_assignee = ?, task_pool_status = 'assigned' WHERE id = ?`,
          [assignPhase, userId, taskId]
        );
      }
    } catch (error) {
      // 如果新字段不存在，返回错误
      await connection.end();
      return res.status(500).json({ error: '任务分配失败：数据库字段不匹配' });
    }
    
    await connection.end();
    
    res.json({ 
      success: true, 
      message: `任务已分配给${userRows[0].name}` 
    });
    
  } catch (error) {
    res.status(500).json({ error: '分配任务失败：' + error.message });
  }
});

// 获取可分配的工人列表
app.get('/api/workers', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const [rows] = await connection.execute(`
      SELECT id, name, role FROM users WHERE role = 'worker' ORDER BY name
    `);
    
    await connection.end();
    
    res.json({ success: true, workers: rows });
    
  } catch (error) {
    res.status(500).json({ error: '获取工人列表失败：' + error.message });
  }
});

// 获取用户的异常报告列表
app.get('/api/exception-reports/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: '用户ID不能为空' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    const [rows] = await connection.execute(`
      SELECT 
        er.*,
        t.name as task_name,
        u.name as approver_name
      FROM exception_reports er
      LEFT JOIN tasks t ON er.task_id = t.id
      LEFT JOIN users u ON er.approved_by = u.id
      WHERE er.user_id = ?
      ORDER BY er.submitted_at DESC
    `, [userId]);
    
    await connection.end();
    
    res.json(rows);
  } catch (error) {
    console.error('获取用户异常报告失败:', error);
    res.status(500).json({ error: '获取异常报告失败' });
  }
});

// 获取所有异常报告（主管和管理员使用）
app.get('/api/exception-reports/all', async (req, res) => {
  try {
    const approverId = req.query.approverId; // 从查询参数获取审批人ID
    
    if (!approverId) {
      return res.status(400).json({ error: '缺少审批人ID参数' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // 获取审批人的部门和用户组信息
    const [approverRows] = await connection.execute(
      'SELECT department, user_group, role FROM users WHERE id = ?',
      [approverId]
    );
    
    if (approverRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '审批人不存在' });
    }
    
    const approver = approverRows[0];
    const approverDepartment = approver.department;
    const approverUserGroup = approver.user_group;
    const approverRole = approver.role;
    
    // 根据审批人的部门或用户组过滤异常报告
    let query = `
      SELECT 
        er.*,
        t.name as task_name,
        u.name as user_name,
        approver.name as approver_name,
        first_approver.name as first_approver_name,
        second_approver.name as second_approver_name,
        staff.name as assigned_staff_name,
        staff.department as assigned_staff_department
      FROM exception_reports er
      LEFT JOIN tasks t ON er.task_id = t.id
      LEFT JOIN users u ON er.user_id = u.id
      LEFT JOIN users approver ON er.approved_by = approver.id
      LEFT JOIN users first_approver ON er.first_approver_id = first_approver.id
      LEFT JOIN users second_approver ON er.second_approver_id = second_approver.id
      LEFT JOIN users staff ON er.assigned_to_staff_id = staff.id
      WHERE 1=1
    `;
    const params = [];
    
    // 工程部（staff角色，部门为工程部）能看到所有异常任务
    if (approverRole === 'staff' && approverDepartment === '工程部') {
      // 不添加部门过滤条件，能看到所有
    } else if (approverRole === 'staff') {
      // 其他部门的staff只能看到分配给自己的异常任务
      query += ` AND er.assigned_to_staff_id = ?`;
      params.push(approverId);
    } else {
      // 其他角色按原逻辑过滤
      query += ` AND (u.department = ?`;
      params.push(approverDepartment);
    
    // 如果审批人有用户组，也显示同组的异常报告
    if (approverUserGroup) {
      query += ` OR (u.user_group IS NOT NULL AND u.user_group = ?)`;
      params.push(approverUserGroup);
    }
    
    // 对于二级审批（manager），还需要检查是否是指定的二级审批人
    if (approverRole === 'manager') {
      query += ` OR er.second_approver_id = ?`;
      params.push(approverId);
    }
    
    // 对于一级审批（supervisor/admin），还需要检查是否是一级审批人
    if (approverRole === 'supervisor' || approverRole === 'admin') {
      query += ` OR er.first_approver_id = ?`;
      params.push(approverId);
    }
    
      query += `)`;
    }
    
    query += ` ORDER BY 
      CASE er.impact_level 
        WHEN '紧急' THEN 1
        WHEN '高' THEN 2
        WHEN '中' THEN 3
        WHEN '低' THEN 4
      END,
      er.submitted_at ASC
    `;
    
    const [rows] = await connection.execute(query, params);
    
    await connection.end();
    
    res.json(rows);
  } catch (error) {
    console.error('获取所有异常报告失败:', error);
    res.status(500).json({ error: '获取异常报告失败' });
  }
});

// 提交异常报告
app.post('/api/exception-reports', upload.any(), async (req, res) => {
  try {
    const { taskId, userId, exceptionType, description, exceptionStartDateTime, exceptionEndDateTime, approverId } = req.body;
    
    if (!taskId || !userId || !exceptionType || !description || !exceptionStartDateTime || !exceptionEndDateTime || !approverId) {
      return res.status(400).json({ error: '必填字段不能为空' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // 处理图片上传
    let imagePath = null;
    if (req.files && req.files.length > 0) {
      const imageFile = req.files.find(file => file.fieldname === 'image');
      if (imageFile) {
        // 生成唯一的文件名
        const timestamp = Date.now();
        const fileExtension = imageFile.originalname.split('.').pop();
        const fileName = `exception_${timestamp}.${fileExtension}`;
        imagePath = `/uploads/exceptions/${fileName}`;
        
        // 确保上传目录存在
        const fs = require('fs');
        const path = require('path');
        const uploadDir = path.join(__dirname, 'uploads', 'exceptions');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // 保存文件
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, imageFile.buffer);
        
        console.log(`图片已保存: ${filePath}`);
      }
    }
    
    // 检查任务是否存在且分配给该用户
    try {
      // 尝试使用新字段查询
      const [taskRows] = await connection.execute(`
        SELECT id, name, machining_assignee, electrical_assignee, pre_assembly_assignee, post_assembly_assignee, debugging_assignee, current_phase_assignee FROM tasks WHERE id = ?
      `, [taskId]);
      
      if (taskRows.length === 0) {
        await connection.end();
        return res.status(404).json({ error: '任务不存在' });
      }
      
      const task = taskRows[0];
      const hasPermission = task.machining_assignee == userId || task.electrical_assignee == userId || task.pre_assembly_assignee == userId || task.post_assembly_assignee == userId || task.debugging_assignee == userId || 
                            (task.current_phase_assignee && task.current_phase_assignee === parseInt(userId));
      
      if (!hasPermission) {
        await connection.end();
        return res.status(403).json({ error: '无权限为此任务提交异常报告' });
      }
    } catch (error) {
      // 如果新字段不存在，使用旧的方式
      const [taskRows] = await connection.execute(`
        SELECT id, name, machining_assignee, electrical_assignee, pre_assembly_assignee, post_assembly_assignee, debugging_assignee FROM tasks WHERE id = ?
      `, [taskId]);
      
      if (taskRows.length === 0) {
        await connection.end();
        return res.status(404).json({ error: '任务不存在' });
      }
      
      const task = taskRows[0];
      const hasPermission = task.machining_assignee == userId || task.electrical_assignee == userId || task.pre_assembly_assignee == userId || task.post_assembly_assignee == userId || task.debugging_assignee == userId;
      
      if (!hasPermission) {
        await connection.end();
        return res.status(403).json({ error: '无权限为此任务提交异常报告' });
      }
    }
    
    // 检查审批人是否存在且具有审批权限
    const [approverRows] = await connection.execute(`
      SELECT id, name, role FROM users WHERE id = ? AND (role = 'admin' OR role = 'supervisor' OR role = 'manager')
    `, [approverId]);
    
    if (approverRows.length === 0) {
      await connection.end();
      return res.status(400).json({ error: '指定的审批人不存在或无审批权限' });
    }
    
    // 验证日期时间格式和逻辑
    const startDateTime = `${exceptionStartDateTime}:00`;
    const endDateTime = `${exceptionEndDateTime}:00`;
    if (isNaN(new Date(startDateTime).getTime()) || isNaN(new Date(endDateTime).getTime())) {
      await connection.end();
      return res.status(400).json({ error: '开始或结束日期时间无效' });
    }
    if (new Date(startDateTime) >= new Date(endDateTime)) {
      await connection.end();
      return res.status(400).json({ error: '结束时间必须晚于开始时间' });
    }
    
    // 自动生成标题：从描述中提取或使用异常类型
    let title = '';
    if (description && description.trim().length > 0) {
      // 从描述中提取标题（前50个字符）
      title = description.length > 50 
        ? description.substring(0, 50) + '...' 
        : description;
    } else {
      // 如果描述为空，使用异常类型作为标题
      title = `${exceptionType}异常报告`;
    }
    
    // 插入异常报告
    const [result] = await connection.execute(`
      INSERT INTO exception_reports (
        task_id, user_id, exception_type, title, description, exception_start_datetime, exception_end_datetime, approved_by, status, image_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `, [taskId, userId, exceptionType, title, description, startDateTime, endDateTime, approverId, imagePath]);
    
    await connection.end();
    
    res.json({ 
      success: true, 
      message: '异常报告提交成功',
      reportId: result.insertId 
    });
    
  } catch (error) {
    res.status(500).json({ error: '提交异常报告失败：' + error.message });
  }
});

// 获取用户的异常报告列表
app.get('/api/exception-reports/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const connection = await mysql.createConnection(dbConfig);
    
    const [rows] = await connection.execute(`
      SELECT er.*, t.name as task_name, u.name as user_name, 
             approver.name as approver_name
      FROM exception_reports er
      LEFT JOIN tasks t ON er.task_id = t.id
      LEFT JOIN users u ON er.user_id = u.id
      LEFT JOIN users approver ON er.approved_by = approver.id
      WHERE er.user_id = ?
      ORDER BY er.submitted_at DESC
    `, [userId]);
    
    await connection.end();
    res.json(rows);
    
  } catch (error) {
    res.status(500).json({ error: '获取异常报告失败：' + error.message });
  }
});

// 获取待审批的异常报告列表（主管/管理员）
app.get('/api/exception-reports/pending', async (req, res) => {
  try {
    const approverId = req.query.approverId; // 从查询参数获取审批人ID
    
    if (!approverId) {
      return res.status(400).json({ error: '缺少审批人ID参数' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // 获取审批人的部门和用户组信息
    const [approverRows] = await connection.execute(
      'SELECT department, user_group, role FROM users WHERE id = ?',
      [approverId]
    );
    
    if (approverRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '审批人不存在' });
    }
    
    const approver = approverRows[0];
    const approverDepartment = approver.department;
    const approverUserGroup = approver.user_group;
    const approverRole = approver.role;
    
    // 根据审批人的部门或用户组过滤待审批异常报告
    // 只显示同一部门或同一用户组的异常报告
    let query = `
      SELECT er.*, t.name as task_name, u.name as user_name,
             approver.name as approver_name,
             first_approver.name as first_approver_name,
             second_approver.name as second_approver_name,
             staff.name as assigned_staff_name,
             staff.department as assigned_staff_department
      FROM exception_reports er
      LEFT JOIN tasks t ON er.task_id = t.id
      LEFT JOIN users u ON er.user_id = u.id
      LEFT JOIN users approver ON er.approved_by = approver.id
      LEFT JOIN users first_approver ON er.first_approver_id = first_approver.id
      LEFT JOIN users second_approver ON er.second_approver_id = second_approver.id
      LEFT JOIN users staff ON er.assigned_to_staff_id = staff.id
      WHERE 1=1
    `;
    const params = [];
    
    // Staff角色：显示分配给自己的待确认异常报告
    if (approverRole === 'staff') {
      query += ` AND er.status = 'pending_staff_confirmation' AND er.assigned_to_staff_id = ?`;
      params.push(approverId);
    } else {
      // 其他角色：显示待审批的异常报告
      query += ` AND er.status IN ('pending', 'pending_second_approval') AND (u.department = ?`;
      params.push(approverDepartment);
    
    // 如果审批人有用户组，也显示同组的异常报告
    if (approverUserGroup) {
      query += ` OR (u.user_group IS NOT NULL AND u.user_group = ?)`;
      params.push(approverUserGroup);
    }
    
    // 对于二级审批（manager），还需要检查是否是指定的二级审批人
    if (approverRole === 'manager') {
      query += ` OR er.second_approver_id = ?`;
      params.push(approverId);
    }
    
      query += `)`;
    }
    
    query += ` ORDER BY 
        CASE er.impact_level 
          WHEN '紧急' THEN 1
          WHEN '高' THEN 2
          WHEN '中' THEN 3
          WHEN '低' THEN 4
        END,
        er.submitted_at ASC
    `;
    
    const [rows] = await connection.execute(query, params);
    
    await connection.end();
    res.json(rows);
    
  } catch (error) {
    res.status(500).json({ error: '获取待审批异常报告失败：' + error.message });
  }
});

// 审批异常报告
app.post('/api/exception-reports/:reportId/approve', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { approverId, approvalNote, action, 
            modifiedExceptionType, modifiedDescription, 
            modifiedStartDateTime, modifiedEndDateTime,
            secondApproverId } = req.body; // action: 'approve' or 'reject'
    
    if (!approverId || !action) {
      return res.status(400).json({ error: '审批人ID和操作类型必填' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // 检查报告是否存在
    const [reportRows] = await connection.execute(`
      SELECT * FROM exception_reports WHERE id = ?
    `, [reportId]);
    
    if (reportRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '异常报告不存在' });
    }
    
    const report = reportRows[0];
    
    // 获取审批人角色
    const [approverRows] = await connection.execute(`
      SELECT role FROM users WHERE id = ?
    `, [approverId]);
    
    if (approverRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '审批人不存在' });
    }
    
    const approverRole = approverRows[0].role;
    
    // 判断是一级审批还是二级审批
    if (report.status === 'pending') {
      // 一级审批：只有supervisor或admin可以进行
      if (approverRole !== 'supervisor' && approverRole !== 'admin') {
        await connection.end();
        return res.status(403).json({ error: '只有主管或管理员可以进行一级审批' });
      }
      
      if (action === 'approve') {
        // 一级审批批准：更新为pending_second_approval状态，保存修改的信息
        const updateFields = [
          'status = ?',
          'first_approver_id = ?',
          'first_approved_at = NOW()',
          'first_approval_note = ?'
        ];
        const updateValues = ['pending_second_approval', approverId, approvalNote || null];
        
        // 如果指定了二级审批人，保存二级审批人ID
        if (secondApproverId !== undefined && secondApproverId !== null) {
          // 验证二级审批人是否为manager角色
          const [secondApproverRows] = await connection.execute(`
            SELECT id, role FROM users WHERE id = ? AND role = 'manager'
          `, [secondApproverId]);
          
          if (secondApproverRows.length === 0) {
            await connection.end();
            return res.status(400).json({ error: '指定的二级审批人不存在或不是经理角色' });
          }
          
          updateFields.push('second_approver_id = ?');
          updateValues.push(secondApproverId);
        }
        
        // 如果主管修改了异常信息，且修改后的值与原始值不同，才保存修改后的值
        if (modifiedExceptionType !== undefined && modifiedExceptionType !== report.exception_type) {
          updateFields.push('modified_exception_type = ?');
          updateValues.push(modifiedExceptionType);
        } else if (modifiedExceptionType !== undefined && modifiedExceptionType === report.exception_type) {
          // 如果值与原始值相同，清空修改字段（表示未修改）
          updateFields.push('modified_exception_type = NULL');
        }
        
        if (modifiedDescription !== undefined && modifiedDescription !== report.description) {
          updateFields.push('modified_description = ?');
          updateValues.push(modifiedDescription);
        } else if (modifiedDescription !== undefined && modifiedDescription === report.description) {
          updateFields.push('modified_description = NULL');
        }
        
        if (modifiedStartDateTime !== undefined) {
          // 比较日期时间：将两个日期时间转换为相同格式进行比较
          const originalStart = report.exception_start_datetime ? 
            new Date(report.exception_start_datetime).getTime() : null;
          const modifiedStart = modifiedStartDateTime ? 
            new Date(modifiedStartDateTime).getTime() : null;
          
          // 如果值不同，保存修改后的值；如果相同，清空修改字段
          if (originalStart !== modifiedStart) {
            updateFields.push('modified_start_datetime = ?');
            updateValues.push(modifiedStartDateTime);
          } else {
            updateFields.push('modified_start_datetime = NULL');
          }
        }
        
        if (modifiedEndDateTime !== undefined) {
          const originalEnd = report.exception_end_datetime ? 
            new Date(report.exception_end_datetime).getTime() : null;
          const modifiedEnd = modifiedEndDateTime ? 
            new Date(modifiedEndDateTime).getTime() : null;
          
          if (originalEnd !== modifiedEnd) {
            updateFields.push('modified_end_datetime = ?');
            updateValues.push(modifiedEndDateTime);
          } else {
            updateFields.push('modified_end_datetime = NULL');
          }
        }
        
        updateValues.push(reportId);
        
        await connection.execute(`
          UPDATE exception_reports 
          SET ${updateFields.join(', ')}
          WHERE id = ?
        `, updateValues);
        
        await connection.end();
        res.json({ 
          success: true, 
          message: '一级审批已批准，等待经理二级审批'
        });
      } else {
        // 一级审批驳回：直接拒绝
        await connection.execute(`
          UPDATE exception_reports 
          SET status = ?, first_approver_id = ?, first_approved_at = NOW(), first_approval_note = ?
          WHERE id = ?
        `, ['rejected', approverId, approvalNote || null, reportId]);
        
        await connection.end();
        res.json({ 
          success: true, 
          message: '异常报告已驳回'
        });
      }
    } else if (report.status === 'pending_second_approval') {
      // 二级审批：只有manager可以进行
      if (approverRole !== 'manager') {
        await connection.end();
        return res.status(403).json({ error: '只有经理可以进行二级审批' });
      }
      
      if (action === 'approve') {
        // 获取异常类型（优先使用修改后的类型）
        const exceptionType = report.modified_exception_type || report.exception_type;
        
        // 根据异常类型决定是否转给staff
        let assignedStaffId = null;
        let newStatus = 'approved'; // 默认直接批准
        
        if (exceptionType !== '临时安排任务') {
          // 需要转给责任部门确认
          let targetDepartment = null;
          
          if (exceptionType === '缺料') {
            targetDepartment = 'PMC';
          } else if (exceptionType === '来料不良') {
            targetDepartment = '质量部';
          } else if (exceptionType === '改造类（研发售后或生产不良）' || exceptionType === '改造类') {
            targetDepartment = '售后';
          }
          
          if (targetDepartment) {
            // 查找对应部门的staff用户
            const [staffRows] = await connection.execute(`
              SELECT id FROM users 
              WHERE role = 'staff' AND department = ?
              LIMIT 1
            `, [targetDepartment]);
            
            if (staffRows.length > 0) {
              assignedStaffId = staffRows[0].id;
              newStatus = 'pending_staff_confirmation';
            } else {
              // 如果没有找到对应的staff，记录警告但继续流程
              console.warn(`警告：未找到${targetDepartment}部门的staff用户，异常报告将直接批准`);
            }
          }
        }
        
        // 更新状态
        await connection.execute(`
          UPDATE exception_reports 
          SET status = ?, 
              second_approver_id = ?, 
              second_approved_at = NOW(), 
              second_approval_note = ?,
              assigned_to_staff_id = ?
          WHERE id = ?
        `, [newStatus, approverId, approvalNote || null, assignedStaffId, reportId]);
        
        await connection.end();
        res.json({ 
          success: true, 
          message: assignedStaffId ? 
            '异常报告已批准，已转给责任部门确认' : 
            '异常报告已批准'
        });
      } else {
        // 二级审批驳回：直接拒绝
      await connection.execute(`
        UPDATE exception_reports 
        SET status = ?, second_approver_id = ?, second_approved_at = NOW(), second_approval_note = ?
        WHERE id = ?
        `, ['rejected', approverId, approvalNote || null, reportId]);
      
      await connection.end();
      res.json({ 
        success: true, 
          message: '异常报告已驳回'
      });
      }
    } else {
      await connection.end();
      return res.status(400).json({ error: '该报告状态不允许审批' });
    }
    
  } catch (error) {
    res.status(500).json({ error: '审批异常报告失败：' + error.message });
  }
});

// 责任部门确认异常报告
app.post('/api/exception-reports/:reportId/staff-confirm', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { staffId, confirmationNote, action } = req.body; // action: 'confirm' or 'reject'
    
    if (!staffId || !action) {
      return res.status(400).json({ error: 'Staff ID和操作类型必填' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // 检查报告是否存在且已分配给该staff
    const [reportRows] = await connection.execute(`
      SELECT * FROM exception_reports WHERE id = ? AND assigned_to_staff_id = ?
    `, [reportId, staffId]);
    
    if (reportRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '异常报告不存在或未分配给您' });
    }
    
    const report = reportRows[0];
    
    if (report.status !== 'pending_staff_confirmation') {
      await connection.end();
      return res.status(400).json({ error: '该报告状态不允许确认' });
    }
    
    // 验证staff用户
    const [staffRows] = await connection.execute(`
      SELECT id, role, department FROM users WHERE id = ? AND role = 'staff'
    `, [staffId]);
    
    if (staffRows.length === 0) {
      await connection.end();
      return res.status(403).json({ error: '您没有权限确认此异常报告' });
    }
    
    const staff = staffRows[0];
    
    // 工程部staff没有确认和拒绝的权限
    if (staff.department === '工程部') {
      await connection.end();
      return res.status(403).json({ error: '工程部没有确认和拒绝异常报告的权限' });
    }
    
    const newStatus = action === 'confirm' ? 'staff_confirmed' : 'approved'; // 拒绝时直接批准（或可以设为其他状态）
    
    await connection.execute(`
      UPDATE exception_reports 
      SET status = ?,
          staff_confirmed_at = NOW(),
          staff_confirmation_note = ?
      WHERE id = ?
    `, [newStatus, confirmationNote || null, reportId]);
    
    await connection.end();
    res.json({ 
      success: true, 
      message: action === 'confirm' ? '异常报告已由责任部门确认' : '异常报告已处理'
    });
    
  } catch (error) {
    res.status(500).json({ error: '确认异常报告失败：' + error.message });
  }
});

// 标记异常报告为处理中
app.post('/api/exception-reports/:reportId/processing', async (req, res) => {
  try {
    const { reportId } = req.params;
    const connection = await mysql.createConnection(dbConfig);
    
    await connection.execute(`
      UPDATE exception_reports 
      SET status = 'processing'
      WHERE id = ? AND status = 'approved'
    `, [reportId]);
    
    await connection.end();
    
    res.json({ success: true, message: '异常报告已标记为处理中' });
    
  } catch (error) {
    res.status(500).json({ error: '更新异常报告状态失败：' + error.message });
  }
});

// 标记异常报告为已解决
app.post('/api/exception-reports/:reportId/resolve', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { resolutionNote } = req.body;
    const connection = await mysql.createConnection(dbConfig);
    
    await connection.execute(`
      UPDATE exception_reports 
      SET status = 'resolved', resolved_at = NOW(), resolution_note = ?
      WHERE id = ?
    `, [resolutionNote || null, reportId]);
    
    await connection.end();
    
    res.json({ success: true, message: '异常报告已标记为已解决' });
    
  } catch (error) {
    res.status(500).json({ error: '解决异常报告失败：' + error.message });
  }
});

// 按任务ID获取异常报告
app.get('/api/exception-reports/by-task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const connection = await mysql.createConnection(dbConfig);
    
    const [rows] = await connection.execute(`
      SELECT 
        er.*,
        t.name as task_name,
        u.name as user_name,
        approver.name as approver_name
      FROM exception_reports er
      LEFT JOIN tasks t ON er.task_id = t.id
      LEFT JOIN users u ON er.user_id = u.id
      LEFT JOIN users approver ON er.approved_by = approver.id
      WHERE er.task_id = ?
      ORDER BY er.submitted_at DESC
    `, [taskId]);
    
    await connection.end();
    
    res.json(rows);
  } catch (error) {
    console.error('按任务获取异常报告失败:', error);
    res.status(500).json({ error: '获取异常报告失败：' + error.message });
  }
});

// 获取异常报告统计信息
app.get('/api/exception-reports/stats', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const [rows] = await connection.execute(`
      SELECT 
        status,
        COUNT(*) as count
      FROM exception_reports
      GROUP BY status
    `);
    
    const [typeRows] = await connection.execute(`
      SELECT 
        exception_type,
        COUNT(*) as count
      FROM exception_reports
      GROUP BY exception_type
    `);
    
    await connection.end();
    
    res.json({
      statusStats: rows,
      typeStats: typeRows
    });
    
  } catch (error) {
    res.status(500).json({ error: '获取异常报告统计失败：' + error.message });
  }
});

// 获取已批准的异常报告（用于效率计算）
app.get('/api/exception-reports/approved', async (req, res) => {
  try {
    const { taskId, userId, startDate, endDate } = req.query;

    const connection = await mysql.createConnection(dbConfig);

    let query = `
      SELECT er.*, t.name as task_name, u.name as user_name
      FROM exception_reports er
      LEFT JOIN tasks t ON er.task_id = t.id
      LEFT JOIN users u ON er.user_id = u.id
      WHERE er.status = 'approved'
    `;

    const params = [];

    if (taskId) {
      query += ' AND er.task_id = ?';
      params.push(taskId);
    }

    if (userId) {
      query += ' AND er.user_id = ?';
      params.push(userId);
    }

    if (startDate) {
      query += ' AND er.exception_start_datetime >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND er.exception_end_datetime <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY er.exception_start_datetime ASC';

    const [rows] = await connection.execute(query, params);

    await connection.end();

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    res.status(500).json({ error: '获取已批准异常报告失败：' + error.message });
  }
});

// 导出异常报告（按审批视角，支持角色和状态筛选）
app.get('/api/exception-reports/export', async (req, res) => {
  // 保留此接口以兼容旧逻辑：简单返回JSON，由前端自己导出
  let connection;
  try {
    const { role, userId, status, type, startDate, endDate } = req.query;
    connection = await mysql.createConnection(dbConfig);

    let query = `
      SELECT 
        er.*,
        t.name AS task_name,
        u.name AS user_name
      FROM exception_reports er
      LEFT JOIN tasks t ON er.task_id = t.id
      LEFT JOIN users u ON er.user_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (role === 'staff' && userId) {
      query += ' AND er.assigned_to_staff_id = ?';
      params.push(userId);
    } else if ((role === 'supervisor' || role === 'manager') && userId) {
      const [userRows] = await connection.execute(
        'SELECT department FROM users WHERE id = ?',
        [userId]
      );
      if (userRows.length > 0 && userRows[0].department) {
        query += ' AND u.department = ?';
        params.push(userRows[0].department);
      }
    }

    if (status) {
      query += ' AND er.status = ?';
      params.push(status);
    }

    if (type) {
      query += ' AND (er.modified_exception_type = ? OR er.exception_type = ?)';
      params.push(type, type);
    }

    if (startDate) {
      query += ' AND er.exception_start_datetime >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND er.exception_end_datetime <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY er.exception_start_datetime DESC';

    const [rows] = await connection.execute(query, params);
    await connection.end();

    res.json({ success: true, data: rows });
  } catch (error) {
    if (connection) await connection.end();
    console.error('导出异常报告失败：', error);
    res.status(500).json({ error: '导出异常报告失败：' + error.message });
  }
});

// 导出异常图片ZIP（按与导出接口相同的筛选逻辑）
app.get('/api/exception-reports/export-images', async (req, res) => {
  let connection;
  try {
    const { role, userId, status, type, startDate, endDate } = req.query;
    connection = await mysql.createConnection(dbConfig);

    let query = `
      SELECT er.*
      FROM exception_reports er
      LEFT JOIN users u ON er.user_id = u.id
      WHERE er.image_path IS NOT NULL AND er.image_path <> ''
    `;

    const params = [];

    if (userId) {
      const [userRows] = await connection.execute(
        'SELECT department, role FROM users WHERE id = ?',
        [userId]
      );

      const userInfo = userRows[0] || {};
      const userDept = userInfo.department || null;
      const userRole = userInfo.role || role;

      // 工程部 staff：可以看到所有异常图片（不加额外限制）
      if (userRole === 'staff' && userDept === '工程部') {
        // no extra filter
      } else if (userRole === 'staff') {
        // 其他部门 staff：只能看分配给自己的异常
        query += ' AND er.assigned_to_staff_id = ?';
        params.push(userId);
      } else if (userRole === 'manager' || userRole === 'admin') {
        // 经理 / 管理员：可以看到全部异常图片（不按部门限制）
        // no extra filter
      } else if (userRole === 'supervisor') {
        // 主管：按本部门限制
        if (userDept) {
          query += ' AND u.department = ?';
          params.push(userDept);
        }
      }
    }

    if (status) {
      query += ' AND er.status = ?';
      params.push(status);
    }

    if (type) {
      query += ' AND (er.modified_exception_type = ? OR er.exception_type = ?)';
      params.push(type, type);
    }

    if (startDate) {
      query += ' AND er.exception_start_datetime >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND er.exception_end_datetime <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY er.exception_start_datetime DESC';

    const [rows] = await connection.execute(query, params);
    await connection.end();

    const fs = require('fs');
    const zip = archiver('zip', { zlib: { level: 9 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="exception_images.zip"'
    );

    zip.on('error', (err) => {
      console.error('打包异常图片失败：', err);
      res.status(500).end();
    });

    zip.pipe(res);

    const baseDir = path.join(__dirname);

    rows.forEach((row) => {
      if (!row.image_path) return;
      const relPath = row.image_path.startsWith('/')
        ? row.image_path.substring(1)
        : row.image_path;
      const filePath = path.join(baseDir, relPath);
      if (fs.existsSync(filePath)) {
        const fileName = `exception_${row.id}_${path.basename(filePath)}`;
        zip.file(filePath, { name: fileName });
      }
    });

    zip.finalize();
  } catch (error) {
    if (connection) await connection.end();
    console.error('导出异常图片失败：', error);
    res.status(500).json({ error: '导出异常图片失败：' + error.message });
  }
});

// ==================== 数据库备份功能 ====================
const backupModule = require('./backup-database');

// API: 手动触发数据库备份
app.post('/api/database/backup', async (req, res) => {
  try {
    console.log('收到手动备份请求');
    const backupFile = await backupModule.backupDatabase();
    backupModule.cleanOldBackups();
    
    res.json({ 
      success: true, 
      message: '数据库备份成功',
      backupFile: path.basename(backupFile),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('手动备份失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '数据库备份失败：' + error.message 
    });
  }
});

// API: 获取备份文件列表
app.get('/api/database/backups', async (req, res) => {
  try {
    const backupDir = backupModule.backupConfig.backupDir;
    
    if (!fs.existsSync(backupDir)) {
      return res.json({ backups: [] });
    }
    
    const files = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('workshop_db_') && file.endsWith('.sql'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          sizeFormatted: (stats.size / 1024).toFixed(2) + ' KB',
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
      .sort((a, b) => b.modified - a.modified); // 按修改时间降序
    
    res.json({ backups: files });
  } catch (error) {
    res.status(500).json({ error: '获取备份列表失败：' + error.message });
  }
});

// API: 下载备份文件
app.get('/api/database/backups/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    // 安全检查：防止路径遍历攻击
    if (filename.includes('..') || !filename.startsWith('workshop_db_') || !filename.endsWith('.sql')) {
      return res.status(400).json({ error: '无效的文件名' });
    }
    
    const filePath = path.join(backupModule.backupConfig.backupDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '备份文件不存在' });
    }
    
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('下载备份文件失败:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: '下载失败' });
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: '下载备份文件失败：' + error.message });
  }
});

// 5. 启动后端服务（端口用 3000，避免和前端冲突）
const PORT = 3000;
const HOST = '0.0.0.0'; // 监听所有网卡，允许局域网访问

app.listen(PORT, HOST, () => {
  try {
    const os = require('os');
    const ifaces = os.networkInterfaces();
    let lanIp = '127.0.0.1';
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          lanIp = iface.address;
          break;
        }
      }
    }
    console.log(`后端服务已启动：`);
    console.log(`- 本机:   http://localhost:${PORT}`);
    console.log(`- 局域网: http://${lanIp}:${PORT}`);
  } catch (e) {
    console.log(`后端服务已启动，端口: ${PORT}`);
  }
});

// ============= 工作时间设置API =============

// 获取工作时间设置
app.get('/api/work-time-settings', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // 创建工作时间设置表（如果不存在）
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS work_time_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        start_time VARCHAR(5) NOT NULL,
        end_time VARCHAR(5) NOT NULL,
        lunch_start_time VARCHAR(5) NOT NULL,
        lunch_end_time VARCHAR(5) NOT NULL,
        other_break_start_time VARCHAR(5),
        other_break_end_time VARCHAR(5),
        standard_hours DECIMAL(5,2) NOT NULL,
        default_overtime_start_time VARCHAR(5),
        note TEXT,
        updated_by INT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (updated_by) REFERENCES users(id)
      )
    `);
    
    // 添加default_overtime_start_time字段（如果不存在）
    try {
      await connection.execute(`
        ALTER TABLE work_time_settings 
        ADD COLUMN IF NOT EXISTS default_overtime_start_time VARCHAR(5) AFTER standard_hours
      `);
    } catch (error) {
      // 字段可能已存在，忽略错误
      console.log('default_overtime_start_time字段可能已存在');
    }
    
    // 添加default_overtime_end_time字段（如果不存在）
    try {
      await connection.execute(`
        ALTER TABLE work_time_settings 
        ADD COLUMN IF NOT EXISTS default_overtime_end_time VARCHAR(5) AFTER default_overtime_start_time
      `);
    } catch (error) {
      // 字段可能已存在，忽略错误
      console.log('default_overtime_end_time字段可能已存在');
    }
    
    // 获取当前设置
    const [rows] = await connection.execute(`
      SELECT * FROM work_time_settings 
      ORDER BY updated_at DESC 
      LIMIT 1
    `);
    
    await connection.end();
    
    if (rows.length === 0) {
      // 如果没有设置，返回错误
      res.status(404).json({
        success: false,
        message: '未找到工作时间设置，请先在考勤管理页面配置工作时间'
      });
    } else {
      res.json({
        success: true,
        settings: rows[0]
      });
    }
  } catch (error) {
    res.status(500).json({ error: '获取工作时间设置失败：' + error.message });
  }
});

// 保存工作时间设置
app.post('/api/work-time-settings', async (req, res) => {
  try {
    const { startTime, endTime, lunchStartTime, lunchEndTime, otherBreakStartTime, otherBreakEndTime, standardHours, note, updatedBy } = req.body;
    const defaultOvertimeStartTime = req.body.defaultOvertimeStartTime || null;
    const defaultOvertimeEndTime = req.body.defaultOvertimeEndTime || null;
    
    if (!startTime || !endTime) {
      return res.status(400).json({ error: '上班时间和下班时间必填' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // 创建工作时间设置表（如果不存在）
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS work_time_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        start_time VARCHAR(5) NOT NULL,
        end_time VARCHAR(5) NOT NULL,
        lunch_start_time VARCHAR(5) NOT NULL,
        lunch_end_time VARCHAR(5) NOT NULL,
        other_break_start_time VARCHAR(5),
        other_break_end_time VARCHAR(5),
        standard_hours DECIMAL(5,2) NOT NULL,
        default_overtime_start_time VARCHAR(5),
        default_overtime_end_time VARCHAR(5),
        note TEXT,
        updated_by INT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (updated_by) REFERENCES users(id)
      )
    `);
    
    // 添加default_overtime_start_time字段（如果不存在）
    try {
      await connection.execute(`
        ALTER TABLE work_time_settings 
        ADD COLUMN IF NOT EXISTS default_overtime_start_time VARCHAR(5) AFTER standard_hours
      `);
    } catch (error) {
      // 字段可能已存在，忽略错误
      console.log('default_overtime_start_time字段可能已存在');
    }
    
    // 添加default_overtime_end_time字段（如果不存在）
    try {
      await connection.execute(`
        ALTER TABLE work_time_settings 
        ADD COLUMN IF NOT EXISTS default_overtime_end_time VARCHAR(5) AFTER default_overtime_start_time
      `);
    } catch (error) {
      // 字段可能已存在，忽略错误
      console.log('default_overtime_end_time字段可能已存在');
    }
    
    // 插入或更新设置（拒绝使用默认值）
    await connection.execute(`
      INSERT INTO work_time_settings (
        start_time, end_time, lunch_start_time, lunch_end_time, 
        other_break_start_time, other_break_end_time, standard_hours, 
        default_overtime_start_time, default_overtime_end_time, note, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      start_time = VALUES(start_time),
      end_time = VALUES(end_time),
      lunch_start_time = VALUES(lunch_start_time),
      lunch_end_time = VALUES(lunch_end_time),
      other_break_start_time = VALUES(other_break_start_time),
      other_break_end_time = VALUES(other_break_end_time),
      standard_hours = VALUES(standard_hours),
      default_overtime_start_time = VALUES(default_overtime_start_time),
      default_overtime_end_time = VALUES(default_overtime_end_time),
      note = VALUES(note),
      updated_by = VALUES(updated_by),
      updated_at = CURRENT_TIMESTAMP
    `, [startTime, endTime, lunchStartTime, lunchEndTime, 
        otherBreakStartTime, otherBreakEndTime, standardHours, 
        defaultOvertimeStartTime, defaultOvertimeEndTime, note, updatedBy]);
    
    await connection.end();
    
    res.json({ 
      success: true, 
      message: '工作时间设置保存成功' 
    });
  } catch (error) {
    res.status(500).json({ error: '保存工作时间设置失败：' + error.message });
  }
});

// 节假日数据缓存（按年份缓存）
const holidayCache = new Map();

// 从GitHub获取节假日数据（带缓存）
async function getHolidaysFromGitHub(year) {
  // 检查缓存
  if (holidayCache.has(year)) {
    const cached = holidayCache.get(year);
    // 缓存24小时
    if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      return cached.data;
    }
  }

  try {
    const url = `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`;
    
    return new Promise((resolve) => {
      // 设置5秒超时，超时时返回空集合，不阻塞主请求
      const timeout = setTimeout(() => {
        console.warn(`[后端] 从GitHub获取${year}年节假日数据超时（5秒），使用空集合`);
        resolve({ holidays: new Set(), workingDays: new Set() });
      }, 5000);
      
      const req = https.get(url, (res) => {
        // 检查响应状态
        if (res.statusCode !== 200) {
          clearTimeout(timeout);
          console.warn(`[后端] GitHub返回状态码 ${res.statusCode}，使用空集合`);
          resolve({ holidays: new Set(), workingDays: new Set() });
          return;
        }
        
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          clearTimeout(timeout);
          try {
            const response = JSON.parse(data);
            const holidays = new Set(); // 非工作日（isOffDay === true）
            const workingDays = new Set(); // 调休日（isWorkingDay === true，需要上班）
            
            if (response?.days) {
              const daysArray = Array.isArray(response.days) 
                ? response.days 
                : Object.values(response.days);
              
              daysArray.forEach((item) => {
                const dateStr = item.date || '';
                if (dateStr && dateStr.length > 0) {
                  // 存储非工作日（节假日）
                  if (item.isOffDay === true) {
                    holidays.add(dateStr);
                  }
                  // 存储调休日（需要上班的工作日）
                  if (item.isWorkingDay === true) {
                    workingDays.add(dateStr);
                  }
                }
              });
            }
            
            const result = {
              holidays: holidays,
              workingDays: workingDays
            };
            
            // 缓存数据
            holidayCache.set(year, {
              data: result,
              timestamp: Date.now()
            });
            
            console.log(`[后端] 已从GitHub加载 ${holidays.size} 个节假日，${workingDays.size} 个调休日（${year}年）`);
            
            // 调试：检查2025年1月1-3日
            if (year === 2025) {
              const janDates = ['2025-01-01', '2025-01-02', '2025-01-03'];
              janDates.forEach(d => {
                const isHoliday = holidays.has(d);
                const isWorkingDay = workingDays.has(d);
                console.log(`[后端调试] ${d}: 节假日=${isHoliday}, 调休日=${isWorkingDay}`);
              });
            }
            
            resolve(result);
          } catch (error) {
            console.error('[后端] 解析GitHub节假日数据失败:', error);
            // 解析失败时返回空集合，不阻塞主请求
            resolve({ holidays: new Set(), workingDays: new Set() });
          }
        });
      });
      
      req.on('error', (error) => {
        clearTimeout(timeout);
        console.error('[后端] 从GitHub获取节假日数据失败:', error);
        // 网络错误时返回空集合，不阻塞主请求
        resolve({ holidays: new Set(), workingDays: new Set() });
      });
      
      // 设置请求超时
      req.setTimeout(5000, () => {
        req.destroy();
        clearTimeout(timeout);
        console.warn(`[后端] GitHub请求超时，已取消请求`);
        resolve({ holidays: new Set(), workingDays: new Set() });
      });
    });
  } catch (error) {
    console.error('[后端] 获取节假日数据异常:', error);
    return { holidays: new Set(), workingDays: new Set() }; // 失败时返回空集合
  }
}

// 判断日期是否为节假日（使用GitHub数据）
async function isHolidayFromGitHub(date, year) {
  try {
    const holidayData = await getHolidaysFromGitHub(year);
    const dateStr = date instanceof Date 
      ? date.toISOString().slice(0, 10) 
      : date;
    return holidayData.holidays.has(dateStr);
  } catch (error) {
    console.error('[后端] 判断节假日失败:', error);
    return false;
  }
}

// 获取标准工作时长的函数
async function getStandardWorkHours(connection) {
  try {
    const [rows] = await connection.execute(`
      SELECT start_time, end_time, lunch_start_time, lunch_end_time, 
             other_break_start_time, other_break_end_time, standard_hours, updated_at
      FROM work_time_settings 
      ORDER BY updated_at DESC 
      LIMIT 1
    `);
    
    if (rows.length > 0) {
      return {
        standardHours: parseFloat(rows[0].standard_hours),
        updatedAt: rows[0].updated_at
      };
    }
    
    // 如果没有设置，拒绝使用默认值
    return {
      standardHours: null,
      updatedAt: null
    };
  } catch (error) {
    console.error('获取标准工作时长失败:', error);
    return {
      standardHours: null,
      updatedAt: null
    }; // 出错时拒绝使用默认值
  }
}

// 计算阶段实际工时的函数
async function calculatePhaseActualHours(connection, taskId, userId, phaseKey, task) {
  try {
    // 获取阶段开始时间
    const startTimeField = `${phaseKey}_start_time`;
    const startTime = task[startTimeField];
    
    if (!startTime) {
      console.log(`阶段 ${phaseKey} 没有开始时间，返回0`);
      return 0;
    }
    
    const endTime = new Date(); // 当前时间作为结束时间
    
    console.log(`计算阶段 ${phaseKey} 实际工时:`);
    console.log(`开始时间: ${startTime}`);
    console.log(`结束时间: ${endTime}`);
    
    // 计算时间跨度（天数）
    const startDate = new Date(startTime);
    const daysDiff = Math.ceil((endTime - startDate) / (1000 * 60 * 60 * 24));
    
    console.log(`时间跨度: ${daysDiff} 天`);
    
    let totalActualHours = 0;
    
    // 遍历每一天，查询该用户的考勤记录
    for (let i = 0; i < daysDiff; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      console.log(`查询日期 ${dateStr} 的考勤记录`);
      
      // 查询该日期的考勤记录
      const [attendanceRows] = await connection.execute(`
        SELECT actual_hours, standard_attendance_hours, overtime_hours, leave_hours
        FROM daily_attendance 
        WHERE user_id = ? AND date = ?
      `, [userId, dateStr]);
      
      if (attendanceRows.length > 0) {
        const attendance = attendanceRows[0];
        const dayActualHours = parseFloat(attendance.actual_hours) || 0;
        totalActualHours += dayActualHours;
        
        console.log(`日期 ${dateStr}: 实际工时 ${dayActualHours} 小时`);
      } else {
        console.log(`日期 ${dateStr}: 无考勤记录`);
      }
    }
    
    console.log(`阶段 ${phaseKey} 总实际工时: ${totalActualHours} 小时`);
    return totalActualHours;
    
  } catch (error) {
    console.error('计算阶段实际工时失败:', error);
    return 0; // 出错时返回0
  }
}

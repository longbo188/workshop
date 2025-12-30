const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function run() {
  let conn;
  try {
    console.log('连接数据库...');
    conn = await mysql.createConnection(dbConfig);

    console.log('添加阶段流程控制字段...');
    await conn.execute("SET FOREIGN_KEY_CHECKS = 0");
    
    // 添加当前阶段字段
    try { 
      await conn.execute("ALTER TABLE tasks ADD COLUMN current_phase ENUM('machining', 'electrical', 'pre_assembly', 'post_assembly', 'debugging') DEFAULT 'machining' AFTER debugging_phase"); 
      console.log('已添加 current_phase'); 
    } catch (e) { 
      console.log('current_phase 已存在或添加失败:', e.code || e.message); 
    }
    
    // 添加阶段开始时间字段
    try { 
      await conn.execute("ALTER TABLE tasks ADD COLUMN machining_start_time DATETIME NULL AFTER current_phase"); 
      console.log('已添加 machining_start_time'); 
    } catch (e) { 
      console.log('machining_start_time 已存在或添加失败:', e.code || e.message); 
    }
    
    try { 
      await conn.execute("ALTER TABLE tasks ADD COLUMN electrical_start_time DATETIME NULL AFTER machining_start_time"); 
      console.log('已添加 electrical_start_time'); 
    } catch (e) { 
      console.log('electrical_start_time 已存在或添加失败:', e.code || e.message); 
    }
    
    try { 
      await conn.execute("ALTER TABLE tasks ADD COLUMN pre_assembly_start_time DATETIME NULL AFTER electrical_start_time"); 
      console.log('已添加 pre_assembly_start_time'); 
    } catch (e) { 
      console.log('pre_assembly_start_time 已存在或添加失败:', e.code || e.message); 
    }
    
    try { 
      await conn.execute("ALTER TABLE tasks ADD COLUMN post_assembly_start_time DATETIME NULL AFTER pre_assembly_start_time"); 
      console.log('已添加 post_assembly_start_time'); 
    } catch (e) { 
      console.log('post_assembly_start_time 已存在或添加失败:', e.code || e.message); 
    }
    
    try { 
      await conn.execute("ALTER TABLE tasks ADD COLUMN debugging_start_time DATETIME NULL AFTER post_assembly_start_time"); 
      console.log('已添加 debugging_start_time'); 
    } catch (e) { 
      console.log('debugging_start_time 已存在或添加失败:', e.code || e.message); 
    }
    
    // 添加阶段完成时间字段
    try { 
      await conn.execute("ALTER TABLE tasks ADD COLUMN machining_complete_time DATETIME NULL AFTER debugging_start_time"); 
      console.log('已添加 machining_complete_time'); 
    } catch (e) { 
      console.log('machining_complete_time 已存在或添加失败:', e.code || e.message); 
    }
    
    try { 
      await conn.execute("ALTER TABLE tasks ADD COLUMN electrical_complete_time DATETIME NULL AFTER machining_complete_time"); 
      console.log('已添加 electrical_complete_time'); 
    } catch (e) { 
      console.log('electrical_complete_time 已存在或添加失败:', e.code || e.message); 
    }
    
    try { 
      await conn.execute("ALTER TABLE tasks ADD COLUMN pre_assembly_complete_time DATETIME NULL AFTER electrical_complete_time"); 
      console.log('已添加 pre_assembly_complete_time'); 
    } catch (e) { 
      console.log('pre_assembly_complete_time 已存在或添加失败:', e.code || e.message); 
    }
    
    try { 
      await conn.execute("ALTER TABLE tasks ADD COLUMN post_assembly_complete_time DATETIME NULL AFTER pre_assembly_complete_time"); 
      console.log('已添加 post_assembly_complete_time'); 
    } catch (e) { 
      console.log('post_assembly_complete_time 已存在或添加失败:', e.code || e.message); 
    }
    
    try { 
      await conn.execute("ALTER TABLE tasks ADD COLUMN debugging_complete_time DATETIME NULL AFTER post_assembly_complete_time"); 
      console.log('已添加 debugging_complete_time'); 
    } catch (e) { 
      console.log('debugging_complete_time 已存在或添加失败:', e.code || e.message); 
    }
    
    await conn.execute("SET FOREIGN_KEY_CHECKS = 1");

    const [rows] = await conn.execute('DESCRIBE tasks');
    console.log('\n当前 tasks 表字段:');
    rows.forEach(r => console.log(`${r.Field} - ${r.Type}`));

    console.log('\n阶段流程控制字段检查:');
    const fields = rows.map(r => r.Field);
    const phaseFields = [
      'current_phase',
      'machining_start_time', 'electrical_start_time', 'pre_assembly_start_time', 'post_assembly_start_time', 'debugging_start_time',
      'machining_complete_time', 'electrical_complete_time', 'pre_assembly_complete_time', 'post_assembly_complete_time', 'debugging_complete_time'
    ];
    phaseFields.forEach(f => console.log(`  ${f}: ${fields.includes(f) ? 'OK' : '缺失'}`));

    console.log('\n完成。');
  } catch (err) {
    console.error('迁移失败:', err.message);
  } finally {
    if (conn) { await conn.end(); console.log('数据库连接已关闭'); }
  }
}

run();









































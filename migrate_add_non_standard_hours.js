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

    console.log('添加非标工时字段...');
    await conn.execute("SET FOREIGN_KEY_CHECKS = 0");
    
    // 添加非标工时字段
    try { 
      await conn.execute("ALTER TABLE tasks ADD COLUMN machining_hours_non_std DECIMAL(5,2) NULL AFTER machining_hours_est"); 
      console.log('已添加 machining_hours_non_std'); 
    } catch (e) { 
      console.log('machining_hours_non_std 已存在或添加失败:', e.code || e.message); 
    }
    
    try { 
      await conn.execute("ALTER TABLE tasks ADD COLUMN electrical_hours_non_std DECIMAL(5,2) NULL AFTER electrical_hours_est"); 
      console.log('已添加 electrical_hours_non_std'); 
    } catch (e) { 
      console.log('electrical_hours_non_std 已存在或添加失败:', e.code || e.message); 
    }
    
    try { 
      await conn.execute("ALTER TABLE tasks ADD COLUMN pre_assembly_hours_non_std DECIMAL(5,2) NULL AFTER pre_assembly_hours_est"); 
      console.log('已添加 pre_assembly_hours_non_std'); 
    } catch (e) { 
      console.log('pre_assembly_hours_non_std 已存在或添加失败:', e.code || e.message); 
    }
    
    try { 
      await conn.execute("ALTER TABLE tasks ADD COLUMN post_assembly_hours_non_std DECIMAL(5,2) NULL AFTER post_assembly_hours_est"); 
      console.log('已添加 post_assembly_hours_non_std'); 
    } catch (e) { 
      console.log('post_assembly_hours_non_std 已存在或添加失败:', e.code || e.message); 
    }
    
    try { 
      await conn.execute("ALTER TABLE tasks ADD COLUMN debugging_hours_non_std DECIMAL(5,2) NULL AFTER debugging_hours_est"); 
      console.log('已添加 debugging_hours_non_std'); 
    } catch (e) { 
      console.log('debugging_hours_non_std 已存在或添加失败:', e.code || e.message); 
    }
    
    await conn.execute("SET FOREIGN_KEY_CHECKS = 1");

    const [rows] = await conn.execute('DESCRIBE tasks');
    console.log('\n当前 tasks 表字段:');
    rows.forEach(r => console.log(`${r.Field} - ${r.Type}`));

    console.log('\n非标工时字段检查:');
    const fields = rows.map(r => r.Field);
    ['machining_hours_non_std','electrical_hours_non_std','pre_assembly_hours_non_std','post_assembly_hours_non_std','debugging_hours_non_std']
      .forEach(f => console.log(`  ${f}: ${fields.includes(f) ? 'OK' : '缺失'}`));

    console.log('\n完成。');
  } catch (e) {
    console.error('迁移失败:', e);
  } finally {
    if (conn) await conn.end();
  }
}

run();

































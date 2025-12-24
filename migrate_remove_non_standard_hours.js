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

    console.log('删除非标工时字段...');
    await conn.execute("SET FOREIGN_KEY_CHECKS = 0");
    
    // 删除非标工时字段
    try { 
      await conn.execute("ALTER TABLE tasks DROP COLUMN machining_hours_non_std"); 
      console.log('已删除 machining_hours_non_std'); 
    } catch (e) { 
      console.log('machining_hours_non_std 不存在或删除失败:', e.code || e.message); 
    }
    
    try { 
      await conn.execute("ALTER TABLE tasks DROP COLUMN electrical_hours_non_std"); 
      console.log('已删除 electrical_hours_non_std'); 
    } catch (e) { 
      console.log('electrical_hours_non_std 不存在或删除失败:', e.code || e.message); 
    }
    
    try { 
      await conn.execute("ALTER TABLE tasks DROP COLUMN pre_assembly_hours_non_std"); 
      console.log('已删除 pre_assembly_hours_non_std'); 
    } catch (e) { 
      console.log('pre_assembly_hours_non_std 不存在或删除失败:', e.code || e.message); 
    }
    
    try { 
      await conn.execute("ALTER TABLE tasks DROP COLUMN post_assembly_hours_non_std"); 
      console.log('已删除 post_assembly_hours_non_std'); 
    } catch (e) { 
      console.log('post_assembly_hours_non_std 不存在或删除失败:', e.code || e.message); 
    }
    
    try { 
      await conn.execute("ALTER TABLE tasks DROP COLUMN debugging_hours_non_std"); 
      console.log('已删除 debugging_hours_non_std'); 
    } catch (e) { 
      console.log('debugging_hours_non_std 不存在或删除失败:', e.code || e.message); 
    }
    
    await conn.execute("SET FOREIGN_KEY_CHECKS = 1");

    const [rows] = await conn.execute('DESCRIBE tasks');
    console.log('\n当前 tasks 表字段:');
    rows.forEach(r => console.log(`${r.Field} - ${r.Type}`));

    console.log('\n非标工时字段检查:');
    const fields = rows.map(r => r.Field);
    const nonStdFields = ['machining_hours_non_std','electrical_hours_non_std','pre_assembly_hours_non_std','post_assembly_hours_non_std','debugging_hours_non_std'];
    nonStdFields.forEach(f => console.log(`  ${f}: ${fields.includes(f) ? '仍在' : '已删除'}`));
    
    if (!fields.some(f => nonStdFields.includes(f))) {
      console.log('✅ 所有非标工时字段已成功删除');
    } else {
      console.log('⚠️  仍有部分非标工时字段未删除');
    }

    console.log('\n完成。');
  } catch (e) {
    console.error('迁移失败:', e);
  } finally {
    if (conn) await conn.end();
  }
}

run();

































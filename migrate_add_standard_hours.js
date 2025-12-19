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

    console.log('添加标准工时字段...');
    await conn.execute("SET FOREIGN_KEY_CHECKS = 0");
    try { await conn.execute("ALTER TABLE tasks ADD COLUMN machining_hours_est DECIMAL(5,2) NULL AFTER actual_hours"); console.log('已添加 machining_hours_est'); } catch (e) { console.log('machining_hours_est 已存在或添加失败:', e.code || e.message); }
    try { await conn.execute("ALTER TABLE tasks ADD COLUMN electrical_hours_est DECIMAL(5,2) NULL AFTER machining_hours_est"); console.log('已添加 electrical_hours_est'); } catch (e) { console.log('electrical_hours_est 已存在或添加失败:', e.code || e.message); }
    try { await conn.execute("ALTER TABLE tasks ADD COLUMN pre_assembly_hours_est DECIMAL(5,2) NULL AFTER electrical_hours_est"); console.log('已添加 pre_assembly_hours_est'); } catch (e) { console.log('pre_assembly_hours_est 已存在或添加失败:', e.code || e.message); }
    try { await conn.execute("ALTER TABLE tasks ADD COLUMN post_assembly_hours_est DECIMAL(5,2) NULL AFTER pre_assembly_hours_est"); console.log('已添加 post_assembly_hours_est'); } catch (e) { console.log('post_assembly_hours_est 已存在或添加失败:', e.code || e.message); }
    try { await conn.execute("ALTER TABLE tasks ADD COLUMN debugging_hours_est DECIMAL(5,2) NULL AFTER post_assembly_hours_est"); console.log('已添加 debugging_hours_est'); } catch (e) { console.log('debugging_hours_est 已存在或添加失败:', e.code || e.message); }
    // 五阶段布尔
    try { await conn.execute("ALTER TABLE tasks ADD COLUMN machining_phase TINYINT(1) DEFAULT 0 AFTER debugging_hours_est"); console.log('已添加 machining_phase'); } catch (e) { console.log('machining_phase 已存在或添加失败:', e.code || e.message); }
    try { await conn.execute("ALTER TABLE tasks ADD COLUMN electrical_phase TINYINT(1) DEFAULT 0 AFTER machining_phase"); console.log('已添加 electrical_phase'); } catch (e) { console.log('electrical_phase 已存在或添加失败:', e.code || e.message); }
    try { await conn.execute("ALTER TABLE tasks ADD COLUMN pre_assembly_phase TINYINT(1) DEFAULT 0 AFTER electrical_phase"); console.log('已添加 pre_assembly_phase'); } catch (e) { console.log('pre_assembly_phase 已存在或添加失败:', e.code || e.message); }
    try { await conn.execute("ALTER TABLE tasks ADD COLUMN post_assembly_phase TINYINT(1) DEFAULT 0 AFTER pre_assembly_phase"); console.log('已添加 post_assembly_phase'); } catch (e) { console.log('post_assembly_phase 已存在或添加失败:', e.code || e.message); }
    try { await conn.execute("ALTER TABLE tasks ADD COLUMN debugging_phase TINYINT(1) DEFAULT 0 AFTER post_assembly_phase"); console.log('已添加 debugging_phase'); } catch (e) { console.log('debugging_phase 已存在或添加失败:', e.code || e.message); }
    await conn.execute("SET FOREIGN_KEY_CHECKS = 1");

    const [rows] = await conn.execute('DESCRIBE tasks');
    console.log('\n当前 tasks 表字段:');
    rows.forEach(r => console.log(`${r.Field} - ${r.Type}`));

    console.log('\n标准工时字段检查:');
    const fields = rows.map(r => r.Field);
    ['machining_hours_est','electrical_hours_est','pre_assembly_hours_est','post_assembly_hours_est','debugging_hours_est','machining_phase','electrical_phase','pre_assembly_phase','post_assembly_phase','debugging_phase']
      .forEach(f => console.log(`  ${f}: ${fields.includes(f) ? 'OK' : '缺失'}`));

    console.log('\n完成。');
  } catch (err) {
    console.error('迁移失败:', err.message);
  } finally {
    if (conn) { await conn.end(); console.log('数据库连接已关闭'); }
  }
}

run();



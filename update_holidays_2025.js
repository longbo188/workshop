const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workshop_db'
};

async function updateHolidays2025() {
  try {
    console.log('开始更新2025年法定节假日数据...');
    
    const conn = await mysql.createConnection(dbConfig);
    
    // 先清空现有的2025年节假日数据
    await conn.execute('DELETE FROM holidays WHERE YEAR(date) = 2025');
    console.log('已清空2025年节假日数据');
    
    // 插入2025年实际法定节假日数据
    const holidays2025 = [
      // 元旦
      ['2025-01-01', '元旦', 'national', false],
      
      // 春节（2025年1月28日-2月3日）
      ['2025-01-28', '春节', 'national', false],
      ['2025-01-29', '春节', 'national', false],
      ['2025-01-30', '春节', 'national', false],
      ['2025-01-31', '春节', 'national', false],
      ['2025-02-01', '春节', 'national', false],
      ['2025-02-02', '春节', 'national', false],
      ['2025-02-03', '春节', 'national', false],
      
      // 清明节（2025年4月5日-7日）
      ['2025-04-05', '清明节', 'national', false],
      ['2025-04-06', '清明节', 'national', false],
      ['2025-04-07', '清明节', 'national', false],
      
      // 劳动节（2025年5月1日-5日）
      ['2025-05-01', '劳动节', 'national', false],
      ['2025-05-02', '劳动节', 'national', false],
      ['2025-05-03', '劳动节', 'national', false],
      ['2025-05-04', '劳动节', 'national', false],
      ['2025-05-05', '劳动节', 'national', false],
      
      // 端午节（2025年6月14日）
      ['2025-06-14', '端午节', 'national', false],
      
      // 中秋节（2025年9月15日-17日）
      ['2025-09-15', '中秋节', 'national', false],
      ['2025-09-16', '中秋节', 'national', false],
      ['2025-09-17', '中秋节', 'national', false],
      
      // 国庆节（2025年10月1日-7日）
      ['2025-10-01', '国庆节', 'national', false],
      ['2025-10-02', '国庆节', 'national', false],
      ['2025-10-03', '国庆节', 'national', false],
      ['2025-10-04', '国庆节', 'national', false],
      ['2025-10-05', '国庆节', 'national', false],
      ['2025-10-06', '国庆节', 'national', false],
      ['2025-10-07', '国庆节', 'national', false],
      
      // 调休工作日（需要上班的周末）
      ['2025-01-26', '调休工作日', 'national', true], // 周日上班
      ['2025-02-08', '调休工作日', 'national', true], // 周六上班
      ['2025-04-27', '调休工作日', 'national', true], // 周日上班
      ['2025-09-28', '调休工作日', 'national', true], // 周日上班
      ['2025-10-12', '调休工作日', 'national', true], // 周日上班
    ];
    
    // 批量插入节假日数据
    for (const [date, name, type, isWorkingDay] of holidays2025) {
      await conn.execute(`
        INSERT INTO holidays (date, name, type, is_working_day) 
        VALUES (?, ?, ?, ?)
      `, [date, name, type, isWorkingDay]);
    }
    
    console.log(`成功插入${holidays2025.length}条2025年节假日数据`);
    
    // 查看更新后的数据
    const [rows] = await conn.execute(`
      SELECT * FROM holidays 
      WHERE YEAR(date) = 2025 
      ORDER BY date ASC
    `);
    
    console.log('\n2025年节假日数据:');
    rows.forEach(holiday => {
      console.log(`${holiday.date} - ${holiday.name} (${holiday.is_working_day ? '工作日' : '节假日'})`);
    });
    
    await conn.end();
    console.log('\n2025年法定节假日数据更新完成！');
    
  } catch (error) {
    console.error('更新失败:', error);
  }
}

updateHolidays2025();





































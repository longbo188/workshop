// 定时备份脚本（使用 node-cron）
const cron = require('node-cron');
const backupModule = require('./backup-database');

// 配置备份时间（每天凌晨 2:00 执行）
// cron 格式：分钟 小时 日 月 星期
// '0 2 * * *' 表示每天凌晨 2:00
// 可以通过环境变量 BACKUP_SCHEDULE 自定义，例如：'0 */6 * * *' 表示每6小时备份一次
const schedule = process.env.BACKUP_SCHEDULE || '0 2 * * *';

console.log('========================================');
console.log('数据库自动备份服务已启动');
console.log('========================================');
console.log(`备份计划: ${schedule} (每天凌晨 2:00)`);
console.log(`备份目录: ${backupModule.backupConfig.backupDir}`);
console.log(`保留备份数: ${backupModule.backupConfig.maxBackups}`);
console.log('========================================\n');

// 设置定时任务
cron.schedule(schedule, async () => {
  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  console.log(`\n[${timestamp}] 开始定时备份...`);
  try {
    const backupFile = await backupModule.backupDatabase();
    backupModule.cleanOldBackups();
    console.log(`[${timestamp}] ✓ 定时备份完成: ${backupFile}\n`);
  } catch (error) {
    console.error(`[${timestamp}] ✗ 定时备份失败: ${error.message}\n`);
  }
});

// 保持进程运行
console.log('定时备份服务正在运行中，按 Ctrl+C 停止...\n');

process.on('SIGINT', () => {
  console.log('\n正在关闭定时备份服务...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n正在关闭定时备份服务...');
  process.exit(0);
});


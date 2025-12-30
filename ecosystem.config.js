module.exports = {
  apps: [{
    name: 'workshop-server',
    script: './backend/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      BACKUP_SCHEDULE: '0 2 * * *'  // 每天凌晨 2:00 自动备份
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // 如果进程崩溃，等待 10 秒后重启
    min_uptime: '10s',
    // 如果 10 秒内重启超过 10 次，停止重启
    max_restarts: 10,
    // 日志文件大小限制（10MB）
    log_file_max_size: '10M',
    // 保留的日志文件数量
    log_file_backups: 5
  }]
};



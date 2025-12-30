// 数据库自动备份脚本
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const execPromise = util.promisify(exec);

// 数据库配置（与 server.js 保持一致）
const dbConfig = {
  host: 'localhost',
  user: 'root',
  port: 3307,
  password: 'Magicray2025!',
  database: 'workshop_db'
};

// 备份配置
const backupConfig = {
  backupDir: path.join(__dirname, 'backups'), // 备份文件存储目录
  maxBackups: 30, // 保留最近30个备份文件
  compress: false // 是否压缩备份文件（Windows 默认不压缩，需要额外工具）
};

/**
 * 确保备份目录存在
 */
function ensureBackupDir() {
  if (!fs.existsSync(backupConfig.backupDir)) {
    fs.mkdirSync(backupConfig.backupDir, { recursive: true });
    console.log(`创建备份目录: ${backupConfig.backupDir}`);
  }
}

/**
 * 执行数据库备份
 */
async function backupDatabase() {
  try {
    ensureBackupDir();
    
    // 生成备份文件名（格式：workshop_db_20250115_143025.sql）
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const filename = `workshop_db_${dateStr}_${timeStr}.sql`;
    const filepath = path.join(backupConfig.backupDir, filename);
    
    console.log(`开始备份数据库: ${dbConfig.database}`);
    console.log(`备份文件: ${filepath}`);
    
    // 构建 mysqldump 命令
    // 尝试多个可能的路径
    let mysqldumpPath = 'mysqldump'; // 默认使用系统 PATH 中的 mysqldump
    
    if (process.platform === 'win32') {
      // Windows 常见路径
      const possiblePaths = [
        'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe',
        'C:\\xampp\\mysql\\bin\\mysqldump.exe',
        'C:\\Program Files\\xampp\\mysql\\bin\\mysqldump.exe',
        'C:\\wamp64\\bin\\mysql\\mysql8.0.27\\bin\\mysqldump.exe',
        'mysqldump.exe' // 如果在 PATH 中
      ];
      
      // 检查哪个路径存在
      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          mysqldumpPath = testPath;
          break;
        }
      }
      
      // 如果都不存在，尝试在 PATH 中查找
      if (!fs.existsSync(mysqldumpPath)) {
        mysqldumpPath = 'mysqldump.exe';
      }
    }
    
    // 使用 --password= 格式避免交互式输入
    const command = `"${mysqldumpPath}" ` +
      `-h ${dbConfig.host} ` +
      `-P ${dbConfig.port} ` +
      `-u ${dbConfig.user} ` +
      `--password=${dbConfig.password} ` +
      `--single-transaction ` +
      `--routines ` +
      `--triggers ` +
      `--events ` +
      `--default-character-set=utf8mb4 ` +
      `${dbConfig.database} > "${filepath}"`;
    
    // 执行备份命令
    await execPromise(command, { 
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      shell: true 
    });
    
    // 检查文件是否成功创建
    if (!fs.existsSync(filepath)) {
      throw new Error('备份文件未生成，可能 mysqldump 路径不正确或权限不足');
    }
    
    const fileSize = fs.statSync(filepath).size;
    if (fileSize === 0) {
      throw new Error('备份文件为空，可能数据库连接失败');
    }
    
    console.log(`✓ 数据库备份成功: ${filepath} (${(fileSize / 1024).toFixed(2)} KB)`);
    
    return filepath;
  } catch (error) {
    console.error(`✗ 数据库备份失败: ${error.message}`);
    throw error;
  }
}

/**
 * 清理旧备份文件，只保留最近的 N 个
 */
function cleanOldBackups() {
  try {
    if (!fs.existsSync(backupConfig.backupDir)) {
      return;
    }
    
    const files = fs.readdirSync(backupConfig.backupDir)
      .filter(file => file.startsWith('workshop_db_') && file.endsWith('.sql'))
      .map(file => ({
        name: file,
        path: path.join(backupConfig.backupDir, file),
        time: fs.statSync(path.join(backupConfig.backupDir, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // 按修改时间降序排列
    
    // 如果文件数量超过限制，删除最旧的文件
    if (files.length > backupConfig.maxBackups) {
      const filesToDelete = files.slice(backupConfig.maxBackups);
      filesToDelete.forEach(file => {
        try {
          fs.unlinkSync(file.path);
          console.log(`删除旧备份: ${file.name}`);
        } catch (err) {
          console.warn(`删除备份文件失败 ${file.name}: ${err.message}`);
        }
      });
      console.log(`已清理 ${filesToDelete.length} 个旧备份文件`);
    }
  } catch (error) {
    console.error(`清理旧备份失败: ${error.message}`);
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    const backupFile = await backupDatabase();
    cleanOldBackups();
    console.log(`\n备份完成！文件: ${backupFile}`);
    process.exit(0);
  } catch (error) {
    console.error(`备份过程出错: ${error.message}`);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

// 导出函数供其他模块使用
module.exports = {
  backupDatabase,
  cleanOldBackups,
  backupConfig
};


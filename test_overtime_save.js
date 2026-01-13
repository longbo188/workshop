// 测试加班时间段保存
const http = require('http');

const data = JSON.stringify({
  overtimeHours: 2.5,
  leaveHours: 0,
  overtimeStartTime: "18:00",
  overtimeEndTime: "20:30",
  leaveStartTime: null,
  leaveEndTime: null,
  note: "测试时间段保存",
  adjustedBy: 1
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/daily-attendance/1/adjust',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`状态码: ${res.statusCode}`);
  console.log(`响应头: ${JSON.stringify(res.headers)}`);
  
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('响应数据:', responseData);
  });
});

req.on('error', (e) => {
  console.error(`请求错误: ${e.message}`);
});

req.write(data);
req.end();







































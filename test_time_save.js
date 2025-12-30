// 测试时间段保存功能
const http = require('http');

const data = JSON.stringify({
  overtimeHours: 2.5,
  leaveHours: 0,
  overtimeStartTime: "18:00",
  overtimeEndTime: "20:30",
  leaveStartTime: null,
  leaveEndTime: null,
  note: "测试HH:MM格式时间段保存",
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

console.log('发送数据:', data);

const req = http.request(options, (res) => {
  console.log(`状态码: ${res.statusCode}`);
  console.log(`响应头: ${JSON.stringify(res.headers)}`);
  
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('响应数据:', responseData);
    
    // 如果成功，查询更新后的数据
    if (res.statusCode === 200) {
      console.log('\n查询更新后的数据...');
      const getOptions = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/daily-attendance?userId=3&start=2025-10-20&end=2025-10-21',
        method: 'GET'
      };
      
      const getReq = http.request(getOptions, (getRes) => {
        let getData = '';
        getRes.on('data', (chunk) => {
          getData += chunk;
        });
        getRes.on('end', () => {
          console.log('更新后的考勤数据:', getData);
        });
      });
      
      getReq.on('error', (e) => {
        console.error(`查询错误: ${e.message}`);
      });
      
      getReq.end();
    }
  });
});

req.on('error', (e) => {
  console.error(`请求错误: ${e.message}`);
});

req.write(data);
req.end();




































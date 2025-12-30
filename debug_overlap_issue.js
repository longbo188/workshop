// 修正异常与加班时间重叠计算
console.log('=== 修正异常与加班时间重叠计算 ===');

// 重叠计算
function getOverlapHours(start1, end1, start2, end2) {
  const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
  const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));
  
  if (overlapStart >= overlapEnd) return 0;
  
  return (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
}

// 测试数据
const exceptionStart = new Date('2025-10-20T08:30:00.000Z'); // 08:30 本地时间
const exceptionEnd = new Date('2025-10-20T19:50:00.000Z');   // 19:50 本地时间
const overtimeStart = new Date('2025-10-20T10:00:00.000Z'); // 18:00 本地时间
const overtimeEnd = new Date('2025-10-20T12:00:00.000Z');   // 20:00 本地时间

console.log('时间分析：');
console.log(`异常时间: ${exceptionStart.toISOString()} - ${exceptionEnd.toISOString()}`);
console.log(`加班时间: ${overtimeStart.toISOString()} - ${overtimeEnd.toISOString()}`);
console.log('');

console.log('本地时间：');
console.log(`异常时间本地: ${exceptionStart.toString()}`);
console.log(`加班时间本地: ${overtimeStart.toString()}`);
console.log('');

// 计算重叠
const overlap = getOverlapHours(exceptionStart, exceptionEnd, overtimeStart, overtimeEnd);
console.log(`重叠结果: ${overlap.toFixed(2)}h`);

console.log('\n=== 问题分析 ===');
console.log('异常时间08:30-19:50与加班时间18:00-20:00的重叠应该是1.83h');
console.log('但计算结果却是2h，说明时间转换有问题');

console.log('\n=== 正确的计算 ===');
console.log('异常时间：08:30-19:50');
console.log('加班时间：18:00-20:00');
console.log('重叠部分：18:00-19:50');
console.log('重叠时长：19:50 - 18:00 = 1小时50分钟 = 1.83小时');

console.log('\n=== 问题根源 ===');
console.log('问题在于：异常时间存储的是本地时间但标记为UTC');
console.log('导致时间转换错误，需要特殊处理');

// 正确的处理方式
const correctExceptionStart = new Date('2025-10-20T00:30:00.000Z'); // 08:30 本地时间
const correctExceptionEnd = new Date('2025-10-20T11:50:00.000Z');   // 19:50 本地时间

console.log('\n=== 正确的UTC时间 ===');
console.log(`异常时间正确UTC: ${correctExceptionStart.toISOString()} - ${correctExceptionEnd.toISOString()}`);
console.log(`异常时间正确本地: ${correctExceptionStart.toString()} - ${correctExceptionEnd.toString()}`);

const correctOverlap = getOverlapHours(correctExceptionStart, correctExceptionEnd, overtimeStart, overtimeEnd);
console.log(`正确重叠结果: ${correctOverlap.toFixed(2)}h`);

console.log('\n=== 结论 ===');
console.log('需要修正前端代码，正确处理异常时间的UTC转换');





































// 验证修正后的异常与加班时间重叠计算
console.log('=== 验证修正后的异常与加班时间重叠计算 ===');

// 重叠计算
function getOverlapHours(start1, end1, start2, end2) {
  const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
  const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));
  
  if (overlapStart >= overlapEnd) return 0;
  
  return (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
}

// 测试数据
const currentDay = '2025-10-20';
const exception = { start: '08:30', end: '19:50' };
const overtime = { start: '18:00', end: '20:00' };

console.log('测试数据：');
console.log(`异常时间: ${exception.start} - ${exception.end}`);
console.log(`加班时间: ${overtime.start} - ${overtime.end}`);
console.log('');

// 创建时间对象
const exceptionStartDate = new Date(`${currentDay}T${exception.start}`);
const exceptionEndDate = new Date(`${currentDay}T${exception.end}`);
const overtimeStart = new Date(`${currentDay}T${overtime.start}`);
const overtimeEnd = new Date(`${currentDay}T${overtime.end}`);

console.log('时间对象：');
console.log(`异常开始: ${exceptionStartDate.toISOString()}`);
console.log(`异常结束: ${exceptionEndDate.toISOString()}`);
console.log(`加班开始: ${overtimeStart.toISOString()}`);
console.log(`加班结束: ${overtimeEnd.toISOString()}`);
console.log('');

// 检查是否跨越日期
const isCrossDate = exceptionEndDate.getDate() !== exceptionStartDate.getDate();
console.log(`是否跨越日期: ${isCrossDate}`);

if (isCrossDate) {
  console.log('\n=== 修正UTC时间转换 ===');
  // 异常时间跨越了日期，说明存储的是本地时间，需要减去8小时转换为UTC
  const correctExceptionStart = new Date(exceptionStartDate.getTime() - 8 * 60 * 60 * 1000);
  const correctExceptionEnd = new Date(exceptionEndDate.getTime() - 8 * 60 * 60 * 1000);
  
  console.log(`修正前异常开始: ${exceptionStartDate.toISOString()}`);
  console.log(`修正后异常开始: ${correctExceptionStart.toISOString()}`);
  console.log(`修正前异常结束: ${exceptionEndDate.toISOString()}`);
  console.log(`修正后异常结束: ${correctExceptionEnd.toISOString()}`);
  console.log('');
  
  // 计算重叠
  const overlap = getOverlapHours(correctExceptionStart, correctExceptionEnd, overtimeStart, overtimeEnd);
  console.log(`修正后重叠结果: ${overlap.toFixed(2)}h`);
  
  // 验证
  console.log('\n=== 验证结果 ===');
  console.log('期望重叠：1.83h');
  console.log(`实际重叠：${overlap.toFixed(2)}h`);
  console.log(`是否一致：${Math.abs(overlap - 1.83) < 0.01 ? '是' : '否'}`);
  
  if (Math.abs(overlap - 1.83) < 0.01) {
    console.log('\n✅ 修正成功！异常与加班时间重叠计算现在正确了。');
  } else {
    console.log('\n❌ 修正失败，仍有问题。');
  }
} else {
  console.log('异常时间在同一天，不需要修正');
}

































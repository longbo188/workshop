// 测试跨越日期检测逻辑
console.log('=== 测试跨越日期检测逻辑 ===');

// 测试数据
const currentDay = '2025-10-20';
const exception = { start: '08:30', end: '19:50' };

console.log('测试数据：');
console.log(`异常时间: ${exception.start} - ${exception.end}`);
console.log('');

// 创建时间对象
const exceptionStartDate = new Date(`${currentDay}T${exception.start}`);
const exceptionEndDate = new Date(`${currentDay}T${exception.end}`);

console.log('时间对象：');
console.log(`异常开始: ${exceptionStartDate.toISOString()}`);
console.log(`异常结束: ${exceptionEndDate.toISOString()}`);
console.log('');

console.log('日期检查：');
console.log(`异常开始日期: ${exceptionStartDate.getDate()}`);
console.log(`异常结束日期: ${exceptionEndDate.getDate()}`);
console.log(`是否跨越日期: ${exceptionEndDate.getDate() !== exceptionStartDate.getDate()}`);
console.log('');

// 问题分析
console.log('=== 问题分析 ===');
console.log('异常时间08:30-19:50在同一天，但我们的逻辑检测不到跨越日期');
console.log('这是因为我们直接创建了Date对象，没有考虑时区问题');

// 正确的检测方式
console.log('\n=== 正确的检测方式 ===');
console.log('应该检查原始存储的时间字符串是否跨越日期');

// 模拟原始存储的时间字符串
const originalStartTime = '2025-10-20T08:30:00.000Z';
const originalEndTime = '2025-10-20T19:50:00.000Z';

console.log(`原始开始时间: ${originalStartTime}`);
console.log(`原始结束时间: ${originalEndTime}`);

// 解析原始时间
const originalStartDate = new Date(originalStartTime);
const originalEndDate = new Date(originalEndTime);

console.log('\n解析后的时间：');
console.log(`开始日期: ${originalStartDate.getDate()}`);
console.log(`结束日期: ${originalEndDate.getDate()}`);
console.log(`是否跨越日期: ${originalEndDate.getDate() !== originalStartDate.getDate()}`);

console.log('\n=== 结论 ===');
console.log('需要在getExceptionPeriodsForDay方法中检测跨越日期');
console.log('而不是在计算重叠时检测');

































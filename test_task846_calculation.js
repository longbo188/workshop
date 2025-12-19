// 任务846的13.42h计算过程测试
console.log('=== 任务846阶段总时间13.42h计算过程分析 ===\n');

// 基础数据
const phaseStartTime = '2025-10-20T00:30:42.000Z';
const phaseEndTime = '2025-10-21T05:50:42.000Z';

// 转换为本地时间
const start = new Date(phaseStartTime);
const end = new Date(phaseEndTime);

console.log('阶段时间 (UTC):', phaseStartTime, '->', phaseEndTime);
console.log('阶段时间 (本地):', start.toLocaleString('zh-CN'), '->', end.toLocaleString('zh-CN'));

// 计算阶段总时长
const totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
console.log('阶段总时长:', totalHours.toFixed(2), '小时\n');

// 工作时间设置
const workTimeSettings = {
  start_time: '08:30:00',
  end_time: '17:50:00',
  lunch_start_time: '11:50:00',
  lunch_end_time: '13:20:00',
  other_break_start_time: '16:00:00',
  other_break_end_time: '16:15:00',
  standard_hours: '7.58'
};

console.log('工作时间设置:', workTimeSettings);

// 获取工作窗口
function getWorkWindowsForDay(workTimeSettings) {
  const startTime = workTimeSettings.start_time;
  const endTime = workTimeSettings.end_time;
  const lunchStart = workTimeSettings.lunch_start_time;
  const lunchEnd = workTimeSettings.lunch_end_time;
  const otherStart = workTimeSettings.other_break_start_time || '';
  const otherEnd = workTimeSettings.other_break_end_time || '';

  let windows = [
    { start: startTime, end: lunchStart },
    { start: lunchEnd, end: endTime }
  ];

  // 扣除其他休息时间
  if (otherStart && otherEnd) {
    windows = splitWindowsByBreak(windows, otherStart, otherEnd);
  }

  return windows;
}

function splitWindowsByBreak(windows, breakStart, breakEnd) {
  const result = [];
  
  windows.forEach(window => {
    if (breakStart >= window.end || breakEnd <= window.start) {
      // 休息时间与窗口不重叠
      result.push(window);
    } else {
      // 需要切分窗口
      if (breakStart > window.start) {
        result.push({ start: window.start, end: breakStart });
      }
      if (breakEnd < window.end) {
        result.push({ start: breakEnd, end: window.end });
      }
    }
  });
  
  return result;
}

const workWindows = getWorkWindowsForDay(workTimeSettings);
console.log('工作窗口:', workWindows);

// 计算时间重叠
function getOverlapHours(start1, end1, start2, end2) {
  const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
  const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));
  
  if (overlapStart >= overlapEnd) return 0;
  
  const hours = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
  return hours;
}

// 逐日计算
let totalEffectiveHours = 0;

// 2025-10-20 计算
console.log('\n=== 2025-10-20 计算 ===');
const day1 = '2025-10-20';
const day1Start = new Date(`${day1}T00:00:00`);
const day1End = new Date(`${day1}T23:59:59`);

// 阶段时间在当天的部分
const phaseStartDay1 = new Date(Math.max(start.getTime(), day1Start.getTime()));
const phaseEndDay1 = new Date(Math.min(end.getTime(), day1End.getTime()));

console.log('当天阶段时间:', phaseStartDay1.toLocaleString('zh-CN'), '->', phaseEndDay1.toLocaleString('zh-CN'));

let day1OverlapHours = 0;

// 计算工作窗口重叠
workWindows.forEach((window, index) => {
  const windowStart = new Date(`${day1}T${window.start}`);
  const windowEnd = new Date(`${day1}T${window.end}`);
  
  const overlap = getOverlapHours(windowStart, windowEnd, phaseStartDay1, phaseEndDay1);
  console.log(`窗口${index + 1} (${window.start}-${window.end}) 重叠:`, overlap.toFixed(2), '小时');
  day1OverlapHours += overlap;
});

console.log('作息时间总重叠:', day1OverlapHours.toFixed(2), '小时');

// 加班时间 (假设18:00-20:25，2.42小时)
const overtimeStart = new Date(`${day1}T18:00:00`);
const overtimeEnd = new Date(`${day1}T20:25:00`);
const overtimeOverlap = getOverlapHours(overtimeStart, overtimeEnd, phaseStartDay1, phaseEndDay1);
console.log('加班时间重叠:', overtimeOverlap.toFixed(2), '小时');

day1OverlapHours += overtimeOverlap;

// 实际出勤限制
const actualAttendance = 10.00; // 7.58 + 2.42
const effectiveDay1 = Math.min(day1OverlapHours, actualAttendance);
console.log('当日有效工时:', effectiveDay1.toFixed(2), '小时 (重叠:', day1OverlapHours.toFixed(2), ', 实际出勤:', actualAttendance, ')');

totalEffectiveHours += effectiveDay1;

// 2025-10-21 计算
console.log('\n=== 2025-10-21 计算 ===');
const day2 = '2025-10-21';
const day2Start = new Date(`${day2}T00:00:00`);
const day2End = new Date(`${day2}T23:59:59`);

// 阶段时间在当天的部分
const phaseStartDay2 = new Date(Math.max(start.getTime(), day2Start.getTime()));
const phaseEndDay2 = new Date(Math.min(end.getTime(), day2End.getTime()));

console.log('当天阶段时间:', phaseStartDay2.toLocaleString('zh-CN'), '->', phaseEndDay2.toLocaleString('zh-CN'));

let day2OverlapHours = 0;

// 计算工作窗口重叠
workWindows.forEach((window, index) => {
  const windowStart = new Date(`${day2}T${window.start}`);
  const windowEnd = new Date(`${day2}T${window.end}`);
  
  const overlap = getOverlapHours(windowStart, windowEnd, phaseStartDay2, phaseEndDay2);
  console.log(`窗口${index + 1} (${window.start}-${window.end}) 重叠:`, overlap.toFixed(2), '小时');
  day2OverlapHours += overlap;
});

console.log('作息时间总重叠:', day2OverlapHours.toFixed(2), '小时');

// 实际出勤限制
const actualAttendance2 = 7.58;
const effectiveDay2 = Math.min(day2OverlapHours, actualAttendance2);
console.log('当日有效工时:', effectiveDay2.toFixed(2), '小时 (重叠:', day2OverlapHours.toFixed(2), ', 实际出勤:', actualAttendance2, ')');

totalEffectiveHours += effectiveDay2;

console.log('\n=== 最终结果 ===');
console.log('总有效工时:', totalEffectiveHours.toFixed(2), '小时');
console.log('界面显示:', '13.42小时');
console.log('差异:', (totalEffectiveHours - 13.42).toFixed(2), '小时');
































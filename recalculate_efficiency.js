// 重新计算效率 - 验证修正后的计算逻辑
console.log('=== 重新计算效率 - 验证修正后的计算逻辑 ===');

// 模拟修正后的时间处理方法
function getExceptionPeriodsForDay(exceptionReports, dateStr) {
  const periods = [];
  
  exceptionReports.forEach(report => {
    if (report.start_time && report.end_time) {
      const reportDate = new Date(report.start_time).toISOString().split('T')[0];
      if (reportDate === dateStr) {
        const startDate = new Date(report.start_time);
        const endDate = new Date(report.end_time);
        
        // 检测是否跨越日期（说明存储的是本地时间但标记为UTC）
        if (endDate.getDate() !== startDate.getDate()) {
          // 跨越日期，说明存储的是本地时间，直接提取时间部分
          const startTime = report.start_time.split('T')[1].substring(0, 5);
          const endTime = report.end_time.split('T')[1].substring(0, 5);
          periods.push({ start: startTime, end: endTime });
        } else {
          // 同一天，使用本地时间处理
          const startTime = startDate.toTimeString().split(' ')[0].substring(0, 5);
          const endTime = endDate.toTimeString().split(' ')[0].substring(0, 5);
          periods.push({ start: startTime, end: endTime });
        }
      }
    }
  });

  return periods;
}

function getOvertimePeriodsForDay(workReports, dateStr) {
  const periods = [];
  
  workReports.forEach(report => {
    if (report.overtime_start_time && report.overtime_end_time) {
      const reportDate = new Date(report.overtime_start_time).toISOString().split('T')[0];
      if (reportDate === dateStr) {
        // 使用本地时间处理
        const startTime = new Date(report.overtime_start_time).toTimeString().split(' ')[0].substring(0, 5);
        const endTime = new Date(report.overtime_end_time).toTimeString().split(' ')[0].substring(0, 5);
        periods.push({ start: startTime, end: endTime });
      }
    }
  });

  return periods;
}

// 重叠计算
function getOverlapHours(start1, end1, start2, end2) {
  const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
  const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));
  
  if (overlapStart >= overlapEnd) return 0;
  
  return (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
}

// 测试数据 - 10月20日
const testData = {
  date: '2025-10-20',
  workTimeSettings: {
    start_time: '08:30',
    end_time: '17:50',
    lunch_start_time: '11:50',
    lunch_end_time: '13:20',
    other_break_start_time: '16:00',
    other_break_end_time: '16:15'
  },
  workReports: [
    { 
      overtime_start_time: '2025-10-20T10:00:00.000Z', // 18:00 本地时间
      overtime_end_time: '2025-10-20T12:00:00.000Z'    // 20:00 本地时间
    }
  ],
  exceptionReports: [
    { 
      start_time: '2025-10-20T08:30:00.000Z', // 08:30 本地时间
      end_time: '2025-10-20T19:50:00.000Z'    // 19:50 本地时间
    }
  ],
  attendanceRecords: [
    {
      date: '2025-10-20',
      actual_hours: 9.58
    }
  ]
};

console.log('测试数据：');
console.log(`日期: ${testData.date}`);
console.log(`作息时间: ${testData.workTimeSettings.start_time} - ${testData.workTimeSettings.end_time}`);
console.log(`加班时间: ${testData.workReports[0].overtime_start_time} - ${testData.workReports[0].overtime_end_time}`);
console.log(`异常时间: ${testData.exceptionReports[0].start_time} - ${testData.exceptionReports[0].end_time}`);
console.log(`实际出勤: ${testData.attendanceRecords[0].actual_hours}h`);
console.log('');

// 1. 获取作息窗口
const workWindows = [
  { start: '08:30', end: '11:50' }, // 上午
  { start: '13:20', end: '16:00' }, // 下午1
  { start: '16:15', end: '17:50' }  // 下午2
];

console.log('作息窗口：');
workWindows.forEach((window, index) => {
  console.log(`${index + 1}. ${window.start} - ${window.end}`);
});
console.log('');

// 2. 获取加班时段
const overtimePeriods = getOvertimePeriodsForDay(testData.workReports, testData.date);
console.log('加班时段：');
overtimePeriods.forEach((period, index) => {
  console.log(`${index + 1}. ${period.start} - ${period.end}`);
});
console.log('');

// 3. 获取异常时段
const exceptionPeriods = getExceptionPeriodsForDay(testData.exceptionReports, testData.date);
console.log('异常时段：');
exceptionPeriods.forEach((period, index) => {
  console.log(`${index + 1}. ${period.start} - ${period.end}`);
});
console.log('');

// 4. 计算阶段时间（全天）
const phaseStart = new Date('2025-10-20T00:00:00.000Z');
const phaseEnd = new Date('2025-10-20T23:59:59.999Z');
console.log('阶段时间：全天 (00:00-24:00)');
console.log('');

// 5. 计算作息时间与阶段的重叠
let totalWorkOverlap = 0;
workWindows.forEach((window, index) => {
  const windowStart = new Date(`2025-10-20T${window.start}:00.000Z`);
  const windowEnd = new Date(`2025-10-20T${window.end}:00.000Z`);
  
  const overlap = getOverlapHours(windowStart, windowEnd, phaseStart, phaseEnd);
  totalWorkOverlap += overlap;
  
  console.log(`作息窗口${index + 1} ${window.start}-${window.end}: 重叠 ${overlap.toFixed(2)}h`);
});

console.log(`\n作息时间总重叠: ${totalWorkOverlap.toFixed(2)}h`);

// 6. 计算加班时间与阶段的重叠
const overtimeStart = new Date('2025-10-20T10:00:00.000Z'); // 18:00 本地时间
const overtimeEnd = new Date('2025-10-20T12:00:00.000Z');   // 20:00 本地时间

const overtimeOverlap = getOverlapHours(overtimeStart, overtimeEnd, phaseStart, phaseEnd);
console.log(`加班时间 18:00-20:00: 重叠 ${overtimeOverlap.toFixed(2)}h`);

// 总计
const totalOverlap = totalWorkOverlap + overtimeOverlap;
console.log(`\n总计重叠: ${totalOverlap.toFixed(2)}h`);

// 7. 计算异常时间扣除
const exceptionStart = new Date('2025-10-20T08:30:00.000Z'); // 08:30 本地时间
const exceptionEnd = new Date('2025-10-20T19:50:00.000Z');   // 19:50 本地时间

console.log('\n=== 异常时间扣除 ===');
console.log('异常时间：08:30-19:50');

// 异常与作息的重叠
let exceptionOverlapWithWork = 0;
workWindows.forEach((window, index) => {
  const windowStart = new Date(`2025-10-20T${window.start}:00.000Z`);
  const windowEnd = new Date(`2025-10-20T${window.end}:00.000Z`);
  
  const overlap = getOverlapHours(exceptionStart, exceptionEnd, windowStart, windowEnd);
  exceptionOverlapWithWork += overlap;
  
  console.log(`作息窗口${index + 1} ${window.start}-${window.end}: 重叠 ${overlap.toFixed(2)}h`);
});

// 异常与加班的重叠
const exceptionOverlapWithOvertime = getOverlapHours(exceptionStart, exceptionEnd, overtimeStart, overtimeEnd);
console.log(`加班时间 18:00-20:00: 重叠 ${exceptionOverlapWithOvertime.toFixed(2)}h`);

const totalExceptionOverlap = exceptionOverlapWithWork + exceptionOverlapWithOvertime;
console.log(`\n异常总扣除: ${totalExceptionOverlap.toFixed(2)}h`);

// 8. 最终结果
const finalOverlap = Math.max(0, totalOverlap - totalExceptionOverlap);
const actualAttendanceHours = testData.attendanceRecords[0].actual_hours;
const dailyResult = Math.min(finalOverlap, actualAttendanceHours);

console.log(`\n=== 最终结果 ===`);
console.log(`计算后重叠: ${finalOverlap.toFixed(2)}h`);
console.log(`实际出勤: ${actualAttendanceHours}h`);
console.log(`当日计入: ${dailyResult.toFixed(2)}h`);

console.log('\n=== 您提到的正确计算 ===');
console.log('10/20：阶段全天；作息=7.58h；加班18:00-20:00=2h；');
console.log('异常8:30-19:50覆盖作息8:30-17:50=7.58h，加班18:00-19:50=1.83h；');
console.log('计入=min(7.58-7.58+2-1.83, 9.58)=min(0.17, 9.58)=0.17h');

console.log('\n=== 验证结果 ===');
console.log(`- 作息重叠: ${totalWorkOverlap.toFixed(2)}h (期望: 7.58h)`);
console.log(`- 加班重叠: ${overtimeOverlap.toFixed(2)}h (期望: 2h)`);
console.log(`- 异常扣除: ${totalExceptionOverlap.toFixed(2)}h (期望: 9.41h)`);
console.log(`- 最终计入: ${dailyResult.toFixed(2)}h (期望: 0.17h)`);

const isCorrect = Math.abs(totalWorkOverlap - 7.58) < 0.01 && 
                  Math.abs(overtimeOverlap - 2) < 0.01 && 
                  Math.abs(totalExceptionOverlap - 9.41) < 0.01 && 
                  Math.abs(dailyResult - 0.17) < 0.01;

console.log(`\n计算结果${isCorrect ? '正确' : '有误'}！`);






































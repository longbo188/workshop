import { Component, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { timeout, catchError } from 'rxjs/operators';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonButtons,
  IonIcon,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonDatetime,
  IonBadge,
  IonChip,
  IonNote,
  IonModal,
  IonSearchbar
} from '@ionic/angular/standalone';
import * as XLSX from 'xlsx';

interface Task {
  id: number;
  name: string;
  description: string;
  product_model: string;
  current_phase: string;
  phase_progress: number;
  start_date: string;
  end_date: string;
  department: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  // 阶段开始时间
  machining_start_time: string | null;
  electrical_start_time: string | null;
  pre_assembly_start_time: string | null;
  post_assembly_start_time: string | null;
  debugging_start_time: string | null;
  // 阶段完成时间
  machining_complete_time: string | null;
  electrical_complete_time: string | null;
  pre_assembly_complete_time: string | null;
  post_assembly_complete_time: string | null;
  debugging_complete_time: string | null;
  // 阶段预估工时
  machining_hours_est: string | null;
  electrical_hours_est: string | null;
  pre_assembly_hours_est: string | null;
  post_assembly_hours_est: string | null;
  debugging_hours_est: string | null;
  // 任务负责人
  machining_assignee: number | null;
  electrical_assignee: number | null;
  pre_assembly_assignee: number | null;
  post_assembly_assignee: number | null;
  debugging_assignee: number | null;
  // 阶段负责人姓名
  machining_assignee_name: string | null;
  electrical_assignee_name: string | null;
  pre_assembly_assignee_name: string | null;
  post_assembly_assignee_name: string | null;
  debugging_assignee_name: string | null;
  // 是否非标
  is_non_standard?: number; // 0=标准，1=非标
}

interface WorkReport {
  id: number;
  task_id: number;
  user_id: number;
  user_name: string;
  work_type: string;
  start_time: string | null;
  end_time: string | null;
  hours_worked: string; // 数据库中的字段名
  quantity_completed: number;
  quality_notes: string | null;
  issues: string | null;
  created_at: string;
  approval_status: string;
  // 为了兼容性，添加别名
  phase?: string;
  actual_hours?: number;
  note?: string;
  // 加班时间段（从考勤记录中获取）
  overtime_start_time?: string;
  overtime_end_time?: string;
}

interface ExceptionReport {
  id: number;
  task_id: number;
  user_id: number;
  user_name: string;
  phase: string;
  exception_type: string;
  description: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  status: string;
  created_at: string;
  // 新增字段用于已批准的异常报告
  exception_start_datetime?: string;
  exception_end_datetime?: string;
  approved_by?: number;
  approved_at?: string;
  approval_note?: string;
}

interface EfficiencyData {
  task: Task;
  phase: string;
  standardHours: number;
  actualWorkHours: number; // 实际出勤时间
  exceptionHours: number;
  assistHours: number; // 协助时间（从有效工时中扣除）
  hasAssistTasks: boolean; // 是否有协助任务标记
  efficiency: number;
  workReports: WorkReport[];
  exceptionReports: ExceptionReport[];
  attendanceRecords: any[]; // 考勤记录
  phaseStartTime: string;
  phaseEndTime: string;
  totalCalendarHours: number; // 日历总时间
  dailyCalculations?: { [date: string]: { totalHours: number; effectiveHours: number; } }; // 单日计算详情
}

interface WorkTimeSettings {
  start_time?: string;
  end_time?: string;
  lunch_start_time?: string;
  lunch_end_time?: string;
  other_break_start_time?: string;
  other_break_end_time?: string;
}

/**
 * 时间处理工具类
 * 统一处理UTC时间、本地时间、时间段等时间相关操作
 */
class TimeUtils {
  /**
   * 将UTC时间字符串转换为本地Date对象
   * @param utcTimeString UTC时间字符串 (如: "2025-10-17T08:20:03.000Z")
   * @returns 本地Date对象
   */
  static utcToLocalDate(utcTimeString: string): Date {
    return new Date(utcTimeString);
  }

  /**
   * 将本地时间字符串转换为Date对象
   * @param localTimeString 本地时间字符串 (如: "2025-10-17 08:20:03")
   * @returns 本地Date对象
   */
  static localToDate(localTimeString: string): Date {
    return new Date(localTimeString);
  }

  /**
   * 创建本地时间的Date对象（用于时间段计算）
   * @param dateStr 日期字符串 (如: "2025-10-17")
   * @param timeStr 时间字符串 (如: "08:30")
   * @returns 本地Date对象
   */
  static createLocalDateTime(dateStr: string, timeStr: string): Date {
    return new Date(`${dateStr}T${timeStr}`);
  }

  /**
   * 获取本地日期字符串 (YYYY-MM-DD格式)
   * @param date Date对象
   * @returns 本地日期字符串
   */
  static getLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 获取本地时间字符串 (HH:MM格式)
   * @param date Date对象
   * @returns 本地时间字符串
   */
  static getLocalTimeString(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * 比较两个时间是否在同一天（本地时间）
   * @param date1 第一个日期
   * @param date2 第二个日期
   * @returns 是否在同一天
   */
  static isSameDay(date1: Date, date2: Date): boolean {
    return this.getLocalDateString(date1) === this.getLocalDateString(date2);
  }

  /**
   * 计算两个时间之间的重叠小时数
   * @param start1 第一个时间段的开始时间
   * @param end1 第一个时间段的结束时间
   * @param start2 第二个时间段的开始时间
   * @param end2 第二个时间段的结束时间
   * @returns 重叠小时数
   */
  static calculateOverlapHours(start1: Date, end1: Date, start2: Date, end2: Date): number {
    const overlapStartTime = Math.max(start1.getTime(), start2.getTime());
    const overlapEndTime = Math.min(end1.getTime(), end2.getTime());
    
    if (overlapStartTime >= overlapEndTime) {
      return 0;
    }
    
    return (overlapEndTime - overlapStartTime) / (1000 * 60 * 60);
  }

  /**
   * 创建包含结束日期整天的结束时间
   * @param endDate 结束日期
   * @returns 结束日期的23:59:59.999
   */
  static createEndOfDay(endDate: Date): Date {
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay;
  }

  /**
   * 验证时间字符串格式
   * @param timeString 时间字符串
   * @param expectedFormat 期望的格式 ('UTC' | 'LOCAL' | 'TIME')
   * @returns 是否有效
   */
  static validateTimeFormat(timeString: string, expectedFormat: 'UTC' | 'LOCAL' | 'TIME'): boolean {
    if (!timeString) return false;
    
    try {
      const date = new Date(timeString);
      if (isNaN(date.getTime())) return false;
      
      switch (expectedFormat) {
        case 'UTC':
          return timeString.includes('Z') || timeString.includes('+');
        case 'LOCAL':
          return !timeString.includes('Z') && !timeString.includes('+') && timeString.includes(' ');
        case 'TIME':
          return /^\d{2}:\d{2}$/.test(timeString);
        default:
          return true;
      }
    } catch {
      return false;
    }
  }

  /**
   * 调试时间信息
   * @param label 标签
   * @param date Date对象
   */
  static debugTime(label: string, date: Date): void {
    console.log(`${label}:`, {
      iso: date.toISOString(),
      local: date.toLocaleString('zh-CN'),
      dateString: this.getLocalDateString(date),
      timeString: this.getLocalTimeString(date),
      timestamp: date.getTime()
    });
  }
}

@Component({
  selector: 'app-efficiency-calc',
  templateUrl: './efficiency-calc.page.html',
  styleUrls: ['./efficiency-calc.page.scss'],
  standalone: true,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonList,
    IonItem,
    IonLabel,
    IonButton,
    IonButtons,
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonSelect,
    IonSelectOption,
    IonInput,
    IonDatetime,
    IonBadge,
    IonChip,
    IonNote,
    IonModal,
    IonSearchbar,
    CommonModule,
    FormsModule,
    RouterLink
  ]
})
export class EfficiencyCalcPage implements OnInit {
  private http = inject(HttpClient);
  private toastController = inject(ToastController);
  
  currentUser: any = null;
  tasks: Task[] = [];
  efficiencyData: EfficiencyData[] = [];
  filteredEfficiencyData: EfficiencyData[] = [];
  loading = false;
  
  // 筛选条件（明细表）
  selectedPhase: string = '';
  selectedUser: string = '';
  selectedModel: string = '';
  startDate: string = ''; // 明细表用：开始日期（按阶段结束时间过滤）
  endDate: string = '';   // 明细表用：结束日期（按阶段结束时间过滤）
  filterMonth: string = ''; // 如后续不再需要“按月份过滤明细”，可逐步废弃
  
  // 月度效率统计用的日期区间（按阶段结束时间）
  monthlyStartDate: string = '';
  monthlyEndDate: string = '';
  
  // 表格筛选条件（明细表表头第二行）
  tableModelFilter: string = ''; // 任务名称栏筛选型号
  tablePhaseFilter: string = ''; // 阶段筛选
  tableAssigneeFilter: string = ''; // 负责人筛选
  tableEfficiencySort: string = ''; // 效率排序
  tableExceptionSort: string = ''; // 异常排序
  
  // 月度汇总表头筛选条件
  monthlyTableEmployeeFilter: string = ''; // 员工筛选
  monthlyTableMonthFilter: string = '';    // 月份筛选（按显示文字模糊匹配）
  monthlyTableEfficiencySort: string = ''; // 效率排序

  // 导出相关状态
  isExportModalOpen = false;
  exportType: 'detail' | 'monthly' = 'detail';
  exportStartDate: string = '';
  exportEndDate: string = '';
  
  // 月度效率结果（按 员工 + 月份 汇总）
  monthlyEfficiencyResults: {
    employee: string;
    monthKey: string;   // '2025-03'
    monthLabel: string; // '2025年3月'
    standardHours: number;
    actualHours: number;
    efficiency: number;
  }[] = [];
  
  // 可用选项
  availableUsers: string[] = [];
  availableModels: string[] = [];

  // 工作时间设置（从后端加载）
  private workTimeSettings: WorkTimeSettings | null = null;
  
  // 节假日数据（用于工作日计算）
  private holidays: Set<string> = new Set(); // 存储节假日日期，格式: "YYYY-MM-DD"

  // 已确认的任务效率（7个工作日前的任务）
  confirmedTasks: Set<string> = new Set(); // 存储已确认的任务，格式: "taskId_phase"
  
  // 防止自动确认时的无限循环
  private isAutoConfirming = false;
  
  // 已确认任务数量（用于界面显示）
  confirmedTasksCount: number = 0;
  
  // 计算过程详情显示控制
  private calculationDetailsVisible = new Map<string, boolean>();
  private dayCalculationDetails = new Map<string, any[]>();
  
  // 异常时间段详情显示控制
  private exceptionDetailsVisible = new Map<string, boolean>();
  
  // 报工记录详情显示控制
  private workReportsDetailsVisible = new Map<string, boolean>();

  // 编辑标准工时相关
  isEditStandardHoursModalOpen = false;
  editingTask: Task | null = null;
  editingPhase: string = '';
  editingStandardHours: number = 0;

  // 显示提示消息
  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'top'
    });
    await toast.present();
  }

  ngOnInit() {
    this.loadCurrentUser();
    // 如果是员工角色，自动设置为查看自己的效率
    if (this.currentUser?.role === 'worker' && this.currentUser?.name) {
      this.selectedUser = this.currentUser.name;
      this.tableAssigneeFilter = this.currentUser.name;
      this.monthlyTableEmployeeFilter = this.currentUser.name;
    }
    this.loadTasks();
    this.loadConfirmedTasks(); // 加载已确认的任务
    // 先加载节假日和工作时间设置，再统计效率
    Promise.all([
      this.loadHolidays(),
      this.loadWorkTimeSettings()
    ]).then(() => {
      this.calculateAllCompletedPhases();
    }).catch((error) => {
      console.error('加载数据失败:', error);
      this.calculateAllCompletedPhases();
    });
  }
  
  // 检查是否是员工角色
  isWorker(): boolean {
    return this.currentUser?.role === 'worker';
  }

  private loadCurrentUser() {
    const userStr = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (userStr) {
      try {
      this.currentUser = JSON.parse(userStr);
        console.log('当前用户信息:', this.currentUser);
        console.log('用户角色:', this.currentUser?.role);
      } catch (error) {
        console.error('解析用户信息失败:', error);
        this.currentUser = null;
      }
    }
  }

  // 检查当前用户是否是管理员
  isAdmin(): boolean {
    if (!this.currentUser) {
      return false;
    }
    const isAdmin = this.currentUser.role === 'admin';
    console.log('isAdmin() 检查结果:', isAdmin, '用户角色:', this.currentUser.role);
    return isAdmin;
  }

  // 加载节假日数据（优先使用GitHub数据源，失败时使用后端API）
  private async loadHolidays(): Promise<void> {
    try {
      // 方案4：优先从GitHub获取节假日数据（NateScarlet/holiday-cn项目）
      const year = new Date().getFullYear();
      try {
        const githubResponse: any = await this.http.get(
          `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`
        ).pipe(
          timeout(5000), // 5秒超时
          catchError(() => {
            throw new Error('GitHub请求超时或失败');
          })
        ).toPromise();
        
        if (githubResponse?.days) {
          // GitHub返回的days是数组格式，不是对象
          const daysArray = Array.isArray(githubResponse.days) 
            ? githubResponse.days 
            : Object.values(githubResponse.days);
          
          // 验证和存储节假日数据
          const holidayEntries = daysArray
            .filter((item: any) => {
              // 确保item是对象且有isOffDay属性
              return item && typeof item === 'object' && item.isOffDay === true;
            })
            .map((item: any) => {
              // 从item对象中提取date和name
              const dateStr = item.date || '';
              const name = item.name || '节假日';
              return { date: dateStr, name: name };
            })
            .filter((h: { date: string; name: string }) => h.date && h.date.length > 0); // 过滤掉无效日期
          
          console.log('处理后的节假日条目示例:', holidayEntries.slice(0, 3));
          
          this.holidays = new Set(holidayEntries.map((h: { date: string; name: string }) => h.date));
          
          // 不再校验“期望值”，以 GitHub 数据为准
          console.log(`已加载 ${this.holidays.size} 个节假日（来自GitHub，${year}年）`);
          console.log('节假日列表:', Array.from(this.holidays).sort());
          return; // 成功获取，直接返回
        } else {
          console.warn('GitHub返回的数据格式不正确，缺少days字段');
          console.warn('返回的数据:', githubResponse);
        }
      } catch (githubError) {
        console.warn('从GitHub获取节假日数据失败，尝试使用后端API:', githubError);
      }
      
      // 备用方案：从后端API获取
      await this.loadHolidaysFromBackend();
    } catch (error) {
      console.error('加载节假日失败:', error);
      this.holidays = new Set(); // 失败时使用空集合，只排除周末
    }
  }

  // 验证节假日数据
  private validateHolidays(holidayEntries: Array<{ date: string; name: string }>, year: number): void {
    console.log('========== 节假日数据验证 ==========');
    console.log(`验证年份: ${year}`);
    console.log(`总节假日数量: ${holidayEntries.length}`);
    
    // 先显示原始数据的前几个，用于调试
    console.log('前5个节假日数据示例:', holidayEntries.slice(0, 5));
    
    // 验证关键节假日（2025年）
    const keyHolidays = [
      { name: '元旦', expectedDates: ['2025-01-01'] },
      { name: '春节', expectedDates: ['2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-01', '2025-02-02', '2025-02-03'] },
      { name: '清明节', expectedDates: ['2025-04-05', '2025-04-06', '2025-04-07'] },
      { name: '劳动节', expectedDates: ['2025-05-01', '2025-05-02', '2025-05-03', '2025-05-04', '2025-05-05'] },
      { name: '端午节', expectedDates: ['2025-06-14'] },
      { name: '中秋节', expectedDates: ['2025-09-15', '2025-09-16', '2025-09-17'] },
      { name: '国庆节', expectedDates: ['2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04', '2025-10-05', '2025-10-06', '2025-10-07'] }
    ];
    
    if (year === 2025) {
      keyHolidays.forEach(holiday => {
        // 改进：使用更精确的名称匹配策略
        // 1. 先尝试完全匹配
        // 2. 再尝试包含匹配（但排除其他节日的干扰）
        let foundEntries = holidayEntries.filter(h => {
          if (!h.name) return false;
          const name = h.name.trim();
          // 完全匹配
          if (name === holiday.name) return true;
          // 包含匹配，但排除其他主要节日
          if (name.includes(holiday.name)) {
            // 排除其他主要节日的干扰
            const otherHolidays = keyHolidays.filter(h => h.name !== holiday.name);
            const isOtherHoliday = otherHolidays.some(oh => name.includes(oh.name));
            return !isOtherHoliday;
          }
          return false;
        });
        
        // 如果名称匹配失败，尝试按日期范围匹配
        if (foundEntries.length === 0) {
          const expectedDateSet = new Set(holiday.expectedDates);
          foundEntries = holidayEntries.filter(h => {
            const dateStr = typeof h.date === 'string' ? h.date : 
              (h.date && typeof h.date === 'object' && 'getFullYear' in h.date) ?
              `${(h.date as Date).getFullYear()}-${String((h.date as Date).getMonth() + 1).padStart(2, '0')}-${String((h.date as Date).getDate()).padStart(2, '0')}` :
              null;
            return dateStr && expectedDateSet.has(dateStr);
          });
        }
        
        const foundDates = foundEntries
          .map(h => {
            // 确保date是字符串格式
            if (typeof h.date === 'string') {
              return h.date;
            } else if (h.date && typeof h.date === 'object' && 'getFullYear' in h.date) {
              const d = h.date as Date;
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            } else {
              // 如果是数字或其他类型，尝试转换
              console.warn(`警告：日期格式异常 - ${holiday.name}:`, h);
              return null;
            }
          })
          .filter((date): date is string => date !== null)
          .sort();
        
        // 检查匹配情况
        const matchedDates = holiday.expectedDates.filter(date => foundDates.includes(date));
        const allFound = matchedDates.length === holiday.expectedDates.length;
        const exactMatch = allFound && foundDates.length === holiday.expectedDates.length;
        
        if (exactMatch) {
          console.log(`✓ ${holiday.name}: 验证通过 (${foundDates.length}天)`);
          console.log(`  日期: ${foundDates.join(', ')}`);
        } else {
          console.warn(`⚠ ${holiday.name}: 验证失败`);
          console.warn(`  期望: ${holiday.expectedDates.join(', ')} (${holiday.expectedDates.length}天)`);
          console.warn(`  实际: ${foundDates.length > 0 ? foundDates.join(', ') : '未找到'} (${foundDates.length}天)`);
          console.warn(`  匹配: ${matchedDates.length}/${holiday.expectedDates.length} 个日期匹配`);
          if (foundEntries.length > 0) {
            console.warn(`  找到的条目名称:`, foundEntries.map(h => h.name).join(', '));
            console.warn(`  找到的条目详情:`, foundEntries.slice(0, 3)); // 只显示前3个
          }
        }
      });
    }
    
    // 显示所有节假日（按日期排序）
    const sortedHolidays = holidayEntries.sort((a: { date: string; name: string }, b: { date: string; name: string }) => {
      const dateA = typeof a.date === 'string' ? a.date : String(a.date);
      const dateB = typeof b.date === 'string' ? b.date : String(b.date);
      return dateA.localeCompare(dateB);
    });
    console.log('\n所有节假日列表:');
    sortedHolidays.forEach((h: { date: string; name: string }) => {
      const dateStr = typeof h.date === 'string' ? h.date : String(h.date);
      console.log(`  ${dateStr} - ${h.name}`);
    });
    
    console.log('=====================================');
  }

  // 从后端API加载节假日数据（备用方案）
  private async loadHolidaysFromBackend(): Promise<void> {
    try {
      const base = this.getApiBase();
      const response: any = await this.http.get(`${base}/api/holidays`).toPromise();
      
      if (response?.success && response?.data) {
        // 只存储非工作日的节假日（is_working_day = false）
        this.holidays = new Set(
          response.data
            .filter((h: any) => !h.is_working_day)
            .map((h: any) => {
              // 确保日期格式为 YYYY-MM-DD
              const date = new Date(h.date);
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            })
        );
        console.log(`已加载 ${this.holidays.size} 个节假日（来自后端API）`);
      } else {
        console.warn('未获取到节假日数据，将只排除周末');
        this.holidays = new Set();
      }
    } catch (error) {
      console.error('从后端API加载节假日失败:', error);
      this.holidays = new Set();
    }
  }

  // 判断日期是否为节假日
  private isHoliday(date: Date): boolean {
    const dateStr = TimeUtils.getLocalDateString(date);
    return this.holidays.has(dateStr);
  }

  // 判断日期是否为工作日（排除周末和节假日）
  private isWorkingDay(date: Date): boolean {
    const dayOfWeek = date.getDay();
    // 0 = 周日, 6 = 周六
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }
    // 检查是否为节假日
    return !this.isHoliday(date);
  }

  // 计算工作日（排除周末和节假日）
  private getWorkingDaysAgo(days: number): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let currentDate = new Date(today);
    let workingDaysCount = 0;
    
    // 向前查找，直到找到指定数量的工作日
    while (workingDaysCount < days) {
      // 使用 isWorkingDay 方法判断是否为工作日
      if (this.isWorkingDay(currentDate)) {
        workingDaysCount++;
      }
      if (workingDaysCount < days) {
        currentDate.setDate(currentDate.getDate() - 1);
      }
    }
    
    return currentDate;
  }

  // 加载已确认的任务（从 localStorage）
  private loadConfirmedTasks(): void {
    try {
      const confirmedStr = localStorage.getItem('confirmedEfficiencyTasks');
      if (confirmedStr) {
        const confirmedArray = JSON.parse(confirmedStr);
        this.confirmedTasks = new Set(confirmedArray);
        this.confirmedTasksCount = this.confirmedTasks.size;
        console.log(`已加载 ${this.confirmedTasksCount} 个已确认的任务`);
      } else {
        this.confirmedTasksCount = 0;
      }
    } catch (error) {
      console.error('加载已确认任务失败:', error);
      this.confirmedTasks = new Set();
      this.confirmedTasksCount = 0;
    }
  }

  // 保存已确认的任务（到 localStorage）
  private saveConfirmedTasks(): void {
    try {
      const confirmedArray = Array.from(this.confirmedTasks);
      localStorage.setItem('confirmedEfficiencyTasks', JSON.stringify(confirmedArray));
    } catch (error) {
      console.error('保存已确认任务失败:', error);
    }
  }

  // 保存已确认任务的数据（到 localStorage）
  private saveConfirmedTasksData(): void {
    try {
      const confirmedData: { [key: string]: EfficiencyData[] } = {};
      let savedCount = 0;
      this.efficiencyData.forEach(data => {
        const key = this.getTaskConfirmKey(data.task.id, data.phase);
        if (this.confirmedTasks.has(key)) {
          if (!confirmedData[key]) {
            confirmedData[key] = [];
          }
          confirmedData[key].push(data);
          savedCount++;
        }
      });
      console.log(`保存已确认任务数据: ${Object.keys(confirmedData).length} 个任务，${savedCount} 条数据`);
      localStorage.setItem('confirmedEfficiencyTasksData', JSON.stringify(confirmedData));
    } catch (error) {
      console.error('保存已确认任务数据失败:', error);
    }
  }

  // 加载已确认任务的数据（从 localStorage）
  private loadConfirmedTasksData(): { [key: string]: EfficiencyData[] } {
    try {
      const confirmedDataStr = localStorage.getItem('confirmedEfficiencyTasksData');
      if (confirmedDataStr) {
        return JSON.parse(confirmedDataStr);
      }
    } catch (error) {
      console.error('加载已确认任务数据失败:', error);
    }
    return {};
  }

  // 判断日期是否在7个工作日之前
  private isBefore7WorkingDays(date: string | null): boolean {
    if (!date) return false;
    
    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);
    const cutoffDate = this.getWorkingDaysAgo(7);
    
    return taskDate < cutoffDate;
  }

  // 获取任务的确认键（taskId_phase）
  private getTaskConfirmKey(taskId: number, phase: string): string {
    return `${taskId}_${phase}`;
  }

  // 检查任务是否已确认（供HTML模板使用）
  isTaskConfirmed(taskId: number, phase: string): boolean {
    const key = this.getTaskConfirmKey(taskId, phase);
    return this.confirmedTasks.has(key);
  }

  // 验证日期输入，限制年份范围
  validateDateInput(event: any, fieldName: string): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    
    if (!value) return;
    
    // 检查日期格式是否正确
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) {
      // 如果格式不正确，尝试修复
      const parts = value.split('-');
      if (parts.length === 3) {
        let year = parts[0];
        // 限制年份为4位数
        if (year.length > 4) {
          year = year.substring(0, 4);
          const month = parts[1] || '01';
          const day = parts[2] || '01';
          const fixedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          input.value = fixedDate;
          
          // 更新对应的模型值
          if (fieldName === 'monthlyStartDate') {
            this.monthlyStartDate = fixedDate;
          } else if (fieldName === 'monthlyEndDate') {
            this.monthlyEndDate = fixedDate;
          } else if (fieldName === 'startDate') {
            this.startDate = fixedDate;
          } else if (fieldName === 'endDate') {
            this.endDate = fixedDate;
          } else if (fieldName === 'exportStartDate') {
            this.exportStartDate = fixedDate;
          } else if (fieldName === 'exportEndDate') {
            this.exportEndDate = fixedDate;
          }
        }
      }
      return;
    }
    
    // 检查年份范围（1900-2099）
    const date = new Date(value);
    const year = date.getFullYear();
    
    if (year < 1900 || year > 2099) {
      // 如果年份超出范围，重置为当前日期
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      input.value = todayStr;
      
      // 更新对应的模型值
      if (fieldName === 'monthlyStartDate') {
        this.monthlyStartDate = todayStr;
      } else if (fieldName === 'monthlyEndDate') {
        this.monthlyEndDate = todayStr;
      } else if (fieldName === 'startDate') {
        this.startDate = todayStr;
      } else if (fieldName === 'endDate') {
        this.endDate = todayStr;
      } else if (fieldName === 'exportStartDate') {
        this.exportStartDate = todayStr;
      } else if (fieldName === 'exportEndDate') {
        this.exportEndDate = todayStr;
      }
      
      this.presentToast('日期年份必须在 1900-2099 范围内');
    }
  }

  // 查看已确认的任务详情
  viewConfirmedTasks() {
    const confirmedList = Array.from(this.confirmedTasks);
    console.log('========== 已确认的任务列表 ==========');
    console.log(`总计: ${confirmedList.length} 个任务阶段`);
    console.log('已确认的任务键值（格式: taskId_phase）:');
    confirmedList.forEach((key, index) => {
      const [taskId, phase] = key.split('_');
      const phaseName = this.getPhaseDisplayName(phase);
      console.log(`  ${index + 1}. 任务ID: ${taskId}, 阶段: ${phaseName} (${key})`);
    });
    console.log('=====================================');
    
    // 从效率数据中查找已确认任务的详细信息
    const confirmedDetails: any[] = [];
    this.efficiencyData.forEach(data => {
      const key = this.getTaskConfirmKey(data.task.id, data.phase);
      if (this.confirmedTasks.has(key)) {
        confirmedDetails.push({
          taskId: data.task.id,
          taskName: data.task.name,
          phase: this.getPhaseDisplayName(data.phase),
          endDate: data.phaseEndTime ? this.formatDate(data.phaseEndTime) : '-',
          efficiency: this.formatEfficiency(data.efficiency)
        });
      }
    });
    
    if (confirmedDetails.length > 0) {
      console.log('\n已确认任务的详细信息:');
      confirmedDetails.forEach((detail, index) => {
        console.log(`  ${index + 1}. [${detail.taskId}] ${detail.taskName} - ${detail.phase}`);
        console.log(`     完工日期: ${detail.endDate}, 效率: ${detail.efficiency}`);
      });
    }
    
    this.presentToast(`已确认 ${confirmedList.length} 个任务阶段，详情请查看控制台`);
  }

  // 清除已确认的任务，恢复所有任务的计算
  async clearConfirmedTasks() {
    try {
      // 清除已确认的任务列表
      this.confirmedTasks.clear();
      this.confirmedTasksCount = 0;
      this.saveConfirmedTasks();
      
      // 清除已确认任务的数据
      localStorage.removeItem('confirmedEfficiencyTasksData');
      
      this.presentToast('已清除所有已确认的任务，将重新计算所有任务');
      
      // 重新计算所有任务
      await this.calculateAllCompletedPhases();
    } catch (error) {
      console.error('清除已确认任务失败:', error);
      this.presentToast('清除已确认任务失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  // 自动确认7个工作日前的任务效率（不显示提示，供内部调用）
  private async autoConfirmOldTasks(silent: boolean = true): Promise<void> {
    // 防止重复调用导致的无限循环
    if (this.isAutoConfirming) {
      console.log('[自动确认] 正在确认中，跳过重复调用');
      return;
    }
    
    this.isAutoConfirming = true;
    try {
      const base = this.getApiBase();
      
      // 确保节假日数据已加载
      if (this.holidays.size === 0) {
        await this.loadHolidays();
      }
      
      // 获取所有任务
      const tasksResponse = await this.http.get<any>(`${base}/api/tasks`).toPromise();
      if (!tasksResponse) {
        if (!silent) {
          this.presentToast('获取任务信息失败');
        }
        return;
      }
      
      const allTasks: Task[] = tasksResponse || [];
      const phases = ['machining', 'electrical', 'pre_assembly', 'post_assembly', 'debugging'];
      
      // 先找出需要确认的任务（7个工作日前的）
      const tasksToConfirm: Array<{ taskId: number; phase: string }> = [];
      for (const phase of phases) {
        // 使用不跳过已确认任务的筛选方法，以便正确统计需要确认的任务
        const completedTasks = this.filterCompletedTasksByPhaseWithoutConfirmation(allTasks, phase);
        
        for (const task of completedTasks) {
          // 获取阶段结束时间
          const phaseEndTime = this.getPhaseEndTime(task, phase);
          
          // 检查是否是7个工作日前的任务
          if (phaseEndTime && this.isBefore7WorkingDays(phaseEndTime)) {
            // 检查是否已经确认过
            const confirmKey = this.getTaskConfirmKey(task.id, phase);
            if (!this.confirmedTasks.has(confirmKey)) {
              tasksToConfirm.push({ taskId: task.id, phase });
            }
          }
        }
      }
      
      if (tasksToConfirm.length === 0) {
        // 没有新任务需要确认
        if (!silent) {
          this.presentToast('没有需要确认的任务');
        }
        return;
      }
      
      // 如果当前没有效率数据，需要先计算
      // 如果已经有数据，说明是刚计算完，直接使用现有数据
      if (this.efficiencyData.length === 0) {
        // 先计算一次所有任务（包括7个工作日前的），确保有数据可以保存
        // 临时移除这些任务的确认标记（如果存在），以便计算它们
        const tempRemovedKeys: string[] = [];
        tasksToConfirm.forEach(({ taskId, phase }) => {
          const key = this.getTaskConfirmKey(taskId, phase);
          if (this.confirmedTasks.has(key)) {
            this.confirmedTasks.delete(key);
            tempRemovedKeys.push(key);
          }
        });
        
        // 计算所有任务（包括即将确认的任务）
        console.log(`[自动确认] 准备计算 ${tasksToConfirm.length} 个待确认任务的数据`);
        await this.calculateAllCompletedPhases();
        console.log(`[自动确认] 计算完成，当前 efficiencyData 数量: ${this.efficiencyData.length}`);
        
        // 恢复临时移除的确认标记
        tempRemovedKeys.forEach(key => {
          this.confirmedTasks.add(key);
        });
      } else {
        console.log(`[自动确认] 使用现有效率数据，当前 efficiencyData 数量: ${this.efficiencyData.length}`);
      }
      
      // 添加新确认的任务
      tasksToConfirm.forEach(({ taskId, phase }) => {
        const key = this.getTaskConfirmKey(taskId, phase);
        this.confirmedTasks.add(key);
      });
      
      // 保存已确认的任务
      this.saveConfirmedTasks();
      
      // 保存已确认任务的数据到 localStorage
      this.saveConfirmedTasksData();
      
      // 更新已确认任务数量
      this.confirmedTasksCount = this.confirmedTasks.size;
      
      if (!silent) {
        this.presentToast(`已自动确认 ${tasksToConfirm.length} 个7个工作日前的任务`);
      } else {
        console.log(`[自动确认] 已确认 ${tasksToConfirm.length} 个7个工作日前的任务`);
      }
    } catch (error) {
      console.error('自动确认任务失败:', error);
      if (!silent) {
        this.presentToast('自动确认任务失败: ' + (error instanceof Error ? error.message : String(error)));
      }
    } finally {
      this.isAutoConfirming = false;
    }
  }


  private getApiBase(): string {
    return 'http://localhost:3000';
  }

  // 获取已批准的异常报告
  async loadApprovedExceptionReports(taskId: number, userId: number, startDate: string, endDate: string, task?: Task): Promise<ExceptionReport[]> {
    try {
      const base = this.getApiBase();
      const params = new URLSearchParams({
        taskId: taskId.toString(),
        userId: userId.toString(),
        startDate: startDate,
        endDate: endDate
      });
      
      const response: any = await this.http.get(`${base}/api/exception-reports/approved?${params}`).toPromise();
      
      if (response.success && response.data) {
        // 转换数据格式以匹配ExceptionReport接口
        return response.data.map((item: any) => {
          // 如果有任务信息，使用更准确的阶段确定逻辑
          const phase = task ? 
            this.determinePhaseFromExceptionTime(item.exception_start_datetime, item.exception_end_datetime, task) :
            this.determinePhaseFromTask(item.task_id);
            
          return {
            id: item.id,
            task_id: item.task_id,
            user_id: item.user_id,
            user_name: item.user_name || '未知用户',
            phase: phase,
            exception_type: item.exception_type,
            description: item.description,
            start_time: item.exception_start_datetime,
            end_time: item.exception_end_datetime,
            duration_hours: this.calculateExceptionDuration(item.exception_start_datetime, item.exception_end_datetime),
            status: item.status,
            created_at: item.submitted_at,
            exception_start_datetime: item.exception_start_datetime,
            exception_end_datetime: item.exception_end_datetime,
            approved_by: item.approved_by,
            approved_at: item.approved_at,
            approval_note: item.approval_note
          };
        });
      }
      
      return [];
    } catch (error) {
      console.error('获取已批准异常报告失败:', error);
      return [];
    }
  }

  // 根据任务ID确定阶段（简化实现，实际可能需要更复杂的逻辑）
  private determinePhaseFromTask(taskId: number): string {
    // 这里需要根据实际业务逻辑来确定阶段
    // 暂时返回一个默认值，实际实现时需要根据任务的具体阶段来确定
    return 'machining'; // 默认返回机加阶段
  }

  // 根据异常时间段和任务阶段时间确定异常属于哪个阶段
  private determinePhaseFromExceptionTime(exceptionStart: string, exceptionEnd: string, task: Task): string {
    if (!exceptionStart || !exceptionEnd) return 'machining';
    
    const exceptionStartTime = new Date(exceptionStart).getTime();
    const exceptionEndTime = new Date(exceptionEnd).getTime();
    
    // 检查各个阶段的时间范围
    const phases = [
      { name: 'machining', start: task.machining_start_time, end: task.machining_complete_time },
      { name: 'electrical', start: task.electrical_start_time, end: task.electrical_complete_time },
      { name: 'pre_assembly', start: task.pre_assembly_start_time, end: task.pre_assembly_complete_time },
      { name: 'post_assembly', start: task.post_assembly_start_time, end: task.post_assembly_complete_time },
      { name: 'debugging', start: task.debugging_start_time, end: task.debugging_complete_time }
    ];
    
    for (const phase of phases) {
      if (phase.start && phase.end) {
        const phaseStartTime = new Date(phase.start).getTime();
        const phaseEndTime = new Date(phase.end).getTime();
        
        // 如果异常时间段与阶段时间段有重叠，则属于该阶段
        if (exceptionStartTime < phaseEndTime && exceptionEndTime > phaseStartTime) {
          return phase.name;
        }
      }
    }
    
    // 如果没有找到匹配的阶段，返回默认阶段
    return 'machining';
  }

  // 计算异常持续时间（小时）
  private calculateExceptionDuration(startDateTime: string, endDateTime: string): number {
    if (!startDateTime || !endDateTime) return 0;
    
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    
    const diffMs = end.getTime() - start.getTime();
    return diffMs / (1000 * 60 * 60); // 转换为小时
  }

  // 计算异常时间段与工作时间的重叠时长
  private calculateExceptionOverlapHours(
    exceptionStart: string, 
    exceptionEnd: string, 
    phaseStartTime: string, 
    phaseEndTime: string,
    workTimeSettings: any,
    attendanceRecords: any[]
  ): number {
    if (!exceptionStart || !exceptionEnd || !phaseStartTime || !phaseEndTime) return 0;
    
    const exceptionStartTime = new Date(exceptionStart);
    const exceptionEndTime = new Date(exceptionEnd);
    const phaseStart = new Date(phaseStartTime);
    const phaseEnd = new Date(phaseEndTime);
    
    if (isNaN(exceptionStartTime.getTime()) || isNaN(exceptionEndTime.getTime())) return 0;
    
    let totalOverlapHours = 0;
    
    // 逐日计算异常时间段与工作时间的重叠
    const endOfLastDay = TimeUtils.createEndOfDay(phaseEnd);
    
    for (let d = new Date(phaseStart); d <= endOfLastDay; d.setDate(d.getDate() + 1)) {
      const currentDay = TimeUtils.getLocalDateString(d);
      
      // 检查异常是否在这一天
      const exceptionDate = TimeUtils.getLocalDateString(exceptionStartTime);
      if (exceptionDate !== currentDay) continue;
      
      // 获取该日的工作窗口
      const workWindows = this.getWorkWindowsForDay(workTimeSettings, currentDay);
      
      // 计算异常时间段与作息时间的重叠
      workWindows.forEach(window => {
        const windowStart = TimeUtils.createLocalDateTime(currentDay, window.start);
        const windowEnd = TimeUtils.createLocalDateTime(currentDay, window.end);
        
        const overlap = TimeUtils.calculateOverlapHours(
          exceptionStartTime,
          exceptionEndTime,
          windowStart,
          windowEnd
        );
        totalOverlapHours += overlap;
      });
      
      // 获取该日的加班时段
      const overtimePeriods = this.getOvertimePeriodsForDay(attendanceRecords, currentDay);
      
      // 计算异常时间段与加班时间的重叠
      overtimePeriods.forEach(overtime => {
        const overtimeStart = TimeUtils.createLocalDateTime(currentDay, overtime.start);
        const overtimeEnd = TimeUtils.createLocalDateTime(currentDay, overtime.end);
        
        const overlap = TimeUtils.calculateOverlapHours(
          exceptionStartTime,
          exceptionEndTime,
          overtimeStart,
          overtimeEnd
        );
        totalOverlapHours += overlap;
      });
    }
    
    return totalOverlapHours;
  }


  async loadTasks() {
    this.loading = true;
    try {
      const base = this.getApiBase();
      const response = await this.http.get<any>(`${base}/api/tasks`).toPromise();
      
      if (response) {
        this.tasks = response || [];
        this.updateAvailableOptions();
      }
    } catch (error) {
      console.error('加载任务失败:', error);
    } finally {
      this.loading = false;
    }
  }

  private async loadWorkTimeSettings(): Promise<WorkTimeSettings | null> {
    try {
      const base = this.getApiBase();
      const response: any = await this.http.get(`${base}/api/work-time-settings`).toPromise();
      if (response?.success && response?.settings) {
        this.workTimeSettings = response.settings as WorkTimeSettings;
        return this.workTimeSettings;
      } else {
        console.error('未找到工作时间设置:', response?.message);
        this.workTimeSettings = null;
        this.presentToast('未找到工作时间设置，请先在考勤管理页面配置工作时间');
        return null;
      }
    } catch (e) {
      console.error('加载工作时间设置失败:', e);
      this.workTimeSettings = null;
      this.presentToast('加载工作时间设置失败，请检查网络连接');
      return null;
    }
  }

  private updateAvailableOptions() {
    // 更新可用用户（从所有阶段负责人获取）
    const users = new Set<string>();
    this.tasks.forEach(task => {
      if (task.machining_assignee_name) {
        users.add(task.machining_assignee_name);
      }
      if (task.electrical_assignee_name) {
        users.add(task.electrical_assignee_name);
      }
      if (task.pre_assembly_assignee_name) {
        users.add(task.pre_assembly_assignee_name);
      }
      if (task.post_assembly_assignee_name) {
        users.add(task.post_assembly_assignee_name);
      }
      if (task.debugging_assignee_name) {
        users.add(task.debugging_assignee_name);
      }
    });
    this.availableUsers = Array.from(users);
    
    // 更新可用型号
    const models = new Set<string>();
    this.tasks.forEach(task => {
      if (task.product_model) {
        models.add(task.product_model);
      }
    });
    this.availableModels = Array.from(models);
  }

  async calculateAllCompletedPhases() {
    this.loading = true;
    try {
      const base = this.getApiBase();
      
      // 获取所有任务
      const tasksResponse = await this.http.get<any>(`${base}/api/tasks`).toPromise();
      if (!tasksResponse) {
        console.error('获取任务信息失败');
        return;
      }
      
      const allTasks: Task[] = tasksResponse || [];
      
      // 在清空数据前，先保存已确认任务的数据到内存和 localStorage
      const confirmedDataMap = new Map<string, EfficiencyData[]>();
      if (this.efficiencyData.length > 0) {
        this.efficiencyData.forEach(data => {
          const key = this.getTaskConfirmKey(data.task.id, data.phase);
          if (this.confirmedTasks.has(key)) {
            if (!confirmedDataMap.has(key)) {
              confirmedDataMap.set(key, []);
            }
            confirmedDataMap.get(key)!.push(data);
          }
        });
        // 保存到 localStorage
        this.saveConfirmedTasksData();
      }
      
      // 从 localStorage 加载已确认任务的数据（如果内存中没有）
      const savedConfirmedData = this.loadConfirmedTasksData();
      console.log('从 localStorage 加载的已确认任务数据:', Object.keys(savedConfirmedData).length, '个任务');
      console.log('已确认任务列表:', Array.from(this.confirmedTasks));
      Object.keys(savedConfirmedData).forEach(key => {
        if (!confirmedDataMap.has(key) && this.confirmedTasks.has(key)) {
          confirmedDataMap.set(key, savedConfirmedData[key]);
          console.log(`从 localStorage 恢复已确认任务数据: ${key}, 数据条数: ${savedConfirmedData[key].length}`);
        } else if (!this.confirmedTasks.has(key)) {
          console.log(`跳过未确认的任务数据: ${key}`);
        } else if (confirmedDataMap.has(key)) {
          console.log(`使用内存中的已确认任务数据: ${key}`);
        }
      });
      console.log('已确认任务数据总数:', confirmedDataMap.size);
      
      // 计算所有阶段（只要该阶段为1且存在开始和结束时间）
      this.efficiencyData = [];
      const phases = ['machining', 'electrical', 'pre_assembly', 'post_assembly', 'debugging'];
      
      for (const phase of phases) {
        try {
          
          const completedTasks = this.filterCompletedTasksByPhase(allTasks, phase);
          
          
          // 检查任务846和1493是否在筛选结果中
          const task846 = completedTasks.find(task => task.id === 846);
          const task1493 = completedTasks.find(task => task.id === 1493);
          if (task846) {
            console.log(`✓ 任务846 (${task846.name}) 被筛选出来用于${this.getPhaseDisplayName(phase)}计算`);
            console.log(`  机加负责人ID: ${task846.machining_assignee}`);
            console.log(`  电气负责人ID: ${task846.electrical_assignee}`);
          } else {
            
          }
          if (task1493) {
            console.log(`✓ 任务1493 (${task1493.name}) 被筛选出来用于${this.getPhaseDisplayName(phase)}计算`);
            console.log(`  机加负责人ID: ${task1493.machining_assignee}`);
            console.log(`  电气负责人ID: ${task1493.electrical_assignee}`);
          } else {
            
          }
        
          for (const task of completedTasks) {
            try {
              // 特别跟踪任务846和1493
              if (task.id === 846 || task.id === 1493) {
                console.log(`开始处理任务${task.id} (${task.name}) 的 ${phase} 阶段效率计算`);
              }
              
              // 特别跟踪任务1421
              if (task.id === 1421) {
                console.log(`=== 任务1421负责人信息调试 ===`);
                console.log(`任务ID: ${task.id}`);
                console.log(`任务名称: ${task.name}`);
                console.log(`当前阶段: ${phase}`);
                console.log(`machining_assignee: ${task.machining_assignee}`);
                console.log(`electrical_assignee: ${task.electrical_assignee}`);
              }
              
              // 获取任务负责人ID
              let taskAssigneeId: number | null = null;
              if (phase === 'machining' && task.machining_assignee) {
                taskAssigneeId = task.machining_assignee;
              } else if (phase === 'electrical' && task.electrical_assignee) {
                taskAssigneeId = task.electrical_assignee;
              } else if (phase === 'pre_assembly' && task.pre_assembly_assignee) {
                taskAssigneeId = task.pre_assembly_assignee;
              } else if (phase === 'post_assembly' && task.post_assembly_assignee) {
                taskAssigneeId = task.post_assembly_assignee;
              } else if (phase === 'debugging' && task.debugging_assignee) {
                taskAssigneeId = task.debugging_assignee;
              }
              
              // 如果阶段负责人为空，跳过此任务
              if (!taskAssigneeId) {
                console.log(`任务${task.id}没有分配阶段负责人，跳过`);
                continue;
              }
              
              // 特别跟踪任务1421的最终负责人ID
              if (task.id === 1421) {
                console.log(`任务1421最终使用的负责人ID: ${taskAssigneeId}`);
              }
              
              const workReportsResponse = await this.http.get<any>(`${base}/api/work-reports/by-task/${task.id}`).toPromise();
              const workReports: WorkReport[] = workReportsResponse || [];
              
              if (task.id === 846 || task.id === 1493) {
                console.log(`任务${task.id}的报工记录数量: ${workReports.length}`);
              }
              
              const exceptionResponse = await this.http.get<any>(`${base}/api/exception-reports/by-task/${task.id}`).toPromise();
              const rawExceptionReports = exceptionResponse || [];
              
              // 确保异常报告有正确的phase字段
              const exceptionReports: ExceptionReport[] = rawExceptionReports.map((report: any) => ({
                ...report,
                phase: report.phase || phase // 如果没有phase字段，使用当前计算的阶段
              }));
              
              if (task.id === 846 || task.id === 1493) {
                console.log(`任务${task.id}的异常报告数量: ${exceptionReports.length}`);
                console.log(`任务${task.id}的异常报告详情:`, exceptionReports.map(ex => ({
                  id: ex.id,
                  phase: ex.phase,
                  exception_type: ex.exception_type,
                  user_name: ex.user_name,
                  duration_hours: ex.duration_hours,
                  status: ex.status
                })));
              }
              
              // 获取阶段时间范围内的考勤记录
              const phaseStartTime = this.getPhaseStartTime(task, phase);
              const phaseEndTime = this.getPhaseEndTime(task, phase);
              
              if (!phaseStartTime || !phaseEndTime) {
                console.log(`任务${task.id}的${phase}阶段时间不完整，跳过`);
                continue;
              }
              
              // 计算阶段时间范围（转换为日期格式）
              const startLocal = new Date(phaseStartTime);
              const endLocal = new Date(phaseEndTime);
              const startDate = `${startLocal.getFullYear()}-${String(startLocal.getMonth() + 1).padStart(2, '0')}-${String(startLocal.getDate()).padStart(2, '0')}`;
              const endDate = `${endLocal.getFullYear()}-${String(endLocal.getMonth() + 1).padStart(2, '0')}-${String(endLocal.getDate()).padStart(2, '0')}`;
              
              // 构建API URL，只有当taskAssigneeId不为null时才添加userId参数
              let apiUrl = `${base}/api/daily-attendance?start=${startDate}&end=${endDate}&pageSize=1000`;
              if (taskAssigneeId !== null) {
                apiUrl += `&userId=${taskAssigneeId}`;
              }
              const attendanceResponse = await this.http.get<any>(apiUrl).toPromise();
              const allAttendanceRecords = attendanceResponse?.list || [];
              
              if (task.id === 846) {
                console.log(`任务846的考勤记录总数: ${allAttendanceRecords.length}`);
              }
              
              const taskEfficiencyData = await this.calculateTaskEfficiencyWithAttendance(
                task, workReports, exceptionReports, allAttendanceRecords, phase
              );
              
              if (task.id === 846) {
                console.log(`任务846的效率数据数量: ${taskEfficiencyData.length}`);
                if (taskEfficiencyData.length > 0) {
                  console.log(`任务846的效率数据:`, taskEfficiencyData[0]);
                }
              }
              
              // 任务182详细调试
              if (task.id === 182) {
                console.log(`\n========== 任务182效率计算详细过程 ==========`);
                console.log(`阶段: ${phase}`);
                console.log(`负责人ID: ${taskAssigneeId}`);
                console.log(`报工记录数量: ${workReports.length}`);
                console.log(`异常报告数量: ${exceptionReports.length}`);
                console.log(`考勤记录总数: ${allAttendanceRecords.length}`);
                console.log(`效率数据数量: ${taskEfficiencyData.length}`);
                if (taskEfficiencyData.length > 0) {
                  console.log(`效率数据详情:`, JSON.stringify(taskEfficiencyData[0], null, 2));
                }
                console.log(`==========================================\n`);
              }
              
              this.efficiencyData.push(...taskEfficiencyData);
            } catch (error) {
              console.error(`统计任务 ${task.id} 的 ${phase} 阶段效率失败:`, error);
              if (task.id === 846) {
                console.error(`任务846效率计算失败详情:`, error);
              }
            }
          }
          
          
        } catch (error) {
          console.error(`处理 ${this.getPhaseDisplayName(phase)} 阶段时发生错误:`, error);
        }
      }
      
      // 恢复已确认任务的数据（保留之前计算的结果，不再重新计算）
      let restoredCount = 0;
      confirmedDataMap.forEach((dataArray, key) => {
        // 只要任务已确认，就保留数据（不管是否还是7个工作日前的）
        const [taskIdStr, phase] = key.split('_');
        const taskId = parseInt(taskIdStr, 10);
        if (this.isTaskConfirmed(taskId, phase)) {
          // 任务已确认，保留数据
          this.efficiencyData.push(...dataArray);
          restoredCount += dataArray.length;
          console.log(`恢复已确认任务 ${key} 的数据，${dataArray.length} 条`);
        }
      });
      console.log(`总共恢复了 ${restoredCount} 条已确认任务的数据`);
      
      // 保存已确认任务的数据到 localStorage（确保数据持久化）
      if (confirmedDataMap.size > 0) {
        this.saveConfirmedTasksData();
      }
      
    } catch (error) {
      console.error('统计效率失败:', error);
    } finally {
      this.loading = false;
      // 计算完成后应用筛选
      this.applyFilters();
      
      // 自动确认7个工作日前的任务（静默模式，不显示提示）
      // 使用 setTimeout 避免阻塞 UI，并在下一个事件循环中执行
      setTimeout(() => {
        this.autoConfirmOldTasks(true).catch(err => {
          console.error('自动确认任务失败:', err);
        });
      }, 100);
    }
  }

  async calculateEfficiency() {
    if (!this.selectedPhase) {
      alert('请选择要统计效率的阶段');
      return;
    }

    this.loading = true;
    try {
      const base = this.getApiBase();
      
      // 获取所有任务
      const tasksResponse = await this.http.get<any>(`${base}/api/tasks`).toPromise();
      if (!tasksResponse) {
        alert('获取任务信息失败');
        return;
      }
      
      const allTasks: Task[] = tasksResponse || [];
      
      // 添加调试信息
      console.log(`获取到的任务总数: ${allTasks.length}`);
      const task1493 = allTasks.find(task => task.id === 1493);
      if (task1493) {
        console.log(`任务1493在任务列表中:`, {
          id: task1493.id,
          name: task1493.name,
          machining_start_time: task1493.machining_start_time,
          machining_complete_time: task1493.machining_complete_time
        });
      } else {
        console.log(`任务1493不在任务列表中`);
      }
      
      // 筛选今天以前已完成指定阶段的任务
      const completedTasks = this.filterCompletedTasksByPhase(allTasks, this.selectedPhase);
      
      if (completedTasks.length === 0) {
        alert(`没有找到已完成${this.getPhaseDisplayName(this.selectedPhase)}的任务`);
        this.loading = false;
        return;
      }
      
      // 加载已确认任务的缓存数据
      const savedConfirmedData = this.loadConfirmedTasksData();
      const confirmedDataMap = new Map<string, EfficiencyData[]>();
      
      // 从内存中获取已确认任务的数据
      if (this.efficiencyData.length > 0) {
        this.efficiencyData.forEach(data => {
          const key = this.getTaskConfirmKey(data.task.id, data.phase);
          if (this.confirmedTasks.has(key)) {
            if (!confirmedDataMap.has(key)) {
              confirmedDataMap.set(key, []);
            }
            confirmedDataMap.get(key)!.push(data);
          }
        });
      }
      
      // 从 localStorage 加载已确认任务的数据
      Object.keys(savedConfirmedData).forEach(key => {
        if (!confirmedDataMap.has(key) && this.confirmedTasks.has(key)) {
          confirmedDataMap.set(key, savedConfirmedData[key]);
        }
      });
      
      // 分离已确认和未确认的任务
      const confirmedTasks: Task[] = [];
      const unconfirmedTasks: Task[] = [];
      
      completedTasks.forEach(task => {
        const key = this.getTaskConfirmKey(task.id, this.selectedPhase);
        if (this.confirmedTasks.has(key) && confirmedDataMap.has(key)) {
          confirmedTasks.push(task);
        } else {
          unconfirmedTasks.push(task);
        }
      });
      
      console.log(`已确认任务: ${confirmedTasks.length} 个，未确认任务: ${unconfirmedTasks.length} 个`);
      
      // 初始化效率数据数组
      this.efficiencyData = [];
      
      // 直接使用已确认任务的缓存数据
      confirmedTasks.forEach(task => {
        const key = this.getTaskConfirmKey(task.id, this.selectedPhase);
        const cachedData = confirmedDataMap.get(key);
        if (cachedData) {
          this.efficiencyData.push(...cachedData);
          console.log(`使用缓存数据: 任务${task.id}的${this.selectedPhase}阶段`);
        }
      });
      
      // 只对未确认的任务进行API调用和计算（使用分批并行处理优化性能）
      if (unconfirmedTasks.length > 0) {
        // 分批处理，每批15个任务并行处理，避免浏览器并发限制和服务器压力过大
        const batchSize = 15;
        const batches: Task[][] = [];
        for (let i = 0; i < unconfirmedTasks.length; i += batchSize) {
          batches.push(unconfirmedTasks.slice(i, i + batchSize));
        }
        
        console.log(`需要重新计算的任务: ${unconfirmedTasks.length}个，分为${batches.length}批处理，每批${batchSize}个任务`);
        
        // 逐批处理
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          console.log(`正在处理第 ${batchIndex + 1}/${batches.length} 批，包含 ${batch.length} 个任务`);
          
          // 并行处理当前批次的所有任务
          const batchPromises = batch.map(async (task) => {
          try {
            // 获取任务负责人ID
            let taskAssigneeId: number | null = null;
            if (this.selectedPhase === 'machining' && task.machining_assignee) {
              taskAssigneeId = task.machining_assignee;
            } else if (this.selectedPhase === 'electrical' && task.electrical_assignee) {
              taskAssigneeId = task.electrical_assignee;
            } else if (this.selectedPhase === 'pre_assembly' && task.pre_assembly_assignee) {
              taskAssigneeId = task.pre_assembly_assignee;
            } else if (this.selectedPhase === 'post_assembly' && task.post_assembly_assignee) {
              taskAssigneeId = task.post_assembly_assignee;
            } else if (this.selectedPhase === 'debugging' && task.debugging_assignee) {
              taskAssigneeId = task.debugging_assignee;
            }
            
            // 如果阶段负责人为空，跳过此任务
            if (!taskAssigneeId) {
              console.log(`任务${task.id}没有分配阶段负责人，跳过`);
              return [];
            }
            
            // 并行获取三个API的数据
            const [workReportsResponse, exceptionResponse, attendanceResponse] = await Promise.all([
              this.http.get<any>(`${base}/api/work-reports/by-task/${task.id}`).toPromise().catch(err => {
                console.error(`获取任务${task.id}的报工记录失败:`, err);
                return [];
              }),
              this.http.get<any>(`${base}/api/exception-reports/by-task/${task.id}`).toPromise().catch(err => {
                console.error(`获取任务${task.id}的异常报告失败:`, err);
                return [];
              }),
              (async () => {
                // 获取阶段时间范围内的考勤记录
                const phaseStartTime = this.getPhaseStartTime(task, this.selectedPhase);
                const phaseEndTime = this.getPhaseEndTime(task, this.selectedPhase);
                
                if (phaseStartTime && phaseEndTime) {
                  // 计算阶段时间范围（转换为日期格式）
                  const startLocal = new Date(phaseStartTime);
                  const endLocal = new Date(phaseEndTime);
                  const startDate = `${startLocal.getFullYear()}-${String(startLocal.getMonth() + 1).padStart(2, '0')}-${String(startLocal.getDate()).padStart(2, '0')}`;
                  const endDate = `${endLocal.getFullYear()}-${String(endLocal.getMonth() + 1).padStart(2, '0')}-${String(endLocal.getDate()).padStart(2, '0')}`;
                  
                  // 构建API URL，只有当taskAssigneeId不为null时才添加userId参数
                  let apiUrl = `${base}/api/daily-attendance?start=${startDate}&end=${endDate}&pageSize=1000`;
                  if (taskAssigneeId !== null) {
                    apiUrl += `&userId=${taskAssigneeId}`;
                  }
                  
                  try {
                    const response = await this.http.get<any>(apiUrl).toPromise();
                    return response?.list || [];
                  } catch (err) {
                    console.error(`获取任务${task.id}的考勤记录失败:`, err);
                    return [];
                  }
                }
                return [];
              })()
            ]);
            
            const workReports: WorkReport[] = workReportsResponse || [];
            const rawExceptionReports = exceptionResponse || [];
            
            // 确保异常报告有正确的phase字段
            const exceptionReports: ExceptionReport[] = rawExceptionReports.map((report: any) => ({
              ...report,
              phase: report.phase || this.selectedPhase // 如果没有phase字段，使用当前选择的阶段
            }));
            
            const allAttendanceRecords: any[] = attendanceResponse || [];
            
            // 添加调试信息
            if (task.id === 1493) {
              console.log(`任务1493考勤记录获取调试:`, {
                phaseStartTime: this.getPhaseStartTime(task, this.selectedPhase),
                phaseEndTime: this.getPhaseEndTime(task, this.selectedPhase),
                attendanceRecordsCount: allAttendanceRecords.length,
                attendanceRecords: allAttendanceRecords.map(rec => ({
                  id: rec.id,
                  user_id: rec.user_id,
                  date: rec.date,
                  actual_hours: rec.actual_hours,
                  is_confirmed: rec.is_confirmed
                }))
              });
            }
            
            // 统计该任务的效率
            const taskEfficiencyData = await this.calculateTaskEfficiencyWithAttendance(
              task, workReports, exceptionReports, allAttendanceRecords, this.selectedPhase
            );
            return taskEfficiencyData;
          } catch (error) {
            console.error(`统计任务 ${task.id} 效率失败:`, error);
            return [];
          }
        });
        
        // 等待当前批次所有任务完成（使用 allSettled 避免部分失败导致全部失败）
        const batchResults = await Promise.allSettled(batchPromises);
        
        // 处理批次结果
        batchResults.forEach((result: PromiseSettledResult<EfficiencyData[]>, index: number) => {
          if (result.status === 'fulfilled') {
            this.efficiencyData.push(...result.value);
          } else {
            const task = batch[index];
            console.error(`批次中任务 ${task?.id} 处理失败:`, result.reason);
          }
        });
        
        // 移除延迟，加快处理速度
        // 批次之间不再添加延迟，连续处理以提高性能
      }
      } else {
        console.log(`所有任务都已确认，直接使用缓存数据，无需重新计算`);
      }
      
      console.log(`效率统计完成，共 ${this.efficiencyData.length} 条效率数据（其中 ${confirmedTasks.length} 个任务使用缓存，${unconfirmedTasks.length} 个任务重新计算）`);
      
    } catch (error) {
      console.error('统计效率失败:', error);
      alert('统计效率失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      this.loading = false;
    }
  }

  private async calculateTaskEfficiencyWithAttendance(
    task: Task, 
    workReports: WorkReport[], 
    exceptionReports: ExceptionReport[], 
    allAttendanceRecords: any[],
    targetPhase?: string
  ): Promise<EfficiencyData[]> {
    const efficiencyMap = new Map<string, EfficiencyData>();
    
    // 使用传入的阶段或当前选择的阶段
    const phase = (targetPhase || this.selectedPhase) as string;
    
    // 获取任务负责人ID
    let taskAssigneeId: number | null = null;
    if (phase === 'machining' && task.machining_assignee) {
      taskAssigneeId = task.machining_assignee;
    } else if (phase === 'electrical' && task.electrical_assignee) {
      taskAssigneeId = task.electrical_assignee;
    } else if (phase === 'pre_assembly' && task.pre_assembly_assignee) {
      taskAssigneeId = task.pre_assembly_assignee;
    } else if (phase === 'post_assembly' && task.post_assembly_assignee) {
      taskAssigneeId = task.post_assembly_assignee;
    } else if (phase === 'debugging' && task.debugging_assignee) {
      taskAssigneeId = task.debugging_assignee;
    }
    
    // 如果阶段负责人为空，返回空结果
    if (!taskAssigneeId) {
      console.log(`任务${task.id}没有分配阶段负责人，无法计算效率`);
      return [];
    }
    
    // 特别跟踪任务846
    if (task.id === 846) {
      console.log(`任务846进入calculateTaskEfficiencyWithAttendance方法，阶段: ${phase}`);
    }
    
    // 任务182详细调试
    if (task.id === 182) {
      console.log(`\n--- 任务182进入calculateTaskEfficiencyWithAttendance方法 ---`);
      console.log(`阶段: ${phase}`);
      console.log(`任务负责人ID: ${taskAssigneeId}`);
      console.log(`报工记录数量: ${workReports.length}`);
      console.log(`异常报告数量: ${exceptionReports.length}`);
      console.log(`考勤记录总数: ${allAttendanceRecords.length}`);
    }
    
    // 获取阶段开始和结束时间
    const phaseStartTime = this.getPhaseStartTime(task, phase);
    const phaseEndTime = this.getPhaseEndTime(task, phase);
    
    if (task.id === 846) {
      console.log(`任务846的阶段时间 - 开始: ${phaseStartTime}, 结束: ${phaseEndTime}`);
    }
    
    // 任务182阶段时间调试
    if (task.id === 182) {
      console.log(`任务182的阶段时间 - 开始: ${phaseStartTime}, 结束: ${phaseEndTime}`);
    }
    
    // 添加任务1493的调试日志
    if (task.id === 1493) {
      console.log(`任务1493的阶段时间 - 开始: ${phaseStartTime}, 结束: ${phaseEndTime}`);
      console.log(`任务1493原始数据 - machining_start_time: ${task.machining_start_time}, machining_complete_time: ${task.machining_complete_time}`);
    }
    
    
    // 获取已批准的异常报告
    let approvedExceptionReports: ExceptionReport[] = [];
    if (taskAssigneeId && phaseStartTime && phaseEndTime) {
      try {
        approvedExceptionReports = await this.loadApprovedExceptionReports(
          task.id, 
          taskAssigneeId, 
          phaseStartTime, 
          phaseEndTime,
          task
        );
      } catch (error) {
        console.error('获取已批准异常报告失败:', error);
      }
    }
    
    // 合并异常报告（原有的 + 已批准的）
    const allExceptionReports = [...exceptionReports, ...approvedExceptionReports];
    
    if (!phaseStartTime || !phaseEndTime) {
      console.log(`任务 ${task.id} 的 ${phase} 阶段缺少时间数据，跳过计算`);
      if (task.id === 846) {
        console.log(`任务846被跳过，原因：缺少时间数据`);
      }
      return [];
    }
    
    // 计算日历总时间
    const totalCalendarHours = this.calculateCalendarHours(phaseStartTime, phaseEndTime);
    
    // 特别调试任务1421
    if (task.id === 1421) {
    
    }
    
    // 如果没有分配用户，使用第一个有考勤记录的用户（用于测试）
    if (!taskAssigneeId && allAttendanceRecords.length > 0) {
      taskAssigneeId = allAttendanceRecords[0].user_id;
      if (task.id === 846) {
        console.log(`任务846使用默认用户ID: ${taskAssigneeId}`);
      }
    }
    
    if (task.id === 846) {
      console.log(`任务846的分配信息检查:`);
      console.log(`  machining_assignee: ${task.machining_assignee}`);
      console.log(`  electrical_assignee: ${task.electrical_assignee}`);
      console.log(`  最终使用的taskAssigneeId: ${taskAssigneeId}`);
    }
    
    if (!taskAssigneeId) {
      if (task.id === 846) {
        console.log(`任务846被跳过：没有找到负责人ID`);
      }
      return [];
    }
    
    if (task.id === 846) {
      console.log(`任务846最终使用的负责人ID: ${taskAssigneeId}`);
    }
    
    // 筛选该员工在阶段期间的考勤记录
    const attendanceRecords = this.getAttendanceRecordsForPeriod(
      allAttendanceRecords, 
      taskAssigneeId, 
      phaseStartTime, 
      phaseEndTime
    );
    
    if (task.id === 846) {
      console.log(`任务846的考勤记录筛选结果:`, attendanceRecords);
      console.log(`任务846筛选到的考勤记录数量: ${attendanceRecords.length}`);
    }
    
    // 特别调试任务1421的考勤记录
    if (task.id === 1421) {
      console.log(`=== 任务1421考勤记录调试 ===`);
      console.log(`API返回的原始考勤记录数量: ${allAttendanceRecords.length}`);
      console.log(`API返回的原始考勤记录:`, allAttendanceRecords.map(rec => ({
        id: rec.id,
        user_id: rec.user_id,
        date: rec.date,
        actual_hours: rec.actual_hours,
        is_confirmed: rec.is_confirmed
      })));
      console.log(`筛选后的考勤记录数量: ${attendanceRecords.length}`);
      console.log(`筛选后的考勤记录详情:`, attendanceRecords.map(rec => ({
        id: rec.id,
        user_id: rec.user_id,
        date: rec.date,
        actual_hours: rec.actual_hours,
        is_confirmed: rec.is_confirmed
      })));
    }
    
    // 获取工作时段设置
    const workTimeSettings = await this.loadWorkTimeSettings();
    if (!workTimeSettings) {
      console.error('无法加载工作时间设置，跳过效率计算');
      return [{
        task: task,
        phase: phase,
        standardHours: 0,
        actualWorkHours: 0,
        exceptionHours: 0,
        assistHours: 0,
        hasAssistTasks: false,
        efficiency: 0,
        workReports: workReports,
        exceptionReports: allExceptionReports,
        attendanceRecords: attendanceRecords,
        phaseStartTime: phaseStartTime,
        phaseEndTime: phaseEndTime,
        totalCalendarHours: 0
      }];
    }
    
    // 计算实际出勤时间（使用完整的作息+加班+请假+异常逻辑）
    const workHoursResult = await this.calculateActualWorkHoursWithShifts(
      attendanceRecords, 
      phaseStartTime, 
      phaseEndTime, 
      workTimeSettings,
      allExceptionReports
    );
    const actualWorkHours = workHoursResult.totalHours;
    const dailyCalculations = workHoursResult.dailyCalculations;
    
    if (task.id === 846) {
      console.log(`任务846的实际工作小时数: ${actualWorkHours}`);
      console.log('阶段总时间对比(考勤 vs 日历):', {
        phase,
        actualWorkHours,
        totalCalendarHours
      });
    }
    
    // 任务182实际工作小时调试
    if (task.id === 182) {
      console.log(`\n--- 任务182实际工作小时计算结果 ---`);
      console.log(`实际工作小时总数: ${actualWorkHours}`);
      console.log(`日历总小时数: ${totalCalendarHours}`);
      console.log(`逐日计算详情:`, JSON.stringify(dailyCalculations, null, 2));
      console.log(`考勤记录详情:`, attendanceRecords.map(rec => ({
        date: rec.date,
        actual_hours: rec.actual_hours,
        standard_attendance_hours: rec.standard_attendance_hours,
        overtime_hours: rec.overtime_hours,
        leave_hours: rec.leave_hours,
        exception_minutes: rec.exception_minutes,
        is_confirmed: rec.is_confirmed
      })));
      console.log(`异常报告详情:`, allExceptionReports.map(ex => ({
        id: ex.id,
        start_time: ex.start_time,
        end_time: ex.end_time,
        duration_hours: ex.duration_hours,
        status: ex.status,
        phase: ex.phase
      })));
    }
    
    // 确保为当前阶段创建效率数据，即使没有报工记录
    if (!efficiencyMap.has(phase)) {
      efficiencyMap.set(phase, {
        task: task,
        phase: phase,
        standardHours: 0,
        actualWorkHours: 0,
        exceptionHours: 0,
        assistHours: 0,
        hasAssistTasks: false,
        efficiency: 0,
        workReports: [],
        exceptionReports: [],
        attendanceRecords: [],
        phaseStartTime: phaseStartTime,
        phaseEndTime: phaseEndTime,
        totalCalendarHours: totalCalendarHours
      });
    }
    
    // 按阶段分组计算
    workReports.forEach(report => {
      // 由于数据库中没有phase字段，我们假设所有报工记录都属于当前选择的阶段
      const reportPhase = phase;
      
      // 只处理指定阶段的报工记录
      if (reportPhase === phase) {
        const efficiency = efficiencyMap.get(phase)!;
        efficiency.workReports.push(report);
        // 使用hours_worked字段
        efficiency.actualWorkHours += parseFloat(report.hours_worked) || 0;
      }
    });
    
    // 添加异常时间
    if (task.id === 1493) {
      console.log(`任务1493的异常报告筛选调试:`, {
        phase,
        allExceptionReportsCount: allExceptionReports.length,
        allExceptionReports: allExceptionReports.map(ex => ({
          id: ex.id,
          phase: ex.phase,
          exception_type: ex.exception_type,
          user_name: ex.user_name,
          duration_hours: ex.duration_hours
        }))
      });
    }
    
    allExceptionReports.forEach(exception => {
      const exceptionPhase = exception.phase;
      
      if (task.id === 1493) {
        console.log(`任务1493异常报告检查:`, {
          exceptionId: exception.id,
          exceptionPhase,
          targetPhase: phase,
          matches: exceptionPhase === phase
        });
      }
      
      if (exceptionPhase === phase && efficiencyMap.has(phase)) {
        const efficiency = efficiencyMap.get(phase)!;
        efficiency.exceptionReports.push(exception);
        
        // 计算异常时间段与工作时间的重叠时长
        const startTime = exception.start_time || exception.exception_start_datetime;
        const endTime = exception.end_time || exception.exception_end_datetime;
        let durationHours = 0;
        
        if (startTime && endTime) {
          // 使用重叠计算方法
          durationHours = this.calculateExceptionOverlapHours(
            startTime,
            endTime,
            phaseStartTime,
            phaseEndTime,
            workTimeSettings,
            attendanceRecords
          );
        } else if (typeof exception.duration_hours === 'number') {
          // 如果没有时间段但有duration_hours，使用原值
          durationHours = exception.duration_hours;
        } else if (exception.duration_hours) {
          // 如果duration_hours是字符串，解析为数字
          durationHours = parseFloat(exception.duration_hours) || 0;
        }
        efficiency.exceptionHours += durationHours;
        
        if (task.id === 1493) {
          console.log(`任务1493异常报告已添加:`, {
            exceptionId: exception.id,
            originalDurationHours: exception.duration_hours,
            startTime: exception.start_time || exception.exception_start_datetime,
            endTime: exception.end_time || exception.exception_end_datetime,
            calculatedDurationHours: durationHours,
            totalExceptionHours: efficiency.exceptionHours,
            calculationMethod: 'overlap_with_work_time'
          });
        }
      }
    });
    
    // 查询协助记录（该用户在该阶段时间范围内协助其他任务/其他阶段的记录）
    let assistReports: any[] = [];
    try {
      const base = this.getApiBase();
      const startDateStr = TimeUtils.getLocalDateString(new Date(phaseStartTime));
      const endDateStr = TimeUtils.getLocalDateString(new Date(phaseEndTime));
      
      // 查询该用户在该时间段内的所有报工记录
      // 对于协助记录，使用 workType=assist 参数，后端会使用 assist_start/assist_end 来过滤
      const workRecordsResponse = await this.http.get<any[]>(
        `${base}/api/work-records?userId=${taskAssigneeId}&start=${startDateStr}&end=${endDateStr}&workType=assist`
      ).toPromise();
      
      if (workRecordsResponse) {
        // 过滤出协助记录（work_type='assist'），且排除协助当前任务当前阶段的记录
        assistReports = workRecordsResponse.filter((record: any) => {
          return record.work_type === 'assist' 
            && record.approval_status === 'approved'
            && !(record.task_id === task.id && record.assist_phase === phase);
        });
      }
    } catch (error) {
      console.error('查询协助记录失败:', error);
      // 如果查询失败，继续计算，只是不扣除协助时间
    }
    
    // 计算协助时间
    let totalAssistHours = 0;
    let hasAssistTasks = false;
    for (const assistReport of assistReports) {
      // 协助记录可能有 assist_start 和 assist_end 字段
      const assistStart = assistReport.assist_start || assistReport.start_time;
      const assistEnd = assistReport.assist_end || assistReport.end_time;
      
      if (assistStart && assistEnd) {
        const assistHours = this.calculateAssistOverlapHours(
          assistStart,
          assistEnd,
          phaseStartTime,
          phaseEndTime,
          workTimeSettings,
          attendanceRecords,
          allExceptionReports,
          task.id // 传递任务ID用于调试
        );
        totalAssistHours += assistHours;
        hasAssistTasks = true; // 标记有协助任务
      }
    }
    
    
    // 计算效率
    efficiencyMap.forEach(efficiency => {
      // 从任务配置中获取标准工时
      efficiency.standardHours = this.getStandardHoursForPhase(task, phase);
      
      // 设置实际出勤时间和考勤记录
      efficiency.actualWorkHours = actualWorkHours;
      efficiency.attendanceRecords = attendanceRecords;
      
      // 确保totalCalendarHours被正确设置
      efficiency.totalCalendarHours = totalCalendarHours;
      
      // 设置单日计算详情
      efficiency.dailyCalculations = dailyCalculations;
      
      // 设置协助时间和标记
      efficiency.assistHours = totalAssistHours;
      efficiency.hasAssistTasks = hasAssistTasks;
      
      // 调试异常时长计算
      if (task.id === 1493) {
        console.log(`任务1493异常时长计算调试:`, {
          taskId: task.id,
          phase: phase,
          exceptionReportsCount: efficiency.exceptionReports.length,
          exceptionHours: efficiency.exceptionHours,
          assistHours: efficiency.assistHours,
          exceptionHoursType: typeof efficiency.exceptionHours,
          isNaN: isNaN(efficiency.exceptionHours),
          exceptionReports: efficiency.exceptionReports.map(ex => ({
            id: ex.id,
            duration_hours: ex.duration_hours,
            duration_hours_type: typeof ex.duration_hours,
            parsed: typeof ex.duration_hours === 'number' ? 
              ex.duration_hours : 
              parseFloat(ex.duration_hours) || 0
          }))
        });
      }
      
      // 效率 = 标准工时 / (实际工作小时数 - 异常时间 - 协助时间)
      const effectiveHours = efficiency.actualWorkHours - efficiency.exceptionHours - efficiency.assistHours;
      if (effectiveHours > 0) {
        const efficiencyValue = (efficiency.standardHours / effectiveHours) * 100;
        
        // 检查效率计算是否为NaN
        if (isNaN(efficiencyValue)) {
          console.error('效率计算为NaN:', {
            taskId: task.id,
            phase,
            standardHours: efficiency.standardHours,
            actualWorkHours: efficiency.actualWorkHours,
            exceptionHours: efficiency.exceptionHours,
            effectiveHours: effectiveHours,
            standardHoursType: typeof efficiency.standardHours,
            actualWorkHoursType: typeof efficiency.actualWorkHours
          });
          efficiency.efficiency = 0;
        } else {
          efficiency.efficiency = efficiencyValue;
        }
      } else {
        efficiency.efficiency = 0;
      }
    });
    
    return Array.from(efficiencyMap.values());
  }

  private calculateTaskEfficiency(task: Task, workReports: WorkReport[], exceptionReports: ExceptionReport[]): EfficiencyData[] {
    const efficiencyMap = new Map<string, EfficiencyData>();
    
    // 只计算指定阶段的效率
    const targetPhase = (this.selectedPhase || '') as string;
    
    // 如果没有选择阶段，返回空数组
    if (!targetPhase) {
      return [];
    }
    
    // 按阶段分组计算
    workReports.forEach(report => {
      // 由于数据库中没有phase字段，我们假设所有报工记录都属于当前选择的阶段
      const reportPhase = targetPhase;
      
      // 只处理指定阶段的报工记录
      if (reportPhase === targetPhase) {
        if (!efficiencyMap.has(targetPhase)) {
          efficiencyMap.set(targetPhase, {
            task: task,
            phase: targetPhase,
            standardHours: 0,
            actualWorkHours: 0,
            exceptionHours: 0,
            assistHours: 0,
        hasAssistTasks: false,
            efficiency: 0,
            workReports: [],
            exceptionReports: [],
            attendanceRecords: [],
            phaseStartTime: '',
            phaseEndTime: '',
            totalCalendarHours: 0
          });
        }
        
        const efficiency = efficiencyMap.get(targetPhase)!;
        efficiency.workReports.push(report);
        // 使用hours_worked字段
        efficiency.actualWorkHours += parseFloat(report.hours_worked) || 0;
      }
    });
    
    // 添加异常时间
    exceptionReports.forEach(exception => {
      const exceptionPhase = exception.phase;
      
      if (exceptionPhase === targetPhase && efficiencyMap.has(targetPhase)) {
        const efficiency = efficiencyMap.get(targetPhase)!;
        efficiency.exceptionReports.push(exception);
        
        // 计算异常时长
        const startTime = exception.start_time || exception.exception_start_datetime;
        const endTime = exception.end_time || exception.exception_end_datetime;
        let durationHours = 0;
        
        if (startTime && endTime) {
          // 使用简单的时长计算方法（因为这个方法没有工作时间和考勤数据）
          durationHours = this.calculateExceptionDuration(startTime, endTime);
        } else if (typeof exception.duration_hours === 'number') {
          // 如果没有时间段但有duration_hours，使用原值
          durationHours = exception.duration_hours;
        } else if (exception.duration_hours) {
          // 如果duration_hours是字符串，解析为数字
          durationHours = parseFloat(exception.duration_hours) || 0;
        }
        efficiency.exceptionHours += durationHours;
      }
    });
    
    // 计算效率
    efficiencyMap.forEach(efficiency => {
      // 从任务配置中获取标准工时
      efficiency.standardHours = this.getStandardHoursForPhase(task, targetPhase as string);
      
      // 效率 = 标准工时 / (实际工时 - 异常时间 - 协助时间)
      // 注意：此方法不查询协助记录，所以 assistHours 始终为 0
      const effectiveHours = efficiency.actualWorkHours - efficiency.exceptionHours - (efficiency.assistHours || 0);
      if (effectiveHours > 0) {
        efficiency.efficiency = (efficiency.standardHours / effectiveHours) * 100;
      } else {
        efficiency.efficiency = 0;
      }
    });
    
    return Array.from(efficiencyMap.values());
  }

  private getStandardHoursForPhase(task: Task, phase: string): number {
    // 从任务配置中获取标准工时
    let result: number;
    switch (phase) {
      case 'machining':
        result = task.machining_hours_est ? parseFloat(task.machining_hours_est) : 0;
        break;
      case 'electrical':
        result = task.electrical_hours_est ? parseFloat(task.electrical_hours_est) : 0;
        break;
      case 'pre_assembly':
        result = task.pre_assembly_hours_est ? parseFloat(task.pre_assembly_hours_est) : 0;
        break;
      case 'post_assembly':
        result = task.post_assembly_hours_est ? parseFloat(task.post_assembly_hours_est) : 0;
        break;
      case 'debugging':
        result = task.debugging_hours_est ? parseFloat(task.debugging_hours_est) : 0;
        break;
      default:
        result = 0;
    }
    
    // 检查结果是否为NaN
    if (isNaN(result)) {
      console.error('标准工时计算为NaN:', {
        taskId: task.id,
        phase,
        machining_hours_est: task.machining_hours_est,
        electrical_hours_est: task.electrical_hours_est,
        pre_assembly_hours_est: task.pre_assembly_hours_est,
        post_assembly_hours_est: task.post_assembly_hours_est,
        debugging_hours_est: task.debugging_hours_est,
        result
      });
      return 0; // 返回默认值
    }
    
    return result;
  }

  onRefresh(event: any) {
    this.loadTasks().then(() => {
      event.target.complete();
    });
  }

  private filterCompletedTasksByPhase(tasks: Task[], phase: string): Task[] {
    return tasks.filter(task => {
      // 筛选该阶段为1（存在）且同时存在开始时间和结束时间的任务
      let isValid = false;
      
      switch (phase) {
        case 'machining':
          isValid = task.machining_start_time !== null && 
                   task.machining_complete_time !== null &&
                   task.machining_start_time !== '' && 
                   task.machining_complete_time !== '';
          break;
        case 'electrical':
          isValid = task.electrical_start_time !== null && 
                   task.electrical_complete_time !== null &&
                   task.electrical_start_time !== '' && 
                   task.electrical_complete_time !== '';
          break;
        case 'pre_assembly':
          isValid = task.pre_assembly_start_time !== null && 
                   task.pre_assembly_complete_time !== null &&
                   task.pre_assembly_start_time !== '' && 
                   task.pre_assembly_complete_time !== '';
          break;
        case 'post_assembly':
          isValid = task.post_assembly_start_time !== null && 
                   task.post_assembly_complete_time !== null &&
                   task.post_assembly_start_time !== '' && 
                   task.post_assembly_complete_time !== '';
          break;
        case 'debugging':
          isValid = task.debugging_start_time !== null && 
                   task.debugging_complete_time !== null &&
                   task.debugging_start_time !== '' && 
                   task.debugging_complete_time !== '';
          break;
        default:
          isValid = false;
      }
      
      // 如果任务阶段无效，直接返回 false
      if (!isValid) {
        return false;
      }
      
      // 检查是否是7个工作日前的任务且已确认
      const phaseEndTime = this.getPhaseEndTime(task, phase);
      if (phaseEndTime && this.isBefore7WorkingDays(phaseEndTime)) {
        if (this.isTaskConfirmed(task.id, phase)) {
          // 已确认的7个工作日前的任务，跳过不计算
          return false;
        }
      }
      
      return true;
    });
  }

  // 筛选已完成的任务（不跳过已确认的任务，用于确认任务时使用）
  private filterCompletedTasksByPhaseWithoutConfirmation(tasks: Task[], phase: string): Task[] {
    return tasks.filter(task => {
      // 筛选该阶段为1（存在）且同时存在开始时间和结束时间的任务
      let isValid = false;
      
        switch (phase) {
          case 'machining':
          isValid = task.machining_start_time !== null && 
                   task.machining_complete_time !== null &&
                   task.machining_start_time !== '' && 
                   task.machining_complete_time !== '';
            break;
          case 'electrical':
          isValid = task.electrical_start_time !== null && 
                   task.electrical_complete_time !== null &&
                   task.electrical_start_time !== '' && 
                   task.electrical_complete_time !== '';
            break;
          case 'pre_assembly':
          isValid = task.pre_assembly_start_time !== null && 
                   task.pre_assembly_complete_time !== null &&
                   task.pre_assembly_start_time !== '' && 
                   task.pre_assembly_complete_time !== '';
            break;
          case 'post_assembly':
          isValid = task.post_assembly_start_time !== null && 
                   task.post_assembly_complete_time !== null &&
                   task.post_assembly_start_time !== '' && 
                   task.post_assembly_complete_time !== '';
            break;
          case 'debugging':
          isValid = task.debugging_start_time !== null && 
                   task.debugging_complete_time !== null &&
                   task.debugging_start_time !== '' && 
                   task.debugging_complete_time !== '';
            break;
        default:
          isValid = false;
      }
      
      return isValid;
    });
  }

  getPhaseDisplayName(phase: string): string {
    const phaseNames: { [key: string]: string } = {
      'machining': '机加阶段',
      'electrical': '电气阶段',
      'pre_assembly': '总装前段阶段',
      'post_assembly': '总装后段阶段',
      'debugging': '调试阶段'
    };
    return phaseNames[phase] || phase;
  }

  getTaskAssigneeName(task: Task, phase: string): string | null {
    switch (phase) {
      case 'machining':
        return task.machining_assignee_name;
      case 'electrical':
        return task.electrical_assignee_name;
      case 'pre_assembly':
        return task.pre_assembly_assignee_name;
      case 'post_assembly':
        return task.post_assembly_assignee_name;
      case 'debugging':
        return task.debugging_assignee_name;
      default:
        return null;
    }
  }

  private getPhaseStartTime(task: Task, phase: string): string | null {
    let startTime: string | null = null;
    
    // 如果没有实际的时间数据，返回null而不是默认值
    switch (phase) {
      case 'machining':
        startTime = task.machining_start_time || null;
        break;
      case 'electrical':
        startTime = task.electrical_start_time || null;
        break;
      case 'pre_assembly':
        startTime = task.pre_assembly_start_time || null;
        break;
      case 'post_assembly':
        startTime = task.post_assembly_start_time || null;
        break;
      case 'debugging':
        startTime = task.debugging_start_time || null;
        break;
      default:
        return null;
    }
    
    // 验证时间格式
    if (startTime && !TimeUtils.validateTimeFormat(startTime, 'UTC')) {
    
    }
    
    return startTime;
  }

  private getPhaseEndTime(task: Task, phase: string): string | null {
    let endTime: string | null = null;
    
    // 如果没有实际的时间数据，返回null而不是默认值
    switch (phase) {
      case 'machining':
        endTime = task.machining_complete_time || null;
        break;
      case 'electrical':
        endTime = task.electrical_complete_time || null;
        break;
      case 'pre_assembly':
        endTime = task.pre_assembly_complete_time || null;
        break;
      case 'post_assembly':
        endTime = task.post_assembly_complete_time || null;
        break;
      case 'debugging':
        endTime = task.debugging_complete_time || null;
        break;
      default:
        return null;
    }
    
    // 验证时间格式
    if (endTime && !TimeUtils.validateTimeFormat(endTime, 'UTC')) {
    
    }
    
    return endTime;
  }

  private calculateCalendarHours(startTime: string, endTime: string): number {
    // 检查输入参数
    if (!startTime || !endTime) {
      console.error('时间参数为空:', { startTime, endTime });
      return 0;
    }
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    // 检查Date对象是否有效
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.error('无效的时间格式:', { 
        startTime, 
        endTime, 
        startValid: !isNaN(start.getTime()),
        endValid: !isNaN(end.getTime())
      });
      return 0;
    }
    
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60); // 转换为小时
    
    // 检查计算结果是否为NaN
    if (isNaN(hours)) {
      console.error('计算结果为NaN:', {
        startTime,
        endTime,
        startTimestamp: start.getTime(),
        endTimestamp: end.getTime(),
        timeDiff: end.getTime() - start.getTime()
      });
      return 0;
    }
    
    // 添加调试信息
    
    
    // 特别调试任务1421的时间计算
    if (startTime.includes('2025-10-19') || endTime.includes('2025-10-19')) {
      
    }
    
    // 如果计算结果是负数，说明开始时间晚于结束时间，这是数据错误
    if (hours < 0) {
      console.error('错误：开始时间晚于结束时间，数据有误', {
        startTime,
        endTime,
        startLocal: start.toLocaleString('zh-CN'),
        endLocal: end.toLocaleString('zh-CN'),
        calculatedHours: hours,
        message: '开始时间应该早于结束时间，请检查数据库中的时间数据'
      });
      return 0; // 返回0表示无效的时间段
    }
    
    // 如果时间差太小（小于1分钟），也认为是无效数据
    if (hours < 0.0167) { // 1分钟 = 1/60小时 ≈ 0.0167小时
      
      return 0; // 返回0表示无效的时间段
    }
    
    // 如果时间差过大（超过30天），也认为是异常数据
    if (hours > 720) { // 30天 = 30 * 24 = 720小时
      
      return 0; // 返回0表示无效的时间段
    }
    
    return hours;
  }

  private getAttendanceRecordsForPeriod(
    allRecords: any[], 
    userId: number, 
    startTime: string, 
    endTime: string
  ): any[] {
    // 由于已经只获取了阶段时间范围内的考勤记录，这里只需要按用户ID和确认状态筛选
    const filteredRecords = allRecords.filter(record => {
      return record.user_id === userId && record.is_confirmed;
    });
    
    
    
    return filteredRecords;
  }

  private getDailyShiftWindows(dateStr: string): Array<{ start: Date; end: Date }> {
    // 必须使用后端配置，没有默认值
    if (!this.workTimeSettings) {
      throw new Error('工作时间设置未加载，请先在考勤管理页面配置工作时间');
    }
    
    const cfg = this.workTimeSettings;
    const startTime = cfg.start_time!;
    const endTime = cfg.end_time!;
    const lunchStart = cfg.lunch_start_time!;
    const lunchEnd = cfg.lunch_end_time!;
    const otherStart = cfg.other_break_start_time || '';
    const otherEnd = cfg.other_break_end_time || '';

    const toDate = (t: string) => new Date(`${dateStr}T${t}`);

    // 基础两个工作窗口（已扣除午休）
    let segments: Array<{ start: Date; end: Date }> = [
      { start: toDate(startTime), end: toDate(lunchStart) },
      { start: toDate(lunchEnd), end: toDate(endTime) }
    ];

    // 扣除"其他休息时间"，可能切分窗口
    if (otherStart && otherEnd) {
      const bStart = toDate(otherStart);
      const bEnd = toDate(otherEnd);
      const newSegments: Array<{ start: Date; end: Date }> = [];
      segments.forEach(seg => {
        // 无重叠
        if (bEnd <= seg.start || bStart >= seg.end) {
          newSegments.push(seg);
        } else {
          // 左段
          if (bStart > seg.start) {
            newSegments.push({ start: seg.start, end: new Date(Math.min(seg.end.getTime(), bStart.getTime())) });
          }
          // 右段
          if (bEnd < seg.end) {
            newSegments.push({ start: new Date(Math.max(seg.start.getTime(), bEnd.getTime())), end: seg.end });
          }
        }
      });
      segments = newSegments.filter(s => s.end > s.start);
    }

    return segments;
  }

  private calculateOverlapHours(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
    const start = new Date(Math.max(aStart.getTime(), bStart.getTime()));
    const end = new Date(Math.min(aEnd.getTime(), bEnd.getTime()));
    const ms = end.getTime() - start.getTime();
    return ms > 0 ? ms / (1000 * 60 * 60) : 0;
  }

  private calculateActualWorkHours(attendanceRecords: any[], startTime: string, endTime: string): number {
    let totalWorkHours = 0;

    const phaseStart = new Date(startTime);
    const phaseEnd = new Date(endTime);

    attendanceRecords.forEach(record => {
      const dateStr = record.date; // YYYY-MM-DD

      // 1) 计算该日内阶段与"配置的班次窗口"重叠总时长
      const windows = this.getDailyShiftWindows(dateStr);
      let overlapWithinShifts = 0;
      windows.forEach(w => {
        overlapWithinShifts += this.calculateOverlapHours(phaseStart, phaseEnd, w.start, w.end);
      });

      // 2) 当天可用于该任务的小时数 = min(当天考勤小时, 阶段在当天与班次窗口的重叠小时)
      const attendedHours = Number(record.actual_attendance_hours ?? record.standard_attendance_hours ?? 0);
      const usedHours = Math.min(attendedHours, overlapWithinShifts);

      totalWorkHours += usedHours;
    });

    return totalWorkHours;
  }

  /**
   * 计算实际工作小时数（包含作息、加班、请假、异常时段的完整逻辑）
   * 公式：作息∩阶段 + 加班∩阶段 - 请假∩作息 - 异常∩(作息+加班)
   */
  private async calculateActualWorkHoursWithShifts(
    attendanceRecords: any[], 
    phaseStartTime: string, 
    phaseEndTime: string, 
    workTimeSettings: any,
    exceptionReports: ExceptionReport[]
  ): Promise<{ totalHours: number; dailyCalculations: { [date: string]: { totalHours: number; effectiveHours: number; } } }> {
    let totalEffectiveHours = 0;
    const dailyCalculations: { [date: string]: { totalHours: number; effectiveHours: number; } } = {};
    
    // 使用TimeUtils统一处理时间转换
    const start = TimeUtils.utcToLocalDate(phaseStartTime);
    const end = TimeUtils.utcToLocalDate(phaseEndTime);
    
    // 验证时间格式
    if (!TimeUtils.validateTimeFormat(phaseStartTime, 'UTC') || !TimeUtils.validateTimeFormat(phaseEndTime, 'UTC')) {
      console.error('阶段时间格式无效:', { phaseStartTime, phaseEndTime });
      return { totalHours: 0, dailyCalculations: {} };
    }
    
    // 添加调试信息
    
    
    // 特别检查任务1493的调试信息
    if (phaseStartTime && phaseStartTime.includes('2025-10-17') && phaseEndTime && phaseEndTime.includes('2025-10-21')) {
      
    }

    // 逐日计算 - 使用TimeUtils确保包含结束日期的整天
    const endOfLastDay = TimeUtils.createEndOfDay(end);
    
    for (let d = new Date(start); d <= endOfLastDay; d.setDate(d.getDate() + 1)) {
      const currentDay = TimeUtils.getLocalDateString(d);
      
      // 添加调试信息 - 检查所有日期的计算
      if (currentDay.startsWith('2025-10-')) {
        
      }
      
      const dayAttendance = attendanceRecords.find(rec => {
        // 使用TimeUtils统一处理日期比较
        const recDate = TimeUtils.utcToLocalDate(rec.date);
        return TimeUtils.isSameDay(recDate, d);
      });
      
      // 特别调试任务1421的10月19日
      if (currentDay === '2025-10-19' && phaseStartTime && phaseStartTime.includes('2025-10-18')) {
        
      }
      
      if (!dayAttendance) {
        
        if (currentDay.startsWith('2025-10-')) {
          
        }
        continue;
      }

      const actualAttendanceHours = dayAttendance.actual_hours || dayAttendance.standard_attendance_hours || 0;

      // 1. 计算作息时间与阶段的重叠
      const workWindows = this.getWorkWindowsForDay(workTimeSettings, currentDay);
      let dayPhaseOverlapHours = 0;
      workWindows.forEach((window, index) => {
        // 使用TimeUtils创建本地时间的工作窗口
        const windowStart = TimeUtils.createLocalDateTime(currentDay, window.start);
        const windowEnd = TimeUtils.createLocalDateTime(currentDay, window.end);
        
        // 使用TimeUtils计算重叠小时数
        const overlap = TimeUtils.calculateOverlapHours(
          windowStart, 
          windowEnd, 
          start, 
          end
        );
        
        dayPhaseOverlapHours += overlap;
      });
      
      // 保存扣除请假和异常前的初始值（用于调试）
      const initialWorkWindowHours = dayPhaseOverlapHours;

      // 2. 获取加班时段并计算重叠
      const overtimePeriods = this.getOvertimePeriodsForDay(attendanceRecords, currentDay);
      let overtimeOverlapTotal = 0;
      overtimePeriods.forEach(overtime => {
        // 使用TimeUtils创建本地时间的加班时段
        const overtimeStartTime = TimeUtils.createLocalDateTime(currentDay, overtime.start);
        const overtimeEndTime = TimeUtils.createLocalDateTime(currentDay, overtime.end);
        
        // 使用TimeUtils计算重叠小时数
        const overtimeOverlap = TimeUtils.calculateOverlapHours(
          overtimeStartTime, 
          overtimeEndTime, 
          start, 
          end
        );
        overtimeOverlapTotal += overtimeOverlap;
        dayPhaseOverlapHours += overtimeOverlap;
      });
      
      // 保存扣除请假前的值（用于调试）
      const beforeLeaveHours = dayPhaseOverlapHours;
      let leaveDeductionTotal = 0;

      // 3. 获取请假时段并扣除（请假时段与作息时间的重叠部分）
      const leavePeriods = this.getLeavePeriodsForDay(attendanceRecords, currentDay);
      leavePeriods.forEach(leave => {
        // 计算请假时段与作息时间的重叠
        workWindows.forEach(window => {
          // 工作时间设置已经是HH:MM格式，直接使用
          const windowStartTime = window.start;
          const windowEndTime = window.end;
          const leaveStartTime = leave.start;
          const leaveEndTime = leave.end;
          
          // 创建本地时间的工作窗口和请假时段
          const windowStart = new Date(`${currentDay}T${windowStartTime}`);
          const windowEnd = new Date(`${currentDay}T${windowEndTime}`);
          const leaveStart = new Date(`${currentDay}T${leaveStartTime}`);
          const leaveEnd = new Date(`${currentDay}T${leaveEndTime}`);
          
          // 将作息窗口限缩到阶段时间内
          const limitedWindowStart = new Date(Math.max(windowStart.getTime(), start.getTime()));
          const limitedWindowEnd = new Date(Math.min(windowEnd.getTime(), end.getTime()));
          if (limitedWindowEnd <= limitedWindowStart) {
            return;
          }
          
          const overlap = TimeUtils.calculateOverlapHours(
            leaveStart, 
            leaveEnd, 
            limitedWindowStart, 
            limitedWindowEnd
          );
          leaveDeductionTotal += overlap;
          dayPhaseOverlapHours -= overlap;
        });
      });
      
      // 4. 获取异常时段（仅记录，不扣除，异常时间不影响实际工作时间计算）
      const exceptionPeriods = this.getExceptionPeriodsForDay(exceptionReports, currentDay);
      let exceptionDeductionTotal = 0; // 仅用于调试显示，不用于扣除
      
      exceptionPeriods.forEach(exception => {
        // 创建异常时段
        const exceptionStart = new Date(`${currentDay}T${exception.start}`);
        const exceptionEnd = new Date(`${currentDay}T${exception.end}`);
        
        // 计算异常时段与阶段时间的重叠部分（仅用于记录，不扣除）
        const exceptionInPhaseStart = new Date(Math.max(exceptionStart.getTime(), start.getTime()));
        const exceptionInPhaseEnd = new Date(Math.min(exceptionEnd.getTime(), end.getTime()));
        
        if (exceptionInPhaseEnd <= exceptionInPhaseStart) {
          // 异常时段与阶段时间无重叠，跳过
          return;
        }
        
        // 计算异常时段与阶段内工作时间的总重叠（仅用于调试显示）
        let totalExceptionOverlap = 0;
        
        // 1. 计算异常时段与作息窗口的重叠（限缩到阶段时间内）
        workWindows.forEach(window => {
          const windowStart = new Date(`${currentDay}T${window.start}`);
          const windowEnd = new Date(`${currentDay}T${window.end}`);
          
          // 将作息窗口限缩到阶段时间内
          const limitedWindowStart = new Date(Math.max(windowStart.getTime(), start.getTime()));
          const limitedWindowEnd = new Date(Math.min(windowEnd.getTime(), end.getTime()));
          if (limitedWindowEnd <= limitedWindowStart) {
            return;
          }
          
          const overlap = TimeUtils.calculateOverlapHours(
            exceptionInPhaseStart, 
            exceptionInPhaseEnd, 
            limitedWindowStart, 
            limitedWindowEnd
          );
          totalExceptionOverlap += overlap;
        });
        
        // 2. 计算异常时段与加班时段的重叠（限缩到阶段时间内）
        overtimePeriods.forEach(overtime => {
          const overtimeStart = new Date(`${currentDay}T${overtime.start}`);
          const overtimeEnd = new Date(`${currentDay}T${overtime.end}`);
          
          // 将加班时段限缩到阶段时间内
          const limitedOvertimeStart = new Date(Math.max(overtimeStart.getTime(), start.getTime()));
          const limitedOvertimeEnd = new Date(Math.min(overtimeEnd.getTime(), end.getTime()));
          if (limitedOvertimeEnd <= limitedOvertimeStart) {
            return;
          }
          
          const overlap = TimeUtils.calculateOverlapHours(
            exceptionInPhaseStart, 
            exceptionInPhaseEnd, 
            limitedOvertimeStart, 
            limitedOvertimeEnd
          );
          totalExceptionOverlap += overlap;
        });
        
        // 仅记录异常时间，不扣除（异常时间不影响实际工作时间）
        exceptionDeductionTotal += totalExceptionOverlap;
        // dayPhaseOverlapHours -= totalExceptionOverlap; // 已移除：不扣除异常时间
      });
      
      // 保存扣除异常前的值（用于调试，实际上现在等于扣除异常后的值，因为不再扣除）
      const beforeExceptionHours = dayPhaseOverlapHours;

      // 确保不为负数
      dayPhaseOverlapHours = Math.max(0, dayPhaseOverlapHours);

      // 5. 取最小值：计算出的重叠时间 vs 实际出勤时间
      const effectiveHours = Math.min(dayPhaseOverlapHours, actualAttendanceHours);
      
      // 任务182的逐日计算详细调试（针对2025-10-20）
      if (currentDay === '2025-10-20') {
        console.log(`\n========== 任务182 - 2025-10-20 逐日计算详情 ==========`);
        console.log(`阶段时间范围: ${start.toLocaleString('zh-CN')} - ${end.toLocaleString('zh-CN')}`);
        console.log(`当日考勤记录:`, {
          date: dayAttendance.date,
          actual_hours: dayAttendance.actual_hours,
          standard_attendance_hours: dayAttendance.standard_attendance_hours,
          overtime_hours: dayAttendance.overtime_hours,
          overtime_start_time: dayAttendance.overtime_start_time,
          overtime_end_time: dayAttendance.overtime_end_time,
          leave_hours: dayAttendance.leave_hours,
          leave_start_time: dayAttendance.leave_start_time,
          leave_end_time: dayAttendance.leave_end_time,
          exception_minutes: dayAttendance.exception_minutes
        });
        console.log(`工作窗口数量: ${workWindows.length}`);
        workWindows.forEach((window, idx) => {
          const windowStart = TimeUtils.createLocalDateTime(currentDay, window.start);
          const windowEnd = TimeUtils.createLocalDateTime(currentDay, window.end);
          const overlap = TimeUtils.calculateOverlapHours(windowStart, windowEnd, start, end);
          console.log(`  窗口${idx + 1}: ${window.start}-${window.end}, 与阶段重叠: ${overlap.toFixed(4)}小时`);
        });
        console.log(`加班时段数量: ${overtimePeriods.length}`);
        overtimePeriods.forEach((overtime, idx) => {
          const overtimeStart = TimeUtils.createLocalDateTime(currentDay, overtime.start);
          const overtimeEnd = TimeUtils.createLocalDateTime(currentDay, overtime.end);
          const overlap = TimeUtils.calculateOverlapHours(overtimeStart, overtimeEnd, start, end);
          console.log(`  加班${idx + 1}: ${overtime.start}-${overtime.end}, 与阶段重叠: ${overlap.toFixed(4)}小时`);
        });
        console.log(`请假时段数量: ${leavePeriods.length}`);
        leavePeriods.forEach((leave, idx) => {
          console.log(`  请假${idx + 1}: ${leave.start}-${leave.end}`);
        });
        console.log(`异常时段数量: ${exceptionPeriods.length}`);
        exceptionPeriods.forEach((exception, idx) => {
          console.log(`  异常${idx + 1}: ${exception.start}-${exception.end}`);
          // 显示异常时段与各窗口的重叠详情
          const exceptionStart = new Date(`${currentDay}T${exception.start}`);
          const exceptionEnd = new Date(`${currentDay}T${exception.end}`);
          const exceptionInPhaseStart = new Date(Math.max(exceptionStart.getTime(), start.getTime()));
          const exceptionInPhaseEnd = new Date(Math.min(exceptionEnd.getTime(), end.getTime()));
          console.log(`    异常时段限缩到阶段内: ${exceptionInPhaseStart.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})}-${exceptionInPhaseEnd.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})}`);
          workWindows.forEach((window, wIdx) => {
            const windowStart = TimeUtils.createLocalDateTime(currentDay, window.start);
            const windowEnd = TimeUtils.createLocalDateTime(currentDay, window.end);
            const limitedWindowStart = new Date(Math.max(windowStart.getTime(), start.getTime()));
            const limitedWindowEnd = new Date(Math.min(windowEnd.getTime(), end.getTime()));
            if (limitedWindowEnd > limitedWindowStart) {
              const overlap = TimeUtils.calculateOverlapHours(exceptionInPhaseStart, exceptionInPhaseEnd, limitedWindowStart, limitedWindowEnd);
              if (overlap > 0) {
                console.log(`      与工作窗口${wIdx + 1}(${window.start}-${window.end})重叠: ${overlap.toFixed(4)}小时`);
              }
            }
          });
          overtimePeriods.forEach((overtime, otIdx) => {
            const overtimeStart = TimeUtils.createLocalDateTime(currentDay, overtime.start);
            const overtimeEnd = TimeUtils.createLocalDateTime(currentDay, overtime.end);
            const limitedOvertimeStart = new Date(Math.max(overtimeStart.getTime(), start.getTime()));
            const limitedOvertimeEnd = new Date(Math.min(overtimeEnd.getTime(), end.getTime()));
            if (limitedOvertimeEnd > limitedOvertimeStart) {
              const overlap = TimeUtils.calculateOverlapHours(exceptionInPhaseStart, exceptionInPhaseEnd, limitedOvertimeStart, limitedOvertimeEnd);
              if (overlap > 0) {
                console.log(`      与加班时段${otIdx + 1}(${overtime.start}-${overtime.end})重叠: ${overlap.toFixed(4)}小时`);
              }
            }
          });
        });
        console.log(`计算步骤:`);
        console.log(`  1. 作息窗口与阶段重叠总和: ${initialWorkWindowHours.toFixed(4)}小时`);
        console.log(`  2. 加班时段与阶段重叠总和: ${overtimeOverlapTotal.toFixed(4)}小时`);
        console.log(`  3. 加上加班后总计: ${beforeLeaveHours.toFixed(4)}小时`);
        console.log(`  4. 扣除请假: -${leaveDeductionTotal.toFixed(4)}小时，剩余: ${beforeExceptionHours.toFixed(4)}小时`);
        console.log(`  5. 异常时间重叠: ${exceptionDeductionTotal.toFixed(4)}小时（仅记录，不扣除）`);
        console.log(`  6. 扣除异常后剩余: ${Math.max(0, dayPhaseOverlapHours).toFixed(4)}小时（与第4步相同，因为不扣除异常）`);
        console.log(`  7. 实际出勤小时: ${actualAttendanceHours}`);
        console.log(`  8. 最终有效小时(取较小值): ${effectiveHours}`);
        console.log(`==================================================\n`);
      }
      
      // 存储单日计算详情
      dailyCalculations[currentDay] = {
        totalHours: dayPhaseOverlapHours, // 单日与阶段的重叠时长
        effectiveHours: effectiveHours    // 单日有效工时
      };
      
      totalEffectiveHours += effectiveHours;
    }

    
    return { totalHours: totalEffectiveHours, dailyCalculations };
  }

  /**
   * 获取某日的工作时段窗口
   */
  private getWorkWindowsForDay(workTimeSettings: any, dateStr: string): Array<{start: string, end: string}> {
    if (!workTimeSettings) {
      throw new Error('工作时间设置未提供');
    }
    
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
      windows = this.splitWindowsByBreak(windows, otherStart, otherEnd);
    }

    return windows;
  }

  /**
   * 获取某日的加班时段
   */
  private getOvertimePeriodsForDay(attendanceRecords: any[], dateStr: string): Array<{start: string, end: string}> {
    const periods: Array<{start: string, end: string}> = [];
    
    attendanceRecords.forEach(record => {
      if (record.date === dateStr) {
        // 只使用实际存储的加班时间段，拒绝自动分配
        if (record.overtime_start_time && record.overtime_end_time) {
          periods.push({ 
            start: record.overtime_start_time, 
            end: record.overtime_end_time 
          });
          console.log(`使用实际加班时间段: ${record.overtime_start_time}-${record.overtime_end_time}`);
        } else if (record.overtime_hours && parseFloat(record.overtime_hours) > 0) {
          console.log(`警告: 用户${record.user_id}在${dateStr}有${record.overtime_hours}小时加班，但未设置具体时间段，跳过计算`);
        }
      }
    });

    return periods;
  }

  /**
   * 获取某日的请假时段
   */
  private getLeavePeriodsForDay(attendanceRecords: any[], dateStr: string): Array<{start: string, end: string}> {
    const periods: Array<{start: string, end: string}> = [];
    
    attendanceRecords.forEach(record => {
      if (record.date === dateStr) {
        // 只使用实际存储的请假时间段，拒绝自动分配
        if (record.leave_start_time && record.leave_end_time) {
          periods.push({ 
            start: record.leave_start_time, 
            end: record.leave_end_time 
          });
          console.log(`使用实际请假时间段: ${record.leave_start_time}-${record.leave_end_time}`);
        } else if (record.leave_hours && parseFloat(record.leave_hours) > 0) {
          console.log(`警告: 用户${record.user_id}在${dateStr}有${record.leave_hours}小时请假，但未设置具体时间段，跳过计算`);
        }
      }
    });

    return periods;
  }

  /**
   * 获取某日的异常时段
   */
  private getExceptionPeriodsForDay(exceptionReports: ExceptionReport[], dateStr: string): Array<{start: string, end: string}> {
    const periods: Array<{start: string, end: string}> = [];
    
    exceptionReports.forEach(report => {
      // 优先使用exception_start_datetime和exception_end_datetime字段
      const startTime = report.exception_start_datetime || report.start_time;
      const endTime = report.exception_end_datetime || report.end_time;
      
      if (startTime && endTime) {
        const reportDate = new Date(startTime).toISOString().split('T')[0];
        if (reportDate === dateStr) {
          const startDate = new Date(startTime);
          const endDate = new Date(endTime);
          
          // 检测是否跨越日期（说明存储的是本地时间但标记为UTC）
          if (endDate.getDate() !== startDate.getDate()) {
            // 跨越日期，说明存储的是本地时间，直接提取时间部分
            const startTimeStr = startTime.split('T')[1].substring(0, 5);
            const endTimeStr = endTime.split('T')[1].substring(0, 5);
            periods.push({ start: startTimeStr, end: endTimeStr });
            console.log(`使用异常时间段: ${startTimeStr}-${endTimeStr}`);
          } else {
            // 同一天，使用本地时间处理
            const startTimeStr = startDate.toTimeString().split(' ')[0].substring(0, 5);
            const endTimeStr = endDate.toTimeString().split(' ')[0].substring(0, 5);
            periods.push({ start: startTimeStr, end: endTimeStr });
            console.log(`使用异常时间段: ${startTimeStr}-${endTimeStr}`);
          }
        }
      }
    });

    return periods;
  }


  /**
   * 根据休息时间切分工作窗口
   */
  private splitWindowsByBreak(windows: Array<{start: string, end: string}>, breakStart: string, breakEnd: string): Array<{start: string, end: string}> {
    const result: Array<{start: string, end: string}> = [];
    
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

  applyFilters() {
    this.applyTableFilters();
  }

  applyTableFilters() {
    // 先应用顶部筛选条件
    let filtered = this.efficiencyData.filter(data => {
      // 阶段筛选（优先使用表格筛选，如果没有则使用顶部筛选）
      const phaseFilter = this.tablePhaseFilter || this.selectedPhase;
      if (phaseFilter && data.phase !== phaseFilter) {
        return false;
      }
      
      // 用户筛选（根据阶段负责人筛选）
      if (this.selectedUser && this.selectedUser.trim() !== '') {
        const keyword = this.selectedUser.trim().toLowerCase();
        const taskUserName = (this.getTaskAssigneeName(data.task, data.phase) || '').toLowerCase();
        if (!taskUserName.includes(keyword)) {
          return false;
        }
      }
      
      // 型号筛选（优先使用表格筛选，如果没有则使用顶部筛选）
      const modelFilter = this.tableModelFilter || this.selectedModel;
      if (modelFilter && modelFilter.trim() !== '') {
        const keyword = modelFilter.trim().toLowerCase();
        const productModel = (data.task.product_model || '').toLowerCase();
        if (!productModel.includes(keyword)) {
          return false;
        }
      }
      
      // 表格内负责人筛选
      if (this.tableAssigneeFilter && this.tableAssigneeFilter.trim() !== '') {
        const keyword = this.tableAssigneeFilter.trim().toLowerCase();
        const taskUserName = (this.getTaskAssigneeName(data.task, data.phase) || '').toLowerCase();
        if (!taskUserName.includes(keyword)) {
          return false;
        }
      }
      
      // 按开始/结束日期区间过滤（基于阶段结束时间）
      if (this.startDate || this.endDate) {
        if (!data.phaseEndTime) {
          return false;
        }
        const ped = new Date(data.phaseEndTime);
        const phaseEndDateStr = `${ped.getFullYear()}-${String(ped.getMonth() + 1).padStart(2, '0')}-${String(ped.getDate()).padStart(2, '0')}`;

        if (this.startDate && phaseEndDateStr < this.startDate) {
          return false;
        }
        if (this.endDate && phaseEndDateStr > this.endDate) {
          return false;
        }
      }

      if (this.filterMonth) {
        if (!data.phaseEndTime) {
          return false;
        }
        const selectedMonthDate = new Date(this.filterMonth);
        if (isNaN(selectedMonthDate.getTime())) {
          return false;
        }
        const selectedMonthKey = `${selectedMonthDate.getFullYear()}-${String(selectedMonthDate.getMonth() + 1).padStart(2, '0')}`;
        const ped = new Date(data.phaseEndTime);
        const phaseMonth = `${ped.getFullYear()}-${String(ped.getMonth() + 1).padStart(2, '0')}`;
        if (phaseMonth !== selectedMonthKey) {
          return false;
        }
      }
      
      return true;
    });

    // 应用排序
    if (this.tableEfficiencySort) {
      filtered = filtered.sort((a, b) => {
        const efficiencyA = a.efficiency || 0;
        const efficiencyB = b.efficiency || 0;
        if (this.tableEfficiencySort === 'asc') {
          return efficiencyA - efficiencyB;
        } else {
          return efficiencyB - efficiencyA;
        }
      });
    }

    if (this.tableExceptionSort) {
      filtered = filtered.sort((a, b) => {
        const exceptionCountA = a.exceptionReports.length || 0;
        const exceptionCountB = b.exceptionReports.length || 0;
        if (this.tableExceptionSort === 'asc') {
          return exceptionCountA - exceptionCountB;
        } else {
          return exceptionCountB - exceptionCountA;
        }
      });
    }

    this.filteredEfficiencyData = filtered;
  }

  clearFilters() {
    this.selectedPhase = '';
    // 员工角色不清空用户筛选，保持只查看自己的数据
    if (this.currentUser?.role !== 'worker') {
    this.selectedUser = '';
      this.tableAssigneeFilter = '';
      this.monthlyTableEmployeeFilter = '';
    }
    this.selectedModel = '';
    this.startDate = '';
    this.endDate = '';
    this.filterMonth = '';
    this.monthlyStartDate = '';
    this.monthlyEndDate = '';
    this.tableModelFilter = '';
    this.tablePhaseFilter = '';
    this.tableEfficiencySort = '';
    this.tableExceptionSort = '';
    this.monthlyEfficiencyResults = [];
    this.applyFilters();
  }

  formatEfficiency(efficiency: number): string {
    return efficiency.toFixed(2) + '%';
  }

  getEfficiencyColor(efficiency: number): string {
    if (efficiency >= 100) return 'success';
    if (efficiency >= 80) return 'warning';
    return 'danger';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  }

  formatTime(timeStr: string | null): string {
    if (!timeStr) return '';
    return new Date(timeStr).toLocaleString('zh-CN');
  }

  // 格式化异常详情用于tooltip显示
  formatExceptionTooltip(exceptionReports: ExceptionReport[]): string {
    if (!exceptionReports || exceptionReports.length === 0) {
      return '';
    }
    
    const lines = exceptionReports.map((ex, index) => {
      const startTime = ex.start_time || ex.exception_start_datetime || '';
      const endTime = ex.end_time || ex.exception_end_datetime || '';
      let timeStr = '';
      if (startTime && endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        timeStr = `${start.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} → ${end.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
      } else if (startTime) {
        const start = new Date(startTime);
        timeStr = start.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      } else {
        timeStr = '时间未设置';
      }
      
      const duration = ex.duration_hours ? `${ex.duration_hours.toFixed(2)}小时` : '';
      const description = ex.description ? `\n说明: ${ex.description}` : '';
      const approvalNote = ex.approval_note ? `\n备注: ${ex.approval_note}` : '';
      
      return `${index + 1}. ${ex.user_name} - ${ex.exception_type}\n时间: ${timeStr}${duration ? ` (${duration})` : ''}${description}${approvalNote}`;
    });
    
    return lines.join('\n\n');
  }

  // 获取异常状态颜色
  getExceptionStatusColor(status: string): string {
    switch (status) {
      case 'approved':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
        return 'danger';
      case 'processing':
        return 'primary';
      case 'resolved':
        return 'medium';
      default:
        return 'light';
    }
  }

  // 获取异常状态文本
  getExceptionStatusText(status: string): string {
    switch (status) {
      case 'approved':
        return '已批准';
      case 'pending':
        return '待审批';
      case 'rejected':
        return '已驳回';
      case 'processing':
        return '处理中';
      case 'resolved':
        return '已解决';
      default:
        return '未知状态';
    }
  }

  /**
   * 获取经过表头筛选/排序后的月度效率结果
   */
  getFilteredMonthlyResults() {
    if (!this.monthlyEfficiencyResults) {
      return [];
    }

    let list = [...this.monthlyEfficiencyResults];

    // 员工筛选（表头第二行）
    if (this.monthlyTableEmployeeFilter && this.monthlyTableEmployeeFilter.trim() !== '') {
      const keyword = this.monthlyTableEmployeeFilter.trim().toLowerCase();
      list = list.filter(item => item.employee.toLowerCase().includes(keyword));
    }

    // 月份筛选（对 monthLabel 做模糊匹配，例如“2025-03”或“3月”）
    if (this.monthlyTableMonthFilter && this.monthlyTableMonthFilter.trim() !== '') {
      const keyword = this.monthlyTableMonthFilter.trim().toLowerCase();
      list = list.filter(item => item.monthLabel.toLowerCase().includes(keyword));
    }

    // 效率排序
    if (this.monthlyTableEfficiencySort === 'asc') {
      list = list.sort((a, b) => (a.efficiency || 0) - (b.efficiency || 0));
    } else if (this.monthlyTableEfficiencySort === 'desc') {
      list = list.sort((a, b) => (b.efficiency || 0) - (a.efficiency || 0));
    }

    return list;
  }

  // 切换计算过程详情显示
  toggleCalculationDetails(taskId: number, phase: string): void {
    const key = `${taskId}-${phase}`;
    const current = this.calculationDetailsVisible.get(key) || false;
    this.calculationDetailsVisible.set(key, !current);
    
    // 如果显示详情且还没有计算过，则计算逐日详情
    if (!current && !this.dayCalculationDetails.has(key)) {
      this.calculateDayDetails(taskId, phase);
    }
  }

  // 获取计算过程详情是否可见
  getCalculationDetailsVisible(taskId: number, phase: string): boolean {
    const key = `${taskId}-${phase}`;
    return this.calculationDetailsVisible.get(key) || false;
  }

  // 切换异常时间段详情显示
  toggleExceptionDetails(taskId: number, phase: string): void {
    const key = `${taskId}-${phase}`;
    const current = this.exceptionDetailsVisible.get(key) || false;
    this.exceptionDetailsVisible.set(key, !current);
  }

  /**
   * 计算协助时间在某阶段内占用的“有效时间”
   * 协助有效时间 = (协助 ∩ 作息/加班 ∩ 本阶段) - (协助 ∩ 异常 ∩ 作息/加班 ∩ 本阶段)
   */
  private calculateAssistOverlapHours(
    assistStartTimeStr: string | null,
    assistEndTimeStr: string | null,
    phaseStartTime: string,
    phaseEndTime: string,
    workTimeSettings: any,
    attendanceRecords: any[],
    exceptionReports: ExceptionReport[],
    taskId?: number // 添加任务ID参数用于调试
  ): number {
    if (!assistStartTimeStr || !assistEndTimeStr) {
      return 0;
    }

    const assistStart = new Date(assistStartTimeStr);
    const assistEnd = new Date(assistEndTimeStr);
    if (isNaN(assistStart.getTime()) || isNaN(assistEnd.getTime()) || assistStart >= assistEnd) {
      return 0;
    }

    const phaseStart = new Date(phaseStartTime);
    const phaseEnd = new Date(phaseEndTime);
    if (isNaN(phaseStart.getTime()) || isNaN(phaseEnd.getTime()) || phaseStart >= phaseEnd) {
      return 0;
    }
    
    // 检查协助时间与阶段时间是否有重叠
    if (assistEnd <= phaseStart || assistStart >= phaseEnd) {
      return 0;
    }

    let totalAssist = 0;
    let totalAssistInException = 0;

    // 按天循环，类似 calculateActualWorkHoursWithShifts
    const startDate = new Date(phaseStart.getFullYear(), phaseStart.getMonth(), phaseStart.getDate());
    const endDate = new Date(phaseEnd.getFullYear(), phaseEnd.getMonth(), phaseEnd.getDate());

    for (let d = new Date(startDate.getTime()); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayStr = TimeUtils.getLocalDateString(d);

      const workWindows = this.getWorkWindowsForDay(workTimeSettings, dayStr);
      const overtimeWindows = this.getOvertimePeriodsForDay(attendanceRecords, dayStr);
      const dayExceptions = this.getExceptionPeriodsForDay(exceptionReports, dayStr);

      // 协助 ∩ 作息/加班 ∩ 本阶段
      const addOverlap = (winStartStr: string | Date, winEndStr: string | Date) => {
        const winStart =
          typeof winStartStr === 'string' ? new Date(`${dayStr}T${winStartStr}`) : new Date(winStartStr);
        const winEnd =
          typeof winEndStr === 'string' ? new Date(`${dayStr}T${winEndStr}`) : new Date(winEndStr);

        const segStart = new Date(Math.max(assistStart.getTime(), phaseStart.getTime(), winStart.getTime()));
        const segEnd = new Date(Math.min(assistEnd.getTime(), phaseEnd.getTime(), winEnd.getTime()));
        if (segEnd > segStart) {
          totalAssist += (segEnd.getTime() - segStart.getTime()) / (1000 * 60 * 60);
        }
      };

      workWindows.forEach(w => addOverlap(w.start, w.end));
      overtimeWindows.forEach(w => addOverlap(w.start, w.end));

      // 协助 ∩ 异常 ∩ 作息/加班 ∩ 本阶段
      const addExceptionOverlap = (winStartStr: string | Date, winEndStr: string | Date, exStartStr: string, exEndStr: string) => {
        const winStart =
          typeof winStartStr === 'string' ? new Date(`${dayStr}T${winStartStr}`) : new Date(winStartStr);
        const winEnd =
          typeof winEndStr === 'string' ? new Date(`${dayStr}T${winEndStr}`) : new Date(winEndStr);

        const exStart = new Date(exStartStr);
        const exEnd = new Date(exEndStr);
        if (isNaN(exStart.getTime()) || isNaN(exEnd.getTime()) || exStart >= exEnd) return;

        const segStart = new Date(
          Math.max(assistStart.getTime(), phaseStart.getTime(), winStart.getTime(), exStart.getTime())
        );
        const segEnd = new Date(
          Math.min(assistEnd.getTime(), phaseEnd.getTime(), winEnd.getTime(), exEnd.getTime())
        );
        if (segEnd > segStart) {
          totalAssistInException += (segEnd.getTime() - segStart.getTime()) / (1000 * 60 * 60);
        }
      };

      dayExceptions.forEach(ex => {
        // 注意：getExceptionPeriodsForDay 返回的是 { start: string; end: string }
        const exStart = `${dayStr}T${ex.start}`;
        const exEnd = `${dayStr}T${ex.end}`;
        if (!exStart || !exEnd) return;
        workWindows.forEach(w => addExceptionOverlap(w.start, w.end, exStart, exEnd));
        overtimeWindows.forEach(w => addExceptionOverlap(w.start, w.end, exStart, exEnd));
      });
    }

    const assistEffective = totalAssist - totalAssistInException;
    return assistEffective > 0 ? assistEffective : 0;
  }

  openExportModal() {
    // 默认使用当前筛选区的日期
    this.exportStartDate = this.startDate || this.monthlyStartDate || '';
    this.exportEndDate = this.endDate || this.monthlyEndDate || '';
    this.exportType = 'detail';
    this.isExportModalOpen = true;
  }

  closeExportModal() {
    this.isExportModalOpen = false;
  }

  async confirmExport() {
    if (!this.exportStartDate || !this.exportEndDate) {
      this.presentToast('请先选择导出的开始日期和结束日期');
      return;
    }

    const start = new Date(this.exportStartDate);
    const end = new Date(this.exportEndDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      this.presentToast('导出日期范围无效');
      return;
    }

    try {
      if (this.exportType === 'detail') {
        await this.exportDetailEfficiency(start, end);
      } else {
        await this.exportMonthlyEfficiency(start, end);
      }
      this.presentToast('导出成功');
      this.closeExportModal();
    } catch (e) {
      console.error('导出失败', e);
      this.presentToast('导出失败，请稍后重试');
    }
  }

  // 导出效率明细（按任务 + 阶段）
  private async exportDetailEfficiency(start: Date, end: Date) {
    const rows = this.efficiencyData.filter(entry => {
      if (!entry.phaseEndTime) return false;
      const d = new Date(entry.phaseEndTime);
      if (isNaN(d.getTime())) return false;
      const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      return dOnly >= start && dOnly <= end;
    });

    if (rows.length === 0) {
      this.presentToast('所选日期范围内没有效率明细数据');
      return;
    }

    const data: any[][] = [];
    const header = [
      '任务ID',
      '任务名称',
      '阶段',
      '负责人',
      '标准工时(h)',
      '实际工时(h)',
      '有效工时(h)',
      '异常时长(h)',
      '效率(%)',
      '完工日期'
    ];
    data.push(header);

    rows.forEach(entry => {
      const assignee = this.getTaskAssigneeName(entry.task, entry.phase) || '-';
      const effective = (entry.actualWorkHours || 0) - (entry.exceptionHours || 0) - (entry.assistHours || 0);
      const efficiency = entry.standardHours > 0
        ? ((effective / entry.standardHours) * 100)
        : 0;
      const endDate = entry.phaseEndTime
        ? new Date(entry.phaseEndTime).toLocaleDateString('zh-CN')
        : '-';

      data.push([
        entry.task.id,
        entry.task.name,
        this.getPhaseDisplayName(entry.phase),
        assignee,
        Number(entry.standardHours || 0),
        Number(entry.actualWorkHours || 0),
        Number(effective.toFixed(2)),
        Number((entry.exceptionHours || 0).toFixed(2)),
        Number(efficiency.toFixed(2)),
        endDate
      ]);
    });

    const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(data);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '效率明细');
    const dateStr = `${this.exportStartDate}_${this.exportEndDate}`;
    XLSX.writeFile(wb, `效率明细_${dateStr}.xlsx`);
  }

  // 导出月度汇总（按员工 + 月份）
  private async exportMonthlyEfficiency(start: Date, end: Date) {
    const rows = this.getFilteredMonthlyResults().filter(item => {
      const [year, month] = item.monthKey.split('-').map(Number);
      const monthDate = new Date(year, month - 1, 1);
      if (isNaN(monthDate.getTime())) return false;
      const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
      const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
      return monthDate >= startMonth && monthDate <= endMonth;
    });

    if (rows.length === 0) {
      this.presentToast('所选日期范围内没有月度汇总数据');
      return;
    }

    const data: any[][] = [];
    const header = [
      '员工',
      '月份',
      '标准工时(h)',
      '有效工时(h)',
      '效率(%)'
    ];
    data.push(header);

    rows.forEach(item => {
      data.push([
        item.employee,
        item.monthLabel,
        item.standardHours,
        item.actualHours,
        item.efficiency
      ]);
    });

    const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(data);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '月度效率汇总');
    const dateStr = `${this.exportStartDate}_${this.exportEndDate}`;
    XLSX.writeFile(wb, `月度效率汇总_${dateStr}.xlsx`);
  }

  /**
   * 计算当前月度效率结果的整体合计（可用于显示 1-3 月总效率等）
   * 如果设置了“用户筛选”，则只统计匹配该用户的行
   */
  getMonthlyTotal() {
    const list = this.getFilteredMonthlyResults();
    if (!list || list.length === 0) {
      return { standardHours: 0, actualHours: 0, efficiency: 0 };
    }

    let totalStandard = 0;
    let totalActual = 0;

    list.forEach(item => {
      totalStandard += item.standardHours || 0;
      totalActual += item.actualHours || 0;
    });

    const efficiency =
      totalStandard > 0 ? Number(((totalActual / totalStandard) * 100).toFixed(2)) : 0;

    return {
      standardHours: Number(totalStandard.toFixed(2)),
      actualHours: Number(totalActual.toFixed(2)),
      efficiency
    };
  }

  // 获取异常时间段详情是否可见
  getExceptionDetailsVisible(taskId: number, phase: string): boolean {
    const key = `${taskId}-${phase}`;
    return this.exceptionDetailsVisible.get(key) || false;
  }

  // 切换报工记录详情显示
  toggleWorkReportsDetails(taskId: number, phase: string): void {
    const key = `${taskId}-${phase}`;
    const current = this.workReportsDetailsVisible.get(key) || false;
    this.workReportsDetailsVisible.set(key, !current);
  }

  // 获取报工记录详情是否可见
  getWorkReportsDetailsVisible(taskId: number, phase: string): boolean {
    const key = `${taskId}-${phase}`;
    return this.workReportsDetailsVisible.get(key) || false;
  }

  // 获取逐日计算详情
  getDayCalculationDetails(taskId: number, phase: string): any[] {
    const key = `${taskId}-${phase}`;
    return this.dayCalculationDetails.get(key) || [];
  }

  // 计算逐日详情
  private calculateDayDetails(taskId: number, phase: string): void {
    const key = `${taskId}-${phase}`;
    const efficiencyData = this.efficiencyData.find(data => 
      data.task.id === taskId && data.phase === phase
    );
    
    if (!efficiencyData) return;

    const dayDetails: any[] = [];
    
    // 如果有单日计算详情，直接使用
    if (efficiencyData.dailyCalculations) {
      Object.keys(efficiencyData.dailyCalculations).forEach(date => {
        const dailyCalc = efficiencyData.dailyCalculations![date];
        dayDetails.push({
          date: date,
          totalHours: dailyCalc.totalHours, // 单日与阶段的重叠时长
          effectiveHours: dailyCalc.effectiveHours, // 单日有效工时
          workWindowOverlap: 0, // 这些字段暂时设为0，因为我们使用新的计算方式
          overtimeOverlap: 0,
          leaveDeduction: 0,
          exceptionDeduction: 0,
          attendanceLimit: 0,
          finalHours: dailyCalc.effectiveHours
        });
      });
      this.dayCalculationDetails.set(key, dayDetails);
      return;
    }

    // 如果没有单日计算详情，使用旧的计算方式
    const start = new Date(efficiencyData.phaseStartTime);
    const end = new Date(efficiencyData.phaseEndTime);

    // 逐日计算 - 使用TimeUtils确保包含结束日期的整天
    const endOfLastDay = TimeUtils.createEndOfDay(end);
    
    for (let d = new Date(start); d <= endOfLastDay; d.setDate(d.getDate() + 1)) {
      const currentDay = TimeUtils.getLocalDateString(d);
      
      // 添加调试信息 - 检查所有日期的计算
      if (currentDay.startsWith('2025-10-')) {
        console.log(`日期调试 - ${currentDay}:`, {
          currentDay,
          start: start.toISOString(),
          end: end.toISOString(),
          d: d.toISOString(),
          attendanceRecordsCount: efficiencyData.attendanceRecords.length
        });
      }
      
      const dayAttendance = efficiencyData.attendanceRecords.find(rec => {
        // 使用TimeUtils统一处理日期比较
        const recDate = TimeUtils.utcToLocalDate(rec.date);
        return TimeUtils.isSameDay(recDate, d);
      });
      
      // 添加调试信息
      if (currentDay === '2025-10-21') {
        console.log('10.21调试 - 考勤记录查找:', {
          currentDay,
          attendanceRecordsCount: efficiencyData.attendanceRecords.length,
          attendanceRecords: efficiencyData.attendanceRecords.map(rec => ({
            id: rec.id,
            date: rec.date,
            actual_hours: rec.actual_hours
          })),
          found: !!dayAttendance
        });
      }
      
      if (!dayAttendance) {
        if (currentDay.startsWith('2025-10-')) {
          console.log(`跳过日期 ${currentDay} - 没有考勤记录`);
        }
        continue;
      }

      // 模拟计算过程（实际应该调用真实计算方法）
      const workWindowOverlap = this.calculateWorkWindowOverlap(currentDay, start, end);
      const overtimeOverlap = this.calculateOvertimeOverlap(dayAttendance, currentDay, start, end);
      const leaveDeduction = this.calculateLeaveDeduction(dayAttendance, currentDay);
      const exceptionDeduction = this.calculateExceptionDeduction(efficiencyData.exceptionReports, currentDay, efficiencyData.attendanceRecords);
      
      // 调试异常扣除计算
      if (currentDay === '2025-10-20' && efficiencyData.task.id === 1493) {
        console.log(`任务1493 - 2025-10-20异常扣除调试:`, {
          currentDay,
          exceptionReportsCount: efficiencyData.exceptionReports.length,
          exceptionReports: efficiencyData.exceptionReports.map(ex => ({
            id: ex.id,
            start_time: ex.start_time || ex.exception_start_datetime,
            end_time: ex.end_time || ex.exception_end_datetime,
            exception_type: ex.exception_type
          })),
          workWindowOverlap,
          overtimeOverlap,
          leaveDeduction,
          exceptionDeduction,
          effectiveHours: workWindowOverlap + overtimeOverlap - leaveDeduction - exceptionDeduction
        });
      }
      
      const effectiveHours = workWindowOverlap + overtimeOverlap - leaveDeduction - exceptionDeduction;
      const attendanceLimit = dayAttendance.actual_hours || dayAttendance.standard_attendance_hours || 0;
      const finalHours = Math.min(Math.max(0, effectiveHours), attendanceLimit);

      dayDetails.push({
        date: currentDay,
        workWindowOverlap: workWindowOverlap,
        overtimeOverlap: overtimeOverlap,
        leaveDeduction: leaveDeduction,
        exceptionDeduction: exceptionDeduction,
        effectiveHours: effectiveHours,
        attendanceLimit: attendanceLimit,
        finalHours: finalHours
      });
    }

    this.dayCalculationDetails.set(key, dayDetails);
  }

  // 计算作息时间重叠
  private calculateWorkWindowOverlap(currentDay: string, phaseStart: Date, phaseEnd: Date): number {
    if (!this.workTimeSettings) return 0;
    
    const workWindows = this.getWorkWindowsForDay(this.workTimeSettings, currentDay);
    let totalOverlap = 0;
    
    workWindows.forEach(window => {
      // 使用TimeUtils创建本地时间的工作窗口
      const windowStart = TimeUtils.createLocalDateTime(currentDay, window.start);
      const windowEnd = TimeUtils.createLocalDateTime(currentDay, window.end);
      
      // 使用TimeUtils计算重叠小时数
      totalOverlap += TimeUtils.calculateOverlapHours(
        windowStart, 
        windowEnd, 
        phaseStart, 
        phaseEnd
      );
    });
    
    return totalOverlap;
  }

  // 计算加班时间重叠
  private calculateOvertimeOverlap(dayAttendance: any, currentDay: string, phaseStart: Date, phaseEnd: Date): number {
    if (!dayAttendance.overtime_start_time || !dayAttendance.overtime_end_time) return 0;
    
    // 使用TimeUtils创建本地时间的加班时段
    const overtimeStart = TimeUtils.createLocalDateTime(currentDay, dayAttendance.overtime_start_time);
    const overtimeEnd = TimeUtils.createLocalDateTime(currentDay, dayAttendance.overtime_end_time);
    
    // 使用TimeUtils计算重叠小时数
    return TimeUtils.calculateOverlapHours(
      overtimeStart, 
      overtimeEnd, 
      phaseStart, 
      phaseEnd
    );
  }

  // 计算请假扣除
  private calculateLeaveDeduction(dayAttendance: any, currentDay: string): number {
    if (!dayAttendance.leave_start_time || !dayAttendance.leave_end_time || !this.workTimeSettings) return 0;
    
    const workWindows = this.getWorkWindowsForDay(this.workTimeSettings, currentDay);
    let totalDeduction = 0;
    
    workWindows.forEach(window => {
      totalDeduction += TimeUtils.calculateOverlapHours(
        TimeUtils.createLocalDateTime(currentDay, dayAttendance.leave_start_time), 
        TimeUtils.createLocalDateTime(currentDay, dayAttendance.leave_end_time), 
        TimeUtils.createLocalDateTime(currentDay, window.start), 
        TimeUtils.createLocalDateTime(currentDay, window.end)
      );
    });
    
    return totalDeduction;
  }

  // 计算异常扣除
  private calculateExceptionDeduction(exceptionReports: any[], currentDay: string, attendanceRecords: any[] = []): number {
    if (!this.workTimeSettings) return 0;
    
    const dayExceptions = exceptionReports.filter(exception => {
      const ed = new Date(exception.exception_start_datetime || exception.start_time);
      const exceptionDate = `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, '0')}-${String(ed.getDate()).padStart(2, '0')}`;
      return exceptionDate === currentDay;
    });
    
    let totalDeduction = 0;
    const workWindows = this.getWorkWindowsForDay(this.workTimeSettings, currentDay);
    
    dayExceptions.forEach(exception => {
      const exceptionStart = new Date(exception.exception_start_datetime || exception.start_time);
      const exceptionEnd = new Date(exception.exception_end_datetime || exception.end_time);
      
      // 与作息时间的重叠
      workWindows.forEach(window => {
        totalDeduction += TimeUtils.calculateOverlapHours(
          exceptionStart, 
          exceptionEnd, 
          TimeUtils.createLocalDateTime(currentDay, window.start), 
          TimeUtils.createLocalDateTime(currentDay, window.end)
        );
      });
      
      // 与加班时间的重叠
      const overtimePeriods = this.getOvertimePeriodsForDay(attendanceRecords, currentDay);
      overtimePeriods.forEach(overtime => {
        totalDeduction += TimeUtils.calculateOverlapHours(
          exceptionStart,
          exceptionEnd,
          TimeUtils.createLocalDateTime(currentDay, overtime.start),
          TimeUtils.createLocalDateTime(currentDay, overtime.end)
        );
      });
    });
    
    return totalDeduction;
  }

  async refreshSettingsAndRecalc() {
    this.loading = true;
    try {
      const workTimeSettings = await this.loadWorkTimeSettings();
      if (!workTimeSettings) {
        console.error('无法加载工作时间设置');
        return;
      }
      // 重新统计（内部会在finally里调用applyFilters）
      await this.calculateAllCompletedPhases();
    } catch (e) {
      console.error('刷新设置并重算失败:', e);
      this.loading = false;
    }
  }

  // 打开编辑标准工时模态框
  openEditStandardHoursModal(task: Task, phase: string) {
    // 员工角色不允许修改标准工时
    if (this.currentUser?.role === 'worker') {
      this.presentToast('员工无权修改标准工时');
      return;
    }
    
    if (task.is_non_standard !== 1) {
      this.presentToast('只有非标任务可以编辑标准工时');
      return;
    }
    
    // 检查任务是否已确认
    const confirmKey = this.getTaskConfirmKey(task.id, phase);
    if (this.confirmedTasks.has(confirmKey)) {
      this.presentToast('已确认的任务不允许修改标准工时');
      return;
    }
    
    this.editingTask = task;
    this.editingPhase = phase;
    
    // 获取当前阶段的标准工时
    const currentHours = this.getStandardHoursForPhase(task, phase);
    this.editingStandardHours = currentHours;
    
    this.isEditStandardHoursModalOpen = true;
  }

  // 关闭编辑标准工时模态框
  closeEditStandardHoursModal() {
    this.isEditStandardHoursModalOpen = false;
    this.editingTask = null;
    this.editingPhase = '';
    this.editingStandardHours = 0;
  }

  // 保存标准工时
  async saveStandardHours() {
    if (!this.editingTask || !this.editingPhase) {
      return;
    }
    
    if (!this.editingStandardHours || this.editingStandardHours <= 0) {
      this.presentToast('请输入有效的标准工时');
      return;
    }
    
    try {
      const base = this.getApiBase();
      
      // 根据阶段确定要更新的字段名
      const fieldMap: { [key: string]: string } = {
        'machining': 'machining_hours_est',
        'electrical': 'electrical_hours_est',
        'pre_assembly': 'pre_assembly_hours_est',
        'post_assembly': 'post_assembly_hours_est',
        'debugging': 'debugging_hours_est'
      };
      
      const fieldName = fieldMap[this.editingPhase];
      if (!fieldName) {
        this.presentToast('无效的阶段');
        return;
      }
      
      // 更新任务的标准工时
      const updateData: any = {};
      updateData[fieldName] = this.editingStandardHours;
      
      await this.http.put(`${base}/api/tasks/${this.editingTask.id}`, updateData).toPromise();
      
      this.presentToast('标准工时更新成功');
      this.closeEditStandardHoursModal();
      
      // 重新加载任务数据并重新计算效率
      await this.loadTasks();
      await this.calculateAllCompletedPhases();
      this.applyFilters();
    } catch (error: any) {
      console.error('更新标准工时失败:', error);
      this.presentToast(error.error?.message || '更新标准工时失败');
    }
  }

  calculateMonthlyEfficiency() {
    const userKeyword = this.selectedUser?.trim().toLowerCase() || '';
    // 按 员工 + 月份 汇总： key = `${employee}__${monthKey}`
    const aggregates = new Map<string, { employee: string; monthKey: string; monthLabel: string; standard: number; actual: number }>();

    // 解析日期区间（按阶段结束时间的“日期部分”来比较）
    let rangeStart: Date | null = null;
    let rangeEnd: Date | null = null;

    if (this.monthlyStartDate) {
      const d = new Date(this.monthlyStartDate);
      if (isNaN(d.getTime())) {
        this.presentToast('开始日期格式无效');
        return;
      }
      rangeStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    if (this.monthlyEndDate) {
      const d = new Date(this.monthlyEndDate);
      if (isNaN(d.getTime())) {
        this.presentToast('结束日期格式无效');
        return;
      }
      rangeEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    if (rangeStart && rangeEnd && rangeStart > rangeEnd) {
      this.presentToast('开始日期不能晚于结束日期');
      return;
    }

    this.efficiencyData.forEach(entry => {
      if (!entry.phaseEndTime) return;
      const phaseEnd = new Date(entry.phaseEndTime);
      if (isNaN(phaseEnd.getTime())) return;

      // 只取结束时间的日期部分
      const phaseEndDateOnly = new Date(
        phaseEnd.getFullYear(),
        phaseEnd.getMonth(),
        phaseEnd.getDate()
      );

      // 日期区间过滤（含首尾）
      if (rangeStart && phaseEndDateOnly < rangeStart) {
        return;
      }
      if (rangeEnd && phaseEndDateOnly > rangeEnd) {
        return;
      }

      const assigneeName = this.getTaskAssigneeName(entry.task, entry.phase) || '未指定';
      if (userKeyword && !assigneeName.toLowerCase().includes(userKeyword)) {
        return;
      }

      // 计算月份 key & label
      const monthKey = `${phaseEnd.getFullYear()}-${String(phaseEnd.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = `${phaseEnd.getFullYear()}年${phaseEnd.getMonth() + 1}月`;
      const aggKey = `${assigneeName}__${monthKey}`;

      let agg = aggregates.get(aggKey);
      if (!agg) {
        agg = { employee: assigneeName, monthKey, monthLabel, standard: 0, actual: 0 };
        aggregates.set(aggKey, agg);
      }

      agg.standard += Number(entry.standardHours || 0);
      const effectiveHours = (entry.actualWorkHours || 0) - (entry.exceptionHours || 0) - (entry.assistHours || 0);
      agg.actual += effectiveHours > 0 ? effectiveHours : 0;
    });

    if (aggregates.size === 0) {
      this.monthlyEfficiencyResults = [];
      const userHint = userKeyword ? `且匹配“${this.selectedUser}”` : '';
      const rangeHint =
        this.monthlyStartDate || this.monthlyEndDate
          ? `${this.monthlyStartDate || '最早'} 至 ${this.monthlyEndDate || '最晚'}`
          : '全部日期';
      this.presentToast(`在${rangeHint}${userHint}没有完成的阶段任务`);
      return;
    }

    this.monthlyEfficiencyResults = Array.from(aggregates.values())
      .map(item => ({
        employee: item.employee,
        monthKey: item.monthKey,
        monthLabel: item.monthLabel,
        standardHours: Number(item.standard.toFixed(2)),
        actualHours: Number(item.actual.toFixed(2)),
        efficiency:
          item.standard > 0
            ? Number(((item.actual / item.standard) * 100).toFixed(2))
            : 0
      }))
      // 排序：同一员工内部按月份倒序，员工按名称排序
      .sort((a, b) => {
        if (a.employee === b.employee) {
          return b.monthKey.localeCompare(a.monthKey);
        }
        return a.employee.localeCompare(b.employee, 'zh-CN');
      });
  }
}

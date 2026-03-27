import { Component, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastController, AlertController } from '@ionic/angular';
import { timeout, catchError } from 'rxjs/operators';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';
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
  device_number?: string | null;
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
  device_efficiency?: number | null; // 设备效率快照(%)，来自后台tasks表
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
  // 计算后的实际异常时间（用于显示）
  calculated_hours?: number;
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
  dailyCalculations?: { [date: string]: { 
    totalHours: number; 
    effectiveHours: number; 
    workWindowOverlap?: number;
    overtimeOverlap?: number;
    pauseDeduction?: number;
    leaveDeduction?: number;
    exceptionDeduction?: number;
    attendanceLimit?: number;
    finalHours?: number;
  } }; // 单日计算详情
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
    // 调试日志已关闭，如需调试可暂时取消注释
    // console.log(`${label}:`, {
    //   iso: date.toISOString(),
    //   local: date.toLocaleString('zh-CN'),
    //   dateString: this.getLocalDateString(date),
    //   timeString: this.getLocalTimeString(date),
    //   timestamp: date.getTime()
    // });
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
  private alertController = inject(AlertController);
  
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
  tableNonStandardFilter: string = ''; // 非标筛选：''全部，'non_standard'仅非标，'standard'仅标准
  
  // 分页相关
  pageSize: number = 50; // 每页显示条数，默认50
  currentPage: number = 1; // 当前页码
  paginatedEfficiencyData: EfficiencyData[] = []; // 分页后的数据
  
  // 月度汇总表头筛选条件
  monthlyTableEmployeeFilter: string = ''; // 员工筛选
  monthlyTableMonthFilter: string = '';    // 月份筛选（按显示文字模糊匹配）
  monthlyTableEfficiencySort: string = ''; // 效率排序

  // 导出相关状态
  isExportModalOpen = false;
  exportType: 'detail' | 'monthly' | 'device' = 'detail';
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
  
  // 设备效率结果（按 产品型号/设备号 汇总）
  deviceEfficiencyResults: {
    deviceKey: string;  // 产品型号或设备号
    deviceLabel: string; // 显示标签（型号 + 设备号）
    standardHours: number;
    actualHours: number;
    efficiency: number;
    taskCount: number; // 任务数量
    isCompleted: boolean; // 是否已完成（所有阶段都已完成）
  }[] = [];
  
  // 设备汇总表头筛选条件
  deviceTableModelFilter: string = ''; // 型号/设备号筛选
  deviceTableEfficiencySort: string = ''; // 效率排序
  deviceTableCompletionFilter: string = ''; // 完成状态筛选：'completed'已完成, 'incomplete'未完成, ''全部
  
  // 表格展开/收起状态
  isMonthlyTableExpanded: boolean = true; // 月度效率汇总表是否展开
  isDeviceTableExpanded: boolean = true; // 设备效率汇总表是否展开
  
  // 可用选项
  availableUsers: string[] = [];
  availableModels: string[] = [];

  // 工作时间设置（从后端加载）
  private workTimeSettings: WorkTimeSettings | null = null;
  
  // 节假日数据（用于工作日计算）
  private holidays: Set<string> = new Set(); // 存储节假日日期，格式: "YYYY-MM-DD"
  private workingDays: Set<string> = new Set(); // 存储调休日（周末但需要上班），格式: "YYYY-MM-DD"

  // 已确认的任务效率（7个工作日前的任务）
  confirmedTasks: Set<string> = new Set(); // 存储已确认的任务，格式: "taskId_phase"
  
  // 防止自动确认时的无限循环
  private isAutoConfirming = false;
  
  // 已确认任务数量（用于界面显示）
  confirmedTasksCount: number = 0;
  
  // 标准工时缓存（按产品型号+阶段缓存）
  private standardHoursCache: Map<string, number> = new Map();
  
  // 计算过程详情显示控制
  private calculationDetailsVisible = new Map<string, boolean>();
  
  // 计算步骤列表展开状态控制
  private calculationStepsExpanded = new Map<string, boolean>();
  
  // 逐日计算详情缓存
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
        // 调试日志已关闭，如需排查问题可临时打开
        // console.log('当前用户信息:', this.currentUser);
        // console.log('用户角色:', this.currentUser?.role);
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
    // 调试日志已关闭，如需排查问题可临时打开
    // console.log('isAdmin() 检查结果:', isAdmin, '用户角色:', this.currentUser.role);
    return isAdmin;
  }

  // 加载节假日数据（直接从考勤日历读取）
  private async loadHolidays(): Promise<void> {
    try {
      // 直接从考勤日历读取放假日期
      await this.loadHolidaysFromBackend();
    } catch (error) {
      console.error('加载节假日失败:', error);
      this.holidays = new Set(); // 失败时使用空集合
      this.workingDays = new Set();
    }
  }

  // 验证节假日数据
  private validateHolidays(holidayEntries: Array<{ date: string; name: string }>, year: number): void {
    // 调试日志已关闭，如需验证节假日数据可暂时打开
    // console.log('========== 节假日数据验证 ==========');
    // console.log(`验证年份: ${year}`);
    // console.log(`总节假日数量: ${holidayEntries.length}`);
    // console.log('前5个节假日数据示例:', holidayEntries.slice(0, 5));
    
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
              return null;
            }
          })
          .filter((date): date is string => date !== null)
          .sort();
        
        // 检查匹配情况
        const matchedDates = holiday.expectedDates.filter(date => foundDates.includes(date));
        const allFound = matchedDates.length === holiday.expectedDates.length;
        const exactMatch = allFound && foundDates.length === holiday.expectedDates.length;
        
        // 这里原本有详细的节假日验证日志，为提高效率统计页面性能已关闭
      });
    }
    
    // 显示所有节假日（按日期排序）
    // 原有的节假日列表调试日志已关闭
  }

  // 从考勤日历加载放假日期（只加载最近若干天，保证有足够的工作日用于计算“7个工作日前”）
  // 除开放假全是工作日
  private async loadHolidaysFromBackend(): Promise<void> {
    try {
      const base = this.getApiBase();
      
      // 向前回溯的自然日天数，用来覆盖「7个工作日」的计算区间
      // 60 天是一个比较保守的值：即使有连续长假也足够
      const daysBack = 30;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const startDateObj = new Date(today);
      startDateObj.setDate(startDateObj.getDate() - daysBack);

      const startDate = startDateObj.toISOString().slice(0, 10); // YYYY-MM-DD
      const endDate = today.toISOString().slice(0, 10);          // YYYY-MM-DD

      const holidayDates = new Set<string>();

      // 只请求这段时间的日考勤
        const attendanceResponse: any = await this.http.get(`${base}/api/daily-attendance`, {
          params: {
            start: startDate,
            end: endDate,
          pageSize: daysBack + 10 // 预留一点富余
          }
        }).toPromise();
        
        if (attendanceResponse?.list && Array.isArray(attendanceResponse.list)) {
          // 从考勤记录中提取放假日期
        // 数据结构：后端返回的是所有工人的考勤记录，每条记录是 (日期 × 工人)
        // 优化：只遍历一次，用Map记录每个日期的考勤情况
        
        // Map<日期, { hasWork: boolean, checked: boolean }>
        // hasWork: 该日期是否有任何工人有考勤
        // checked: 该日期是否已检查过所有记录（用于判断是否所有工人都没有考勤）
        const dateStatus = new Map<string, { hasWork: boolean; recordCount: number }>();
        
        // 只遍历一次，记录每个日期的考勤情况
          attendanceResponse.list.forEach((record: any) => {
          if (!record.date) return;
            
              const dateStr = record.date instanceof Date 
                ? record.date.toISOString().slice(0, 10) 
                : record.date;
              if (dateStr && dateStr.length >= 10) {
            const normalizedDate = dateStr.substring(0, 10); // YYYY-MM-DD
            
            // 初始化或获取该日期的状态
            if (!dateStatus.has(normalizedDate)) {
              dateStatus.set(normalizedDate, { hasWork: false, recordCount: 0 });
            }
            const status = dateStatus.get(normalizedDate)!;
            status.recordCount++;
            
            // 如果该日期已经标记为有考勤，跳过（避免重复检查）
            if (status.hasWork) {
              return;
            }
            
            // 检查该记录是否有考勤（standard_attendance_hours > 0 或 overtime_hours > 0）
            const standardHours = record.standard_attendance_hours || 0;
            const overtimeHours = record.overtime_hours || 0;
            
            if (standardHours > 0 || overtimeHours > 0) {
              // 该日期有工人有考勤，标记为工作日
              status.hasWork = true;
              }
            }
          });
          
        // 对于有考勤记录的日期，如果所有工人都没有考勤，则认为是放假
        dateStatus.forEach((status, dateStr) => {
          // 如果该日期有考勤记录，但所有工人都没有考勤，则认为是放假
          if (!status.hasWork && status.recordCount > 0) {
            holidayDates.add(dateStr);
        }
        });
      }

      this.holidays = holidayDates;
      this.workingDays = new Set(); // 考勤日历不提供调休日信息
    } catch (error) {
      console.error('加载节假日数据失败:', error);
      this.holidays = new Set(); // 失败时使用空集合
      this.workingDays = new Set();
    }
  }

  // 判断日期是否为节假日
  private isHoliday(date: Date): boolean {
    const dateStr = TimeUtils.getLocalDateString(date);
    return this.holidays.has(dateStr);
  }

  // 判断日期是否为工作日
  // 除开放假日期外，其他日期均为工作日（包括周末，除非是放假）
  private isWorkingDay(date: Date): boolean {
    const dateStr = TimeUtils.getLocalDateString(date);
    
    // 如果日期在放假列表中，则不是工作日
    if (this.holidays.has(dateStr)) {
      return false;
    }
    
    // 除开放假，其他全是工作日（包括周末）
    return true;
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

  // 加载已确认的任务（从后端 task_efficiency 表）
  private loadConfirmedTasks(): void {
    this.confirmedTasks = new Set();
    this.confirmedTasksCount = 0;

    try {
      const base = this.getApiBase();
      // 只加载 is_confirmed=1 的任务阶段
      this.http
        .get<any[]>(`${base}/api/task-efficiency`, { params: { isConfirmed: '1' } })
        .toPromise()
        .then(rows => {
          const list = rows || [];
          list.forEach(row => {
            const key = this.getTaskConfirmKey(row.task_id, row.phase);
            this.confirmedTasks.add(key);
          });
          this.confirmedTasksCount = this.confirmedTasks.size;

          // 可选：同步一份到 localStorage，仅作缓存，不作为真相源
          try {
            const confirmedArray = Array.from(this.confirmedTasks);
            localStorage.setItem('confirmedEfficiencyTasks', JSON.stringify(confirmedArray));
          } catch (e) {
            console.error('缓存已确认任务到 localStorage 失败:', e);
          }
        })
        .catch(err => {
          console.error('从后端加载已确认任务失败:', err);
        });
    } catch (error) {
      console.error('初始化已确认任务失败:', error);
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

  // 从数据库加载已确认任务的数据
  private async loadConfirmedTasksDataFromDatabase(): Promise<Map<string, EfficiencyData[]>> {
    const confirmedDataMap = new Map<string, EfficiencyData[]>();
    try {
      const base = this.getApiBase();
      const response = await this.http.get<any[]>(`${base}/api/task-efficiency`, { 
        params: { isConfirmed: '1' } 
      }).toPromise();
      
      if (!response || response.length === 0) {
        return confirmedDataMap;
      }

      // 获取所有任务信息（用于构建 EfficiencyData）
      const tasksResponse = await this.http.get<any>(`${base}/api/tasks`).toPromise();
      const allTasks: Task[] = tasksResponse || [];
      const tasksMap = new Map<number, Task>();
      allTasks.forEach(task => {
        tasksMap.set(task.id, task);
      });
      

      let skippedCount = 0;
      const skippedTasks: number[] = [];
      let duplicateKeyCount = 0;
      const duplicateKeys: string[] = [];

      // 将数据库中的数据转换为 EfficiencyData 格式
      for (const row of response) {
        const task = tasksMap.get(row.task_id);
        if (!task) {
          skippedCount++;
          skippedTasks.push(row.task_id);
          continue;
        }

        const key = this.getTaskConfirmKey(row.task_id, row.phase);
        if (!confirmedDataMap.has(key)) {
          confirmedDataMap.set(key, []);
        } else {
          duplicateKeyCount++;
          if (!duplicateKeys.includes(key)) {
            duplicateKeys.push(key);
          }
        }

        // 构建 EfficiencyData 对象
        const efficiencyData: EfficiencyData = {
          task: task,
          phase: row.phase,
          standardHours: parseFloat(row.standard_hours) || 0,
          actualWorkHours: parseFloat(row.actual_work_hours) || 0,
          exceptionHours: parseFloat(row.exception_hours) || 0,
          assistHours: parseFloat(row.assist_hours) || 0,
          hasAssistTasks: false,
          efficiency: parseFloat(row.efficiency) || 0,
          workReports: [],
          exceptionReports: [],
          attendanceRecords: [],
          phaseStartTime: row.phase_start_time || '',
          phaseEndTime: row.phase_end_time || '',
          totalCalendarHours: 0,
          dailyCalculations: {}
        };

        confirmedDataMap.get(key)!.push(efficiencyData);
      }

      // 计算总数据条数
      let totalDataCount = 0;
      confirmedDataMap.forEach((dataArray) => {
        totalDataCount += dataArray.length;
      });

    } catch (error) {
      console.error('从数据库加载已确认任务数据失败:', error);
    }
    return confirmedDataMap;
  }

  // 将当前内存中的效率结果保存到后端 task_efficiency 表
  private async saveEfficiencySnapshotsToBackend(): Promise<void> {
    try {
      const base = this.getApiBase();

      const payloads = this.efficiencyData.map(data => {
        const confirmKey = this.getTaskConfirmKey(data.task.id, data.phase);
        const isConfirmed = this.confirmedTasks.has(confirmKey);

        // 根据阶段获取负责人ID
        let assigneeId: number | null = null;
        const task = data.task as Task;
        switch (data.phase) {
          case 'machining':
            assigneeId = task.machining_assignee || null;
            break;
          case 'electrical':
            assigneeId = task.electrical_assignee || null;
            break;
          case 'pre_assembly':
            assigneeId = task.pre_assembly_assignee || null;
            break;
          case 'post_assembly':
            assigneeId = task.post_assembly_assignee || null;
            break;
          case 'debugging':
            assigneeId = task.debugging_assignee || null;
            break;
          default:
            assigneeId = null;
        }

        return {
          taskId: data.task.id,
          phase: data.phase,
          assigneeId,
          standardHours: data.standardHours,
          actualWorkHours: data.actualWorkHours,
          exceptionHours: data.exceptionHours,
          assistHours: data.assistHours,
          efficiency: data.efficiency,
          phaseStartTime: data.phaseStartTime,
          phaseEndTime: data.phaseEndTime,
          isConfirmed,
          confirmedBy: isConfirmed ? this.currentUser?.id || null : null
        };
      });

      await Promise.all(
        payloads.map(p =>
          this.http.post(`${base}/api/task-efficiency`, p).toPromise().catch(err => {
            console.error('保存任务效率快照失败:', p.taskId, p.phase, err);
          })
        )
      );
    } catch (error) {
      console.error('批量保存任务效率快照失败:', error);
    }
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
    // 调试日志已关闭，如需查看控制台详情可临时打开下面的日志
    // console.log('========== 已确认的任务列表 ==========');
    // console.log(`总计: ${confirmedList.length} 个任务阶段`);
    // console.log('已确认的任务键值（格式: taskId_phase）:');
    // confirmedList.forEach((key, index) => {
    //   const [taskId, phase] = key.split('_');
    //   const phaseName = this.getPhaseDisplayName(phase);
    //   console.log(`  ${index + 1}. 任务ID: ${taskId}, 阶段: ${phaseName} (${key})`);
    // });
    // console.log('=====================================');
    
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
    
    // if (confirmedDetails.length > 0) {
    //   console.log('\n已确认任务的详细信息:');
    //   confirmedDetails.forEach((detail, index) => {
    //     console.log(`  ${index + 1}. [${detail.taskId}] ${detail.taskName} - ${detail.phase}`);
    //     console.log(`     完工日期: ${detail.endDate}, 效率: ${detail.efficiency}`);
    //   });
    // }
    
    this.presentToast(`已确认 ${confirmedList.length} 个任务阶段，详情请查看控制台`);
  }

  // 清除已确认的任务，恢复所有任务的计算
  async clearConfirmedTasks() {
    // 显示确认对话框
    const alert = await this.alertController.create({
      header: '确认清除',
      message: '确定要清除所有已确认的任务吗？这将清除所有已确认任务的数据，并重新计算所有任务。此操作不可恢复！',
      buttons: [
        {
          text: '取消',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: '确定清除',
          role: 'destructive',
          cssClass: 'danger',
          handler: async () => {
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
        }
      ]
    });

    await alert.present();
  }

  // 自动确认7个工作日前的任务效率（不显示提示，供内部调用）
  private async autoConfirmOldTasks(silent: boolean = true): Promise<void> {
    // 防止重复调用导致的无限循环
    if (this.isAutoConfirming) {
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
        await this.calculateAllCompletedPhases();
        
        // 恢复临时移除的确认标记
        tempRemovedKeys.forEach(key => {
          this.confirmedTasks.add(key);
        });
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
      
      // 将确认状态保存到数据库
      await this.saveEfficiencySnapshotsToBackend();
      
      // 更新已确认任务数量
      this.confirmedTasksCount = this.confirmedTasks.size;
      
      if (!silent) {
        this.presentToast(`已自动确认 ${tasksToConfirm.length} 个7个工作日前的任务`);
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
    const isNative = Capacitor.isNativePlatform();
    return isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
  }

  // 获取已批准的异常报告（完全使用后台记录的阶段，不再按时间推断）
  async loadApprovedExceptionReports(
    taskId: number,
    userId: number,
    startDate: string,
    endDate: string,
    task?: Task
  ): Promise<ExceptionReport[]> {
    try {
      const base = this.getApiBase();
      const params = new URLSearchParams({
        taskId: taskId.toString(),
        userId: userId.toString(),
        startDate,
        endDate
      });

      const response: any = await this.http.get(`${base}/api/exception-reports/approved?${params}`).toPromise();

      if (response.success && response.data) {
        // 直接使用后台返回的 phase 字段，不再根据时间或任务推断阶段
        return response.data.map((item: any) => ({
          id: item.id,
          task_id: item.task_id,
          user_id: item.user_id,
          user_name: item.user_name || '未知用户',
          phase: item.phase ?? '',
          exception_type: item.exception_type,
          description: item.description,
          start_time: item.exception_start_datetime,
          end_time: item.exception_end_datetime,
          duration_hours: this.calculateExceptionDuration(
            item.exception_start_datetime,
            item.exception_end_datetime
          ),
          status: item.status,
          created_at: item.submitted_at,
          exception_start_datetime: item.exception_start_datetime,
          exception_end_datetime: item.exception_end_datetime,
          approved_by: item.approved_by,
          approved_at: item.approved_at,
          approval_note: item.approval_note
        }));
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

  // 合并重叠的异常时间段
  private mergeOverlappingExceptionPeriods(exceptions: ExceptionReport[]): Array<{start: Date, end: Date}> {
    if (exceptions.length === 0) return [];
    
    // 提取所有有效的时间段并排序
    const periods = exceptions
      .map(ex => {
        const start = ex.start_time || ex.exception_start_datetime;
        const end = ex.end_time || ex.exception_end_datetime;
        if (!start || !end) return null;
        return {
          start: new Date(start),
          end: new Date(end)
        };
      })
      .filter((p): p is {start: Date, end: Date} => 
        p !== null && !isNaN(p.start.getTime()) && !isNaN(p.end.getTime())
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    
    if (periods.length === 0) return [];
    
    // 合并重叠的时间段
    const merged: Array<{start: Date, end: Date}> = [{...periods[0]}];
    
    for (let i = 1; i < periods.length; i++) {
      const current = periods[i];
      const last = merged[merged.length - 1];
      
      // 如果当前时间段与最后一个时间段重叠或相邻，则合并
      if (current.start.getTime() <= last.end.getTime()) {
        last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
      } else {
        merged.push({...current});
      }
    }
    
    return merged;
  }

  // 计算异常时间段与工作时间的重叠时长（仅统计对实际出勤有影响的部分）
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
    let totalLeaveOverlapHours = 0; // 异常 ∩ 请假 ∩（作息/加班）总时长
    
    // 逐日计算异常时间段与工作时间的重叠
    const endOfLastDay = TimeUtils.createEndOfDay(phaseEnd);
    const exceptionStartDate = TimeUtils.getLocalDateString(exceptionStartTime);
    const exceptionEndDate = TimeUtils.getLocalDateString(exceptionEndTime);
    
    for (let d = new Date(phaseStart); d <= endOfLastDay; d.setDate(d.getDate() + 1)) {
      const currentDay = TimeUtils.getLocalDateString(d);
      
      // 检查异常时间段是否与当前日期有重叠
      // 如果异常开始日期 > 当前日期，或者异常结束日期 < 当前日期，则跳过
      if (exceptionStartDate > currentDay || exceptionEndDate < currentDay) {
        continue;
      }
      
      // 将异常时间段限缩到阶段时间内
      const exceptionInPhaseStart = new Date(Math.max(exceptionStartTime.getTime(), phaseStart.getTime()));
      const exceptionInPhaseEnd = new Date(Math.min(exceptionEndTime.getTime(), phaseEnd.getTime()));
      
      // 如果限缩后的时间段无效，跳过
      if (exceptionInPhaseEnd <= exceptionInPhaseStart) {
        continue;
      }
      
      // 获取该日的工作窗口
      const workWindows = this.getWorkWindowsForDay(workTimeSettings, currentDay);
      // 获取该日的请假时段
      const leavePeriods = this.getLeavePeriodsForDay(attendanceRecords, currentDay);
      
      // 1) 计算异常与作息时间的重叠（限缩到阶段时间内）
      workWindows.forEach(window => {
        const windowStart = TimeUtils.createLocalDateTime(currentDay, window.start);
        const windowEnd = TimeUtils.createLocalDateTime(currentDay, window.end);
        
        // 将工作窗口限缩到阶段时间内
        const limitedWindowStart = new Date(Math.max(windowStart.getTime(), phaseStart.getTime()));
        const limitedWindowEnd = new Date(Math.min(windowEnd.getTime(), phaseEnd.getTime()));
        
        if (limitedWindowEnd <= limitedWindowStart) {
          return;
        }
        
        // 异常 ∩ 作息
        const overlap = TimeUtils.calculateOverlapHours(
          exceptionInPhaseStart,
          exceptionInPhaseEnd,
          limitedWindowStart,
          limitedWindowEnd
        );
        totalOverlapHours += overlap;

        // 异常 ∩ 请假 ∩ 作息（从上面的重叠中扣除）
        leavePeriods.forEach(leave => {
          const leaveStart = TimeUtils.createLocalDateTime(currentDay, leave.start);
          const leaveEnd = TimeUtils.createLocalDateTime(currentDay, leave.end);

          // 请假与该作息窗口的重叠
          const leaveWindowStart = new Date(Math.max(leaveStart.getTime(), limitedWindowStart.getTime()));
          const leaveWindowEnd = new Date(Math.min(leaveEnd.getTime(), limitedWindowEnd.getTime()));
          if (leaveWindowEnd <= leaveWindowStart) {
            return;
          }

          const leaveOverlap = TimeUtils.calculateOverlapHours(
            exceptionInPhaseStart,
            exceptionInPhaseEnd,
            leaveWindowStart,
            leaveWindowEnd
          );
          totalLeaveOverlapHours += leaveOverlap;
        });
      });
      
      // 获取该日的加班时段
      const overtimePeriods = this.getOvertimePeriodsForDay(attendanceRecords, currentDay);
      
      // 2) 计算异常与加班时间的重叠（限缩到阶段时间内）
      overtimePeriods.forEach(overtime => {
        const overtimeStart = TimeUtils.createLocalDateTime(currentDay, overtime.start);
        const overtimeEnd = TimeUtils.createLocalDateTime(currentDay, overtime.end);
        
        // 将加班时段限缩到阶段时间内
        const limitedOvertimeStart = new Date(Math.max(overtimeStart.getTime(), phaseStart.getTime()));
        const limitedOvertimeEnd = new Date(Math.min(overtimeEnd.getTime(), phaseEnd.getTime()));
        
        if (limitedOvertimeEnd <= limitedOvertimeStart) {
          return;
        }
        
        // 异常 ∩ 加班
        const overlap = TimeUtils.calculateOverlapHours(
          exceptionInPhaseStart,
          exceptionInPhaseEnd,
          limitedOvertimeStart,
          limitedOvertimeEnd
        );
        totalOverlapHours += overlap;

        // 异常 ∩ 请假 ∩ 加班（从上面的重叠中扣除）
        leavePeriods.forEach(leave => {
          const leaveStart = TimeUtils.createLocalDateTime(currentDay, leave.start);
          const leaveEnd = TimeUtils.createLocalDateTime(currentDay, leave.end);

          // 请假与该加班时段的重叠
          const leaveOvertimeStart = new Date(Math.max(leaveStart.getTime(), limitedOvertimeStart.getTime()));
          const leaveOvertimeEnd = new Date(Math.min(leaveEnd.getTime(), limitedOvertimeEnd.getTime()));
          if (leaveOvertimeEnd <= leaveOvertimeStart) {
            return;
          }

          const leaveOverlap = TimeUtils.calculateOverlapHours(
            exceptionInPhaseStart,
            exceptionInPhaseEnd,
            leaveOvertimeStart,
            leaveOvertimeEnd
          );
          totalLeaveOverlapHours += leaveOverlap;
        });
      });
    }
    
    // 只保留「异常 ∩（作息/加班）∩ 非请假」的部分
    const effectiveExceptionHours = Math.max(0, totalOverlapHours - totalLeaveOverlapHours);
    return effectiveExceptionHours;
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
      
      // 直接优先从数据库加载已确认任务的数据（数据库是权威来源）
      const confirmedDataMap = await this.loadConfirmedTasksDataFromDatabase();
      // 更新 this.confirmedTasks 以确保一致性（基于数据库中的数据）
      this.confirmedTasks.clear();
      confirmedDataMap.forEach((dataArray, key) => {
        this.confirmedTasks.add(key);
      });
      this.confirmedTasksCount = this.confirmedTasks.size;
      
      // 可选：将数据库数据同步到 localStorage 作为缓存（不作为数据源）
      if (confirmedDataMap.size > 0) {
        const confirmedDataForStorage: { [key: string]: EfficiencyData[] } = {};
        confirmedDataMap.forEach((dataArray, key) => {
          confirmedDataForStorage[key] = dataArray;
        });
        try {
          localStorage.setItem('confirmedEfficiencyTasksData', JSON.stringify(confirmedDataForStorage));
        } catch (e) {
          console.error('同步已确认任务数据到 localStorage 失败:', e);
        }
      }
      
      // 批量加载所有任务的标准工时（在开始计算之前）
      await this.loadStandardHoursForTasks(allTasks);
      
      // 计算所有阶段（只要该阶段为1且存在开始和结束时间）
      this.efficiencyData = [];
      const phases = ['machining', 'electrical', 'pre_assembly', 'post_assembly', 'debugging'];
      
      for (const phase of phases) {
        try {
          
          const completedTasks = this.filterCompletedTasksByPhase(allTasks, phase);
          
          
        
          for (const task of completedTasks) {
            try {
              // 检查任务是否已确认，如果已确认则跳过计算（会在后面统一恢复）
              const confirmKey = this.getTaskConfirmKey(task.id, phase);
              if (this.confirmedTasks.has(confirmKey) && confirmedDataMap.has(confirmKey)) {
                continue;
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
                continue;
              }
              
              const workReportsResponse = await this.http.get<any>(`${base}/api/work-reports/by-task/${task.id}`).toPromise();
              const workReports: WorkReport[] = workReportsResponse || [];
              
              
              const exceptionResponse = await this.http.get<any>(`${base}/api/exception-reports/by-task/${task.id}`).toPromise();
              const rawExceptionReports = exceptionResponse || [];
              
              // 直接使用后端返回的阶段信息，不做前端兜底
              const exceptionReports: ExceptionReport[] = rawExceptionReports.map((report: any) => ({
                ...report,
                phase: report.phase ?? ''
              }));
              
              
              // 获取阶段时间范围内的考勤记录
              const phaseStartTime = this.getPhaseStartTime(task, phase);
              const phaseEndTime = this.getPhaseEndTime(task, phase);
              
              if (!phaseStartTime || !phaseEndTime) {
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
              
              const taskEfficiencyData = await this.calculateTaskEfficiencyWithAttendance(
                task, workReports, exceptionReports, allAttendanceRecords, phase
              );
              
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
      
      // 恢复已确认任务的数据（直接从数据库加载的数据中恢复）
      let restoredCount = 0;
      let skippedRestoreCount = 0;
      const skippedRestoreKeys: string[] = [];
      const restoredKeys: string[] = [];
      
      // 为已确认的任务阶段加载异常报告
      const exceptionReportsPromises: Promise<void>[] = [];
      
      confirmedDataMap.forEach((dataArray, key) => {
        // 检查是否已经存在相同的数据（防止重复添加）
        const [taskIdStr, phase] = key.split('_');
        const taskId = parseInt(taskIdStr, 10);
          const existingData = this.efficiencyData.find(data => 
            data.task.id === taskId && data.phase === phase
          );
        
          if (!existingData) {
          // 从数据库加载的数据中恢复
            this.efficiencyData.push(...dataArray);
            restoredCount += dataArray.length;
          restoredKeys.push(key);
          
          // 为每个恢复的数据加载异常报告
          dataArray.forEach(data => {
            const loadExceptionReportsPromise = (async () => {
              try {
                const exceptionResponse = await this.http.get<any>(`${base}/api/exception-reports/by-task/${data.task.id}`).toPromise();
                const rawExceptionReports = exceptionResponse || [];
                const exceptionReports: ExceptionReport[] = rawExceptionReports.map((report: any) => ({
                  ...report,
                  phase: report.phase ?? ''
                }));
                
                // 筛选属于当前阶段的异常报告
                const phaseExceptions = exceptionReports.filter(ex => {
                  const exceptionPhase = ex.phase || '';
                  return exceptionPhase === data.phase || !exceptionPhase;
                });
                
                // 将异常报告添加到数据中
                data.exceptionReports.push(...phaseExceptions);
              } catch (error) {
                console.error(`加载任务${data.task.id}的异常报告失败:`, error);
              }
            })();
            exceptionReportsPromises.push(loadExceptionReportsPromise);
          });
          } else {
          skippedRestoreCount += dataArray.length;
          skippedRestoreKeys.push(key);
        }
      });
      
      // 等待所有异常报告加载完成
      if (exceptionReportsPromises.length > 0) {
        await Promise.all(exceptionReportsPromises);
      }
      
      
      // 保存已确认任务的数据到 localStorage（确保数据持久化）
      if (confirmedDataMap.size > 0) {
        this.saveConfirmedTasksData();
      }
      
      // 全局去重：移除重复的任务-阶段组合
      const beforeDedupCount = this.efficiencyData.length;
      const uniqueDataMap = new Map<string, EfficiencyData>();
      const duplicateCount = { count: 0 };
      const duplicateKeys: string[] = [];
      
      this.efficiencyData.forEach(data => {
        const key = `${data.task.id}_${data.phase}`;
        if (uniqueDataMap.has(key)) {
          duplicateCount.count++;
          if (!duplicateKeys.includes(key)) {
            duplicateKeys.push(key);
          }
        } else {
          uniqueDataMap.set(key, data);
        }
      });
      
      if (duplicateCount.count > 0) {
        this.efficiencyData = Array.from(uniqueDataMap.values());
      }

      // 将当前效率结果落库到后端（task_efficiency），区分已确认 / 未确认
      await this.saveEfficiencySnapshotsToBackend();
      
      
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
      
      
      // 初始化效率数据数组
      this.efficiencyData = [];
      
      // 直接使用已确认任务的缓存数据
      confirmedTasks.forEach(task => {
        const key = this.getTaskConfirmKey(task.id, this.selectedPhase);
        const cachedData = confirmedDataMap.get(key);
        if (cachedData) {
          this.efficiencyData.push(...cachedData);
          
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
        
        
        // 逐批处理
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          
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
            
            // 直接使用后端返回的阶段信息，不再用当前选择的阶段兜底
            const exceptionReports: ExceptionReport[] = rawExceptionReports.map((report: any) => ({
              ...report,
              // 直接使用后端返回的阶段信息，不做前端兜底
              phase: report.phase ?? ''
            }));
            
            const allAttendanceRecords: any[] = attendanceResponse || [];
            
            
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
      }
      
      
      // 全局去重：移除重复的任务-阶段组合
      const uniqueDataMap = new Map<string, EfficiencyData>();
      const duplicateCount = { count: 0 };
      this.efficiencyData.forEach(data => {
        const key = `${data.task.id}_${data.phase}`;
        if (uniqueDataMap.has(key)) {
          duplicateCount.count++;
        } else {
          uniqueDataMap.set(key, data);
        }
      });
      
      if (duplicateCount.count > 0) {
        this.efficiencyData = Array.from(uniqueDataMap.values());
      }
      
    } catch (error) {
      console.error('统计效率失败:', error);
      alert('统计效率失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      this.loading = false;
    }
  }

  private isDeductibleExceptionStatus(status: string | null | undefined): boolean {
    return status === 'approved' || status === 'pending_staff_confirmation';
  }

  private mergeTimeRanges(
    ranges: Array<{ start: Date; end: Date }>
  ): Array<{ start: Date; end: Date }> {
    if (!ranges.length) return [];
    const sorted = ranges
      .filter(r => r.end > r.start)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    if (!sorted.length) return [];

    const merged: Array<{ start: Date; end: Date }> = [{ ...sorted[0] }];
    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const last = merged[merged.length - 1];
      if (current.start.getTime() <= last.end.getTime()) {
        if (current.end.getTime() > last.end.getTime()) {
          last.end = current.end;
        }
      } else {
        merged.push({ ...current });
      }
    }
    return merged;
  }

  private async loadPausePeriodsForPhase(
    taskId: number,
    phase: string,
    userId: number,
    phaseStartTime: string,
    phaseEndTime: string
  ): Promise<Array<{ start: Date; end: Date }>> {
    try {
      const base = this.getApiBase();
      const params = new URLSearchParams({
        userId: String(userId),
        startTime: phaseStartTime,
        endTime: phaseEndTime
      });
      const rows = await this.http.get<any[]>(
        `${base}/api/tasks/${taskId}/phases/${phase}/pause-logs?${params.toString()}`
      ).toPromise();

      const phaseStart = TimeUtils.utcToLocalDate(phaseStartTime);
      const phaseEnd = TimeUtils.utcToLocalDate(phaseEndTime);
      const periods = (rows || []).map((row: any) => {
        const pausedAt = row?.paused_at ? TimeUtils.utcToLocalDate(row.paused_at) : null;
        const resumedAt = row?.resumed_at ? TimeUtils.utcToLocalDate(row.resumed_at) : phaseEnd;
        if (!pausedAt || !resumedAt) return null;
        const start = new Date(Math.max(pausedAt.getTime(), phaseStart.getTime()));
        const end = new Date(Math.min(resumedAt.getTime(), phaseEnd.getTime()));
        if (end <= start) return null;
        return { start, end };
      }).filter((v: { start: Date; end: Date } | null): v is { start: Date; end: Date } => !!v);

      return this.mergeTimeRanges(periods);
    } catch (error) {
      console.error('加载阶段暂停日志失败:', { taskId, phase, userId, error });
      return [];
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
      return [];
    }
    

    
    // 获取阶段开始和结束时间
    const phaseStartTime = this.getPhaseStartTime(task, phase);
    const phaseEndTime = this.getPhaseEndTime(task, phase);
    
    
    
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
    
    // 合并异常报告（原有的 + 已批准的），并去重（基于异常报告ID）
    const allExceptionReportsMap = new Map<number, ExceptionReport>();
    // 先添加原有的异常报告
    exceptionReports.forEach(ex => {
      if (ex.id) {
        allExceptionReportsMap.set(ex.id, ex);
      }
    });
    // 再添加已批准的异常报告（如果ID不存在才添加，避免重复）
    approvedExceptionReports.forEach(ex => {
      if (ex.id && !allExceptionReportsMap.has(ex.id)) {
        allExceptionReportsMap.set(ex.id, ex);
      }
    });
    const allExceptionReports = Array.from(allExceptionReportsMap.values());
    // 扣减口径：仅 approved / pending_staff_confirmation
    const deductibleExceptionReports = allExceptionReports.filter(ex =>
      this.isDeductibleExceptionStatus((ex as any).status)
    );
    
    if (!phaseStartTime || !phaseEndTime) {
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
      }
    }
    
    if (task.id === 846) {
    }
    
    if (!taskAssigneeId) {
      if (task.id === 846) {
      }
      return [];
    }
    
    if (task.id === 846) {
    }
    
    // 筛选该员工在阶段期间的考勤记录
    const attendanceRecords = this.getAttendanceRecordsForPeriod(
      allAttendanceRecords, 
      taskAssigneeId, 
      phaseStartTime, 
      phaseEndTime
    );
    
    if (task.id === 846) {
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

    // 加载暂停区间（用于从有效工时中扣减暂停时段）
    const pausePeriods = await this.loadPausePeriodsForPhase(
      task.id,
      phase,
      taskAssigneeId,
      phaseStartTime,
      phaseEndTime
    );
    
    // 计算实际出勤时间（使用完整的作息+加班+请假+异常逻辑）
    const workHoursResult = await this.calculateActualWorkHoursWithShifts(
      attendanceRecords, 
      phaseStartTime, 
      phaseEndTime, 
      workTimeSettings,
      deductibleExceptionReports,
      pausePeriods
    );
    const actualWorkHours = workHoursResult.totalHours;
    const dailyCalculations = workHoursResult.dailyCalculations;
    
    
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
    
    
    // 先收集所有属于该阶段的异常报告（去重）
    const phaseExceptionReportsMap = new Map<number, ExceptionReport>();
    for (const exception of deductibleExceptionReports) {
      const exceptionPhase = exception.phase || '';
      
      
      
      // 如果异常报告的phase与当前阶段匹配，或者phase为空（兼容旧数据），则添加到列表
      if ((exceptionPhase === phase || !exceptionPhase) && efficiencyMap.has(phase)) {
        // 基于ID去重
        if (!phaseExceptionReportsMap.has(exception.id)) {
          phaseExceptionReportsMap.set(exception.id, exception);
        }
      }
    }
    
    
    // 对每个阶段的异常报告进行处理
    if (phaseExceptionReportsMap.size > 0 && efficiencyMap.has(phase)) {
      const efficiency = efficiencyMap.get(phase)!;
      const phaseExceptions = Array.from(phaseExceptionReportsMap.values());
      
      // 先计算每个异常的实际时间（用于显示）
      phaseExceptions.forEach(exception => {
        const startTime = exception.start_time || exception.exception_start_datetime;
        const endTime = exception.end_time || exception.exception_end_datetime;
        
        if (startTime && endTime) {
          // 计算该异常时间段与阶段时间、工作时间的重叠
          exception.calculated_hours = this.calculateExceptionOverlapHours(
            startTime,
            endTime,
            phaseStartTime,
            phaseEndTime,
            workTimeSettings,
            attendanceRecords
          );
        } else if (exception.duration_hours) {
          // 如果没有时间段但有duration_hours，使用原值
          if (typeof exception.duration_hours === 'number') {
            exception.calculated_hours = exception.duration_hours;
          } else {
            const parsed = parseFloat(exception.duration_hours);
            exception.calculated_hours = isNaN(parsed) ? 0 : parsed;
          }
        } else {
          exception.calculated_hours = 0;
        }
      });
      
      
      // 展示：只展示 approved / pending_staff_confirmation（与扣减口径一致）
      const phaseExceptionsForDisplay = allExceptionReports.filter(ex => {
        if (!this.isDeductibleExceptionStatus((ex as any).status)) return false;
        const exPhase = ex.phase || '';
        return exPhase === phase || !exPhase;
      });
      efficiency.exceptionReports.push(...phaseExceptionsForDisplay);
      
      // 合并重叠的异常时间段
      const mergedPeriods = this.mergeOverlappingExceptionPeriods(phaseExceptions);
      
      // 计算合并后的总异常时间
      let totalExceptionHours = 0;
      for (const period of mergedPeriods) {
        const hours = this.calculateExceptionOverlapHours(
          period.start.toISOString(),
          period.end.toISOString(),
          phaseStartTime,
          phaseEndTime,
          workTimeSettings,
          attendanceRecords
        );
        totalExceptionHours += hours;
      }
      
      // 对于没有时间段但有duration_hours的异常报告，直接累加
      // 这些异常报告不在合并的时间段中，需要单独处理
      phaseExceptions.forEach(exception => {
        const startTime = exception.start_time || exception.exception_start_datetime;
        const endTime = exception.end_time || exception.exception_end_datetime;
        
        // 如果没有时间段但有duration_hours，使用原值
        if (!startTime || !endTime) {
          if (typeof exception.duration_hours === 'number' && exception.duration_hours > 0) {
            totalExceptionHours += exception.duration_hours;
          } else if (exception.duration_hours) {
            const parsed = typeof exception.duration_hours === 'string' 
              ? parseFloat(exception.duration_hours) 
              : Number(exception.duration_hours);
            if (!isNaN(parsed) && parsed > 0) {
              totalExceptionHours += parsed;
            }
          }
        }
      });
      
      efficiency.exceptionHours = totalExceptionHours;
    }
    
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
          deductibleExceptionReports,
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
    exceptionReports
      .filter(ex => this.isDeductibleExceptionStatus((ex as any).status))
      .forEach(exception => {
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

  // 批量加载标准工时（在计算效率之前调用）
  private async loadStandardHoursForTasks(tasks: Task[]): Promise<void> {
    // 清空缓存
    this.standardHoursCache.clear();
    
    // 收集所有需要查询的产品型号（保留原始大小写用于API查询，但缓存键使用大写）
    const productModels = new Set<string>();
    const modelMap = new Map<string, string>(); // 大写 -> 原始值
    tasks.forEach(task => {
      if (task.product_model && task.product_model.trim()) {
        const originalModel = task.product_model.trim();
        const upperModel = originalModel.toUpperCase();
        productModels.add(upperModel);
        // 保存原始值，用于API查询（后端会做大小写不敏感匹配）
        if (!modelMap.has(upperModel)) {
          modelMap.set(upperModel, originalModel);
        }
      }
    });

    if (productModels.size === 0) {
      return;
    }

    try {
      const base = this.getApiBase();
      // 批量查询所有产品型号的标准工时
      const promises = Array.from(productModels).map(async (upperModel) => {
        try {
          // 使用原始值查询（后端会做大小写不敏感匹配）
          const originalModel = modelMap.get(upperModel) || upperModel;
          const response: any = await this.http.get<any>(
            `${base}/api/product-standard-hours?productModel=${encodeURIComponent(originalModel)}`
          ).toPromise();
          
          if (response) {
            // 缓存各阶段的标准工时（使用大写作为键，确保匹配时一致）
            const machining = response.machining_hours || 0;
            const electrical = response.electrical_hours || 0;
            const preAssembly = response.pre_assembly_hours || 0;
            const postAssembly = response.post_assembly_hours || 0;
            const debugging = response.debugging_hours || 0;
            
            this.standardHoursCache.set(`${upperModel}_machining`, machining);
            this.standardHoursCache.set(`${upperModel}_electrical`, electrical);
            this.standardHoursCache.set(`${upperModel}_pre_assembly`, preAssembly);
            this.standardHoursCache.set(`${upperModel}_post_assembly`, postAssembly);
            this.standardHoursCache.set(`${upperModel}_debugging`, debugging);
          }
        } catch (error) {
          console.error(`查询产品型号 ${upperModel} 的标准工时失败:`, error);
        }
      });

      await Promise.all(promises);
    } catch (error) {
      console.error('批量加载标准工时失败:', error);
    }
  }

  private getStandardHoursForPhase(task: Task, phase: string): number {
    // 先从任务配置中获取标准工时
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
    
    // 如果任务本身没有标准工时，且任务有产品型号，且不是非标产品，从缓存中查找
    if (result === 0 && task.product_model && task.product_model.trim() && 
        (!task.is_non_standard || task.is_non_standard === 0)) {
      const productModel = task.product_model.trim().toUpperCase();
      const cacheKey = `${productModel}_${phase}`;
      const cachedValue = this.standardHoursCache.get(cacheKey);
      if (cachedValue !== undefined && cachedValue > 0) {
        result = cachedValue;
      }
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
    
    // 使用TimeUtils统一处理时间转换，确保时区处理一致
    const start = TimeUtils.utcToLocalDate(startTime);
    const end = TimeUtils.utcToLocalDate(endTime);
    
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
   * 计算实际工作小时数（包含作息、加班、暂停、请假、异常时段的完整逻辑）
   * 公式：作息∩阶段 + 加班∩阶段 - 暂停∩(作息+加班) - 请假∩作息（异常仅记录展示）
   */
  private async calculateActualWorkHoursWithShifts(
    attendanceRecords: any[], 
    phaseStartTime: string, 
    phaseEndTime: string, 
    workTimeSettings: any,
    exceptionReports: ExceptionReport[],
    pausePeriods: Array<{ start: Date; end: Date }> = []
  ): Promise<{ totalHours: number; dailyCalculations: { [date: string]: { 
    totalHours: number; 
    effectiveHours: number; 
    workWindowOverlap?: number;
    overtimeOverlap?: number;
    pauseDeduction?: number;
    leaveDeduction?: number;
    exceptionDeduction?: number;
    attendanceLimit?: number;
    finalHours?: number;
  } } }> {
    let totalEffectiveHours = 0;
    const dailyCalculations: { [date: string]: { 
      totalHours: number; 
      effectiveHours: number; 
      workWindowOverlap?: number;
      overtimeOverlap?: number;
      pauseDeduction?: number;
      leaveDeduction?: number;
      exceptionDeduction?: number;
      attendanceLimit?: number;
      finalHours?: number;
    } } = {};
    
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

      // 2.5 扣减暂停区间（支持多次暂停/继续）
      let pauseDeductionTotal = 0;
      if (pausePeriods.length > 0) {
        pausePeriods.forEach(period => {
          // 仅处理当天有交集的暂停区间
          const periodDay = TimeUtils.getLocalDateString(period.start);
          if (periodDay !== currentDay) {
            // 暂停区间可能跨天，仍需按当天边界裁剪再计算
            const dayStart = new Date(`${currentDay}T00:00:00`);
            const dayEnd = new Date(`${currentDay}T23:59:59.999`);
            if (period.end <= dayStart || period.start >= dayEnd) return;
          }

          const pauseInPhaseStart = new Date(Math.max(period.start.getTime(), start.getTime()));
          const pauseInPhaseEnd = new Date(Math.min(period.end.getTime(), end.getTime()));
          if (pauseInPhaseEnd <= pauseInPhaseStart) return;

          // 暂停只扣工作窗口/加班窗口内的有效部分
          workWindows.forEach(window => {
            const windowStart = new Date(`${currentDay}T${window.start}`);
            const windowEnd = new Date(`${currentDay}T${window.end}`);
            const limitedWindowStart = new Date(Math.max(windowStart.getTime(), start.getTime()));
            const limitedWindowEnd = new Date(Math.min(windowEnd.getTime(), end.getTime()));
            if (limitedWindowEnd <= limitedWindowStart) return;

            pauseDeductionTotal += TimeUtils.calculateOverlapHours(
              pauseInPhaseStart,
              pauseInPhaseEnd,
              limitedWindowStart,
              limitedWindowEnd
            );
          });

          overtimePeriods.forEach(overtime => {
            const overtimeStart = new Date(`${currentDay}T${overtime.start}`);
            const overtimeEnd = new Date(`${currentDay}T${overtime.end}`);
            const limitedOvertimeStart = new Date(Math.max(overtimeStart.getTime(), start.getTime()));
            const limitedOvertimeEnd = new Date(Math.min(overtimeEnd.getTime(), end.getTime()));
            if (limitedOvertimeEnd <= limitedOvertimeStart) return;

            pauseDeductionTotal += TimeUtils.calculateOverlapHours(
              pauseInPhaseStart,
              pauseInPhaseEnd,
              limitedOvertimeStart,
              limitedOvertimeEnd
            );
          });
        });
      }
      dayPhaseOverlapHours -= pauseDeductionTotal;
      
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
      
      
      // 存储单日计算详情（包含详细分解数据）
      dailyCalculations[currentDay] = {
        totalHours: dayPhaseOverlapHours, // 单日与阶段的重叠时长
        effectiveHours: effectiveHours,    // 单日有效工时
        workWindowOverlap: initialWorkWindowHours, // 作息时间重叠
        overtimeOverlap: overtimeOverlapTotal, // 加班时间重叠
        pauseDeduction: pauseDeductionTotal, // 暂停扣减
        leaveDeduction: leaveDeductionTotal, // 请假扣除
        exceptionDeduction: exceptionDeductionTotal, // 异常扣除（仅记录，不扣除）
        attendanceLimit: actualAttendanceHours, // 实际出勤时间限制
        finalHours: effectiveHours // 最终有效工时
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
        } else if (record.overtime_hours && parseFloat(record.overtime_hours) > 0) {
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
        } else if (record.leave_hours && parseFloat(record.leave_hours) > 0) {
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
          } else {
            // 同一天，使用本地时间处理
            const startTimeStr = startDate.toTimeString().split(' ')[0].substring(0, 5);
            const endTimeStr = endDate.toTimeString().split(' ')[0].substring(0, 5);
            periods.push({ start: startTimeStr, end: endTimeStr });
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
      
      // 型号/设备号筛选（优先使用表格筛选，如果没有则使用顶部筛选）
      const modelFilter = this.tableModelFilter || this.selectedModel;
      if (modelFilter && modelFilter.trim() !== '') {
        const keyword = modelFilter.trim().toLowerCase();
        const productModel = (data.task.product_model || '').toLowerCase();
        const deviceNumber = (data.task.device_number || '').toLowerCase();
        // 如果既不在型号中也不在设备号中，则过滤掉
        if (!productModel.includes(keyword) && !deviceNumber.includes(keyword)) {
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

      // 按是否非标筛选（基于任务的 is_non_standard 字段）
      if (this.tableNonStandardFilter) {
        const isNonStandard = Number(data.task?.is_non_standard) === 1;
        if (this.tableNonStandardFilter === 'non_standard') {
          // 仅显示非标任务
          if (!isNonStandard) {
            return false;
          }
        } else if (this.tableNonStandardFilter === 'standard') {
          // 仅显示标准任务
          if (isNonStandard) {
            return false;
          }
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
    } else if (this.tableExceptionSort) {
      filtered = filtered.sort((a, b) => {
        const exceptionCountA = a.exceptionReports.length || 0;
        const exceptionCountB = b.exceptionReports.length || 0;
        if (this.tableExceptionSort === 'asc') {
          return exceptionCountA - exceptionCountB;
        } else {
          return exceptionCountB - exceptionCountA;
        }
      });
    } else {
      // 默认按完工日期降序排序（最新的在前）
      filtered = filtered.sort((a, b) => {
        const dateA = a.phaseEndTime ? new Date(a.phaseEndTime).getTime() : 0;
        const dateB = b.phaseEndTime ? new Date(b.phaseEndTime).getTime() : 0;
        // 降序：日期大的（新的）在前
        if (dateA === 0 && dateB === 0) return 0;
        if (dateA === 0) return 1; // 没有完工日期的排后面
        if (dateB === 0) return -1; // 没有完工日期的排后面
        return dateB - dateA; // 降序
      });
    }

    this.filteredEfficiencyData = filtered;
    // 应用分页
    this.applyPagination();
  }
  
  // 应用分页
  applyPagination() {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedEfficiencyData = this.filteredEfficiencyData.slice(startIndex, endIndex);
  }
  
  // 获取总页数
  getTotalPages(): number {
    const total = Math.ceil(this.filteredEfficiencyData.length / this.pageSize);
    return total > 0 ? total : 1; // 至少返回1页，避免显示0页
  }
  
  // 切换页码
  goToPage(page: number) {
    const totalPages = this.getTotalPages();
    if (page >= 1 && page <= totalPages) {
      this.currentPage = page;
      this.applyPagination();
    }
  }
  
  // 上一页
  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.applyPagination();
    }
  }
  
  // 下一页
  nextPage() {
    const totalPages = this.getTotalPages();
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.applyPagination();
    }
  }
  
  // 改变每页显示条数
  onPageSizeChange() {
    this.currentPage = 1; // 重置到第一页
    this.applyPagination();
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
    // 重置分页到第一页
    this.currentPage = 1;
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

  // 计算有效工时：实际工时 - 异常时间 - 协助时间
  getEffectiveHours(data: EfficiencyData): number {
    const effectiveHours = (data.actualWorkHours || 0) - (data.exceptionHours || 0) - (data.assistHours || 0);
    return Math.max(0, effectiveHours); // 确保不为负数
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
    
    // 如果显示详情，则计算逐日详情（如果还没有计算过或数据为空）
    if (!current) {
      const existingDetails = this.dayCalculationDetails.get(key);
      if (!existingDetails || existingDetails.length === 0) {
      this.calculateDayDetails(taskId, phase);
      }
    }
  }

  // 获取计算过程详情是否可见
  getCalculationDetailsVisible(taskId: number, phase: string): boolean {
    const key = `${taskId}-${phase}`;
    return this.calculationDetailsVisible.get(key) || false;
  }

  // 切换计算步骤列表展开状态
  toggleCalculationSteps(taskId: number, phase: string): void {
    const key = `${taskId}-${phase}`;
    const current = this.calculationStepsExpanded.get(key) ?? true; // 默认展开
    this.calculationStepsExpanded.set(key, !current);
  }

  // 获取计算步骤列表是否展开
  getCalculationStepsExpanded(taskId: number, phase: string): boolean {
    const key = `${taskId}-${phase}`;
    return this.calculationStepsExpanded.get(key) ?? true; // 默认展开
  }

  // 计算单个异常报告的实际异常时间（用于显示）
  getExceptionCalculatedHours(exception: ExceptionReport, taskId: number, phase: string): number {
    // 优先使用计算后的时间（如果已计算）
    if (exception.calculated_hours !== undefined && exception.calculated_hours !== null) {
      return exception.calculated_hours;
    }

    // 如果没有计算后的时间，尝试实时计算
    const efficiencyData = this.efficiencyData.find(
      data => data.task.id === taskId && data.phase === phase
    );

    if (!efficiencyData) {
      // 如果没有效率数据，尝试使用 duration_hours
      return exception.duration_hours || 0;
    }

    const phaseStartTime = efficiencyData.phaseStartTime;
    const phaseEndTime = efficiencyData.phaseEndTime;

    if (!phaseStartTime || !phaseEndTime) {
      return exception.duration_hours || 0;
    }

    const startTime = exception.start_time || exception.exception_start_datetime;
    const endTime = exception.end_time || exception.exception_end_datetime;

    // 如果有时间段，尝试使用更准确的计算方法
    if (startTime && endTime) {
      try {
        // 如果有工作时间设置，则始终使用带作息/加班的重叠计算
        // 即使没有考勤记录，仍会按作息时间窗口扣除休息时间
        if (this.workTimeSettings) {
          return this.calculateExceptionOverlapHours(
            startTime,
            endTime,
            phaseStartTime,
            phaseEndTime,
            this.workTimeSettings,
            efficiencyData.attendanceRecords || []
          );
        } else {
          // 否则使用基本的时间差计算（与阶段时间的重叠）
          const start = TimeUtils.utcToLocalDate(startTime);
          const end = TimeUtils.utcToLocalDate(endTime);
          const phaseStart = TimeUtils.utcToLocalDate(phaseStartTime);
          const phaseEnd = TimeUtils.utcToLocalDate(phaseEndTime);

          // 计算重叠时间
          const overlapStart = new Date(Math.max(start.getTime(), phaseStart.getTime()));
          const overlapEnd = new Date(Math.min(end.getTime(), phaseEnd.getTime()));

          if (overlapEnd > overlapStart) {
            const hours = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
            return Math.max(0, hours);
          }
        }
      } catch (error) {
        console.error('计算异常时间失败:', error);
      }
    }

    // 如果没有时间段但有 duration_hours，使用原值
    if (exception.duration_hours) {
      if (typeof exception.duration_hours === 'number') {
        return exception.duration_hours;
      } else {
        const parsed = parseFloat(exception.duration_hours);
        return isNaN(parsed) ? 0 : parsed;
      }
    }

    return 0;
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
      } else if (this.exportType === 'monthly') {
        await this.exportMonthlyEfficiency(start, end);
      } else if (this.exportType === 'device') {
        await this.exportDeviceEfficiency(start, end);
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
      const efficiency = effective > 0
        ? ((entry.standardHours || 0) / effective) * 100
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

  // 导出设备效率汇总（按设备号/产品型号）
  private async exportDeviceEfficiency(start: Date, end: Date) {
    // 如果还没有计算过设备效率，先计算一次
    if (!this.deviceEfficiencyResults || this.deviceEfficiencyResults.length === 0) {
      this.calculateDeviceEfficiency();
    }

    if (!this.deviceEfficiencyResults || this.deviceEfficiencyResults.length === 0) {
      this.presentToast('当前没有设备效率数据，请先点击“设备效率”按钮进行统计');
      return;
    }

    const rows = this.deviceEfficiencyResults;

    if (rows.length === 0) {
      this.presentToast('当前没有设备效率数据可导出');
      return;
    }

    const data: any[][] = [];
    const header = [
      '设备标识',
      '设备/型号',
      '标准工时合计(h)',
      '有效工时合计(h)',
      '设备效率(%)',
      '任务数量',
      '是否全部阶段完成'
    ];
    data.push(header);

    rows.forEach(item => {
      data.push([
        item.deviceKey,
        item.deviceLabel,
        Number((item.standardHours || 0).toFixed(2)),
        Number((item.actualHours || 0).toFixed(2)),
        Number((item.efficiency || 0).toFixed(2)),
        item.taskCount || 0,
        item.isCompleted ? '是' : '否'
      ]);
    });

    const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(data);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '设备效率汇总');
    const dateStr = `${this.exportStartDate}_${this.exportEndDate}`;
    XLSX.writeFile(wb, `设备效率汇总_${dateStr}.xlsx`);
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
      totalActual > 0 ? Number(((totalStandard / totalActual) * 100).toFixed(2)) : 0;

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
    
    // 如果有单日计算详情，直接使用（包含详细分解数据）
    if (efficiencyData.dailyCalculations && Object.keys(efficiencyData.dailyCalculations).length > 0) {
      Object.keys(efficiencyData.dailyCalculations).forEach(date => {
        const dailyCalc = efficiencyData.dailyCalculations![date];
        dayDetails.push({
          date: date,
          totalHours: dailyCalc.totalHours || 0, // 单日与阶段的重叠时长
          effectiveHours: dailyCalc.effectiveHours || 0, // 单日有效工时
          workWindowOverlap: dailyCalc.workWindowOverlap || 0, // 作息时间重叠
          overtimeOverlap: dailyCalc.overtimeOverlap || 0, // 加班时间重叠
          pauseDeduction: dailyCalc.pauseDeduction || 0, // 暂停扣减
          leaveDeduction: dailyCalc.leaveDeduction || 0, // 请假扣除
          exceptionDeduction: dailyCalc.exceptionDeduction || 0, // 异常扣除
          attendanceLimit: dailyCalc.attendanceLimit || 0, // 实际出勤时间限制
          finalHours: dailyCalc.finalHours || dailyCalc.effectiveHours || 0 // 最终有效工时
        });
      });
      this.dayCalculationDetails.set(key, dayDetails);
      return;
    }

    // 如果没有单日计算详情，使用旧的计算方式
    // 使用TimeUtils统一处理时间转换，确保时区处理一致
    const start = TimeUtils.utcToLocalDate(efficiencyData.phaseStartTime);
    const end = TimeUtils.utcToLocalDate(efficiencyData.phaseEndTime);

    // 逐日计算 - 使用TimeUtils确保包含结束日期的整天
    const endOfLastDay = TimeUtils.createEndOfDay(end);
    
    for (let d = new Date(start); d <= endOfLastDay; d.setDate(d.getDate() + 1)) {
      const currentDay = TimeUtils.getLocalDateString(d);
      
      
      const dayAttendance = efficiencyData.attendanceRecords.find(rec => {
        // 使用TimeUtils统一处理日期比较
        const recDate = TimeUtils.utcToLocalDate(rec.date);
        return TimeUtils.isSameDay(recDate, d);
      });
      
      
      if (!dayAttendance) {
        if (currentDay.startsWith('2025-10-')) {
        }
        continue;
      }

      // 模拟计算过程（实际应该调用真实计算方法）
      const workWindowOverlap = this.calculateWorkWindowOverlap(currentDay, start, end);
      const overtimeOverlap = this.calculateOvertimeOverlap(dayAttendance, currentDay, start, end);
      const leaveDeduction = this.calculateLeaveDeduction(dayAttendance, currentDay);
      const exceptionDeduction = this.calculateExceptionDeduction(efficiencyData.exceptionReports, currentDay, efficiencyData.attendanceRecords);
      
      
      const effectiveHours = workWindowOverlap + overtimeOverlap - leaveDeduction - exceptionDeduction;
      const attendanceLimit = dayAttendance.actual_hours || dayAttendance.standard_attendance_hours || 0;
      const finalHours = Math.min(Math.max(0, effectiveHours), attendanceLimit);

      dayDetails.push({
        date: currentDay,
        totalHours: effectiveHours,
        workWindowOverlap: workWindowOverlap,
        overtimeOverlap: overtimeOverlap,
        pauseDeduction: 0,
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
          item.actual > 0
            ? Number(((item.standard / item.actual) * 100).toFixed(2))
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

  /**
   * 计算设备效率汇总（按产品型号/设备号分组）
   */
  calculateDeviceEfficiency() {
    // 按 产品型号/设备号 汇总
    const aggregates = new Map<string, { 
      deviceKey: string; 
      deviceLabel: string; 
      standard: number; 
      actual: number; 
      taskIds: Set<number>;
      completedPhaseKeys: Set<string>; // 已完成的阶段键（格式：taskId_phase）
    }>();

    // 解析日期区间（按阶段结束时间的"日期部分"来比较）
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

    // 先按设备号分组所有任务
    const deviceTasksMap = new Map<string, Task[]>();
    this.tasks.forEach(task => {
      const deviceNumber = task.device_number?.trim() || '';
      if (!deviceNumber) return;
      
      if (!deviceTasksMap.has(deviceNumber)) {
        deviceTasksMap.set(deviceNumber, []);
      }
      deviceTasksMap.get(deviceNumber)!.push(task);
    });

    // 对每个设备，计算所有阶段的标准工时之和（从任务配置中获取）
    deviceTasksMap.forEach((tasks, deviceNumber) => {
      const productModel = tasks[0]?.product_model?.trim() || '';
      const deviceKey = deviceNumber;
      const deviceLabel = productModel 
        ? `${productModel}-${deviceNumber}` 
        : deviceNumber;

      let agg = aggregates.get(deviceKey);
      if (!agg) {
        agg = { 
          deviceKey, 
          deviceLabel, 
          standard: 0, 
          actual: 0, 
          taskIds: new Set<number>(),
          completedPhaseKeys: new Set<string>()
        };
        aggregates.set(deviceKey, agg);
      }

      // 对每个任务，累加所有阶段的标准工时（从任务配置中获取）
      tasks.forEach(task => {
        agg.taskIds.add(task.id);
        
        const phases = ['machining', 'electrical', 'pre_assembly', 'post_assembly', 'debugging'];
        phases.forEach(phase => {
          // 从任务配置中获取该阶段的标准工时（无论是否完成都累加）
          const phaseStandardHours = this.getStandardHoursForPhase(task, phase);
          agg.standard += phaseStandardHours;
      
          // 检查该阶段是否已完成（有结束时间且在日期范围内）
          const phaseEndTime = this.getPhaseEndTime(task, phase);
          if (phaseEndTime) {
            const phaseEnd = new Date(phaseEndTime);
            if (!isNaN(phaseEnd.getTime())) {
              const phaseEndDateOnly = new Date(
                phaseEnd.getFullYear(),
                phaseEnd.getMonth(),
                phaseEnd.getDate()
              );
      
              // 日期区间过滤（含首尾）
              if ((!rangeStart || phaseEndDateOnly >= rangeStart) && 
                  (!rangeEnd || phaseEndDateOnly <= rangeEnd)) {
                // 该阶段已完成且在日期范围内，累加实际工时
                const phaseKey = `${task.id}_${phase}`;
      agg.completedPhaseKeys.add(phaseKey);
                
                // 从 efficiencyData 中查找该阶段的实际工时数据
                const efficiencyEntry = this.efficiencyData.find(
                  entry => entry.task.id === task.id && entry.phase === phase
                );
                
                if (efficiencyEntry) {
                  // 计算该阶段的有效工时 = 实际工时 - 异常时间 - 协助时间
                  const effectiveHours = (efficiencyEntry.actualWorkHours || 0) - 
                                        (efficiencyEntry.exceptionHours || 0) - 
                                        (efficiencyEntry.assistHours || 0);
                  
                  // 累加该阶段的有效工时（只累加有效值）
                  agg.actual += effectiveHours > 0 ? effectiveHours : 0;
                }
              }
            }
          }
        });
      });
    });

    if (aggregates.size === 0) {
      this.deviceEfficiencyResults = [];
      const rangeHint =
        this.monthlyStartDate || this.monthlyEndDate
          ? `${this.monthlyStartDate || '最早'} 至 ${this.monthlyEndDate || '最晚'}`
          : '全部日期';
      this.presentToast(`在${rangeHint}没有完成的阶段任务`);
      return;
    }

    // 检查每个设备号的所有任务的所有阶段是否都已完成
    const deviceTaskPhases = new Map<string, Set<string>>(); // deviceKey -> Set<taskId_phase>
    
    // 收集该设备号所有任务的所有阶段（包括未完成的）
    this.tasks.forEach(task => {
      const deviceNumber = task.device_number?.trim() || '';
      if (!deviceNumber) return;
      
      const phases = ['machining', 'electrical', 'pre_assembly', 'post_assembly', 'debugging'];
      phases.forEach(phase => {
        // 检查该阶段是否已开始（有开始时间）
        const phaseStartField = `${phase}_start_time`;
        const phaseStart = (task as any)[phaseStartField];
        if (phaseStart) {
          // 该阶段已开始，需要检查是否完成
          if (!deviceTaskPhases.has(deviceNumber)) {
            deviceTaskPhases.set(deviceNumber, new Set<string>());
          }
          const phaseKey = `${task.id}_${phase}`;
          deviceTaskPhases.get(deviceNumber)!.add(phaseKey);
        }
      });
    });

    this.deviceEfficiencyResults = Array.from(aggregates.values())
      .map(item => {
        // 防御性处理：确保 standard / actual 为数字
        const standardNum = typeof item.standard === 'number'
          ? item.standard
          : Number(item.standard || 0);
        const actualNum = typeof item.actual === 'number'
          ? item.actual
          : Number(item.actual || 0);

        // 获取该设备号的所有阶段（包括未完成的）
        const allPhases = deviceTaskPhases.get(item.deviceKey) || new Set<string>();
        // 判断是否所有阶段都已完成
        const isCompleted = allPhases.size > 0 && 
          Array.from(allPhases).every(phaseKey => item.completedPhaseKeys.has(phaseKey));
        
        return {
          deviceKey: item.deviceKey,
          deviceLabel: item.deviceLabel,
          standardHours: Number(standardNum.toFixed(2)),
          actualHours: Number(actualNum.toFixed(2)),
          // 效率 = (标准工时之和 / 有效工时之和) × 100%
          efficiency:
            actualNum > 0
              ? Number(((standardNum / actualNum) * 100).toFixed(2))
              : 0,
          taskCount: item.taskIds.size,
          isCompleted: isCompleted
        };
      })
      .sort((a, b) => {
        // 按设备标识排序
        return a.deviceKey.localeCompare(b.deviceKey);
      });
  }

  /**
   * 获取经过表头筛选/排序后的设备效率结果
   */
  getFilteredDeviceResults() {
    if (!this.deviceEfficiencyResults) {
      return [];
    }

    let list = [...this.deviceEfficiencyResults];

    // 型号/设备号筛选（表头第二行）
    if (this.deviceTableModelFilter && this.deviceTableModelFilter.trim() !== '') {
      const keyword = this.deviceTableModelFilter.trim().toLowerCase();
      list = list.filter(item => 
        item.deviceKey.toLowerCase().includes(keyword) || 
        item.deviceLabel.toLowerCase().includes(keyword)
      );
    }

    // 完成状态筛选
    if (this.deviceTableCompletionFilter === 'completed') {
      list = list.filter(item => item.isCompleted === true);
    } else if (this.deviceTableCompletionFilter === 'incomplete') {
      list = list.filter(item => item.isCompleted === false);
    }

    // 效率排序
    if (this.deviceTableEfficiencySort === 'asc') {
      list = list.sort((a, b) => (a.efficiency || 0) - (b.efficiency || 0));
    } else if (this.deviceTableEfficiencySort === 'desc') {
      list = list.sort((a, b) => (b.efficiency || 0) - (a.efficiency || 0));
    }

    return list;
  }

  /**
   * 计算当前设备效率结果的整体合计
   */
  getDeviceTotal() {
    const list = this.getFilteredDeviceResults();
    if (!list || list.length === 0) {
      return { standardHours: 0, actualHours: 0, efficiency: 0, taskCount: 0 };
    }

    let totalStandard = 0;
    let totalActual = 0;

    list.forEach(item => {
      totalStandard += item.standardHours || 0;
      totalActual += item.actualHours || 0;
    });

    const efficiency =
      totalActual > 0 ? Number(((totalStandard / totalActual) * 100).toFixed(2)) : 0;

    return {
      standardHours: Number(totalStandard.toFixed(2)),
      actualHours: Number(totalActual.toFixed(2)),
      efficiency,
      taskCount: list.length // 设备数量
    };
  }
}

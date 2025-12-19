import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonButton, IonInput, IonList, IonSpinner, IonModal, IonTextarea, IonSelect, IonSelectOption, IonBadge, IonButtons, IonIcon, IonCardHeader, IonCardTitle, IonCheckbox, IonText, IonDatetime, IonNote, AlertController, ToastController } from '@ionic/angular/standalone';
import { environment } from '../../../environments/environment';
import { Capacitor } from '@capacitor/core';
import { timeout, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-attendance-admin',
  standalone: true,
  templateUrl: './attendance-admin.page.html',
  styleUrls: ['./attendance-admin.page.scss'],
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonCard, IonCardContent, IonItem, IonLabel, IonButton, IonInput, IonList, IonSpinner,
    IonModal, IonTextarea, IonSelect, IonSelectOption, IonBadge,
    IonButtons, IonIcon, IonCardHeader, IonCardTitle, IonCheckbox, IonText, IonDatetime, IonNote
  ]
})
export class AttendanceAdminPage implements OnInit {
  private http = inject(HttpClient);
  private alertController = inject(AlertController);
  private toastController = inject(ToastController);
  
  isLoading = false;
  errorMsg = '';
  list: any[] = [];
  total = 0;
  page = 1;
  pageSize = 20;
  start = '';
  end = '';
  userNameFilter: string = '';
  selectedDepartmentFilter: string = '';
  availableDepartmentsFilter: string[] = [];
  selectedGroupFilter: string = '';
  availableGroupsFilter: string[] = [];
  
  // 统计相关
  showStats = false;
  statsData: any = null;
  statsLoading = false;
  // 调试开关（逐日计算详情）
  private debugDailyDetail = true;
  
  // 调整相关
  isAdjustModalOpen = false;
  selectedRecord: any = null;
  overtimeMinutes = 0;
  leaveMinutes = 0;
  adjustmentNote = '';
  currentUser: any = null;
  isSubmitting = false;

  // 时间段选择相关
  selectedOvertimeSlots: number[] = [];
  selectedLeaveSlots: number[] = [];
  overtimeTimeSlots: any[] = [];
  leaveTimeSlots: any[] = [];
  
  // 时间选择相关属性
  overtimeStartHour: number | null = null;
  overtimeStartMinute: number | null = null;
  overtimeEndHour: number | null = null;
  overtimeEndMinute: number | null = null;
  leaveStartHour: number | null = null;
  leaveStartMinute: number | null = null;
  leaveEndHour: number | null = null;
  leaveEndMinute: number | null = null;
  
  // 时间输入格式属性
  overtimeStartTime: string = '';
  overtimeEndTime: string = '';
  leaveStartTime: string = '';
  leaveEndTime: string = '';
  
  // 时间选项
  minuteOptions: { value: number; label: string }[] = [];
  overtimeStartHours: { value: number; label: string }[] = [];
  overtimeEndHours: { value: number; label: string }[] = [];
  leaveStartHours: { value: number; label: string }[] = [];
  leaveEndHours: { value: number; label: string }[] = [];

  // 批量调整相关属性
  isBatchAdjustModalOpen = false;
  availableUsers: any[] = [];
  filteredUsers: any[] = [];
  selectedUsers: any[] = [];
  searchKeyword: string = '';
  selectedGroup: string = ''; // 批量操作时的组筛选
  availableGroups: string[] = []; // 批量操作时可用的组列表
  selectedDepartment: string = '';
  availableDepartments: string[] = [];

  // 批量考勤管理相关属性
  isBatchAttendanceModalOpen = false;
  batchAttendanceDate: string = '';
  batchAttendanceHours: number | null = null;
  batchAttendanceNote: string = '';
  filteredWorkers: any[] = [];
  batchOvertimeStartHour: number | null = null;
  batchOvertimeStartMinute: number | null = null;
  batchOvertimeEndHour: number | null = null;
  batchOvertimeEndMinute: number | null = null;
  batchOvertimeStartHours: { value: number; label: string }[] = [];
  batchOvertimeEndHours: { value: number; label: string }[] = [];
  batchAdjustDate: string = '';
  batchAdjustmentNote: string = '';
  today: string = this.getLocalDateString();
  
  // 批量调整时间输入格式属性
  batchOvertimeStartTime: string = '';
  batchOvertimeEndTime: string = '';

  // 工作时间设置相关属性
  isWorkTimeModalOpen = false;
  workTimeSettings: any = null; // 拒绝使用默认值，必须从数据库加载

  // 节假日数据（用于前端判断，与效率计算页面保持一致）
  private holidays: Set<string> = new Set(); // 存储节假日日期，格式: "YYYY-MM-DD"
  private holidayNames: Map<string, string> = new Map(); // 存储节假日名称，格式: "YYYY-MM-DD" => "节假日名称"

  async ngOnInit() {
    // 获取当前用户信息
    const userStr = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (userStr) {
      this.currentUser = JSON.parse(userStr);
    }
    this.initializeTimeSlots();
    this.loadDepartments();
    this.loadGroups();
    this.loadWorkTimeSettings(); // 加载作息窗口数据
    // 先加载节假日数据，再加载考勤数据，确保节假日数据已准备好
    await this.loadHolidays();
    this.load(); // 加载节假日数据后再加载考勤数据
  }

  private getApiBase(): string {
    const isNative = Capacitor.isNativePlatform();
    return isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
  }

  // 初始化时间段选项
  initializeTimeSlots() {
    // 分钟选项：00-59
    this.minuteOptions = [];
    for (let minute = 0; minute < 60; minute++) {
      this.minuteOptions.push({
        value: minute,
        label: minute.toString().padStart(2, '0')
      });
    }
    
    // 加班开始小时：18-23
    this.overtimeStartHours = [];
    for (let hour = 18; hour <= 23; hour++) {
      this.overtimeStartHours.push({
        value: hour,
        label: hour.toString().padStart(2, '0')
      });
    }
    
    // 加班结束小时：18-23
    this.overtimeEndHours = [];
    for (let hour = 18; hour <= 23; hour++) {
      this.overtimeEndHours.push({
        value: hour,
        label: hour.toString().padStart(2, '0')
      });
    }
    
    // 请假开始小时：8-17
    this.leaveStartHours = [];
    for (let hour = 8; hour <= 17; hour++) {
      this.leaveStartHours.push({
        value: hour,
        label: hour.toString().padStart(2, '0')
      });
    }
    
    // 请假结束小时：8-17
    this.leaveEndHours = [];
    for (let hour = 8; hour <= 17; hour++) {
      this.leaveEndHours.push({
        value: hour,
        label: hour.toString().padStart(2, '0')
      });
    }
  }


  // 计算加班总时长（考虑与作息窗口重叠时减去休息时间）
  calculateOvertimeHours(): number {
    if (!this.overtimeStartTime || !this.overtimeEndTime) {
      return 0;
    }
    
    const startTime = this.parseTimeString(this.overtimeStartTime);
    const endTime = this.parseTimeString(this.overtimeEndTime);
    
    if (!startTime || !endTime) return 0;
    
    const startMinutes = startTime.hour * 60 + startTime.minute;
    const endMinutes = endTime.hour * 60 + endTime.minute;
    
    if (startMinutes >= endMinutes) return 0;
    
    // 基础加班时长
    const totalOvertimeMinutes = endMinutes - startMinutes;
    
    // 检查是否与作息窗口重叠，如果重叠则需要减去休息时间
    if (this.workTimeSettings) {
      const workStart = this.timeToMinutes(this.workTimeSettings.startTime);
      const workEnd = this.timeToMinutes(this.workTimeSettings.endTime);
      
      // 检查加班时间是否与工作时间重叠
      if (startMinutes < workEnd && endMinutes > workStart) {
        // 有重叠，需要减去休息时间
        const lunchStart = this.timeToMinutes(this.workTimeSettings.lunchStartTime);
        const lunchEnd = this.timeToMinutes(this.workTimeSettings.lunchEndTime);
        
        // 计算与午休时间的重叠
        let lunchOverlapMinutes = 0;
        if (lunchStart && lunchEnd && startMinutes < lunchEnd && endMinutes > lunchStart) {
          const overlapStart = Math.max(startMinutes, lunchStart);
          const overlapEnd = Math.min(endMinutes, lunchEnd);
          lunchOverlapMinutes = Math.max(0, overlapEnd - overlapStart);
        }
        
        // 计算与其他休息时间的重叠
        let otherBreakOverlapMinutes = 0;
        if (this.workTimeSettings.otherBreakStartTime && this.workTimeSettings.otherBreakEndTime) {
          const otherStart = this.timeToMinutes(this.workTimeSettings.otherBreakStartTime);
          const otherEnd = this.timeToMinutes(this.workTimeSettings.otherBreakEndTime);
          
          if (startMinutes < otherEnd && endMinutes > otherStart) {
            const overlapStart = Math.max(startMinutes, otherStart);
            const overlapEnd = Math.min(endMinutes, otherEnd);
            otherBreakOverlapMinutes = Math.max(0, overlapEnd - overlapStart);
          }
        }
        
        // 从加班时间中减去休息时间重叠
        const effectiveOvertimeMinutes = totalOvertimeMinutes - lunchOverlapMinutes - otherBreakOverlapMinutes;
        return Math.max(0, effectiveOvertimeMinutes) / 60; // 转换为小时
      }
    }
    
    // 没有与作息窗口重叠，直接返回总时长
    return totalOvertimeMinutes / 60; // 转换为小时
  }

  // 计算当前调整的请假总时长
  calculateCurrentLeaveHours(): number {
    if (!this.leaveStartTime || !this.leaveEndTime) {
      return 0;
    }
    
    const startTime = this.parseTimeString(this.leaveStartTime);
    const endTime = this.parseTimeString(this.leaveEndTime);
    
    if (!startTime || !endTime) return 0;
    
    const startMinutes = startTime.hour * 60 + startTime.minute;
    const endMinutes = endTime.hour * 60 + endTime.minute;
    
    if (startMinutes >= endMinutes) return 0;
    
    return (endMinutes - startMinutes) / 60; // 转换为小时
  }

  load(resetPage = false) {
    console.log('=== load方法开始执行 ===');
    if (resetPage) this.page = 1;
    
    // 并行加载考勤数据和节假日数据，提高加载速度
    // 考勤数据不依赖节假日数据，可以并行加载
    this.loadData();
    // 节假日数据在后台加载，用于显示节假日名称
    this.loadHolidays().catch(err => {
      console.warn('[考勤管理] 节假日数据加载失败，但不影响考勤数据显示:', err);
    });
  }
  
  private loadData() {
    this.isLoading = true;
    this.errorMsg = '';
    const base = this.getApiBase();
    const params = new URLSearchParams();
    if (this.start) params.set('start', this.start);
    if (this.end) params.set('end', this.end);
    params.set('page', String(this.page));
    params.set('pageSize', String(this.pageSize));
    
    const url = `${base}/api/daily-attendance?${params.toString()}`;
    console.log('API请求URL:', url);
    console.log('请求参数:', params.toString());
    
    // 使用日考勤列表接口（小时制）
    console.log('发送API请求...');
    
    // 添加超时处理
    const timeout = setTimeout(() => {
      console.error('API请求超时，超过10秒没有响应');
      this.errorMsg = '请求超时，请检查网络连接';
      this.isLoading = false;
    }, 10000);
    
    this.http.get(url).subscribe({
      next: (data: any) => {
        clearTimeout(timeout);
        console.log('=== API响应成功 ===');
        console.log('响应数据:', data);
        let allRecords = data?.list || [];
        
        // 如果选择了车间筛选，进行客户端筛选
        if (this.selectedDepartmentFilter) {
          console.log('应用车间筛选:', this.selectedDepartmentFilter);
          allRecords = allRecords.filter((record: any) => 
            record.department === this.selectedDepartmentFilter
          );
          console.log('筛选后记录数量:', allRecords.length);
        }
        
        // 如果输入了姓名筛选，进行客户端筛选
        if (this.userNameFilter && this.userNameFilter.trim()) {
          console.log('应用姓名筛选:', this.userNameFilter);
          allRecords = allRecords.filter((record: any) => 
            record.user_name && record.user_name.includes(this.userNameFilter.trim())
          );
          console.log('姓名筛选后记录数量:', allRecords.length);
        }
        
        // 如果选择了组筛选，进行客户端筛选
        if (this.selectedGroupFilter) {
          console.log('应用组筛选:', this.selectedGroupFilter);
          // 需要根据用户的组信息筛选，需要先获取用户信息
          const base = this.getApiBase();
          this.http.get(`${base}/api/users`).subscribe({
            next: (users: any) => {
              const userGroupsMap = new Map();
              users.forEach((user: any) => {
                userGroupsMap.set(user.id, user.user_group);
              });
              
              allRecords = allRecords.filter((record: any) => {
                const userGroup = userGroupsMap.get(record.user_id);
                return userGroup === this.selectedGroupFilter;
              });
              
              this.list = allRecords;
              this.total = allRecords.length;
              this.isLoading = false;
              console.log('组筛选后记录数量:', this.list.length);
            }
          });
          return; // 等待异步加载完成后再更新
        }
        
        // 数值化关键字段，避免字符串参与计算导致为0
        this.list = allRecords.map((record: any) => ({
          ...record,
          standard_attendance_hours: Number(record.standard_attendance_hours) || 0,
          overtime_hours: parseFloat(record.overtime_hours) || 0,
          leave_hours: parseFloat(record.leave_hours) || 0,
          actual_hours: Number(record.actual_hours) || 0,
          // 兼容分钟字段（若存在）
          overtime_minutes: Number(record.overtime_minutes || 0),
          leave_minutes: Number(record.leave_minutes || 0)
        }));
        this.total = this.list.length; // 使用筛选后的数量
        if (this.debugDailyDetail) {
          console.group('逐日详情-记录(数值化后)');
          this.list.forEach((r: any) => {
            console.log({
              date: r.date,
              standard_attendance_hours: r.standard_attendance_hours,
              overtime_hours: r.overtime_hours,
              leave_hours: r.leave_hours,
              actual_hours: r.actual_hours,
              overtime_minutes: r.overtime_minutes,
              leave_minutes: r.leave_minutes
            });
          });
          console.groupEnd();
        }
        // 撤回：不在前端保存用户ID集合用于统计
        this.isLoading = false;
        console.log('最终记录数量:', this.list.length);
        
        // 显示所有记录
        console.log('=== 所有记录 ===');
        this.list.forEach((record: any, index: number) => {
          console.log(`记录${index + 1}:`, {
            id: record.id,
            user_id: record.user_id,
            date: record.date,
            department: record.department,
            standard_attendance_hours: record.standard_attendance_hours,
            overtime_hours: record.overtime_hours,
            actual_hours: record.actual_hours
          });
        });
      },
      error: (err) => {
        clearTimeout(timeout);
        console.log('=== API请求失败 ===');
        console.log('错误:', err);
        this.errorMsg = '加载失败：' + (err?.error?.error || err?.message);
        this.isLoading = false;
      }
    });
  }

  nextPage() {
    if (this.page * this.pageSize >= this.total) return;
    this.page += 1;
    this.load();
  }

  prevPage() {
    if (this.page <= 1) return;
    this.page -= 1;
    this.load();
  }

  get totalPages(): number {
    const pages = Math.ceil((this.total || 0) / (this.pageSize || 1));
    return pages > 0 ? pages : 1;
  }

  get selectedWorkersCount() {
    return this.filteredWorkers.filter(user => user.selected).length;
  }
  
  // 加载统计信息（日考勤）
  loadStats() {
    this.statsLoading = true;
    const base = this.getApiBase();
    const params = new URLSearchParams();
    if (this.start) params.set('start', this.start);
    if (this.end) params.set('end', this.end);
    // 撤回：不自动附带 userId，沿用后端默认汇总口径
    
    this.http.get(`${base}/api/daily-attendance/stats?${params.toString()}`).subscribe({
      next: (data: any) => {
        // 如果选择了车间筛选，对统计数据进行筛选
        if (data?.list) {
          // 先数值化 list，再做筛选与统计
          data.list = data.list.map((r: any) => ({
            ...r,
            overtime_hours: parseFloat(r?.overtime_hours) || 0,
            leave_hours: parseFloat(r?.leave_hours) || 0,
            actual_hours: Number(r?.actual_hours) || 0,
            standard_attendance_hours: Number(r?.standard_attendance_hours) || 0
          }));
          if (this.selectedDepartmentFilter) {
            data.list = data.list.filter((record: any) => 
              record.department === this.selectedDepartmentFilter
            );
          }
          data.overall = this.calculateFilteredStats(data.list);
        }
        this.statsData = data;
        // 撤回：不在前端使用本地列表覆盖服务端统计
        this.statsLoading = false;
      },
      error: (err) => {
        this.errorMsg = '加载统计失败：' + (err?.error?.error || err?.message);
        this.statsLoading = false;
      }
    });
  }

  // 计算筛选后的统计数据
  calculateFilteredStats(records: any[]) {
    // 数值化，避免字符串参与计算
    const normalized = (records || []).map((r: any) => ({
      ...r,
      overtime_hours: parseFloat(r?.overtime_hours) || 0,
      leave_hours: parseFloat(r?.leave_hours) || 0,
      actual_hours: Number(r?.actual_hours) || 0,
      standard_attendance_hours: Number(r?.standard_attendance_hours) || 0
    }));
    const totalDays = normalized.length;
    const totalOvertime = normalized.reduce((sum: number, r: any) => sum + r.overtime_hours, 0);
    const totalLeave = normalized.reduce((sum: number, r: any) => sum + this.calculateLeaveHours(r), 0);
    const totalActual = normalized.reduce((sum: number, r: any) => sum + this.calculateActualHours(r), 0);
    if (this.debugDailyDetail) {
      console.group('逐日统计-汇总调试');
      console.log('输入记录数:', totalDays);
      console.log('合计: 加班', totalOvertime, ' 请假', totalLeave, ' 实际', totalActual);
      console.groupEnd();
    }
    
    return {
      total_days: totalDays,
      total_overtime: totalOvertime,
      total_leave: totalLeave,
      total_actual: totalActual,
      // 兼容旧模板字段（_hours 后缀）
      total_overtime_hours: totalOvertime,
      total_leave_hours: totalLeave,
      total_actual_hours: totalActual
    };
  }
  
  // 切换统计显示
  toggleStats() {
    this.showStats = !this.showStats;
    if (this.showStats && !this.statsData) {
      this.loadStats();
    }
  }
  
  // 打开调整模态框
  openAdjustModal(record: any) {
    console.log('打开调整模态框，记录信息:', record);
    this.selectedRecord = record;
    this.overtimeMinutes = record.overtime_minutes || 0;
    this.leaveMinutes = record.leave_minutes || 0;
    this.adjustmentNote = record.adjustment_note || '';
    
    // 从现有记录中加载加班时间信息
    if (record.overtime_start_time && record.overtime_end_time) {
      // 如果有具体的加班时间段，直接使用
      this.overtimeStartTime = record.overtime_start_time;
      this.overtimeEndTime = record.overtime_end_time;
      
      // 解析时间段到小时和分钟
      const startTime = this.parseTimeString(record.overtime_start_time);
      const endTime = this.parseTimeString(record.overtime_end_time);
      if (startTime) {
        this.overtimeStartHour = startTime.hour;
        this.overtimeStartMinute = startTime.minute;
      }
      if (endTime) {
        this.overtimeEndHour = endTime.hour;
        this.overtimeEndMinute = endTime.minute;
      }
    } else if (record.overtime_hours && record.overtime_hours > 0) {
      // 如果没有具体时间段但有加班小时数，尝试解析时间（假设从18:00开始）
      this.overtimeStartHour = 18;
      this.overtimeStartMinute = 0;
      this.overtimeEndHour = 18 + Math.floor(record.overtime_hours);
      this.overtimeEndMinute = Math.round((record.overtime_hours % 1) * 60);
      
      // 设置时间输入格式
      this.overtimeStartTime = this.formatTimeString(this.overtimeStartHour, this.overtimeStartMinute);
      this.overtimeEndTime = this.formatTimeString(this.overtimeEndHour, this.overtimeEndMinute);
    } else {
      // 如果没有加班时间，检查是否有初始加班时间设置
      if (this.workTimeSettings && this.workTimeSettings.defaultOvertimeStartTime) {
        // 使用初始加班时间作为默认值
        this.overtimeStartTime = this.workTimeSettings.defaultOvertimeStartTime;
        const startTime = this.parseTimeString(this.workTimeSettings.defaultOvertimeStartTime);
        if (startTime) {
          this.overtimeStartHour = startTime.hour;
          this.overtimeStartMinute = startTime.minute;
        }
      } else {
        this.overtimeStartHour = null;
        this.overtimeStartMinute = 0;
        this.overtimeStartTime = '';
      }
      
      // 使用默认结束加班时间
      if (this.workTimeSettings && this.workTimeSettings.defaultOvertimeEndTime) {
        this.overtimeEndTime = this.workTimeSettings.defaultOvertimeEndTime;
        const endTime = this.parseTimeString(this.workTimeSettings.defaultOvertimeEndTime);
        if (endTime) {
          this.overtimeEndHour = endTime.hour;
          this.overtimeEndMinute = endTime.minute;
        }
      } else {
        this.overtimeEndHour = null;
        this.overtimeEndMinute = 0;
        this.overtimeEndTime = '';
      }
    }
    
    // 从现有记录中加载请假时间信息
    if (record.leave_start_time && record.leave_end_time) {
      // 如果有具体的请假时间段，直接使用
      this.leaveStartTime = record.leave_start_time;
      this.leaveEndTime = record.leave_end_time;
      
      // 解析时间段到小时和分钟
      const startTime = this.parseTimeString(record.leave_start_time);
      const endTime = this.parseTimeString(record.leave_end_time);
      if (startTime) {
        this.leaveStartHour = startTime.hour;
        this.leaveStartMinute = startTime.minute;
      }
      if (endTime) {
        this.leaveEndHour = endTime.hour;
        this.leaveEndMinute = endTime.minute;
      }
    } else if (record.leave_hours && record.leave_hours > 0) {
      // 如果没有具体时间段但有请假小时数，尝试解析时间（假设从9:00开始）
      this.leaveStartHour = 9;
      this.leaveStartMinute = 0;
      this.leaveEndHour = 9 + Math.floor(record.leave_hours);
      this.leaveEndMinute = Math.round((record.leave_hours % 1) * 60);
      
      // 设置时间输入格式
      this.leaveStartTime = this.formatTimeString(this.leaveStartHour, this.leaveStartMinute);
      this.leaveEndTime = this.formatTimeString(this.leaveEndHour, this.leaveEndMinute);
    } else {
      this.leaveStartHour = null;
      this.leaveStartMinute = 0;
      this.leaveEndHour = null;
      this.leaveEndMinute = 0;
      this.leaveStartTime = '';
      this.leaveEndTime = '';
    }
    
    this.isAdjustModalOpen = true;
  }
  
  // 关闭调整模态框
  closeAdjustModal() {
    this.isAdjustModalOpen = false;
    this.selectedRecord = null;
    this.overtimeMinutes = 0;
    this.leaveMinutes = 0;
    this.adjustmentNote = '';
    this.overtimeStartHour = null;
    this.overtimeStartMinute = 0;
    this.overtimeEndHour = null;
    this.overtimeEndMinute = 0;
    this.leaveStartHour = null;
    this.leaveStartMinute = 0;
    this.leaveEndHour = null;
    this.leaveEndMinute = 0;
    this.overtimeStartTime = '';
    this.overtimeEndTime = '';
    this.leaveStartTime = '';
    this.leaveEndTime = '';
  }
  
  // 确认考勤记录
  async confirmAttendance(record: any) {
    if (!record || !this.currentUser) return;
    
    try {
      const base = this.getApiBase();
      const response = await this.http.post(`${base}/api/daily-attendance/${record.id}/confirm`, {
        confirmedBy: this.currentUser.id
      }).toPromise();
      
      if (response && (response as any).success) {
        alert('考勤确认成功！');
        // 重新加载数据
        this.load(true);
        if (this.showStats) {
          this.loadStats();
        }
      } else {
        throw new Error((response as any).error || '确认失败');
      }
    } catch (error) {
      console.error('确认考勤失败:', error);
      alert('确认失败：' + (error as any).message);
    }
  }
  
  // 取消确认考勤记录
  async unconfirmAttendance(record: any) {
    if (!record) return;
    
    try {
      const base = this.getApiBase();
      const response = await this.http.post(`${base}/api/daily-attendance/${record.id}/unconfirm`, {}).toPromise();
      
      if (response && (response as any).success) {
        alert('取消确认成功！');
        // 重新加载数据
        this.load(true);
        if (this.showStats) {
          this.loadStats();
        }
      } else {
        throw new Error((response as any).error || '取消确认失败');
      }
    } catch (error) {
      console.error('取消确认失败:', error);
      alert('取消确认失败：' + (error as any).message);
    }
  }
  
  // 确认调整（日考勤单条记录）
  async confirmAdjust() {
    if (!this.selectedRecord || !this.currentUser) return;
    
    // 调试信息
    const overtimeHours = this.calculateOvertimeHours();
    const leaveHours = this.calculateCurrentLeaveHours();
    console.log('=== 确认调整调试信息 ===');
    console.log('记录ID:', this.selectedRecord.id);
    console.log('记录ID类型:', typeof this.selectedRecord.id);
    console.log('记录是否存在ID:', !!this.selectedRecord.id);
    console.log('记录ID是否为null:', this.selectedRecord.id === null);
    console.log('记录ID是否为undefined:', this.selectedRecord.id === undefined);
    console.log('记录ID是否为字符串null:', this.selectedRecord.id === 'null');
    console.log('计算出的加班时长:', overtimeHours);
    console.log('计算出的请假时长:', leaveHours);
    console.log('发送到后端的数据:', {
      overtimeHours,
      leaveHours,
      adjustmentNote: this.adjustmentNote,
      adjustedBy: this.currentUser.id
    });
    
    try {
      const base = this.getApiBase();
      
      // 如果记录ID为null或undefined，需要先创建记录
      if (!this.selectedRecord.id || this.selectedRecord.id === null || this.selectedRecord.id === undefined || this.selectedRecord.id === 'null') {
        console.log('记录ID为null，尝试创建记录');
        console.log('selectedRecord完整信息:', this.selectedRecord);
        // 将日期转换为YYYY-MM-DD格式，避免时区问题
        const date = this.selectedRecord.date instanceof Date 
          ? this.selectedRecord.date 
          : new Date(this.selectedRecord.date);
        // 使用本地日期，避免时区转换
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const createData = {
          userId: this.selectedRecord.user_id,
          date: dateStr,
          standardAttendanceHours: this.selectedRecord.standard_attendance_hours || 8, // 默认8小时标准考勤
          overtimeHours: overtimeHours,
          leaveHours: leaveHours,
          overtimeStartTime: this.overtimeStartTime || null,
          overtimeEndTime: this.overtimeEndTime || null,
          leaveStartTime: this.leaveStartTime || null,
          leaveEndTime: this.leaveEndTime || null,
          note: this.adjustmentNote,
          adjustedBy: this.currentUser.id
        };
        console.log('创建记录的数据:', createData);
        console.log('日期格式:', dateStr);
        
        // 先创建记录
        const createResponse = await this.http.post(`${base}/api/daily-attendance`, createData).toPromise();
        console.log('创建记录响应:', createResponse);
        
        if (createResponse && (createResponse as any).success) {
          console.log('记录创建成功');
          console.log('准备关闭模态框...');
          // 直接关闭模态框
          this.closeAdjustModal();
          console.log('模态框已关闭');
          console.log('准备延迟重新加载数据...');
          // 延迟重新加载数据
          setTimeout(() => {
            console.log('=== 开始重新加载数据 ===');
            this.load(true); // 重新加载列表
            if (this.showStats) {
              this.loadStats(); // 重新加载统计
            }
          console.log('=== 数据重新加载完成 ===');
          // 使用 toast 提示，避免阻塞弹窗
          this.presentToast('考勤记录创建并调整成功');
          }, 1000);
          console.log('setTimeout已设置');
        } else {
          console.log('记录创建失败:', createResponse);
          throw new Error((createResponse as any).error || '创建记录失败');
        }
      } else {
        // 记录存在，直接调整
        console.log('记录存在，使用调整API');
        console.log('调整API URL:', `${base}/api/daily-attendance/${this.selectedRecord.id}/adjust`);
      const response = await this.http.post(`${base}/api/daily-attendance/${this.selectedRecord.id}/adjust`, {
          overtimeHours: overtimeHours,
          leaveHours: leaveHours,
          overtimeStartTime: this.overtimeStartTime || null,
          overtimeEndTime: this.overtimeEndTime || null,
          leaveStartTime: this.leaveStartTime || null,
          leaveEndTime: this.leaveEndTime || null,
          note: this.adjustmentNote,
        adjustedBy: this.currentUser.id
      }).toPromise();
      
      if (response && (response as any).success) {
          console.log('后端响应:', response);
        // 使用 toast 提示，避免阻塞弹窗
        this.presentToast('考勤时长调整成功');
        this.closeAdjustModal();
          // 强制刷新数据
          setTimeout(() => {
            this.load(true); // 重置到第一页并重新加载
        if (this.showStats) {
          this.loadStats(); // 重新加载统计
        }
          }, 100);
      } else {
          console.log('后端响应失败:', response);
        throw new Error((response as any).error || '调整失败');
        }
      }
    } catch (error: any) {
      console.error('调整失败，完整错误信息:', error);
      console.error('错误状态:', error.status);
      console.error('错误消息:', error.message);
      console.error('错误详情:', error.error);
      alert('调整失败：' + (error.error?.error || error.message));
    }
  }
  
  // 格式化小时（保留最多两位小数）
  formatHours(hours: number): string {
    const h = Number(hours || 0);
    return `${h.toFixed(2).replace(/\.00$/, '')} 小时`;
  }
  
  // 计算请假小时（拒绝使用默认作息窗口）
  calculateLeaveHours(record: any): number {
    if (record.leave_start_time && record.leave_end_time) {
      // 如果有具体的请假时间段，尝试计算与作息窗口的重叠
      // 如果没有工作时间设置，拒绝使用默认作息窗口
      if (!this.workTimeSettings) {
        console.warn('工作时间设置未加载，拒绝使用默认作息窗口，使用原始请假小时数');
        return Number(record.leave_hours || 0);
      }
      
      return this.calculateLeaveOverlapWithWorkWindows(
        record.leave_start_time, 
        record.leave_end_time
      );
    } else if (record.leave_hours && record.leave_hours > 0) {
      // 如果只有请假小时数，使用原始值
      return Number(record.leave_hours);
    }
    return 0;
  }

  // 计算实际小时（与模态框显示计算保持一致）
  // 总是重新计算，不使用数据库的actual_hours字段
  // 因为数据库的actual_hours使用的是leave_hours字段值，
  // 而前端显示时使用的是与工作窗口重叠后的请假时间，需要保持一致
  calculateActualHours(record: any): number {
    const standard = record.standard_attendance_hours || 0; // 使用实际标准工时，不设默认值
    
    // 计算加班时长（实时计算，与模态框保持一致）
    let overtime = 0;
    if (record.overtime_start_time && record.overtime_end_time) {
      // 如果有具体的加班时间段，计算时长
      const startTime = this.parseTimeString(record.overtime_start_time);
      const endTime = this.parseTimeString(record.overtime_end_time);
      if (startTime && endTime) {
        const startMinutes = startTime.hour * 60 + startTime.minute;
        const endMinutes = endTime.hour * 60 + endTime.minute;
        if (startMinutes < endMinutes) {
          overtime = (endMinutes - startMinutes) / 60;
        }
      }
    } else if (record.overtime_hours && record.overtime_hours > 0) {
      // 如果没有具体时间段但有加班小时数，使用原始值
      overtime = Number(record.overtime_hours);
    }
    
    // 计算请假时长（使用与显示一致的逻辑）
    let leaveHours = 0;
    if (record.leave_start_time && record.leave_end_time) {
      // 如果有具体的请假时间段，计算与作息窗口的重叠
      leaveHours = this.calculateLeaveOverlapWithWorkWindows(
        record.leave_start_time, 
        record.leave_end_time
      );
    } else {
      // 使用原始记录的请假小时数（不考虑作息窗口重叠）
      leaveHours = Number(record.leave_hours || 0);
    }
    
    return standard + overtime - leaveHours;
  }

  // 计算请假时间段与作息窗口的重叠小时数（拒绝使用默认作息窗口）
  private calculateLeaveOverlapWithWorkWindows(leaveStart: string, leaveEnd: string): number {
    // 拒绝使用默认作息窗口，必须从数据库加载
    if (!this.workTimeSettings) {
      console.warn('工作时间设置未加载，拒绝使用默认作息窗口，请假时长计算为0');
      return 0;
    }
    
    try {
      const workWindows = this.getWorkWindowsFromSettings();
      
      let totalOverlap = 0;
      workWindows.forEach((window: {start: string, end: string}) => {
        const overlap = this.calculateTimeOverlap(leaveStart, leaveEnd, window.start, window.end);
        totalOverlap += overlap;
      });
      
      return totalOverlap;
    } catch (error) {
      console.warn('作息窗口计算失败，拒绝使用默认值:', error);
      return 0;
    }
  }

  // 从工作时间设置获取作息窗口（拒绝使用默认值）
  private getWorkWindowsFromSettings(): Array<{start: string, end: string}> {
    if (!this.workTimeSettings) {
      throw new Error('工作时间设置未加载，拒绝使用默认作息窗口，请先配置工作时间');
    }
    
    const startTime = this.workTimeSettings.startTime;
    const endTime = this.workTimeSettings.endTime;
    const lunchStart = this.workTimeSettings.lunchStartTime;
    const lunchEnd = this.workTimeSettings.lunchEndTime;
    const otherStart = this.workTimeSettings.otherBreakStartTime || '';
    const otherEnd = this.workTimeSettings.otherBreakEndTime || '';
    
    if (!startTime || !endTime || !lunchStart || !lunchEnd) {
      throw new Error('工作时间设置不完整，拒绝使用默认作息窗口，请检查数据库配置');
    }
    
    // 基础两个工作窗口（已扣除午休）
    let segments = [
      { start: startTime, end: lunchStart },
      { start: lunchEnd, end: endTime }
    ];
    
    // 扣除"其他休息时间"，可能切分窗口
    if (otherStart && otherEnd) {
      const newSegments: Array<{start: string, end: string}> = [];
      segments.forEach(seg => {
        // 无重叠
        if (otherEnd <= seg.start || otherStart >= seg.end) {
          newSegments.push(seg);
        } else {
          // 左段
          if (otherStart > seg.start) {
            newSegments.push({ start: seg.start, end: otherStart });
          }
          // 右段
          if (otherEnd < seg.end) {
            newSegments.push({ start: otherEnd, end: seg.end });
          }
        }
      });
      segments = newSegments.filter(s => s.end > s.start);
    }
    
    return segments;
  }

  // 计算两个时间段的重叠小时数
  private calculateTimeOverlap(start1: string, end1: string, start2: string, end2: string): number {
    const startTime1 = this.timeToMinutes(start1);
    const endTime1 = this.timeToMinutes(end1);
    const startTime2 = this.timeToMinutes(start2);
    const endTime2 = this.timeToMinutes(end2);
    
    const overlapStart = Math.max(startTime1, startTime2);
    const overlapEnd = Math.min(endTime1, endTime2);
    
    if (overlapStart >= overlapEnd) {
      return 0; // 没有重叠
    }
    
    return (overlapEnd - overlapStart) / 60; // 转换为小时
  }


  // 计算当前调整后的实际时长（用于模态框显示）
  // 总是重新计算，不使用数据库的actual_hours字段，确保与显示的请假时间一致
  calculateCurrentActualHours(): number {
    const standard = this.selectedRecord?.standard_attendance_hours || 0;
    const overtime = this.calculateOvertimeHours();
    
    // 计算请假时间与作息窗口的重叠
    let leaveHours = 0;
    if (this.leaveStartTime && this.leaveEndTime) {
      // 如果有具体的请假时间段，计算与作息窗口的重叠
      leaveHours = this.calculateLeaveOverlapWithWorkWindows(
        this.leaveStartTime, 
        this.leaveEndTime
      );
    } else {
      // 使用原始记录的请假小时数（不考虑作息窗口重叠）
      leaveHours = Number(this.selectedRecord?.leave_hours || 0);
    }
    
    return standard + overtime - leaveHours;
  }

  // 测试计算方法
  testCalculation() {
    console.log('=== 测试计算逻辑 ===');
    console.log('加班开始时间:', (this.overtimeStartHour ?? '未选择') + ':' + (this.overtimeStartMinute?.toString().padStart(2, '0') || '00'));
    console.log('加班结束时间:', (this.overtimeEndHour ?? '未选择') + ':' + (this.overtimeEndMinute?.toString().padStart(2, '0') || '00'));
    console.log('请假开始时间:', (this.leaveStartHour ?? '未选择') + ':' + (this.leaveStartMinute?.toString().padStart(2, '0') || '00'));
    console.log('请假结束时间:', (this.leaveEndHour ?? '未选择') + ':' + (this.leaveEndMinute?.toString().padStart(2, '0') || '00'));
    console.log('计算出的加班时长:', this.calculateOvertimeHours());
    console.log('计算出的请假时长:', this.calculateCurrentLeaveHours());
    console.log('当前记录信息:', this.selectedRecord);
    console.log('当前实际时长计算:', this.calculateCurrentActualHours());
  }

  // 测试API调用
  testApiCall() {
    console.log('=== 测试API调用 ===');
    const base = this.getApiBase();
    const url = `${base}/api/daily-attendance?page=1&pageSize=20`;
    console.log('测试URL:', url);
    
    // 添加超时处理
    const timeout = setTimeout(() => {
      console.log('=== 测试API调用超时 ===');
    }, 5000);
    
    this.http.get(url).subscribe({
      next: (data: any) => {
        clearTimeout(timeout);
        console.log('=== 测试API调用成功 ===');
        console.log('测试响应:', data);
      },
      error: (err) => {
        clearTimeout(timeout);
        console.log('=== 测试API调用失败 ===');
        console.log('测试错误:', err);
      }
    });
  }

  // 批量调整相关方法
  async openBatchAdjustModal() {
    this.isBatchAdjustModalOpen = true;
    this.selectedUsers = [];
    this.searchKeyword = '';
    this.selectedGroup = '';
    
    // 初始化加班时间，如果有初始加班时间设置，使用它
    if (this.workTimeSettings && this.workTimeSettings.defaultOvertimeStartTime) {
      // 使用初始加班时间作为默认值
      this.batchOvertimeStartTime = this.workTimeSettings.defaultOvertimeStartTime;
      const startTime = this.parseTimeString(this.workTimeSettings.defaultOvertimeStartTime);
      if (startTime) {
        this.batchOvertimeStartHour = startTime.hour;
        this.batchOvertimeStartMinute = startTime.minute;
      }
    } else {
      this.batchOvertimeStartHour = null;
      this.batchOvertimeStartMinute = 0;
      this.batchOvertimeStartTime = '';
    }
    
    // 使用默认结束加班时间
    if (this.workTimeSettings && this.workTimeSettings.defaultOvertimeEndTime) {
      this.batchOvertimeEndTime = this.workTimeSettings.defaultOvertimeEndTime;
      const endTime = this.parseTimeString(this.workTimeSettings.defaultOvertimeEndTime);
      if (endTime) {
        this.batchOvertimeEndHour = endTime.hour;
        this.batchOvertimeEndMinute = endTime.minute;
      }
    } else {
      this.batchOvertimeEndHour = null;
      this.batchOvertimeEndMinute = 0;
      this.batchOvertimeEndTime = '';
    }
    this.batchAdjustDate = this.getLocalDateString();
    this.batchAdjustmentNote = '';
    
    // 加载可用用户
    await this.loadAvailableUsers();
    
    // 在用户加载完成后初始化筛选
    this.initializeFilters();
    
    // 初始化批量时间选项
    this.initializeBatchTimeOptions();
  }

  closeBatchAdjustModal() {
    this.isBatchAdjustModalOpen = false;
    this.selectedUsers = [];
    this.availableUsers = [];
    this.filteredUsers = [];
    this.searchKeyword = '';
    this.selectedGroup = '';
    this.batchOvertimeStartTime = '';
    this.batchOvertimeEndTime = '';
  }

  async loadAvailableUsers() {
    try {
      const base = this.getApiBase();
      const response = await this.http.get(`${base}/api/users`).toPromise();
      this.availableUsers = (response as any[]).filter(user => user.role === 'worker');
      this.filteredUsers = [...this.availableUsers];
    } catch (error) {
      console.error('加载用户列表失败:', error);
      this.availableUsers = [];
      this.filteredUsers = [];
    }
  }

  initializeFilters() {
    // 获取所有组列表
    this.availableGroups = [...new Set(this.availableUsers.map(user => user.user_group))].filter(group => group);
    this.availableGroups.sort();
  }

  filterUsers() {
    let filtered = [...this.availableUsers];

    // 按姓名搜索
    if (this.searchKeyword.trim()) {
      const keyword = this.searchKeyword.toLowerCase().trim();
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(keyword)
      );
    }

    // 按组筛选
    if (this.selectedGroup) {
      filtered = filtered.filter(user => user.user_group === this.selectedGroup);
    }

    this.filteredUsers = filtered;
  }

  selectAllUsers() {
    this.selectedUsers = [...this.filteredUsers];
  }

  clearAllUsers() {
    this.selectedUsers = [];
  }

  initializeBatchTimeOptions() {
    // 批量加班开始小时：18-23
    this.batchOvertimeStartHours = [];
    for (let hour = 18; hour <= 23; hour++) {
      this.batchOvertimeStartHours.push({
        value: hour,
        label: hour.toString().padStart(2, '0')
      });
    }
    
    // 批量加班结束小时：18-23
    this.batchOvertimeEndHours = [];
    for (let hour = 18; hour <= 23; hour++) {
      this.batchOvertimeEndHours.push({
        value: hour,
        label: hour.toString().padStart(2, '0')
      });
    }
  }

  toggleUserSelection(user: any) {
    const index = this.selectedUsers.findIndex(u => u.id === user.id);
    if (index > -1) {
      this.selectedUsers.splice(index, 1);
    } else {
      this.selectedUsers.push(user);
    }
  }

  isUserSelected(userId: number): boolean {
    return this.selectedUsers.some(user => user.id === userId);
  }

  calculateBatchOvertimeHours(): number {
    console.log('=== 计算批量加班时长 ===');
    console.log('开始时间:', this.batchOvertimeStartTime);
    console.log('结束时间:', this.batchOvertimeEndTime);
    
    if (!this.batchOvertimeStartTime || !this.batchOvertimeEndTime) {
      console.log('时间未设置，返回0');
      return 0;
    }
    
    const startTime = this.parseTimeString(this.batchOvertimeStartTime);
    const endTime = this.parseTimeString(this.batchOvertimeEndTime);
    
    console.log('解析后的开始时间:', startTime);
    console.log('解析后的结束时间:', endTime);
    
    if (!startTime || !endTime) {
      console.log('时间解析失败，返回0');
      return 0;
    }
    
    const startMinutes = startTime.hour * 60 + startTime.minute;
    const endMinutes = endTime.hour * 60 + endTime.minute;
    
    console.log('开始分钟数:', startMinutes);
    console.log('结束分钟数:', endMinutes);
    
    if (startMinutes >= endMinutes) {
      console.log('开始时间大于等于结束时间，返回0');
      return 0;
    }
    
    const hours = (endMinutes - startMinutes) / 60;
    console.log('计算出的加班时长:', hours);
    return hours; // 转换为小时
  }

  async confirmBatchAdjust() {
    if (this.selectedUsers.length === 0) {
      alert('请选择要调整的员工');
      return;
    }

    if (!this.batchOvertimeStartTime || !this.batchOvertimeEndTime) {
      alert('请设置加班时间');
      return;
    }

    const overtimeHours = this.calculateBatchOvertimeHours();
    if (overtimeHours <= 0) {
      alert('加班时长必须大于0');
      return;
    }

    if (!this.batchAdjustDate) {
      alert('请选择调整日期');
      return;
    }

    try {
      const base = this.getApiBase();
      console.log('=== 批量调整开始 ===');
      console.log('选择的用户:', this.selectedUsers);
      console.log('调整日期:', this.batchAdjustDate);
      console.log('加班时长:', overtimeHours);
      
      const promises = this.selectedUsers.map(user => {
        const dateStr = this.batchAdjustDate;
        console.log(`处理用户 ${user.id} (${user.name})`);
        // 直接使用后端API，后端会智能判断记录是否存在
        // 不传递 standardAttendanceHours，让后端保持原有值
        return this.http.post(`${base}/api/daily-attendance`, {
          userId: user.id,
          date: dateStr,
          // 不设置 standardAttendanceHours，让后端保持原有值
          overtimeHours: overtimeHours,
          leaveHours: 0,
          note: this.batchAdjustmentNote,
          adjustedBy: this.currentUser.id
        }).toPromise();
      });

      const results = await Promise.all(promises);
      const successCount = results.filter(result => (result as any)?.success).length;
      
      alert(`批量调整完成！成功调整 ${successCount}/${this.selectedUsers.length} 名员工`);
      
      this.closeBatchAdjustModal();
      this.load(true); // 重新加载列表
      if (this.showStats) {
        this.loadStats(); // 重新加载统计
      }
    } catch (error) {
      console.error('批量调整失败:', error);
      alert('批量调整失败：' + (error as any)?.message);
    }
  }

  // 考勤管理车间筛选相关方法
  async loadDepartments() {
    try {
      const base = this.getApiBase();
      const response = await this.http.get(`${base}/api/users`).toPromise();
      const users = (response as any[]).filter(user => user.role === 'worker');
      this.availableDepartmentsFilter = [...new Set(users.map(user => user.department))].filter(dept => dept);
      this.availableDepartmentsFilter.sort();
    } catch (error) {
      console.error('加载车间列表失败:', error);
      this.availableDepartmentsFilter = [];
    }
  }
  
  async loadGroups() {
    try {
      const base = this.getApiBase();
      const response = await this.http.get(`${base}/api/users`).toPromise();
      const users = (response as any[]).filter(user => user.user_group);
      this.availableGroupsFilter = [...new Set(users.map(user => user.user_group))].filter(group => group);
      this.availableGroupsFilter.sort();
    } catch (error) {
      console.error('加载组列表失败:', error);
      this.availableGroupsFilter = [];
    }
  }

  onDepartmentFilterChange() {
    // 当车间筛选改变时，保持姓名筛选不变
    this.load(true);
  }
  
  onGroupFilterChange() {
    // 当组筛选改变时，重新加载
    this.load(true);
  }

  clearFilters() {
    this.start = '';
    this.end = '';
    this.userNameFilter = '';
    this.selectedDepartmentFilter = '';
    this.selectedGroupFilter = '';
    this.load(true);
  }

  // 判断是否为周末
  isWeekend(date: string | Date): boolean {
    if (!date) return false;
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // 周日(0)或周六(6)
  }

  // 获取周末名称
  getWeekendName(date: string | Date): string {
    if (!date) return '';
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    return dayOfWeek === 0 ? '周日' : dayOfWeek === 6 ? '周六' : '';
  }

  // 加载节假日数据（优先使用GitHub数据源，失败时使用后端API）
  // 根据查询的日期范围动态加载对应年份的数据
  private async loadHolidays(): Promise<void> {
    try {
      // 计算需要加载的年份范围
      let startYear: number;
      let endYear: number;
      
      if (this.start && this.end) {
        // 如果有查询日期范围，使用查询范围
        startYear = new Date(this.start).getFullYear();
        endYear = new Date(this.end).getFullYear();
      } else {
        // 如果没有查询范围，使用当前年份（前后各扩展1年，确保覆盖）
        const currentYear = new Date().getFullYear();
        startYear = currentYear - 1;
        endYear = currentYear + 1;
      }
      
      console.log(`[考勤管理] 准备加载 ${startYear}-${endYear} 年的节假日数据`);
      
      // 方案4：优先从GitHub获取节假日数据（NateScarlet/holiday-cn项目）
      // 并行加载所有需要的年份数据
      const yearPromises: Promise<any>[] = [];
      for (let year = startYear; year <= endYear; year++) {
        yearPromises.push(
          this.http.get(
            `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`
          ).pipe(
            timeout(5000), // 5秒超时
            catchError((error) => {
              console.warn(`[考勤管理] 获取${year}年节假日数据失败:`, error);
              return Promise.resolve(null); // 失败时返回null，不中断其他请求
            })
          ).toPromise()
        );
      }
      
      try {
        const responses = await Promise.all(yearPromises);
        
        // 合并所有年份的节假日数据
        const holidayDates: string[] = [];
        const holidayNamesMap = new Map<string, string>();
        let loadedYears = 0;
        
        responses.forEach((githubResponse: any, index: number) => {
          const year = startYear + index;
          if (githubResponse?.days) {
            // GitHub返回的days是数组格式，不是对象
            const daysArray = Array.isArray(githubResponse.days) 
              ? githubResponse.days 
              : Object.values(githubResponse.days);
            
            daysArray
              .filter((item: any) => item && item.isOffDay === true)
              .forEach((item: any) => {
                const dateStr = item.date || '';
                const name = item.name || '节假日';
                if (dateStr && dateStr.length > 0) {
                  holidayDates.push(dateStr);
                  holidayNamesMap.set(dateStr, name);
                }
              });
            
            loadedYears++;
            console.log(`[考勤管理] 已加载 ${year} 年节假日数据`);
          }
        });
        
        if (loadedYears > 0) {
          this.holidays = new Set(holidayDates);
          this.holidayNames = holidayNamesMap;
          console.log(`[考勤管理] 已加载 ${this.holidays.size} 个节假日（来自GitHub，${loadedYears}个年份：${startYear}-${endYear}）`);
          return; // 成功获取，直接返回
        } else {
          console.warn('[考勤管理] 所有年份的GitHub数据获取失败，尝试使用后端API');
        }
      } catch (githubError) {
        console.warn('[考勤管理] 从GitHub获取节假日数据失败，尝试使用后端API:', githubError);
      }
      
      // 备用方案：从后端API获取
      await this.loadHolidaysFromBackend();
    } catch (error) {
      console.error('[考勤管理] 加载节假日失败:', error);
      this.holidays = new Set(); // 失败时使用空集合
      this.holidayNames = new Map();
    }
  }

  // 从后端API加载节假日数据（备用方案）
  private async loadHolidaysFromBackend(): Promise<void> {
    try {
      const base = this.getApiBase();
      const response: any = await this.http.get(`${base}/api/holidays`).toPromise();
      
      if (response?.success && response?.data) {
        // 存储节假日日期和名称
        const holidayDates: string[] = [];
        const holidayNamesMap = new Map<string, string>();
        
        response.data
          .filter((h: any) => !h.is_working_day)
          .forEach((h: any) => {
            // 确保日期格式为 YYYY-MM-DD
            const date = new Date(h.date);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            holidayDates.push(dateStr);
            holidayNamesMap.set(dateStr, h.name || '节假日');
          });
        
        this.holidays = new Set(holidayDates);
        this.holidayNames = holidayNamesMap;
        console.log(`[考勤管理] 已加载 ${this.holidays.size} 个节假日（来自后端API）`);
      } else {
        console.warn('[考勤管理] 未获取到节假日数据');
        this.holidays = new Set();
        this.holidayNames = new Map();
      }
    } catch (error) {
      console.error('[考勤管理] 从后端API加载节假日失败:', error);
      this.holidays = new Set();
      this.holidayNames = new Map();
    }
  }

  // 判断日期是否为节假日（前端判断，用于补充后端数据）
  isHoliday(date: string | Date): boolean {
    if (!date) return false;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return this.holidays.has(dateStr);
  }

  // 获取节假日名称（从GitHub数据中获取）
  getHolidayName(date: string | Date): string {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return this.holidayNames.get(dateStr) || '';
  }

  // 判断日期是否为工作日（排除周末和节假日）
  isWorkingDay(date: string | Date): boolean {
    if (this.isWeekend(date)) return false;
    return !this.isHoliday(date);
  }

  // 打开批量考勤管理模态框
  async openBatchAttendanceModal() {
    // 设置初始值
    this.batchAttendanceDate = this.getLocalDateString(); // YYYY-MM-DD格式
    
    // 根据工作时间设置自动计算考勤时长
    if (this.workTimeSettings && this.workTimeSettings.standardHours) {
      this.batchAttendanceHours = this.workTimeSettings.standardHours;
    } else {
      this.batchAttendanceHours = null;
    }
    
    this.batchAttendanceNote = '';
    
    // 打开模态框
    this.isBatchAttendanceModalOpen = true;
    
    // 加载工人列表
    try {
      await this.loadWorkers();
    } catch (error) {
      console.error('加载工人列表失败:', error);
    }
  }


  // 验证日期格式
  isValidDate(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) {
      return false;
    }
    
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  // 格式化日期
  formatDate(dateString: string): string {
    if (!this.isValidDate(dateString)) {
      return this.getLocalDateString();
    }
    return dateString;
  }

  // 日期输入变化处理
  onDateInputChange(event: any) {
    const value = event.target.value;
    
    if (value && this.isValidDate(value)) {
      this.batchAttendanceDate = value;
      // 根据工作时间设置自动更新考勤时长
      this.updateBatchAttendanceHoursByDate();
    }
  }
  
  // 根据选择的日期更新考勤时长
  updateBatchAttendanceHoursByDate() {
    if (this.workTimeSettings && this.workTimeSettings.standardHours) {
      this.batchAttendanceHours = this.workTimeSettings.standardHours;
    } else {
      this.batchAttendanceHours = null;
    }
  }

  // 设置今天
  setToday() {
    this.batchAttendanceDate = this.getLocalDateString();
    this.updateBatchAttendanceHoursByDate();
  }

  // 设置昨天
  setYesterday() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    this.batchAttendanceDate = this.getLocalDateString(yesterday);
    this.updateBatchAttendanceHoursByDate();
  }

  // 设置明天
  setTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.batchAttendanceDate = this.getLocalDateString(tomorrow);
    this.updateBatchAttendanceHoursByDate();
  }

  // 获取本地日期字符串（避免UTC转换问题）
  getLocalDateString(date?: Date): string {
    const d = date || new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 获取HTML5日期输入的值
  getDateForHTML5Input(): string {
    return this.batchAttendanceDate || this.getLocalDateString();
  }

  // 关闭批量考勤管理模态框
  closeBatchAttendanceModal() {
    this.isBatchAttendanceModalOpen = false;
    this.filteredWorkers = [];
    this.searchKeyword = '';
    this.selectedGroup = '';
  }

  // 加载工人列表
  async loadWorkers() {
    try {
      const base = this.getApiBase();
      const response = await this.http.get(`${base}/api/users`).toPromise();
      const users = (response as any[]).filter(user => user.role === 'worker');
      
      this.filteredWorkers = users.map(user => ({
        ...user,
        selected: false
      }));
      
      this.availableGroups = [...new Set(users.map(user => user.user_group))].filter(group => group);
      this.availableGroups.sort();
    } catch (error) {
      console.error('加载工人列表失败:', error);
      this.presentToast('加载工人列表失败');
    }
  }

  // 筛选工人
  filterWorkers() {
    let filtered = this.filteredWorkers;
    
    // 按姓名搜索
    if (this.searchKeyword) {
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(this.searchKeyword.toLowerCase())
      );
    }
    
    // 按组筛选
    if (this.selectedGroup) {
      filtered = filtered.filter(user => user.user_group === this.selectedGroup);
    }
    
    this.filteredWorkers = filtered;
  }

  // 全选工人
  selectAllWorkers() {
    this.filteredWorkers.forEach(user => user.selected = true);
  }

  // 清空选择
  clearAllWorkers() {
    this.filteredWorkers.forEach(user => user.selected = false);
  }

  // 工人选择变化
  onWorkerSelectionChange() {
    // 可以在这里添加额外的逻辑
  }

  // 确认批量考勤设置
  async confirmBatchAttendance() {
    // 验证日期
    if (!this.batchAttendanceDate) {
      this.presentToast('请选择日期');
      return;
    }

    if (!this.isValidDate(this.batchAttendanceDate)) {
      this.presentToast('请输入有效的日期格式');
      return;
    }

    if (this.selectedWorkersCount === 0) {
      this.presentToast('请选择至少一名工人');
      return;
    }
    
    if (this.batchAttendanceHours === null || this.batchAttendanceHours === undefined) {
      this.presentToast('请输入考勤时长');
      return;
    }
    
    const selectedWorkers = this.filteredWorkers.filter(user => user.selected);
    const confirmed = await this.alertController.create({
      header: '确认批量设置考勤',
      message: `确定要为 ${selectedWorkers.length} 名工人设置 ${this.batchAttendanceHours} 小时的考勤吗？`,
      buttons: [
        {
          text: '取消',
          role: 'cancel'
        },
        {
          text: '确认设置',
          handler: async () => {
            try {
              const base = this.getApiBase();
              
              // 为每个选中的工人设置考勤
              let successCount = 0;
              for (const worker of selectedWorkers) {
                const response = await this.http.post(`${base}/api/daily-attendance`, {
                  userId: worker.id,
                  date: this.batchAttendanceDate,
                  standardAttendanceHours: this.batchAttendanceHours,
                  overtimeHours: 0,
                  leaveHours: 0,
                  note: this.batchAttendanceNote || '批量考勤管理',
                  adjustedBy: 1
                }).toPromise();
                
                if (response && (response as any).success) {
                  successCount++;
                }
              }
              
              this.presentToast(`成功设置 ${successCount} 名工人的考勤`);
              this.closeBatchAttendanceModal();
              this.load(true); // 重新加载数据
            } catch (error) {
              console.error('批量设置考勤失败:', error);
              this.presentToast('批量设置考勤失败');
            }
          }
        }
      ]
    });
    
    await confirmed.present();
  }

  // 显示提示消息
  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'top'
    });
    await toast.present();
  }

  // ========== 工作时间设置相关方法 ==========

  // 打开工作时间设置模态框
  async openWorkTimeModal() {
    this.isWorkTimeModalOpen = true;
    await this.loadWorkTimeSettings();
  }

  // 关闭工作时间设置模态框
  closeWorkTimeModal() {
    this.isWorkTimeModalOpen = false;
  }

  // 加载工作时间设置
  async loadWorkTimeSettings() {
    try {
      const base = this.getApiBase();
      const response: any = await this.http.get(`${base}/api/work-time-settings`).toPromise();
      
      if (response.success && response.settings) {
        this.workTimeSettings = {
          startTime: response.settings.start_time,
          endTime: response.settings.end_time,
          lunchStartTime: response.settings.lunch_start_time,
          lunchEndTime: response.settings.lunch_end_time,
          otherBreakStartTime: response.settings.other_break_start_time,
          otherBreakEndTime: response.settings.other_break_end_time,
          standardHours: response.settings.standard_hours,
          defaultOvertimeStartTime: response.settings.default_overtime_start_time,
          defaultOvertimeEndTime: response.settings.default_overtime_end_time,
          note: response.settings.note
        };
      } else {
        console.error('未找到工作时间设置:', response.message);
        this.workTimeSettings = null; // 拒绝使用默认值
        this.presentToast('未找到工作时间设置，请先配置工作时间');
      }
    } catch (error) {
      console.error('加载工作时间设置失败:', error);
      this.workTimeSettings = null; // 拒绝使用默认值
      this.presentToast('加载工作时间设置失败，请检查网络连接');
    }
  }

  // 保存工作时间设置
  async saveWorkTimeSettings() {
    if (!this.workTimeSettings.startTime || !this.workTimeSettings.endTime) {
      this.presentToast('请填写上班时间和下班时间');
      return;
    }

    // 保存前重新计算标准工作时长
    this.calculateStandardHours();

    this.isSubmitting = true;

    try {
      const base = this.getApiBase();
      const response: any = await this.http.post(`${base}/api/work-time-settings`, {
        startTime: this.workTimeSettings.startTime,
        endTime: this.workTimeSettings.endTime,
        lunchStartTime: this.workTimeSettings.lunchStartTime,
        lunchEndTime: this.workTimeSettings.lunchEndTime,
        otherBreakStartTime: this.workTimeSettings.otherBreakStartTime,
        otherBreakEndTime: this.workTimeSettings.otherBreakEndTime,
        standardHours: this.workTimeSettings.standardHours,
        defaultOvertimeStartTime: this.workTimeSettings.defaultOvertimeStartTime,
        defaultOvertimeEndTime: this.workTimeSettings.defaultOvertimeEndTime,
        note: this.workTimeSettings.note,
        updatedBy: this.currentUser?.id
      }).toPromise();

      if (response.success) {
        this.presentToast('工作时间设置保存成功');
        this.closeWorkTimeModal();
        // 重新加载考勤数据以显示新的标准考勤时长
        this.load();
      } else {
        this.presentToast('保存失败：' + (response.error || '未知错误'));
      }
    } catch (error: any) {
      this.presentToast('保存失败：' + (error.error?.error || error.message));
    } finally {
      this.isSubmitting = false;
    }
  }

  // 重置为默认设置（拒绝使用硬编码默认值）
  resetWorkTimeSettings() {
    this.presentToast('拒绝使用默认设置，请从数据库加载工作时间配置');
  }

  // 自动计算标准工作时长
  calculateStandardHours() {
    try {
      // 获取上班时间和下班时间
      const startTime = this.workTimeSettings.startTime;
      const endTime = this.workTimeSettings.endTime;
      const lunchStartTime = this.workTimeSettings.lunchStartTime;
      const lunchEndTime = this.workTimeSettings.lunchEndTime;
      const otherBreakStartTime = this.workTimeSettings.otherBreakStartTime;
      const otherBreakEndTime = this.workTimeSettings.otherBreakEndTime;

      if (!startTime || !endTime) {
        return;
      }

      // 计算总工作时间（分钟）
      const start = this.timeToMinutes(startTime);
      const end = this.timeToMinutes(endTime);
      const totalMinutes = end - start;

      // 计算午休时间（分钟）
      let lunchMinutes = 0;
      if (lunchStartTime && lunchEndTime) {
        const lunchStart = this.timeToMinutes(lunchStartTime);
        const lunchEnd = this.timeToMinutes(lunchEndTime);
        lunchMinutes = lunchEnd - lunchStart;
      }

      // 计算其余休息时间（分钟）
      let otherBreakMinutes = 0;
      if (otherBreakStartTime && otherBreakEndTime) {
        const otherBreakStart = this.timeToMinutes(otherBreakStartTime);
        const otherBreakEnd = this.timeToMinutes(otherBreakEndTime);
        otherBreakMinutes = otherBreakEnd - otherBreakStart;
      }

      // 计算实际工作时长（分钟）
      const workMinutes = totalMinutes - lunchMinutes - otherBreakMinutes;

      // 转换为小时（保留2位小数）
      this.workTimeSettings.standardHours = Math.round(workMinutes / 60 * 100) / 100;

    } catch (error) {
      console.error('计算标准工时失败:', error);
    }
  }

  // 将时间字符串转换为分钟数
  private timeToMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // 解析时间字符串（HH:MM格式）
  private parseTimeString(timeStr: string): { hour: number; minute: number } | null {
    if (!timeStr || !timeStr.includes(':')) return null;
    const [hourStr, minuteStr] = timeStr.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    if (isNaN(hour) || isNaN(minute)) return null;
    return { hour, minute };
  }

  // 将小时和分钟转换为时间字符串
  private formatTimeString(hour: number, minute: number): string {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  // 时间输入变化事件处理
  onOvertimeStartTimeChange() {
    if (this.overtimeStartTime) {
      const time = this.parseTimeString(this.overtimeStartTime);
      if (time) {
        this.overtimeStartHour = time.hour;
        this.overtimeStartMinute = time.minute;
      }
    }
  }

  onOvertimeEndTimeChange() {
    if (this.overtimeEndTime) {
      const time = this.parseTimeString(this.overtimeEndTime);
      if (time) {
        this.overtimeEndHour = time.hour;
        this.overtimeEndMinute = time.minute;
      }
    }
  }

  onLeaveStartTimeChange() {
    if (this.leaveStartTime) {
      const time = this.parseTimeString(this.leaveStartTime);
      if (time) {
        this.leaveStartHour = time.hour;
        this.leaveStartMinute = time.minute;
      }
    }
  }

  onLeaveEndTimeChange() {
    if (this.leaveEndTime) {
      const time = this.parseTimeString(this.leaveEndTime);
      if (time) {
        this.leaveEndHour = time.hour;
        this.leaveEndMinute = time.minute;
      }
    }
  }
  
  // 批量调整时间输入变化事件处理
  onBatchOvertimeStartTimeChange() {
    if (this.batchOvertimeStartTime) {
      const time = this.parseTimeString(this.batchOvertimeStartTime);
      if (time) {
        this.batchOvertimeStartHour = time.hour;
        this.batchOvertimeStartMinute = time.minute;
      }
    }
  }
  
  onBatchOvertimeEndTimeChange() {
    if (this.batchOvertimeEndTime) {
      const time = this.parseTimeString(this.batchOvertimeEndTime);
      if (time) {
        this.batchOvertimeEndHour = time.hour;
        this.batchOvertimeEndMinute = time.minute;
      }
    }
  }
}



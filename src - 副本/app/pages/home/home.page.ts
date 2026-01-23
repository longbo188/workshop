import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonList,
  IonItem,
  IonLabel,
  IonAlert,
  IonButton,
  IonButtons,
  IonIcon,
  IonBadge,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonModal,
  IonInput,
  IonTextarea,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonDatetime,
  IonNote,
  IonChip,
  ToastController,
  AlertController,
  ActionSheetController
} from '@ionic/angular/standalone';
// 新增：导入 HttpClient
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common'; // 提供 *ngIf 等指令
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
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
    IonList,
    IonItem,
    IonLabel,
    IonAlert,
    IonButton,
    IonButtons,
    IonIcon,
    IonBadge,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonModal,
    IonInput,
    IonTextarea,
    IonSegment,
    IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonDatetime,
  IonNote,
  IonChip,
  CommonModule,
    FormsModule,
    RouterLink
  ]
})
export class HomePage implements OnInit, OnDestroy {
  // 注入服务
  private http = inject(HttpClient);
  private router = inject(Router);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);
  private actionSheetController = inject(ActionSheetController);
  
  tasks: any[] = [];
  filteredTasks: any[] = [];
  isLoading: boolean = true;
  errorMsg: string = '';
  currentUser: any = null;
  pendingApprovals: any[] = []; // 任务完成报告的待审批
  pendingExceptionReports: any[] = []; // 异常报告的待审批
  
  // 责任部门确认相关
  staffExceptionReports: any[] = []; // 责任部门确认的异常报告列表
  filteredStaffReports: any[] = []; // 筛选后的责任部门确认报告

  // 考勤：今日状态
  attendance: any = null;

  // 筛选/搜索与范围
  filterPriority: string = '';
  filterDepartment: string = '';
  keyword: string = '';
  viewScope: 'mine' | 'all' = 'mine';
  taskViewMode: 'active' | 'completed' = 'active';
  activeTaskId: number | null = null;
  departments: string[] = []; // 部门列表
  users: any[] = []; // 用户列表（用于部门筛选）
  private activeStartMs: number | null = null;
  activeElapsedText: string = '00:00:00';
  private activeTimerHandle: any = null;
  pausedTaskId: number | null = null; // 暂停的任务ID
  private pausedElapsedMs: number = 0; // 暂停时已累计的时间（毫秒）

  // 完成任务相关属性
  isCompleteModalOpen: boolean = false;
  selectedTaskForComplete: any = null;
  selectedTaskPhaseName: string = '';
  isSubmitting: boolean = false;

  // 异常上报相关属性
  isExceptionModalOpen: boolean = false;
  selectedTaskForException: any = null;
  exceptionType: string = '';
  selectedApproverId: number | null = null;
  exceptionDescription: string = '';
  exceptionStartDateTime: string = '';
  exceptionEndDateTime: string = '';
  selectedImage: string | null = null;
  selectedImageFile: File | null = null;
  approvers: any[] = [];
  approvalAction: string = 'approve'; // 用于责任部门确认：'approve' or 'reject'
  approvalNote: string = ''; // 用于责任部门确认备注
  
  // 导入员工相关属性
  isImportUserModalOpen: boolean = false;
  selectedUserFile: File | null = null;
  isImportingUsers: boolean = false;
  importUserResult: any = null;
  // 员工信息查询
  isUserListModalOpen: boolean = false;
  userSearchKeyword: string = '';
  
  // 导入标准工时相关属性
  isStdHoursModalOpen: boolean = false;
  selectedStdFile: File | null = null;
  isImportingStd: boolean = false;
  importStdResult: any = null;
  // IonDatetime 辅助范围（防止空白）
  minDateISO: string = '2000-01-01T00:00';
  maxDateISO: string = '2100-12-31T23:59';


  async ngOnInit() {
    // 获取当前用户信息
    const userStr = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (userStr) {
      this.currentUser = JSON.parse(userStr);
    }
    await this.loadUsersAndDepartments();
    
    // Staff角色加载责任部门确认的异常报告，其他角色加载任务
    if (this.currentUser?.role === 'staff') {
      this.loadStaffExceptionReports();
    } else {
      this.loadTasks();
    }
    
    this.loadPendingApprovalsIfNeeded();
    this.loadPendingExceptionReportsIfNeeded();
    this.fetchActiveTimer();
  }
  
  // 加载用户和部门列表
  async loadUsersAndDepartments() {
    try {
      const isNative = Capacitor.isNativePlatform();
      const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
      const usersData: any = await this.http.get(`${base}/api/users`).toPromise();
      this.users = usersData || [];
      
      // 提取部门列表
      this.departments = [...new Set(this.users
        .map((user: any) => user.department)
        .filter((dept: string | undefined) => dept && dept.trim() !== '')
      )].sort();
    } catch (error) {
      console.error('加载用户和部门列表失败:', error);
    }
  }

  ngOnDestroy(): void {
    this.stopTicker();
  }

  // 打开/关闭员工信息查询模态框
  openUserListModal() {
    this.isUserListModalOpen = true;
    this.userSearchKeyword = '';
  }

  closeUserListModal() {
    this.isUserListModalOpen = false;
    this.userSearchKeyword = '';
  }

  get filteredUsersForModal() {
    const keyword = (this.userSearchKeyword || '').trim().toLowerCase();
    // 只展示 worker 角色
    const workerUsers = (this.users || []).filter((u: any) => u.role === 'worker');
    if (!keyword) {
      return workerUsers;
    }
    return workerUsers.filter((u: any) => {
      const text = [
        u.username,
        u.name,
        u.department,
        u.user_group
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(keyword);
    });
  }

  async loadTasks(): Promise<void> {
    this.isLoading = true;
    this.errorMsg = '';
    
    // 根据用户角色和任务类型加载不同的任务
    const isNative = Capacitor.isNativePlatform();
    const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
    
    let url: string;
    if (this.currentUser?.role === 'manager') {
      // 经理始终看全部任务（不区分完成状态，由前端过滤）
      url = `${base}/api/tasks`;
    } else if (this.currentUser?.role === 'admin' && this.viewScope === 'all') {
      // 管理员选择查看全部
      url = `${base}/api/tasks`;
    } else {
      // 工人、主管和管理员看自己
      if (this.taskViewMode === 'completed') {
        // 已完成任务
        url = `${base}/api/tasks/user/${this.currentUser?.id}/completed`;
      } else {
        // 进行中任务
        url = `${base}/api/tasks/user/${this.currentUser?.id}`;
      }
    }
    
    return new Promise((resolve) => {
      this.http.get(url).subscribe({
        next: (data: any) => {
          // 处理API返回的数据结构
          if (Array.isArray(data)) {
            this.tasks = data;
          } else if (data && Array.isArray(data.value)) {
            this.tasks = data.value;
          } else {
            this.tasks = [];
          }
          
          this.tasks = (this.tasks || []).map(task => ({
            ...task,
            priority: this.normalizePriorityValue(task.priority)
          }));
          
          // 根据taskViewMode过滤任务（仅经理和管理员看全部任务时需要）
          if (this.currentUser?.role === 'manager' || (this.currentUser?.role === 'admin' && this.viewScope === 'all')) {
            if (this.taskViewMode === 'active') {
              // 进行中视图：只显示未完成的任务
              this.tasks = this.tasks.filter((t: any) => t.status !== 'completed');
            } else {
              // 已完成视图：只显示已完成的任务
              this.tasks = this.tasks.filter((t: any) => t.status === 'completed');
            }
          }
          
          this.applyFilters();
          this.isLoading = false;
          resolve();
        },
        error: (err) => {
          this.errorMsg = '获取任务失败: ' + (err.error?.error || err.message);
          this.isLoading = false;
          resolve();
        }
      });
    });
  }

  doRefresh(event: any) {
    if (this.currentUser?.role === 'staff') {
      this.loadStaffExceptionReports();
    } else {
      this.loadTasks();
    }
    this.loadPendingApprovalsIfNeeded();
    this.loadPendingExceptionReportsIfNeeded();
    this.fetchActiveTimer();
    setTimeout(() => event.target.complete(), 500);
  }

  applyFilters() {
    // Staff角色：筛选异常报告
    if (this.currentUser?.role === 'staff') {
      this.filteredStaffReports = this.staffExceptionReports.filter(report => {
        const kw = (this.keyword || '').trim().toLowerCase();
        const kwOk = kw ? (
          (report.task_name || '').toLowerCase().includes(kw) || 
          (report.description || '').toLowerCase().includes(kw) ||
          (report.modified_description || '').toLowerCase().includes(kw) ||
          (report.exception_type || '').toLowerCase().includes(kw) ||
          (report.modified_exception_type || '').toLowerCase().includes(kw)
        ) : true;
        return kwOk;
      });
      return;
    }
    
    // 其他角色：筛选任务
    this.filteredTasks = this.tasks.filter(t => {
      const priorityOk = this.filterPriority ? t.priority === this.filterPriority : true;
      const kw = (this.keyword || '').trim().toLowerCase();
      const kwOk = kw ? ((t.name || '').toLowerCase().includes(kw) || (t.description || '').toLowerCase().includes(kw)) : true;
      
      // 部门筛选
      let departmentOk = true;
      if (this.filterDepartment) {
        // 检查任务的任何阶段的分配人是否属于所选部门
        const assignees = [
          t.machining_assignee, t.electrical_assignee, t.pre_assembly_assignee,
          t.post_assembly_assignee, t.debugging_assignee
        ];
        departmentOk = assignees.some(assigneeId => {
          if (!assigneeId) return false;
          const user = this.users.find(u => u.id === assigneeId);
          return user && user.department === this.filterDepartment;
        });
      }
      
      return priorityOk && kwOk && departmentOk;
    });
  }

  resetFilters() {
    this.filterPriority = '';
    this.filterDepartment = '';
    this.keyword = '';
    if (this.currentUser?.role === 'staff') {
      this.filteredStaffReports = this.staffExceptionReports;
    } else {
      this.applyFilters();
    }
  }

  // 任务视图模式切换
  onTaskViewModeChange() {
    if (this.currentUser?.role === 'staff') {
      this.loadStaffExceptionReports();
    } else {
      this.loadTasks();
    }
  }

  private loadPendingApprovalsIfNeeded() {
    if (!(this.currentUser?.role === 'admin' || this.currentUser?.role === 'supervisor' || this.currentUser?.role === 'manager')) {
      this.pendingApprovals = [];
      return;
    }
    if (!this.currentUser?.id) {
      this.pendingApprovals = [];
      return;
    }
    const isNative = Capacitor.isNativePlatform();
    const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
    // 调用任务完成报告的待审批API，传递当前用户ID进行过滤
    this.http.get(`${base}/api/approvals/pending?approverId=${this.currentUser.id}`).subscribe({
      next: (rows: any) => {
        this.pendingApprovals = rows || [];
        // 如果有待审批任务，弹出提醒
        if (this.pendingApprovals.length > 0) {
          this.showPendingApprovalsAlert();
        }
      },
      error: () => (this.pendingApprovals = [])
    });
  }
  
  // 加载异常报告的待审批
  private loadPendingExceptionReportsIfNeeded() {
    if (!(this.currentUser?.role === 'admin' || this.currentUser?.role === 'supervisor' || this.currentUser?.role === 'manager')) {
      this.pendingExceptionReports = [];
      return;
    }
    if (!this.currentUser?.id) {
      this.pendingExceptionReports = [];
      return;
    }
    const isNative = Capacitor.isNativePlatform();
    const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
    // 调用异常报告的待审批API，传递当前用户ID进行过滤
    this.http.get(`${base}/api/exception-reports/pending?approverId=${this.currentUser.id}`).subscribe({
      next: (rows: any) => {
        this.pendingExceptionReports = rows || [];
        // 如果有待审批的异常报告，弹出提醒
        if (this.pendingExceptionReports.length > 0) {
          this.showPendingExceptionReportsAlert();
        }
      },
      error: () => (this.pendingExceptionReports = [])
    });
  }

  // 显示待审批任务提醒
  async showPendingApprovalsAlert() {
    const alert = await this.alertController.create({
      header: '有待审批的任务',
      message: `您有 ${this.pendingApprovals.length} 个待审批的任务完成报告，请及时处理。`,
      buttons: [
        {
          text: '稍后提醒',
          role: 'cancel'
        },
        {
          text: '立即查看',
          handler: () => {
            // 可以导航到任务审批页面，如果有的话
          }
        }
      ]
    });
    
    await alert.present();
  }

  // 显示待审批异常报告提醒
  async showPendingExceptionReportsAlert() {
    const alert = await this.alertController.create({
      header: '有待审批的异常报告',
      message: `您有 ${this.pendingExceptionReports.length} 个待审批的异常报告，请及时处理。`,
      buttons: [
        {
          text: '稍后提醒',
          role: 'cancel'
        },
        {
          text: '立即查看',
          handler: () => {
            this.router.navigate(['/exception-approval']);
          }
        }
      ]
    });
    
    await alert.present();
  }


  approve(report: any) {
    const isNative = Capacitor.isNativePlatform();
    const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
    this.http.post(`${base}/api/exception-reports/${report.id}/approve`, {
      approverId: this.currentUser.id,
      action: 'approve',
      approvalNote: ''
    }).subscribe({
      next: () => { this.loadTasks(); this.loadPendingApprovalsIfNeeded(); this.loadPendingExceptionReportsIfNeeded(); },
      error: (err) => this.errorMsg = '审批通过失败：' + (err.error?.error || err.message)
    });
  }

  reject(report: any) {
    const isNative = Capacitor.isNativePlatform();
    const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
    this.http.post(`${base}/api/exception-reports/${report.id}/approve`, {
      approverId: this.currentUser.id,
      action: 'reject',
      approvalNote: ''
    }).subscribe({
      next: () => { this.loadTasks(); this.loadPendingApprovalsIfNeeded(); this.loadPendingExceptionReportsIfNeeded(); },
      error: (err) => this.errorMsg = '审批驳回失败：' + (err.error?.error || err.message)
    });
  }

  approveWithNote(report: any) {
    const note = prompt('请输入审批通过备注（可选）');
    const isNative = Capacitor.isNativePlatform();
    const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
    // 调用任务完成报告的审批API
    this.http.post(`${base}/api/approvals/${report.id}/approve`, {
      note: note || ''
    }).subscribe({
      next: () => { this.loadTasks(); this.loadPendingApprovalsIfNeeded(); this.loadPendingExceptionReportsIfNeeded(); },
      error: (err) => this.errorMsg = '审批通过失败：' + (err.error?.error || err.message)
    });
  }

  rejectWithNote(report: any) {
    const note = prompt('请输入驳回原因（必填）') || '';
    if (!note.trim()) {
      this.errorMsg = '请输入驳回原因';
      return;
    }
    const isNative = Capacitor.isNativePlatform();
    const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
    // 调用任务完成报告的驳回API
    this.http.post(`${base}/api/approvals/${report.id}/reject`, {
      note: note
    }).subscribe({
      next: () => { this.loadTasks(); this.loadPendingApprovalsIfNeeded(); this.loadPendingExceptionReportsIfNeeded(); },
      error: (err) => this.errorMsg = '审批驳回失败：' + (err.error?.error || err.message)
    });
  }

  getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': '待处理',
      'in_progress': '进行中',
      'completed': '已完成',
      'cancelled': '已取消'
    };
    return statusMap[status] || status;
  }

  private normalizePriorityValue(priority: any): 'urgent' | 'normal' {
    if (!priority && priority !== 0) {
      return 'normal';
    }
    const text = String(priority).toLowerCase();
    if (text === 'urgent' || text === 'high' || text === '紧急' || text === '高') {
      return 'urgent';
    }
    return 'normal';
  }

  getPriorityColor(priority: string): string {
    return this.normalizePriorityValue(priority) === 'urgent' ? 'danger' : 'medium';
  }

  getPriorityText(priority: string): string {
    return this.normalizePriorityValue(priority) === 'urgent' ? '紧急' : '非紧急';
  }


  // ======= 任务计时：UI 事件 =======
  async startTaskTimer(task: any) {
    if (!this.currentUser?.id || !this.isTaskAssignedToUser(task)) return;
    try {
      const base = this.getApiBase();
      const resp: any = await this.http.post(`${base}/api/task-time/start`, { taskId: task.id, userId: this.currentUser.id }).toPromise();
      if (resp?.success) {
        this.fetchTaskTotalMinutes(task);
        this.activeTaskId = task.id;
        this.activeStartMs = Date.now();
        this.pausedTaskId = null;
        this.pausedElapsedMs = 0;
        this.startTicker();
      }
    } catch (e: any) {
      this.errorMsg = '开始计时失败：' + (e?.error?.error || e?.message);
    }
  }

  async stopTaskTimer(task: any) {
    if (!this.currentUser?.id || !this.isTaskAssignedToUser(task)) return;
    try {
      const ok = confirm('确认停止该任务计时吗？');
      if (!ok) return;
      const base = this.getApiBase();
      const resp: any = await this.http.post(`${base}/api/task-time/stop`, { taskId: task.id, userId: this.currentUser.id }).toPromise();
      if (resp?.success) {
        this.fetchTaskTotalMinutes(task);
        this.activeTaskId = null;
        this.activeStartMs = null;
        this.pausedTaskId = null;
        this.pausedElapsedMs = 0;
        this.stopTicker();
      }
    } catch (e: any) {
      this.errorMsg = '停止计时失败：' + (e?.error?.error || e?.message);
    }
  }

  async pauseTaskTimer(task: any) {
    if (!this.currentUser?.id || !this.isTaskAssignedToUser(task)) return;
    try {
      // 计算当前已累计的时间
      if (this.activeStartMs) {
        this.pausedElapsedMs += Date.now() - this.activeStartMs;
      }
      
      // 暂停计时
      this.pausedTaskId = task.id;
      this.activeTaskId = null;
      this.activeStartMs = null;
      this.stopTicker();
      
      // 更新显示的时间
      this.updateElapsedDisplay();
    } catch (e: any) {
      this.errorMsg = '暂停计时失败：' + (e?.error?.error || e?.message);
    }
  }

  async resumeTaskTimer(task: any) {
    if (!this.currentUser?.id || !this.isTaskAssignedToUser(task)) return;
    try {
      // 恢复计时
      this.activeTaskId = task.id;
      this.activeStartMs = Date.now();
      this.pausedTaskId = null;
      this.startTicker();
    } catch (e: any) {
      this.errorMsg = '恢复计时失败：' + (e?.error?.error || e?.message);
    }
  }

  fetchTaskTotalMinutes(task: any) {
    const base = this.getApiBase();
    this.http.get(`${base}/api/task-time/summary/${task.id}`).subscribe({
      next: (data: any) => task._totalMinutes = data?.totalMinutes ?? 0,
      error: () => task._totalMinutes = undefined
    });
  }

  fetchActiveTimer() {
    if (!this.currentUser?.id) { this.activeTaskId = null; return; }
    const base = this.getApiBase();
    this.http.get(`${base}/api/task-time/active/${this.currentUser.id}`).subscribe({
      next: (data: any) => {
        this.activeTaskId = data?.task_id || null;
        this.activeStartMs = data?.start_time ? new Date(data.start_time).getTime() : null;
        if (this.activeTaskId && this.activeStartMs) {
          this.startTicker();
        } else {
          this.stopTicker();
        }
      },
      error: () => { this.activeTaskId = null; this.activeStartMs = null; this.stopTicker(); }
    });
  }

  private startTicker() {
    this.stopTicker();
    if (!this.activeStartMs) { this.activeElapsedText = '00:00:00'; return; }
    this.updateElapsedText();
    this.activeTimerHandle = setInterval(() => this.updateElapsedText(), 1000);
  }

  private stopTicker() {
    if (this.activeTimerHandle) {
      clearInterval(this.activeTimerHandle);
      this.activeTimerHandle = null;
    }
  }

  private updateElapsedText() {
    if (!this.activeStartMs) { 
      this.activeElapsedText = this.formatHms(this.pausedElapsedMs);
      return; 
    }
    const diffMs = this.pausedElapsedMs + (Date.now() - this.activeStartMs);
    this.activeElapsedText = this.formatHms(diffMs);
  }

  private updateElapsedDisplay() {
    this.activeElapsedText = this.formatHms(this.pausedElapsedMs);
  }

  private formatHms(ms: number): string {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  // ========== 任务计时相关 ==========
  private getApiBase(): string {
    const isNative = Capacitor.isNativePlatform();
    return isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
  }

  // 主页不再展示通用考勤卡片；改为在任务行提供计时按钮

  private isAttendanceRole(): boolean {
    const role = this.currentUser?.role;
    return role === 'worker' || role === 'supervisor' || role === 'manager';
  }



  logout() {
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUser');
    window.location.href = '/login';
  }

  goDispatch() {
    this.router.navigate(['/dispatch']);
  }

  goManagerAssist() {
    this.router.navigate(['/manager-home']);
  }

  // ========== 完成任务相关方法 ==========

  // 获取任务的操作阶段（分配给用户的阶段，如果没有则使用 current_phase）
  getTaskOperatePhase(task: any): string | null {
    const assignedPhase = this.getAssignedPhase(task);
    if (assignedPhase) return assignedPhase;
    return task.current_phase || null;
  }

  // 检查阶段是否已开始
  isPhaseStarted(task: any): boolean {
    const phase = this.getTaskOperatePhase(task);
    if (!phase) return false;
    // 阶段已开始且未暂停
    return task[`${phase}_start_time`] !== null && 
           !this.isPhasePaused(task);
  }

  // 检查阶段是否已暂停
  isPhasePaused(task: any): boolean {
    const phase = this.getTaskOperatePhase(task);
    if (!phase) return false;
    return task[`${phase}_paused_at`] !== null && 
           task[`${phase}_paused_at`] !== undefined;
  }

  // 检查阶段是否已完成
  isPhaseCompleted(task: any): boolean {
    const phase = this.getTaskOperatePhase(task);
    if (!phase) return false;
    return task[`${phase}_phase`] === 1;
  }

  // 获取分配给当前用户的阶段
  getAssignedPhase(task: any): string | null {
    if (!this.currentUser) return null;
    
    // 优先使用后端返回的 assigned_phase 字段（如果存在）
    if (task.assigned_phase) {
      return task.assigned_phase;
    }
    
    // 如果没有 assigned_phase 字段，则检查各个阶段的 assignee（兼容旧逻辑）
    if (task.machining_assignee === this.currentUser.id) return 'machining';
    if (task.electrical_assignee === this.currentUser.id) return 'electrical';
    if (task.pre_assembly_assignee === this.currentUser.id) return 'pre_assembly';
    if (task.post_assembly_assignee === this.currentUser.id) return 'post_assembly';
    if (task.debugging_assignee === this.currentUser.id) return 'debugging';
    
    return null;
  }

  // 获取当前阶段名称（根据分配给用户的阶段，而不是 current_phase）
  getCurrentPhaseName(task: any): string {
    // 优先使用分配给当前用户的阶段
    const assignedPhase = this.getAssignedPhase(task);
    if (assignedPhase) {
      const phaseNames: { [key: string]: string } = {
        'machining': '机加',
        'electrical': '电控',
        'pre_assembly': '总装前段',
        'post_assembly': '总装后段',
        'debugging': '调试'
      };
      return phaseNames[assignedPhase] || assignedPhase;
    }
    
    // 如果没有分配给当前用户，则使用 current_phase（用于其他场景）
    if (!task.current_phase) return '';
    const phaseNames: { [key: string]: string } = {
      'machining': '机加',
      'electrical': '电控',
      'pre_assembly': '总装前段',
      'post_assembly': '总装后段',
      'debugging': '调试'
    };
    return phaseNames[task.current_phase] || task.current_phase;
  }

  // 检查是否为当前阶段
  isCurrentPhase(task: any, phaseKey: string): boolean {
    if (phaseKey === 'machining') {
      return task.machining_phase === 0;
    } else if (phaseKey === 'electrical') {
      return task.electrical_phase === 0;
    } else {
      return task.current_phase === phaseKey;
    }
  }

  // 获取已完成阶段数量
  getCompletedPhasesCount(task: any): number {
    let count = 0;
    if (task.machining_status === 'completed') count++;
    if (task.electrical_status === 'completed') count++;
    if (task.pre_assembly_status === 'completed') count++;
    if (task.post_assembly_status === 'completed') count++;
    if (task.debugging_status === 'completed') count++;
    return count;
  }
  
  // 获取已完成阶段列表
  getCompletedPhases(task: any): string[] {
    const phases: string[] = [];
    if (task.machining_status === 'completed') phases.push('机加');
    if (task.electrical_status === 'completed') phases.push('电控');
    if (task.pre_assembly_status === 'completed') phases.push('总装前段');
    if (task.post_assembly_status === 'completed') phases.push('总装后段');
    if (task.debugging_status === 'completed') phases.push('调试');
    return phases;
  }

  // 检查任务是否分配给当前用户（任何阶段）
  isTaskAssignedToUser(task: any): boolean {
    if (!this.currentUser) return false;
    
    // 如果任务有 assigned_phase 字段，说明该任务在该阶段分配给了当前用户
    if (task.assigned_phase) {
      // 检查对应阶段的 assignee 是否匹配当前用户
      const phaseAssigneeMap: any = {
        'machining': task.machining_assignee,
        'electrical': task.electrical_assignee,
        'pre_assembly': task.pre_assembly_assignee,
        'post_assembly': task.post_assembly_assignee,
        'debugging': task.debugging_assignee
      };
      return phaseAssigneeMap[task.assigned_phase] === this.currentUser.id;
    }
    
    // 兼容旧逻辑：检查各个阶段的 assignee
    return task.machining_assignee === this.currentUser.id || 
           task.electrical_assignee === this.currentUser.id ||
           task.pre_assembly_assignee === this.currentUser.id ||
           task.post_assembly_assignee === this.currentUser.id ||
           task.debugging_assignee === this.currentUser.id;
  }

  // 检查任务是否处于暂停状态
  isTaskPaused(task: any): boolean {
    return this.pausedTaskId === task.id;
  }

  // 检查是否可以操作任务
  canOperateTask(task: any): boolean {
    if (!this.currentUser) return false;
    
    // 如果是任何阶段的负责人，可以操作
    return this.isTaskAssignedToUser(task);
  }

  // 开始当前阶段
  async startCurrentPhase(task: any) {
    if (!this.currentUser) return;
    
    // 检查是否有其他任务正在进行（已开始且未暂停）
    const currentActiveTask = this.findCurrentActiveTask(task);
    
    if (currentActiveTask) {
      // 有其他任务正在进行，提示无法开始
      const alert = await this.alertController.create({
        header: '无法开始任务',
        message: `任务"${currentActiveTask.name}"的${this.getCurrentPhaseName(currentActiveTask)}阶段正在进行中，无法开始新任务。请先暂停或完成当前任务。`,
        buttons: ['确定']
      });
      await alert.present();
      return;
    }
    
    // 获取分配给用户的阶段
    const phase = this.getTaskOperatePhase(task);
    if (!phase) {
      this.presentToast('无法确定要开始的阶段');
      return;
    }
    
    this.isSubmitting = true;
    
    try {
      const isNative = Capacitor.isNativePlatform();
      const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
      
      const response: any = await this.http.post(`${base}/api/tasks/${task.id}/phases/${phase}/start`, {
        userId: this.currentUser.id
      }).toPromise();
      
      if (response.success) {
        // 重新加载任务列表
        await this.loadTasks();
        this.presentToast(response.message || '阶段已开始');
      } else {
        this.presentToast('开始阶段失败：' + (response.error || '未知错误'));
      }
    } catch (error: any) {
      this.presentToast('开始阶段失败：' + (error.error?.error || error.message));
    } finally {
      this.isSubmitting = false;
    }
  }

  // 暂停阶段
  async pauseCurrentPhase(task: any) {
    if (!this.currentUser) return;
    
    // 先检查是否有下一个任务
    const nextTask = this.findNextTask(task);
    
    if (nextTask) {
      // 有下一个任务，弹出确认对话框（带备注输入）
      const alert = await this.alertController.create({
        header: '暂停并开始下一个任务',
        message: `是否要暂停当前任务"${task.name}"的${this.getCurrentPhaseName(task)}阶段，并开始下一个任务"${nextTask.name}"的${this.getCurrentPhaseName(nextTask)}阶段？`,
        inputs: [
          {
            name: 'note',
            type: 'textarea',
            placeholder: '请输入暂停备注（可选）',
            attributes: {
              rows: 3
            }
          }
        ],
        buttons: [
          {
            text: '取消',
            role: 'cancel',
            handler: () => {
              // 用户取消，不执行任何操作
              return;
            }
          },
          {
            text: '确认',
            handler: async (data) => {
              // 用户确认，执行暂停并开始下一个任务
              const note = data?.note || '';
              await this.executePauseAndStartNext(task, nextTask, note);
            }
          }
        ]
      });
      
      await alert.present();
    } else {
      // 没有下一个任务，提示无法暂停
      const alert = await this.alertController.create({
        header: '无法暂停任务',
        message: '没有可用的下一个任务，无法暂停当前任务。请先分配任务或等待任务分配。',
        buttons: ['确定']
      });
      await alert.present();
    }
  }

  // 查找下一个任务
  findNextTask(currentTask: any): any | null {
    // 只对工人和主管角色生效
    if (this.currentUser?.role !== 'worker' && this.currentUser?.role !== 'supervisor') {
      return null;
    }
    
    // 只对"进行中"任务视图生效
    if (this.taskViewMode !== 'active') {
      return null;
    }
    
    // 确保任务列表已加载
    if (!this.tasks || this.tasks.length === 0) {
      return null;
    }
    
    // 应用筛选条件，获取过滤后的任务列表
    this.applyFilters();
    
    // 获取当前任务的阶段
    const currentPhase = this.getTaskOperatePhase(currentTask);
    
    // 获取当前任务和阶段在列表中的索引
    const currentTaskIndex = this.filteredTasks.findIndex(t => {
      return t.id === currentTask.id && this.getTaskOperatePhase(t) === currentPhase;
    });
    
    // 查找下一个任务（可以是同一任务的不同阶段，也可以是不同的任务）
    const nextTask = this.filteredTasks.find((t, index) => {
      const taskPhase = this.getTaskOperatePhase(t);
      
      // 检查是否是同一个任务的不同阶段，或者是不同的任务
      const isSameTaskDifferentPhase = t.id === currentTask.id && taskPhase !== currentPhase;
      const isDifferentTask = t.id !== currentTask.id;
      
      return index > currentTaskIndex &&
        (isSameTaskDifferentPhase || isDifferentTask) &&
        this.isTaskAssignedToUser(t) && 
        t.status !== 'completed' &&
        taskPhase &&
        !this.isPhaseStarted(t) &&
        !this.isPhasePaused(t) &&
        !this.isPhaseCompleted(t) &&
        this.canOperateTask(t);
    });
    
    return nextTask || null;
  }

  // 执行暂停操作
  async executePause(task: any, note: string = '') {
    const phase = this.getTaskOperatePhase(task);
    if (!phase) {
      this.presentToast('无法确定要暂停的阶段');
      return;
    }
    this.isSubmitting = true;
    
    try {
      const isNative = Capacitor.isNativePlatform();
      const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
      
      const response: any = await this.http.post(`${base}/api/tasks/${task.id}/phases/${phase}/pause`, {
        userId: this.currentUser.id,
        note: note || null
      }).toPromise();
      
      if (response.success) {
        // 等待任务列表加载完成
        await this.loadTasks();
        this.presentToast(response.message || '阶段已暂停');
      } else {
        this.presentToast('暂停阶段失败：' + (response.error || '未知错误'));
      }
    } catch (error: any) {
      this.presentToast('暂停阶段失败：' + (error.error?.error || error.message));
    } finally {
      this.isSubmitting = false;
    }
  }

  // 执行暂停并开始下一个任务
  async executePauseAndStartNext(currentTask: any, nextTask: any, note: string = '') {
    this.isSubmitting = true;
    
    try {
      const isNative = Capacitor.isNativePlatform();
      const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
      
      // 获取当前任务的操作阶段（分配给用户的阶段）
      const currentPhase = this.getTaskOperatePhase(currentTask);
      if (!currentPhase) {
        this.presentToast('无法确定要暂停的阶段');
        this.isSubmitting = false;
        return;
      }
      
      // 1. 先暂停当前任务
      const pauseResponse: any = await this.http.post(`${base}/api/tasks/${currentTask.id}/phases/${currentPhase}/pause`, {
        userId: this.currentUser.id,
        note: note || null
      }).toPromise();
      
      if (!pauseResponse.success) {
        this.presentToast('暂停阶段失败：' + (pauseResponse.error || '未知错误'));
        return;
      }
      
      // 2. 刷新任务列表，等待加载完成
      await this.loadTasks();
      
      // 3. 重新应用筛选，获取最新的任务列表
      this.applyFilters();
      
      // 4. 重新查找下一个任务（因为任务列表已刷新，需要重新查找）
      const updatedCurrentTask = this.filteredTasks.find(t => t.id === currentTask.id);
      if (!updatedCurrentTask) {
        this.presentToast('未找到当前任务');
        this.presentToast(pauseResponse.message || '阶段已暂停');
        return;
      }
      
      // 重新查找下一个任务
      const updatedNextTask = this.findNextTask(updatedCurrentTask);
      
      if (!updatedNextTask) {
        // 没有找到下一个任务，提示用户
        this.presentToast('未找到下一个任务');
        this.presentToast(pauseResponse.message || '阶段已暂停');
        return;
      }
      
      // 4. 检查下一个任务的阶段状态
      const nextPhase = this.getTaskOperatePhase(updatedNextTask);
      if (!nextPhase) {
        this.presentToast('无法确定下一个任务的阶段');
        this.presentToast(pauseResponse.message || '阶段已暂停');
        return;
      }
      
      // 5. 如果下一个任务的阶段未开始且未暂停，则开始阶段
      const isNextPhaseStarted = updatedNextTask[`${nextPhase}_start_time`] != null && 
                                  updatedNextTask[`${nextPhase}_start_time`] !== '';
      const isNextPhasePaused = updatedNextTask[`${nextPhase}_paused_at`] != null && 
                                updatedNextTask[`${nextPhase}_paused_at`] !== undefined;
      
      console.log('下一个任务状态检查:', {
        taskId: updatedNextTask.id,
        taskName: updatedNextTask.name,
        phase: nextPhase,
        isNextPhaseStarted,
        isNextPhasePaused,
        startTime: updatedNextTask[`${nextPhase}_start_time`],
        pausedAt: updatedNextTask[`${nextPhase}_paused_at`]
      });
      
      if (!isNextPhaseStarted && !isNextPhasePaused) {
        // 直接调用开始阶段的API，跳过 findCurrentActiveTask 检查（因为当前任务已经暂停）
        try {
          console.log('准备开始下一个任务:', {
            taskId: updatedNextTask.id,
            phase: nextPhase,
            userId: this.currentUser.id
          });
          
          const startResponse: any = await this.http.post(`${base}/api/tasks/${updatedNextTask.id}/phases/${nextPhase}/start`, {
            userId: this.currentUser.id
          }).toPromise();
          
          console.log('开始任务响应:', startResponse);
          
          if (startResponse.success) {
            // 开始成功后，刷新任务列表，确保界面更新
            await this.loadTasks();
            this.presentToast(`阶段已暂停，已开始下一个任务：${updatedNextTask.name}`);
          } else {
            console.error('开始任务失败:', startResponse);
            this.presentToast('暂停成功，但开始下一个任务失败：' + (startResponse.error || '未知错误'));
            this.presentToast(pauseResponse.message || '阶段已暂停');
          }
        } catch (error: any) {
          console.error('开始任务异常:', error);
          this.presentToast('暂停成功，但开始下一个任务失败：' + (error.error?.error || error.message));
          this.presentToast(pauseResponse.message || '阶段已暂停');
        }
      } else {
        // 阶段已经开始了或已暂停，只需要提示暂停成功
        console.log('下一个任务阶段已开始或已暂停，跳过开始操作');
        this.presentToast(pauseResponse.message || '阶段已暂停');
      }
      
    } catch (error: any) {
      this.presentToast('暂停阶段失败：' + (error.error?.error || error.message));
    } finally {
      this.isSubmitting = false;
    }
  }

  // 继续阶段
  async resumeCurrentPhase(task: any) {
    if (!this.currentUser) return;
    
    // 查找当前正在进行的任务（阶段已开始且未暂停，且不是要继续的任务）
    const currentActiveTask = this.findCurrentActiveTask(task);
    
    if (currentActiveTask) {
      const alert = await this.alertController.create({
        header: '暂停并继续任务',
        message: `是否要暂停任务"${currentActiveTask.name}"的${this.getCurrentPhaseName(currentActiveTask)}阶段，并继续任务"${task.name}"的${this.getCurrentPhaseName(task)}阶段？`,
        buttons: [
          {
            text: '取消',
            role: 'cancel'
          },
          {
            text: '确认',
            handler: async () => {
              await this.executePauseAndResume(currentActiveTask, task);
            }
          }
        ]
      });
      
      await alert.present();
    } else {
      await this.executeResume(task);
    }
  }

  // 执行继续操作
  async executeResume(task: any) {
    this.isSubmitting = true;
    
    try {
      const isNative = Capacitor.isNativePlatform();
      const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
      
      const phase = this.getTaskOperatePhase(task);
      if (!phase) {
        this.presentToast('无法确定要继续的阶段');
        this.isSubmitting = false;
        return;
      }
      
      const response: any = await this.http.post(`${base}/api/tasks/${task.id}/phases/${phase}/resume`, {
        userId: this.currentUser.id
      }).toPromise();
      
      if (response.success) {
        await this.loadTasks();
        this.presentToast(response.message || '阶段已继续');
      } else {
        this.presentToast('继续阶段失败：' + (response.error || '未知错误'));
      }
    } catch (error: any) {
      this.presentToast('继续阶段失败：' + (error.error?.error || error.message));
    } finally {
      this.isSubmitting = false;
    }
  }

  // 执行暂停并继续
  async executePauseAndResume(currentActiveTask: any, taskToResume: any) {
    this.isSubmitting = true;
    
    try {
      const isNative = Capacitor.isNativePlatform();
      const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
      
      // 获取当前活跃任务的阶段（分配给用户的阶段）
      const currentActivePhase = this.getTaskOperatePhase(currentActiveTask);
      if (!currentActivePhase) {
        this.presentToast('无法确定要暂停的阶段');
        this.isSubmitting = false;
        return;
      }
      
      // 1. 暂停当前正在进行的任务（继续阶段时不需要备注）
      const pauseResponse: any = await this.http.post(`${base}/api/tasks/${currentActiveTask.id}/phases/${currentActivePhase}/pause`, {
        userId: this.currentUser.id,
        note: null
      }).toPromise();
      
      if (!pauseResponse.success) {
        this.presentToast('暂停任务失败：' + (pauseResponse.error || '未知错误'));
        this.isSubmitting = false;
        return;
      }
      
      // 2. 刷新任务列表，等待加载完成
      await this.loadTasks();
      this.presentToast(`${currentActiveTask.name}的${this.getCurrentPhaseName(currentActiveTask)}阶段已暂停`);
      
      // 3. 重新应用筛选，获取最新的任务（通过 id 和 assigned_phase 匹配）
      this.applyFilters();
      const taskToResumePhase = this.getTaskOperatePhase(taskToResume);
      const updatedTask = this.filteredTasks.find(t => {
        return t.id === taskToResume.id && this.getTaskOperatePhase(t) === taskToResumePhase;
      });
      
      if (!updatedTask) {
        this.presentToast('未找到要继续的任务');
        this.isSubmitting = false;
        return;
      }
      
      await this.executeResume(updatedTask);
      
    } catch (error: any) {
      this.presentToast('操作失败：' + (error.error?.error || error.message));
    } finally {
      this.isSubmitting = false;
    }
  }

  // 查找当前正在进行的任务（阶段已开始且未暂停）
  findCurrentActiveTask(excludeTask: any): any | null {
    // 只对工人和主管角色生效
    if (this.currentUser?.role !== 'worker' && this.currentUser?.role !== 'supervisor') {
      return null;
    }
    
    // 确保任务列表已加载
    if (!this.tasks || this.tasks.length === 0) {
      return null;
    }
    
    // 应用筛选条件，获取过滤后的任务列表
    this.applyFilters();
    
    // 获取要排除的任务的阶段
    const excludePhase = this.getTaskOperatePhase(excludeTask);
    
    // 查找正在进行的任务（阶段已开始且未暂停）
    // 检查：不同的任务，或者同一任务的不同阶段
    const activeTask = this.filteredTasks.find(t => {
      // 必须是分配给当前用户的任务
      if (!this.isTaskAssignedToUser(t)) return false;
      if (t.status === 'completed') return false;
      if (!this.isPhaseStarted(t)) return false;
      if (this.isPhasePaused(t)) return false;
      if (this.isPhaseCompleted(t)) return false;
      if (!this.canOperateTask(t)) return false;
      
      // 获取当前任务正在进行的阶段
      const tPhase = this.getTaskOperatePhase(t);
      
      // 如果是不同的任务，或者同一任务的不同阶段，则认为是冲突的
      if (t.id !== excludeTask.id) {
        return true; // 不同任务正在运行
      }
      
      // 同一任务，检查是否是不同阶段
      if (tPhase && excludePhase && tPhase !== excludePhase) {
        return true; // 同一任务的不同阶段正在运行
      }
      
      return false;
    });
    
    return activeTask || null;
  }

  // 打开完成任务对话框
  completeCurrentPhase(task: any) {
    this.selectedTaskForComplete = task;
    this.selectedTaskPhaseName = this.getCurrentPhaseName(task);
    this.isCompleteModalOpen = true;
  }

  // 关闭完成任务对话框
  closeCompleteModal() {
    this.isCompleteModalOpen = false;
    this.selectedTaskForComplete = null;
    this.selectedTaskPhaseName = '';
    this.isSubmitting = false;
  }

  // 确认完成阶段
  async confirmCompletePhase() {
    if (!this.selectedTaskForComplete) {
      this.presentToast('任务信息错误');
      return;
    }

    // 获取可用的下一个任务列表（未开始或已暂停）
    const availableTasks = this.getAvailableNextTasks(this.selectedTaskForComplete);

    if (availableTasks.length === 0) {
      // 没有其他任务可接，允许直接完成当前阶段
      const alert = await this.alertController.create({
        header: `完成"${this.selectedTaskForComplete.name}"的${this.selectedTaskPhaseName}阶段`,
        message: '当前没有其他任务需要衔接，是否直接完成该阶段？',
        buttons: [
          { text: '取消', role: 'cancel' },
          { text: '完成', handler: () => this.executeCompletePhase() }
        ]
      });
      await alert.present();
      return;
    }

    // 构建选项列表，默认未开始任务排在前面
    const buttons: Array<{ text: string; handler?: () => Promise<void>; role?: string }> = availableTasks.map(task => {
      const statusLabel = this.isPhasePaused(task) ? '（已暂停）' : '（未开始）';
      return {
        text: `${task.name} - ${this.getCurrentPhaseName(task)}阶段${statusLabel}`,
        handler: async () => {
          await this.executeCompletePhaseAndStartNext(task);
        }
      };
    });

    // 添加取消选项
    buttons.push({
      text: '取消',
      role: 'cancel'
    });

    const actionSheet = await this.actionSheetController.create({
      header: `完成"${this.selectedTaskForComplete.name}"的${this.selectedTaskPhaseName}阶段`,
      subHeader: '请选择下一步操作',
      buttons
    });

    await actionSheet.present();
  }

  private async executeCompletePhase() {
    if (!this.selectedTaskForComplete) {
      this.presentToast('任务信息错误');
      return;
    }

    this.isSubmitting = true;
    this.errorMsg = '';

    try {
      const response = await this.performCompletePhaseRequest();

      if (response?.success) {
        this.handlePhaseCompletionSuccess(response);
      }
    } catch (error: any) {
      this.errorMsg = '完成阶段失败：' + (error.error?.error || error.message);
    } finally {
      this.isSubmitting = false;
    }
  }

  private async executeCompletePhaseAndStartNext(nextTask: any) {
    if (!this.selectedTaskForComplete) {
      this.presentToast('任务信息错误');
      return;
    }

    this.isSubmitting = true;
    this.errorMsg = '';

    try {
      const response = await this.performCompletePhaseRequest();

      if (response?.success) {
        this.handlePhaseCompletionSuccess(response);

        // 确保任务列表刷新后再开始下一个任务
        await this.loadTasks();
        
        // 重新应用筛选条件
        this.applyFilters();
        
        // 查找更新后的下一个任务（通过 id 和 assigned_phase 匹配）
        const nextPhase = this.getTaskOperatePhase(nextTask);
        const updatedNextTask = this.filteredTasks.find(t => {
          return t.id === nextTask.id && this.getTaskOperatePhase(t) === nextPhase;
        });
        
        if (updatedNextTask) {
          await this.startOrResumeNextTask(updatedNextTask);
          await this.loadTasks();
        } else {
          this.presentToast('未找到下一个任务，请手动开始');
        }
      }
    } catch (error: any) {
      this.errorMsg = '完成阶段失败：' + (error.error?.error || error.message);
    } finally {
      this.isSubmitting = false;
    }
  }

  private async performCompletePhaseRequest(): Promise<any | null> {
    if (!this.selectedTaskForComplete) {
      return null;
    }

    const isNative = Capacitor.isNativePlatform();
    const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;

    const phase = this.getTaskOperatePhase(this.selectedTaskForComplete);
    if (!phase) {
      return Promise.reject(new Error('无法确定要完成的阶段'));
    }
    
    return this.http.post(
      `${base}/api/tasks/${this.selectedTaskForComplete.id}/phases/${phase}/complete`,
      {
        userId: this.currentUser.id,
        quantity: 1,
        qualityNotes: '',
        issues: ''
      }
    ).toPromise();
  }

  private async startOrResumeNextTask(task: any) {
    const isNative = Capacitor.isNativePlatform();
    const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;

    try {
      const phase = this.getTaskOperatePhase(task);
      if (!phase) {
        this.presentToast('无法确定要操作的阶段');
        return;
      }
      
      if (this.isPhasePaused(task)) {
        await this.http.post(`${base}/api/tasks/${task.id}/phases/${phase}/resume`, {
          userId: this.currentUser.id
        }).toPromise();
        this.presentToast(`已继续任务：${task.name} 的 ${this.getCurrentPhaseName(task)}阶段`);
      } else if (!this.isPhaseStarted(task)) {
        await this.http.post(`${base}/api/tasks/${task.id}/phases/${phase}/start`, {
          userId: this.currentUser.id
        }).toPromise();
        this.presentToast(`已开始任务：${task.name} 的 ${this.getCurrentPhaseName(task)}阶段`);
      }
    } catch (error: any) {
      this.presentToast('启动下一个任务失败：' + (error.error?.error || error.message));
    }
  }

  private handlePhaseCompletionSuccess(response: any) {
    this.closeCompleteModal();
    this.loadTasks();

    let message = `${this.selectedTaskPhaseName}阶段已完成！`;
    if (response.actualHours !== undefined) {
      message += `\n实际工时：${response.actualHours.toFixed(2)}小时`;
    }
    if (response.taskCompleted) {
      message += '\n任务已完成！';
    } else if (response.inTaskPool) {
      message += '\n任务已进入任务池，等待重新分配！';
    }

    this.presentToast(message);

    if (response.taskCompleted || response.inTaskPool) {
      setTimeout(() => {
        this.loadTasks();
      }, 1000);
    }
  }

  private getAvailableNextTasks(currentTask: any): any[] {
    if (this.currentUser?.role !== 'worker' && this.currentUser?.role !== 'supervisor') {
      return [];
    }

    if (this.taskViewMode !== 'active') {
      return [];
    }

    if (!this.tasks || this.tasks.length === 0) {
      return [];
    }

    // 按当前筛选/排序获取任务列表
    this.applyFilters();

    // 当前任务的阶段（可能是同一任务的某个具体阶段）
    const currentPhase = this.getTaskOperatePhase(currentTask);

    // 在 filteredTasks 中找到“当前任务 + 当前阶段”的位置
    const currentTaskIndex = this.filteredTasks.findIndex(t => {
      return t.id === currentTask.id && this.getTaskOperatePhase(t) === currentPhase;
    });

    let firstNotStarted: any | null = null;
    const pausedTasks: any[] = [];

    this.filteredTasks.forEach((task, index) => {
      // 只考虑当前任务之后的任务
      if (index <= currentTaskIndex) return;

      const taskPhase = this.getTaskOperatePhase(task);
      if (!taskPhase) return;
      if (!this.isTaskAssignedToUser(task)) return;
      if (task.status === 'completed') return;
      if (this.isPhaseCompleted(task)) return;
      if (!this.canOperateTask(task)) return;

      const started = this.isPhaseStarted(task);
      const paused = this.isPhasePaused(task);

      // 1) 记录“紧接着的下一个未开始任务”（列表中第一个未开始且未暂停的任务）
      if (!started && !paused && !firstNotStarted) {
        firstNotStarted = task;
        return;
      }

      // 2) 收集所有已暂停的任务（当前任务之后）
      if (paused) {
        pausedTasks.push(task);
      }
    });

    const result: any[] = [];
    if (firstNotStarted) {
      result.push(firstNotStarted);
    }
    if (pausedTasks.length > 0) {
      result.push(...pausedTasks);
    }

    return result;
  }

  // ============= 异常上报相关方法 =============

  // 打开异常上报模态框
  async openExceptionReportModal(task: any) {
    this.selectedTaskForException = task;
    this.exceptionType = '';
    this.exceptionDescription = '';
    
    // 设置默认时间为当前半小时窗口
    const now = new Date();
    const rounded = this.getHalfHourRounded(now);
    const endPlus30 = this.addMinutes(rounded, 30);
    
    // 格式化为 datetime-local 格式 (YYYY-MM-DDTHH:mm)
    this.exceptionStartDateTime = this.formatDateTimeLocal(rounded);
    this.exceptionEndDateTime = this.formatDateTimeLocal(endPlus30);
    
    this.selectedImage = null;
    this.selectedImageFile = null;
    this.isExceptionModalOpen = true;
    
    // 先加载审批人列表（会自动设置默认审批人）
    await this.loadApprovers();
    
    // 如果加载后还没有选择审批人，才设为null
    if (!this.selectedApproverId) {
      this.selectedApproverId = null;
    }
  }

  // 关闭异常上报模态框
  closeExceptionModal() {
    this.isExceptionModalOpen = false;
    this.selectedTaskForException = null;
    this.exceptionType = '';
    this.selectedApproverId = null;
    this.exceptionDescription = '';
    this.exceptionStartDateTime = '';
    this.exceptionEndDateTime = '';
    this.selectedImage = null;
    this.selectedImageFile = null;
  }

  // 加载审批人列表
  async loadApprovers() {
    try {
      const response = await this.http.get(`${environment.apiBase}/api/users`).toPromise();
      // 仅保留主管作为异常审批的审批人
      this.approvers = (response as any[]).filter(user => user.role === 'supervisor');
      
      // 根据当前用户的user_group自动选择审批人
      if (this.currentUser?.user_group && this.approvers.length > 0) {
        // 查找与当前用户同组的审批人
        const groupApprover = this.approvers.find(approver => 
          approver.user_group === this.currentUser.user_group
        );
        
        if (groupApprover) {
          this.selectedApproverId = groupApprover.id;
        }
      }
    } catch (error: any) {
      console.error('加载审批人列表失败：', error);
      this.approvers = [];
    }
  }

  // 选择图片
  selectImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        // 检查文件大小（限制为5MB）
        if (file.size > 5 * 1024 * 1024) {
          alert('图片大小不能超过5MB');
          return;
        }
        
        // 检查文件类型
        if (!file.type.startsWith('image/')) {
          alert('请选择图片文件');
          return;
        }
        
        this.selectedImageFile = file;
        
        // 创建预览
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.selectedImage = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }

  // 移除图片
  removeImage() {
    this.selectedImage = null;
    this.selectedImageFile = null;
  }

  // 生成30分钟间隔的时间选项
  getTimeOptions(): string[] {
    const times: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        times.push(timeString);
      }
    }
    return times;
  }

  // 获取当前日期（YYYY-MM-DD 格式）
  getCurrentDate(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 获取当前日期时间（YYYY-MM-DD HH:mm 格式）
  getCurrentDateTime(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    const h = now.getHours().toString().padStart(2, '0');
    const min = Math.floor(now.getMinutes() / 30) * 30; // 向下取整到30分钟间隔
    const minStr = min.toString().padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${minStr}`;
  }

  // 将日期四舍五入到最近的半小时（向下取整）
  private getHalfHourRounded(date: Date): Date {
    const d = new Date(date);
    d.setSeconds(0, 0);
    const minutes = d.getMinutes();
    const roundedMinutes = Math.floor(minutes / 30) * 30;
    d.setMinutes(roundedMinutes);
    return d;
  }

  // 增加分钟数，返回新日期
  private addMinutes(date: Date, minutes: number): Date {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() + minutes);
    return d;
  }

  // 格式化时间为 HH:mm 格式
  private formatTime(date: Date): string {
    const hh = date.getHours().toString().padStart(2, '0');
    const mm = date.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  }

  // 格式化为 datetime-local 格式 (YYYY-MM-DDTHH:mm)
  private formatDateTimeLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  // 转为本地ISO（不含秒），用于 IonDatetime 绑定，如 2025-10-20T09:00
  private toLocalIsoMinutes(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const hh = date.getHours().toString().padStart(2, '0');
    const mm = date.getMinutes().toString().padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  // 将 ISO 字符串（或已有的 YYYY-MM-DD HH:mm）格式化为 YYYY-MM-DD HH:mm
  private toYmdHm(value: string): string {
    if (!value) return '';
    // 如果是 ISO，包含 'T'
    if (value.includes('T')) {
      const dt = new Date(value);
      if (isNaN(dt.getTime())) return '';
      const y = dt.getFullYear();
      const m = (dt.getMonth() + 1).toString().padStart(2, '0');
      const d = dt.getDate().toString().padStart(2, '0');
      const hh = dt.getHours().toString().padStart(2, '0');
      const mm = dt.getMinutes().toString().padStart(2, '0');
      return `${y}-${m}-${d} ${hh}:${mm}`;
    }
    // 可能已经是 'YYYY-MM-DD HH:mm'
    return value;
  }

  // 规范到 30 分钟刻度（向下取整到 00/30）
  private floorToHalfHour(date: Date): Date {
    const d = new Date(date);
    d.setSeconds(0, 0);
    d.setMinutes(Math.floor(d.getMinutes() / 30) * 30);
    return d;
  }

  // 生成日期时间选项（最近30天，30分钟间隔）
  getDateTimeOptions(): string[] {
    const options: string[] = [];
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateString = date.getFullYear() + '-' + 
                        (date.getMonth() + 1).toString().padStart(2, '0') + '-' + 
                        date.getDate().toString().padStart(2, '0');
      
      for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          const dateTimeString = `${dateString} ${timeString}`;
          options.push(dateTimeString);
        }
      }
    }
    
    return options;
  }

  // 获取日期时间显示文本
  getDateTimeDisplayText(dateTimeString: string): string {
    const [dateStr, timeStr] = dateTimeString.split(' ');
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    let dateDisplay = '';
    if (dateStr === this.getCurrentDate()) {
      dateDisplay = '今天';
    } else if (dateStr === yesterday.toISOString().split('T')[0]) {
      dateDisplay = '昨天';
    } else {
      dateDisplay = dateStr;
    }
    
    return `${dateDisplay} ${timeStr}`;
  }


  // 提交异常报告
  async submitExceptionReport() {
    if (!this.selectedTaskForException || !this.exceptionType || !this.selectedApproverId || !this.exceptionDescription || !this.exceptionStartDateTime || !this.exceptionEndDateTime) {
      alert('请填写所有必填字段');
      return;
    }

    // 验证时间逻辑
    const startDt = new Date(this.exceptionStartDateTime);
    const endDt = new Date(this.exceptionEndDateTime);
    if (!(startDt instanceof Date) || isNaN(startDt.getTime()) || !(endDt instanceof Date) || isNaN(endDt.getTime())) {
      alert('请选择有效的开始与结束时间');
      return;
    }
    if (startDt >= endDt) {
      alert('结束时间必须晚于开始时间');
      return;
    }

    this.isSubmitting = true;

    try {
      // 创建FormData以支持文件上传
      const formData = new FormData();
      formData.append('taskId', this.selectedTaskForException.id.toString());
      formData.append('userId', this.currentUser.id.toString());
      formData.append('exceptionType', this.exceptionType);
      formData.append('description', this.exceptionDescription);
      formData.append('exceptionStartDateTime', this.exceptionStartDateTime);
      formData.append('exceptionEndDateTime', this.exceptionEndDateTime);
      formData.append('approverId', this.selectedApproverId!.toString());
      
      if (this.selectedImageFile) {
        formData.append('image', this.selectedImageFile);
      }

      const response = await this.http.post(`${environment.apiBase}/api/exception-reports`, formData).toPromise();

      if (response && (response as any).success) {
        alert('异常报告提交成功！');
        this.closeExceptionModal();
      } else {
        throw new Error((response as any).error || '提交失败');
      }
    } catch (error: any) {
      this.errorMsg = '提交异常报告失败：' + (error.error?.error || error.message);
      alert(this.errorMsg);
    } finally {
      this.isSubmitting = false;
    }
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
  
  // 导入员工相关方法
  openImportUserModal() {
    this.isImportUserModalOpen = true;
    this.selectedUserFile = null;
    this.importUserResult = null;
  }
  
  closeImportUserModal() {
    this.isImportUserModalOpen = false;
    this.selectedUserFile = null;
    this.importUserResult = null;
  }
  
  onUserFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      if (!allowedTypes.includes(file.type)) {
        this.presentToast('请选择Excel文件（.xlsx或.xls格式）');
        return;
      }
      this.selectedUserFile = file;
    }
  }
  
  async downloadUserTemplate() {
    try {
      const isNative = Capacitor.isNativePlatform();
      const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
      
      // 使用fetch下载文件
      const response = await fetch(`${base}/api/users/template`);
      if (!response.ok) {
        throw new Error('下载失败');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '员工信息导入模板.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      await this.presentToast('模板下载成功');
    } catch (error) {
      console.error('下载模板失败:', error);
      await this.presentToast('下载模板失败');
    }
  }
  
  async importUsers() {
    if (!this.selectedUserFile) {
      return;
    }
    
    this.isImportingUsers = true;
    this.importUserResult = null;
    
    try {
      const isNative = Capacitor.isNativePlatform();
      const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
      
      const formData = new FormData();
      formData.append('file', this.selectedUserFile);
      
      const response: any = await this.http.post(`${base}/api/users/import`, formData).toPromise();
      
      this.importUserResult = response;
      
      if (response.success) {
        await this.presentToast('员工导入成功');
        // 可以刷新用户列表
        await this.loadUsersAndDepartments();
      }
    } catch (error: any) {
      this.importUserResult = {
        success: false,
        message: error.error?.error || error.message || '导入失败'
      };
      await this.presentToast('员工导入失败');
    } finally {
      this.isImportingUsers = false;
    }
  }

  // 加载责任部门确认的异常报告
  async loadStaffExceptionReports() {
    this.isLoading = true;
    this.errorMsg = '';
    
    try {
      const isNative = Capacitor.isNativePlatform();
      const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
      
      const approverId = this.currentUser?.id;
      if (!approverId) {
        this.errorMsg = '未获取到当前用户信息';
        this.isLoading = false;
        return;
      }
      
      const response: any = await this.http.get(`${base}/api/exception-reports/all?approverId=${approverId}`).toPromise();
      this.staffExceptionReports = response || [];
      
      // 根据taskViewMode过滤：active=待确认，completed=已确认
      if (this.taskViewMode === 'active') {
        this.staffExceptionReports = this.staffExceptionReports.filter((r: any) => r.status === 'pending_staff_confirmation');
      } else {
        this.staffExceptionReports = this.staffExceptionReports.filter((r: any) => r.status === 'staff_confirmed');
      }
      
      this.applyFilters();
    } catch (error: any) {
      this.errorMsg = '加载异常报告失败：' + (error.error?.error || error.message);
      console.error('加载异常报告失败:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // 格式化日期时间
  formatExceptionDateTime(dateTimeStr: string): string {
    if (!dateTimeStr) return '-';
    try {
      const date = new Date(dateTimeStr);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateTimeStr;
    }
  }

  // 打开确认模态框
  openStaffConfirmModal(report: any, action: string) {
    this.selectedTaskForException = { id: report.task_id, name: report.task_name };
    this.exceptionType = report.modified_exception_type || report.exception_type;
    this.exceptionDescription = report.modified_description || report.description;
    this.exceptionStartDateTime = this.formatDateTimeLocal(new Date(report.modified_start_datetime || report.exception_start_datetime));
    this.exceptionEndDateTime = this.formatDateTimeLocal(new Date(report.modified_end_datetime || report.exception_end_datetime));
    this.selectedApproverId = null;
    this.approvalAction = action; // 'approve' or 'reject'
    this.approvalNote = '';
    this.isExceptionModalOpen = true;
  }

  // 确认/拒绝责任部门确认
  async confirmStaffApproval() {
    if (!this.selectedTaskForException) return;

    const report = this.staffExceptionReports.find((r: any) => r.task_id === this.selectedTaskForException.id);
    if (!report) return;

    try {
      const isNative = Capacitor.isNativePlatform();
      const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
      
      // 将'approve'转换为'confirm'
      const action = this.approvalAction === 'approve' ? 'confirm' : 'reject';
      
      const requestBody = {
        staffId: this.currentUser.id,
        action: action,
        confirmationNote: this.approvalNote
      };
      
      const response = await this.http.post(
        `${base}/api/exception-reports/${report.id}/staff-confirm`,
        requestBody
      ).toPromise();

      if (response && (response as any).success) {
        const message = (response as any).message || 
                       (action === 'confirm' ? '异常报告已确认' : '异常报告已处理');
        await this.presentToast(message);
        this.closeExceptionModal();
        this.loadStaffExceptionReports();
      } else {
        throw new Error((response as any).error || '操作失败');
      }
    } catch (error: any) {
      await this.presentToast('操作失败：' + (error.error?.error || error.message));
    }
  }

  // ===== 标准工时导入 =====
  openStdHoursModal() {
    this.isStdHoursModalOpen = true;
    this.selectedStdFile = null;
    this.importStdResult = null;
  }

  closeStdHoursModal() {
    this.isStdHoursModalOpen = false;
    this.selectedStdFile = null;
    this.importStdResult = null;
  }

  onStdFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      if (!allowedTypes.includes(file.type)) {
        this.errorMsg = '请选择Excel文件（.xlsx或.xls格式）';
        return;
      }
      this.selectedStdFile = file;
      this.errorMsg = '';
    }
  }

  async importStandardHours() {
    if (!this.selectedStdFile || !this.currentUser) {
      await this.presentToast('请选择文件或重新登录');
      return;
    }
    this.isImportingStd = true;
    this.importStdResult = null;
    this.errorMsg = '';
    try {
      const isNative = Capacitor.isNativePlatform();
      const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
      
      const formData = new FormData();
      formData.append('file', this.selectedStdFile);
      formData.append('userId', this.currentUser.id.toString());

      const response: any = await this.http.post(
        `${base}/api/standard-hours/import`,
        formData
      ).toPromise();

      this.importStdResult = response;
      if (response.success) {
        await this.presentToast('标准工时导入成功');
        this.closeStdHoursModal();
      } else {
        await this.presentToast(response.message || '导入失败');
      }
    } catch (error: any) {
      this.importStdResult = {
        success: false,
        message: error.error?.error || error.message || '导入失败'
      };
      await this.presentToast('导入失败：' + (error.error?.error || error.message));
    } finally {
      this.isImportingStd = false;
    }
  }

  // 下载标准工时模板
  downloadStdTemplate() {
    const isNative = Capacitor.isNativePlatform();
    const base = isNative ? environment.apiBase.replace('localhost', '10.0.2.2') : environment.apiBase;
    const url = `${base}/api/standard-hours/template`;
    try {
      window.open(url, '_blank');
    } catch {
      window.location.href = url;
    }
  }
}
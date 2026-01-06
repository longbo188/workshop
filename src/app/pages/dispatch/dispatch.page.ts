import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonList, IonItem, IonLabel, IonSpinner, IonButton, IonIcon, IonModal, IonChip, IonButtons, IonInput, IonSelect, IonSelectOption, IonRow, IonCol, IonBadge, IonPopover, IonTextarea, IonDatetime, IonSearchbar, ToastController, ActionSheetController, IonCheckbox } from '@ionic/angular/standalone';
import { environment } from '../../../environments/environment';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-dispatch',
  standalone: true,
  templateUrl: './dispatch.page.html',
  styleUrls: ['./dispatch.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonList, IonItem, IonLabel, IonSpinner, IonButton, IonIcon,
    IonModal, IonChip, IonButtons, IonInput, IonSelect, IonSelectOption, IonRow, IonCol, IonBadge, IonPopover, IonTextarea, IonDatetime, IonSearchbar, IonCheckbox
  ]
})
export class DispatchPage implements OnInit {
    private toastController = inject(ToastController);
    private actionSheetController = inject(ActionSheetController);
    
  isLoading = true;
  errorMsg = '';

  users: any[] = [];
  tasks: any[] = [];
  departments: string[] = []; // 新增：部门列表
  availableGroups: string[] = []; // 新增：组列表（用于分配任务筛选）
  selectedTaskId: number | null = null; // 选中分配的任务ID

  // 导入相关属性
  isImportModalOpen = false;
  selectedFile: File | null = null;
  isImporting = false;
  importResult: any = null;
  canImportTasks = false;
  currentUser: any = null;

  // 新增任务属性（改为单任务导入）
  isCreateTaskModalOpen = false;
  selectedCreateTaskFile: File | null = null;
  isCreatingTask = false;
  createTaskResult: any = null;

  // 修改任务属性
  isEditTaskModalOpen = false;
  editTask: any = null;
  editTaskId: number | null = null; // 编辑时的任务ID
  searchDeviceOrModel: string = '';

  // 删除任务属性
  isDeleteTaskModalOpen = false;
  taskToDelete: any = null;
  deleteTaskId: number | null = null;
  deleteSearchDeviceOrModel: string = '';

  // 标准工时导入相关属性
  isStdHoursModalOpen = false;
  selectedStdFile: File | null = null;
  isImportingStd = false;
  importStdResult: any = null;

  // 派工任务可视化相关属性
  isVizModalOpen = false;
  vizData: any[] = [];
  vizDepartmentFilter = ''; // 可视化部门筛选
  vizGroupFilter = ''; // 可视化组筛选
  vizEmployeeLimit: number = 10; // 可视化显示员工上限
  unassignedTasks: any[] = []; // 待分配任务列表
  
  // 待分配任务筛选
  unassignedTaskFilters = {
    deviceNumber: '', // 设备号筛选
    productModel: '', // 型号筛选
    productionDateEnd: '', // 开工日期止
    phase: '' // 阶段筛选
  };
  
  // 拖放相关属性
  isDragging = false;
  draggedTask: any = null;
  draggedTaskEmployee: number | null = null;
  dragOverEmployee: number | null = null;

  // 搜索和筛选相关属性
  searchKeyword = '';
  selectedPriority = '';
  selectedStatus = '';
  selectedPhase = ''; // 新增：阶段筛选
  selectedAssignmentStatus = ''; // 新增：分配状态筛选
  currentPage = 1;
  pageSize = 50;
  showFilters = false;
  selectedView = 'all'; // 新增：视图筛选 ('all', 'unassigned', 'assigned', 'urgent')
  tableColumnVisibility: Record<string, boolean> = {
    index: true, // 序号列
    device: true,
    model: true,
    priority: true,
    status: true,
    currentPhase: true,
    productionTime: true,
    promisedTime: true,
    progress: true,
    machining: true,
    electrical: true,
    pre_assembly: true,
    post_assembly: true,
    debugging: true
  };
  columnVisibilityOptions = [
    { key: 'index', label: '序号' },
    { key: 'device', label: '设备号' },
    { key: 'model', label: '型号' },
    { key: 'priority', label: '优先级' },
    { key: 'status', label: '状态' },
    { key: 'currentPhase', label: '当前阶段' },
    { key: 'productionTime', label: '开工日期' },
    { key: 'promisedTime', label: '承诺交付' },
    { key: 'progress', label: '整体进度' },
    { key: 'machining', label: '机加' },
    { key: 'electrical', label: '电控' },
    { key: 'pre_assembly', label: '总装前段' },
    { key: 'post_assembly', label: '总装后段' },
    { key: 'debugging', label: '调试' }
  ];
  tableFilters = {
    device: '',
    model: '',
    priority: '',
    status: '',
    phase: '',
    assignee: '',
    productionTime: '', // 开工日期筛选
    promisedTime: '', // 承诺交付日期筛选
    progress: '', // 整体进度筛选
    machining: '', // 机加阶段筛选（completed/not_completed）
    electrical: '', // 电控阶段筛选
    pre_assembly: '', // 总装前段筛选
    post_assembly: '', // 总装后段筛选
    debugging: '' // 调试阶段筛选
  };

  // 分配任务相关属性
  isAssignModalOpen = false;
  selectedTaskForAssign: any = null;
  userSearchKeyword = '';
  selectedPhaseForAssign: string = 'general'; // 新增：选择的阶段
  selectedUserGroup = ''; // 新增：用户组筛选

  // 协助人员相关属性
  isAssignAssistantModalOpen = false;
  selectedTaskForAssist: any = null;
  selectedPhaseForAssist: string = '';
  assistants: any[] = [];
  selectedAssistantUserIds: number[] = [];
  assistantSearchKeyword: string = '';
  // 为每个协助人员分别存储时间 { userId: { start: string, end: string } }
  assistantTimes: Record<number, { start: string | null; end: string | null }> = {};
  assignAssistantManagerId: number | null = null; // 统一的审批经理
  // 统一时间设置
  unifiedAssistStart: string | null = null;
  unifiedAssistEnd: string | null = null;
  confirmAssistUserId: number | 'ALL' | null = null;
  confirmAssistStart: string | null = null;
  confirmAssistEnd: string | null = null;
  confirmAssistManagerId: number | null = null;
  managerUsers: any[] = [];

  private http = inject(HttpClient);

  ngOnInit(): void {
    this.checkUserPermission();
    this.loadTableColumnVisibility();
    // 读取可视化员工上限设置
    const savedLimit = localStorage.getItem('vizEmployeeLimit');
    if (savedLimit) {
      const n = Number(savedLimit);
      if (!Number.isNaN(n) && n > 0) this.vizEmployeeLimit = n;
    }
    
    this.loadData();
  }

  async loadData() {
    try {
      this.isLoading = true;
      this.errorMsg = '';
      const [users, tasks] = await Promise.all([
        this.http.get<any[]>(`${environment.apiBase}/api/users`).toPromise(),
        this.http.get<any[]>(`${environment.apiBase}/api/tasks`).toPromise(),
      ]);
      this.users = users || [];
      this.managerUsers = this.users.filter(u => u.role === 'manager');
      // 仅展示未完成的任务
      this.tasks = (tasks || [])
        .filter(t => t.status !== 'completed')
        .map(task => this.decorateTask(task));
      
      // 清除所有缓存，因为任务数据已更新
      this.clearAllCache();
      
      // 获取部门列表（只从worker角色的用户中提取，去重并按指定顺序排序）
      const preferredOrder = ['机加', '电控', '总装前段', '总装后段', '调试'];
      const workerUsers = this.users.filter(u => u.role === 'worker');
      this.departments = [...new Set(workerUsers
        .map(user => user.department)
        .filter(dept => dept && dept.trim() !== '')
        .filter(dept => dept !== 'IT部门' && dept !== '生产部')
      )].sort((a, b) => {
        const ia = preferredOrder.indexOf(a);
        const ib = preferredOrder.indexOf(b);
        const sa = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
        const sb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
        if (sa !== sb) return sa - sb;
        return a.localeCompare(b);
      });
      
      // 获取组列表（去重并排序）
      this.availableGroups = [...new Set(this.users
        .map(user => user.user_group)
        .filter(group => group && group.trim() !== '')
      )].sort();
    } catch (e: any) {
      this.errorMsg = e?.error?.error || e?.message || '加载失败';
    } finally {
      this.isLoading = false;
    }
  }

  // 获取当前应判定的阶段（新逻辑：机加未完成→机加和电控并行，机加完成→总装前段，前段完成→总装后段）
  private getEffectivePhase(task: any): string | string[] | null {
    // 机加未完成 → 返回 ['machining', 'electrical']（并行）
    if (task.machining_phase === 0 || task.machining_phase === '0') {
      return ['machining', 'electrical'];
    }
    
    // 机加完成，总装前段未完成 → 返回 'pre_assembly'
    if (task.pre_assembly_phase === 0 || task.pre_assembly_phase === '0') {
      return 'pre_assembly';
    }
    
    // 机加、电控、总装前段都完成，总装后段未完成 → 返回 'post_assembly'
    if (task.post_assembly_phase === 0 || task.post_assembly_phase === '0') {
      return 'post_assembly';
    }
    
    // 总装后段完成，调试未完成 → 返回 'debugging'
    if (task.debugging_phase === 0 || task.debugging_phase === '0') {
      return 'debugging';
    }
    
    // 所有阶段都完成
    return null;
  }

  private decorateTask(task: any) {
    // 预先计算任务显示相关的值，避免在模板中重复计算
    const decorated = {
      ...task,
      priority: this.normalizePriorityValue(task.priority),
      // 预计算当前阶段显示
      _currentPhaseDisplay: this.getCurrentPhaseDisplay(task),
      // 预计算进度百分比
      _progressPercent: this.getTaskProgressPercent(task),
      // 预计算阶段列表
      _phases: this.getTaskPhases(task)
    };
    return decorated;
  }

  private normalizePriorityValue(priority: any): 'urgent' | 'normal' {
    if (!priority && priority !== 0) {
      return 'normal';
    }
    const text = String(priority).toLowerCase();
    if (text === 'urgent' || text === '高' || text === '紧急' || text === 'high') {
      return 'urgent';
    }
    return 'normal';
  }

  isUrgentPriority(priority: any): boolean {
    return this.normalizePriorityValue(priority) === 'urgent';
  }

  getPriorityClass(priority: any): string {
    return this.isUrgentPriority(priority) ? 'urgent' : 'normal';
  }

  // 根据阶段取对应负责人
  private getAssigneeByPhase(task: any, phase: string | string[] | null): number | null {
    if (!phase) return null;
    
    // 如果是数组（多阶段并行），检查是否有任何一个阶段已分配
    if (Array.isArray(phase)) {
      for (const p of phase) {
        const assignee = this.getAssigneeByPhase(task, p);
        if (assignee) return assignee;
      }
      return null;
    }
    
    // 单个阶段
    if (phase === 'machining') return task.machining_assignee || null;
    if (phase === 'electrical') return task.electrical_assignee || null;
    if (phase === 'pre_assembly') return task.pre_assembly_assignee || null;
    if (phase === 'post_assembly') return task.post_assembly_assignee || null;
    if (phase === 'debugging') return task.debugging_assignee || null;
    return null;
  }

  // 判断当前阶段是否已开始（已打卡/有开始时间）
  private hasCurrentPhaseStarted(task: any): boolean {
    const phase = this.getEffectivePhase(task);
    if (!phase) return false;
    
    // 如果是数组（多阶段并行），检查是否有任何一个阶段已开始
    if (Array.isArray(phase)) {
      return phase.some(p => {
        const startField =
          p === 'machining' ? 'machining_start_time' :
          p === 'electrical' ? 'electrical_start_time' :
          p === 'pre_assembly' ? 'pre_assembly_start_time' :
          p === 'post_assembly' ? 'post_assembly_start_time' :
          p === 'debugging' ? 'debugging_start_time' : null;
        return startField && !!task[startField];
      });
    }
    
    // 单个阶段
    const startField =
      phase === 'machining' ? 'machining_start_time' :
      phase === 'electrical' ? 'electrical_start_time' :
      phase === 'pre_assembly' ? 'pre_assembly_start_time' :
      phase === 'post_assembly' ? 'post_assembly_start_time' :
      phase === 'debugging' ? 'debugging_start_time' : null;
    if (!startField) return false;
    return !!task[startField];
  }

  // （可视化不显示徽章，保留方法供内部逻辑使用）
  // isTaskStarted 仅用于模板徽章，已撤回模板调用
  isTaskStarted(task: any): boolean { return this.hasCurrentPhaseStarted(task); }

  // 按当前阶段判定是否已分配（而不是任一阶段）
  isTaskAssigned(task: any): boolean {
    const phase = this.getEffectivePhase(task);
    const assignee = this.getAssigneeByPhase(task, phase);
    return !!assignee;
  }

  // 任务池中（未分配且未完成）- 用于主页面
  get taskPoolTasks() {
    return this.getFilteredTasks().filter(t => !this.isTaskAssigned(t));
  }

  // 获取当前显示的任务
  getDisplayTasks() {
    // 生成缓存键
    const cacheKey = JSON.stringify({
      selectedView: this.selectedView,
      selectedPriority: this.selectedPriority,
      selectedStatus: this.selectedStatus,
      selectedPhase: this.selectedPhase,
      selectedAssignmentStatus: this.selectedAssignmentStatus,
      searchKeyword: this.searchKeyword
    });
    
    // 如果缓存键匹配，直接返回缓存
    if (this._cachedDisplayTasks && this._cachedDisplayTasksKey === cacheKey) {
      return this._cachedDisplayTasks;
    }
    
    const filtered = this.getFilteredTasks();
    
    let result: any[];
    if (this.selectedView === 'unassigned') {
      result = filtered.filter(t => !this.isTaskAssigned(t));
    } else if (this.selectedView === 'assigned') {
      result = filtered.filter(t => this.isTaskAssigned(t));
    } else if (this.selectedView === 'urgent') {
      result = filtered.filter(t => t.priority === 'urgent');
    } else {
      // 'all' 显示所有任务，同时应用表格筛选
      result = this.applyTableFilters(filtered);
    }
    
    // 更新缓存
    this._cachedDisplayTasks = result;
    this._cachedDisplayTasksKey = cacheKey;
    
    return result;
  }

  // 获取筛选后的任务
  getFilteredTasks() {
    let filtered = (this.tasks || []).filter(t => 
      t.status !== 'completed' && 
      !this.isTaskCompleted(t)
    );

    // 视图筛选
    if (this.selectedView === 'unassigned') {
      filtered = filtered.filter(t => !this.isTaskAssigned(t));
    } else if (this.selectedView === 'assigned') {
      filtered = filtered.filter(t => this.isTaskAssigned(t));
    } else if (this.selectedView === 'urgent') {
      filtered = filtered.filter(t => t.priority === 'urgent');
    }
    // 'all' 不进行额外筛选

    // 搜索筛选
    if (this.searchKeyword) {
      const keyword = this.searchKeyword.toLowerCase();
      filtered = filtered.filter(t => 
        (t.name && t.name.toLowerCase().includes(keyword)) ||
        (t.device_number && t.device_number.toLowerCase().includes(keyword)) ||
        (t.product_model && t.product_model.toLowerCase().includes(keyword))
      );
    }

    // 优先级筛选
    if (this.selectedPriority) {
      filtered = filtered.filter(t => t.priority === this.selectedPriority);
    }

    // 状态筛选
    if (this.selectedStatus) {
      filtered = filtered.filter(t => t.status === this.selectedStatus);
    }

    // 分配状态筛选
    if (this.selectedAssignmentStatus) {
      if (this.selectedAssignmentStatus === 'assigned') {
        filtered = filtered.filter(t => this.isTaskAssigned(t));
      } else if (this.selectedAssignmentStatus === 'unassigned') {
        filtered = filtered.filter(t => !this.isTaskAssigned(t));
      }
    }

    // 阶段筛选（使用新的当前阶段逻辑）
    if (this.selectedPhase) {
      if (this.selectedPhase === 'not_started') {
        // 未开始：所有阶段都未开始
      filtered = filtered.filter(t => {
          const phase = this.getEffectivePhase(t);
          return !phase || (Array.isArray(phase) && phase.length === 0);
        });
      } else if (this.selectedPhase === 'machining' || this.selectedPhase === 'electrical') {
        // 机加或电控：匹配多阶段并行情况
        filtered = filtered.filter(t => {
          const phase = this.getEffectivePhase(t);
          return Array.isArray(phase) && phase.includes(this.selectedPhase);
        });
        } else {
        // 其他阶段：精确匹配
        filtered = filtered.filter(t => {
          const phase = this.getEffectivePhase(t);
          return phase === this.selectedPhase;
        });
      }
    }

    return filtered;
  }

  // 获取分页后的任务
  getPaginatedTasks(tasks: any[]) {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return tasks.slice(startIndex, endIndex);
  }

  // 获取总页数
  getTotalPages(tasks: any[]) {
    return Math.ceil(tasks.length / this.pageSize);
  }

  // 获取任务在分页中的序号
  getTaskIndex(index: number): number {
    return (this.currentPage - 1) * this.pageSize + index + 1;
  }

  // 任务统计信息
  get taskStats() {
    const allTasks = this.getFilteredTasks();
    // 检查是否有任何阶段负责人
    const hasAnyAssignee = (task: any) => {
      return task.machining_assignee || task.electrical_assignee || 
             task.pre_assembly_assignee || task.post_assembly_assignee || 
             task.debugging_assignee;
    };
    
    const unassigned = allTasks.filter(t => !hasAnyAssignee(t));
    const assigned = allTasks.filter(t => hasAnyAssignee(t));
    
    return {
      total: allTasks.length,
      unassigned: unassigned.length,
      assigned: assigned.length,
      urgent: allTasks.filter(t => t.priority === 'urgent').length,
      normal: allTasks.filter(t => t.priority !== 'urgent').length,
      // 阶段统计（使用新的当前阶段逻辑）
      machining: allTasks.filter(t => {
        const phase = this.getEffectivePhase(t);
        return Array.isArray(phase) && phase.includes('machining');
      }).length,
      electrical: allTasks.filter(t => {
        const phase = this.getEffectivePhase(t);
        return Array.isArray(phase) && phase.includes('electrical');
      }).length,
      pre_assembly: allTasks.filter(t => {
        const phase = this.getEffectivePhase(t);
        return phase === 'pre_assembly';
      }).length,
      post_assembly: allTasks.filter(t => {
        const phase = this.getEffectivePhase(t);
        return phase === 'post_assembly';
      }).length,
      debugging: allTasks.filter(t => {
        const phase = this.getEffectivePhase(t);
        return phase === 'debugging';
      }).length,
      not_started: allTasks.filter(t => {
        const phase = this.getEffectivePhase(t);
        return !phase || (Array.isArray(phase) && phase.length === 0);
      }).length
    };
  }

  // 检查任务是否已完成（根据订单状态判断）
  isTaskCompleted(task: any): boolean {
    if (!task.order_status) return false;
    const status = task.order_status.toLowerCase();
    return status.includes('已完成') || 
           status.includes('已交货') || 
           status.includes('完成') || 
           status.includes('交货');
  }

  // 某个用户的任务（过滤已完成的任务）
  tasksOfUser(userId: number) {
    return this.getFilteredTasks().filter(t => 
      t.machining_assignee === userId || 
      t.electrical_assignee === userId || 
      t.pre_assembly_assignee === userId || 
      t.post_assembly_assignee === userId || 
      t.debugging_assignee === userId
    );
  }

  // 点击分配任务功能（已移除拖动功能）

  async assignTask(taskId: number, userId: number | null, phaseKey?: string): Promise<any> {
    try {
      this.isLoading = true;
      this.errorMsg = '';
      // 回滚：使用原有旧接口 /api/tasks/assign
      const requestBody: any = { taskId, userId: (userId == null ? 0 : userId) };
      if (phaseKey) {
        requestBody.phaseKey = phaseKey;
      }
      
      // 调试信息：记录发送到后端的参数
      console.log('assignTask 调用 - 发送到后端:', {
        taskId,
        userId,
        phaseKey,
        requestBody
      });
      
      const result: any = await this.http.post(`${environment.apiBase}/api/tasks/assign`, requestBody).toPromise();
      
      // 检查返回结果
      if (result && result.success === false) {
        this.errorMsg = result.error || result.message || '分配失败';
        throw new Error(this.errorMsg);
      }
      
      // 单次轻量刷新
      await this.loadData();
      // 可视化数据后台刷新，确保面板实时更新且不阻塞UI
      try { this.loadVizData && this.loadVizData(); } catch {}
      
      return result;
    } catch (e: any) {
      this.errorMsg = e?.error?.error || e?.error?.message || e?.message || '分配失败';
      throw e; // 重新抛出错误，让调用者处理
    } finally {
      this.isLoading = false;
    }
  }

  // ========== 以下为任务分配交互 ==========

  isSelected(taskId: number) {
    return this.selectedTaskId === taskId;
  }

  // 获取筛选后的用户列表
  getFilteredUsers() {
    let filtered = this.users;
    // 剔除主管/管理员，仅显示工人
    filtered = filtered.filter(u => u.role === 'worker');
    
    // 搜索筛选
    if (this.userSearchKeyword) {
      const keyword = this.userSearchKeyword.toLowerCase();
      filtered = filtered.filter(u => 
        u.name.toLowerCase().includes(keyword) ||
        u.role.toLowerCase().includes(keyword) ||
        (u.department && u.department.toLowerCase().includes(keyword))
      );
    }
    
    // 组筛选
    if (this.selectedUserGroup) {
      filtered = filtered.filter(u => u.user_group === this.selectedUserGroup);
    }
    
    return filtered;
  }

  // 关闭分配模态框
  closeAssignModal() {
    this.isAssignModalOpen = false;
    this.selectedTaskForAssign = null;
    this.userSearchKeyword = '';
    this.selectedUserGroup = ''; // 重置组筛选
  }


  // 取消任务分配
  async unassignTask() {
    if (!this.selectedTaskForAssign) return;
    
    try {
      // 禁止：当前阶段已开始
      if (this.hasCurrentPhaseStarted(this.selectedTaskForAssign)) {
        this.presentToast('当前阶段已开始，禁止取消分配');
        return;
      }
      await this.assignTask(this.selectedTaskForAssign.id, null);
      this.closeAssignModal();
    } catch (error) {
      console.error('取消分配失败:', error);
    }
  }

  // 旧方法保留兼容性
  async assignSelectedToUser(userId: number) {
    if (!this.selectedTaskId || !userId) return;
    const taskId = this.selectedTaskId;
    this.selectedTaskId = null;
    await this.assignTask(taskId, userId);
  }

  async assignSelectedToPool() {
    if (!this.selectedTaskId) return;
    const taskId = this.selectedTaskId;
    this.selectedTaskId = null;
    await this.assignTask(taskId, null);
  }

  // ========== 以下为导入任务相关方法 ==========
  checkUserPermission() {
    // 从localStorage或sessionStorage获取当前用户信息
    const userStr = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (userStr) {
      this.currentUser = JSON.parse(userStr);
      this.canImportTasks = this.currentUser && 
        (this.currentUser.role === 'admin' || 
         this.currentUser.role === 'supervisor' || 
         this.currentUser.role === 'manager' ||
         (this.currentUser.role === 'staff' && this.currentUser.department === 'PMC'));
    }
  }

  openImportModal() {
    this.isImportModalOpen = true;
    this.selectedFile = null;
    this.importResult = null;
  }

  closeImportModal() {
    this.isImportModalOpen = false;
    this.selectedFile = null;
    this.importResult = null;
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      // 验证文件类型
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        this.errorMsg = '请选择Excel文件（.xlsx或.xls格式）';
        return;
      }
      
      this.selectedFile = file;
      this.errorMsg = '';
    }
  }

  async importTasks() {
    if (!this.selectedFile || !this.currentUser) {
      this.errorMsg = '请选择文件或重新登录';
      return;
    }

    this.isImporting = true;
    this.importResult = null;
    this.errorMsg = '';

    try {
      const formData = new FormData();
      formData.append('file', this.selectedFile);
      formData.append('userId', this.currentUser.id.toString());

      const response: any = await this.http.post(
        `${environment.apiBase}/api/tasks/import`,
        formData
      ).toPromise();

      this.importResult = response;
      
      if (response.success) {
        // 导入成功后刷新任务列表
        await this.loadData();
      }
    } catch (error: any) {
      this.importResult = {
        success: false,
        message: error.error?.error || error.message || '导入失败'
      };
    } finally {
      this.isImporting = false;
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
      this.errorMsg = '请选择文件或重新登录';
      return;
    }
    this.isImportingStd = true;
    this.importStdResult = null;
    this.errorMsg = '';
    try {
      const formData = new FormData();
      formData.append('file', this.selectedStdFile);
      formData.append('userId', this.currentUser.id.toString());

      const response: any = await this.http.post(
        `${environment.apiBase}/api/standard-hours/import`,
        formData
      ).toPromise();

      this.importStdResult = response;
      if (response.success) {
        // 刷新任务列表以显示最新预计工时
        await this.loadData();
      }
    } catch (error: any) {
      this.importStdResult = {
        success: false,
        message: error.error?.error || error.message || '导入失败'
      };
    } finally {
      this.isImportingStd = false;
    }
  }

  // 下载标准工时模板
  downloadStdTemplate() {
    const url = `${environment.apiBase}/api/standard-hours/template`;
    try {
      window.open(url, '_blank');
    } catch {
      window.location.href = url;
    }
  }


  // ========== 以下为搜索和筛选相关方法 ==========
  onSearchChange() {
    this.currentPage = 1; // 重置到第一页
    this.clearAllCache(); // 清除缓存，因为筛选条件改变
  }

  onFilterChange() {
    this.currentPage = 1; // 重置到第一页
    this.clearAllCache(); // 清除缓存，因为筛选条件改变
  }

  onTableFilterChange() {
    this.currentPage = 1;
    this.clearAllCache();
  }

  clearFilters() {
    this.searchKeyword = '';
    this.selectedPriority = '';
    this.selectedStatus = '';
    this.selectedPhase = ''; // 清除阶段筛选
    this.selectedAssignmentStatus = '';
    this.selectedView = 'all';
    // 清除表格筛选
    this.tableFilters = {
      device: '',
      model: '',
      priority: '',
      status: '',
      phase: '',
      assignee: '',
      productionTime: '',
      promisedTime: '',
      progress: '',
      machining: '',
      electrical: '',
      pre_assembly: '',
      post_assembly: '',
      debugging: ''
    };
    this.currentPage = 1;
    this.clearAllCache(); // 清除缓存
  }

  // 清除所有筛选（包括视图和阶段筛选）
  clearAllFilters() {
    this.searchKeyword = '';
    this.selectedPriority = '';
    this.selectedStatus = '';
    this.selectedPhase = '';
    this.selectedAssignmentStatus = '';
    this.selectedView = 'all';
    this.currentPage = 1;
  }

  getVisibleTableColumnCount(): number {
    const visible = Object.values(this.tableColumnVisibility).filter(Boolean).length;
    const operationsColumn = 1;
    return visible + operationsColumn;
  }

  toggleColumnVisibility(columnKey: string, value: boolean) {
    const visibleCount = Object.values(this.tableColumnVisibility).filter(Boolean).length;
    if (!value && visibleCount <= 1) {
      this.presentToast('至少保留一列');
      return;
    }
    this.tableColumnVisibility = {
      ...this.tableColumnVisibility,
      [columnKey]: value
    };
    this.saveTableColumnVisibility();
  }

  resetColumnVisibility() {
    this.tableColumnVisibility = {
      device: true,
      model: true,
      priority: true,
      status: true,
      currentPhase: true,
      productionTime: true,
      promisedTime: true,
      progress: true,
      machining: true,
      electrical: true,
      pre_assembly: true,
      post_assembly: true,
      debugging: true
    };
    this.saveTableColumnVisibility();
  }

  columnVisible(columnKey: string): boolean {
    return !!this.tableColumnVisibility[columnKey];
  }

  private loadTableColumnVisibility() {
    try {
      const saved = localStorage.getItem('dispatchTableColumns');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.tableColumnVisibility = {
          ...this.tableColumnVisibility,
          ...parsed
        };
      }
    } catch (error) {
      console.warn('读取列可见性失败', error);
    }
  }

  private saveTableColumnVisibility() {
    localStorage.setItem('dispatchTableColumns', JSON.stringify(this.tableColumnVisibility));
  }

  // 点击统计芯片切换视图
  onStatsClick(view: string) {
    this.selectedView = view;
    this.currentPage = 1; // 重置到第一页
    this.clearAllCache(); // 清除缓存，因为视图改变
  }

  // 点击阶段芯片切换阶段筛选
  onPhaseClick(phase: string) {
    this.selectedPhase = phase;
    this.currentPage = 1; // 重置到第一页
    this.clearAllCache(); // 清除缓存，因为阶段筛选改变
  }

  toggleFilters() {
    this.showFilters = !this.showFilters;
  }

  goToPage(page: number) {
    const totalPages = this.getTotalPages(this.getFilteredTasks());
    if (page >= 1 && page <= totalPages) {
      this.currentPage = page;
    }
  }

  getPageNumbers() {
    const totalPages = this.getTotalPages(this.getFilteredTasks());
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const start = Math.max(1, this.currentPage - 2);
      const end = Math.min(totalPages, start + maxVisible - 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  }

  // 获取阶段名称
  getPhaseName(phaseKey: string): string {
    const phaseNames: { [key: string]: string } = {
      'machining': '机加',
      'electrical': '电控',
      'pre_assembly': '总装前段',
      'post_assembly': '总装后段',
      'debugging': '调试'
    };
    return phaseNames[phaseKey] || phaseKey;
  }

  // 根据用户ID获取姓名
  getEmployeeName(userId: number | null | undefined): string {
    if (userId == null) return '';
    const user = this.users.find(u => u.id === userId) || this.vizData.find(e => e.id === userId);
    return user?.name || '';
  }

  // 获取当前阶段显示文本
  // 获取任务的分配人信息
  getTaskAssignees(task: any): string {
    const assignees: string[] = [];
    
    if (task.machining_assignee) {
      const user = this.users.find(u => u.id === task.machining_assignee);
      if (user) {
        assignees.push(`机加: ${user.name}`);
      }
    }
    if (task.electrical_assignee) {
      const user = this.users.find(u => u.id === task.electrical_assignee);
      if (user) {
        assignees.push(`电控: ${user.name}`);
      }
    }
    if (task.pre_assembly_assignee) {
      const user = this.users.find(u => u.id === task.pre_assembly_assignee);
      if (user) {
        assignees.push(`总装前段: ${user.name}`);
      }
    }
    if (task.post_assembly_assignee) {
      const user = this.users.find(u => u.id === task.post_assembly_assignee);
      if (user) {
        assignees.push(`总装后段: ${user.name}`);
      }
    }
    if (task.debugging_assignee) {
      const user = this.users.find(u => u.id === task.debugging_assignee);
      if (user) {
        assignees.push(`调试: ${user.name}`);
      }
    }
    
    return assignees.length > 0 ? assignees.join(', ') : '-';
  }

  getCurrentPhaseDisplay(task: any): string {
    const phase = this.getEffectivePhase(task);
    
    if (!phase) {
      return '已完成';
    }
    
    // 如果是数组（多阶段并行），显示多个阶段
    if (Array.isArray(phase)) {
      return phase.map(p => this.getPhaseName(p)).join('、');
    }
    
    // 单个阶段
    return this.getPhaseName(phase);
  }

  // 阶段是否完成（供模板和内部逻辑复用）
  isPhaseCompleted(task: any, phaseKey: string | null): boolean {
    if (!task || !phaseKey) return false;

    // 优先使用已装饰的阶段数据（包含 completed 标记）
    if (Array.isArray(task._phases)) {
      const decoratedPhase = task._phases.find((phase: any) => phase.key === phaseKey);
      if (decoratedPhase) {
        return !!decoratedPhase.completed;
      }
    }

    const phaseFieldMap: Record<string, string> = {
      machining: 'machining_phase',
      electrical: 'electrical_phase',
      pre_assembly: 'pre_assembly_phase',
      post_assembly: 'post_assembly_phase',
      debugging: 'debugging_phase'
    };

    const field = phaseFieldMap[phaseKey];
    if (!field) return false;

    const rawValue = task[field];
    if (rawValue == null) return false;

    if (typeof rawValue === 'number') {
      return rawValue === 1;
    }
    if (typeof rawValue === 'boolean') {
      return rawValue;
    }

    const normalized = String(rawValue).trim().toLowerCase();
    const truthyValues = ['1', 'true', 'completed', 'complete', 'done', 'finished', 'yes', 'y', '已完成', '完成'];
    return truthyValues.includes(normalized);
  }

  // 已撤回可视化徽章颜色使用
  getPhaseBadgeColor(task: any): string { return 'medium'; }

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

  // ========== 阶段分配相关方法 ==========
  
  // 检查是否可以分配阶段
  canAssignPhases(): boolean {
    if (!this.selectedTaskForAssign) return false;
    const task = this.selectedTaskForAssign;
    // 机加和电控阶段可以并列分配，只要其中一个未完成即可
    return task.machining_phase === 0 || task.electrical_phase === 0;
  }

  // 检查特定阶段是否可以分配
  canAssignPhase(phaseKey: string): boolean {
    if (!this.selectedTaskForAssign) return false;
    const task = this.selectedTaskForAssign;
    
    if (phaseKey === 'machining') {
      // 机加阶段可以分配：机加阶段未完成且未分配
      return task.machining_phase === 0 && !task.machining_assignee;
    } else if (phaseKey === 'electrical') {
      // 电控阶段可以分配：电控阶段未完成且未分配
      return task.electrical_phase === 0 && !task.electrical_assignee;
    } else if (phaseKey === 'pre_assembly') {
      // 总装前段可以分配：总装前段未完成且未分配，且机加阶段已派工或已完成
      const machiningAssigned = task.machining_assignee != null && task.machining_assignee !== '' && task.machining_assignee !== 0;
      const machiningCompleted = task.machining_phase === 1 || task.machining_phase === '1';
      return task.pre_assembly_phase === 0 && !task.pre_assembly_assignee && (machiningAssigned || machiningCompleted);
    } else if (phaseKey === 'post_assembly') {
      // 总装后段可以分配：总装后段未完成且未分配，且总装前段已派工或已完成
      const preAssemblyAssigned = task.pre_assembly_assignee != null && task.pre_assembly_assignee !== '' && task.pre_assembly_assignee !== 0;
      const preAssemblyCompleted = task.pre_assembly_phase === 1 || task.pre_assembly_phase === '1';
      return task.post_assembly_phase === 0 && !task.post_assembly_assignee && (preAssemblyAssigned || preAssemblyCompleted);
    } else if (phaseKey === 'debugging') {
      // 调试阶段可以分配：调试阶段未完成且未分配
      return task.debugging_phase === 0 && !task.debugging_assignee;
    }
    
    return false;
  }

  // 选择阶段进行分配
  selectPhaseForAssign(phaseKey: string) {
    this.selectedPhaseForAssign = phaseKey;
  }

  // 获取阶段说明
  getPhaseNote(): string {
    if (!this.selectedPhaseForAssign) return '';
    
    switch (this.selectedPhaseForAssign) {
      case 'machining':
        return '分配机加阶段给工人，可以与电控阶段并行进行';
      case 'electrical':
        return '分配电控阶段给工人，可以与机加阶段并行进行';
      case 'pre_assembly':
        return '分配总装前段给工人，需要机加阶段已派工或已完成';
      case 'post_assembly':
        return '分配总装后段给工人，需要总装前段已派工或已完成';
      case 'debugging':
        return '分配调试阶段给工人';
      default:
        return '';
    }
  }

  // 分配任务给用户（带阶段信息）
  async assignTaskToUser(userId: number) {
    if (!this.selectedTaskForAssign) return;
    
    // 必须选择阶段
    if (!this.selectedPhaseForAssign) {
      this.errorMsg = '请先选择要分配的阶段';
      return;
    }
    
    // 检查阶段是否可以分配
    if (!this.canAssignPhase(this.selectedPhaseForAssign)) {
      this.errorMsg = `无法分配${this.getPhaseName(this.selectedPhaseForAssign)}阶段，请检查前置条件`;
      return;
    }
    
    await this.assignTask(this.selectedTaskForAssign.id, userId, this.selectedPhaseForAssign);
    this.closeAssignModal();
  }

  // 打开分配模态框时重置阶段选择
  onTaskClick(taskId: number, ev?: Event) {
    ev?.stopPropagation?.();
    // 找到任务详情
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      this.selectedTaskForAssign = task;
      // 根据筛选条件或任务状态选择默认阶段
      if (this.unassignedTaskFilters.phase) {
        // 如果筛选条件指定了阶段，使用筛选条件的阶段
        const filterPhase = this.unassignedTaskFilters.phase;
        if (this.canAssignPhase(filterPhase)) {
          this.selectedPhaseForAssign = filterPhase;
        } else {
          this.selectedPhaseForAssign = ''; // 筛选条件指定的阶段不可用
        }
      } else {
        // 否则，默认选择第一个可用的阶段（机加或电控）
      if (this.canAssignPhase('machining')) {
        this.selectedPhaseForAssign = 'machining';
      } else if (this.canAssignPhase('electrical')) {
        this.selectedPhaseForAssign = 'electrical';
      } else {
        this.selectedPhaseForAssign = ''; // 没有可用阶段
        }
      }
      this.isAssignModalOpen = true;
      this.userSearchKeyword = '';
      this.selectedUserGroup = ''; // 重置组筛选
    }
  }

  // ========== 任务管理相关方法 ==========
  
  // 新增任务（单任务Excel导入）
  openCreateTaskModal() {
    this.isCreateTaskModalOpen = true;
    this.selectedCreateTaskFile = null;
    this.createTaskResult = null;
  }

  closeCreateTaskModal() {
    this.isCreateTaskModalOpen = false;
    this.selectedCreateTaskFile = null;
    this.createTaskResult = null;
  }

  onCreateTaskFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      // 验证文件类型
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        this.errorMsg = '请选择Excel文件（.xlsx或.xls格式）';
        return;
      }
      
      this.selectedCreateTaskFile = file;
      this.errorMsg = '';
    }
  }

  async importSingleTask() {
    if (!this.selectedCreateTaskFile || !this.currentUser) {
      this.errorMsg = '请选择文件或重新登录';
      return;
    }

    this.isCreatingTask = true;
    this.createTaskResult = null;
    this.errorMsg = '';

    try {
      const formData = new FormData();
      formData.append('file', this.selectedCreateTaskFile);
      formData.append('userId', this.currentUser.id.toString());

      const response: any = await this.http.post(
        `${environment.apiBase}/api/tasks/import`,
        formData
      ).toPromise();

      this.createTaskResult = response;
      
      if (response.success) {
        // 导入成功后刷新任务列表
        await this.loadData();
      }
    } catch (error: any) {
      this.createTaskResult = {
        success: false,
        message: error.error?.error || error.message || '导入失败'
      };
    } finally {
      this.isCreatingTask = false;
    }
  }

  // 修改任务
  openEditTaskModal() {
    // 让用户选择要修改的任务
    this.isEditTaskModalOpen = true;
    this.editTask = null;
    this.searchDeviceOrModel = '';
  }

  closeEditTaskModal() {
    this.isEditTaskModalOpen = false;
    this.editTask = null;
    this.searchDeviceOrModel = '';
  }

  async loadTaskForEditByDeviceOrModel() {
    if (!this.searchDeviceOrModel) return;
    
    try {
      // 先搜索所有任务
      const tasks: any = await this.http.get(`${environment.apiBase}/api/tasks`).toPromise();
      const tasksArray = Array.isArray(tasks) ? tasks : [];
      // 按设备号或产品型号查找
      const foundTask = tasksArray.find((t: any) => 
        t.device_number === this.searchDeviceOrModel || 
        t.product_model === this.searchDeviceOrModel
      );
      
      if (foundTask) {
        this.editTask = foundTask;
      } else {
        this.errorMsg = '未找到匹配的任务';
      }
    } catch (error: any) {
      this.errorMsg = '获取任务信息失败';
    }
  }

  async updateTask() {
    if (!this.editTask) return;

    try {
      // 处理时间格式
      const updateData = {
        ...this.editTask,
        production_time: this.editTask.production_time ? 
          (this.editTask.production_time.split('T')[0] + 'T00:00:00') : this.editTask.production_time,
        promised_completion_time: this.editTask.promised_completion_time ? 
          (this.editTask.promised_completion_time.split('T')[0] + 'T00:00:00') : this.editTask.promised_completion_time
      };
      
      await this.http.put(`${environment.apiBase}/api/tasks/${this.editTask.id}`, updateData).toPromise();
      this.presentToast('任务修改成功');
      this.closeEditTaskModal();
      await this.loadData();
      this.errorMsg = '';
    } catch (error: any) {
      this.errorMsg = error.error?.message || '更新任务失败';
      this.presentToast('任务修改失败');
    }
  }

  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'top'
    });
    await toast.present();
  }

  // 删除任务
  openDeleteTaskModal() {
    this.isDeleteTaskModalOpen = true;
    this.taskToDelete = null;
    this.deleteSearchDeviceOrModel = '';
  }

  closeDeleteTaskModal() {
    this.isDeleteTaskModalOpen = false;
    this.taskToDelete = null;
    this.deleteSearchDeviceOrModel = '';
  }

  async searchTaskToDelete() {
    if (!this.deleteSearchDeviceOrModel) return;
    
    try {
      // 先搜索所有任务
      const tasks: any = await this.http.get(`${environment.apiBase}/api/tasks`).toPromise();
      const tasksArray = Array.isArray(tasks) ? tasks : [];
      // 按设备号或产品型号查找
      const foundTask = tasksArray.find((t: any) => 
        t.device_number === this.deleteSearchDeviceOrModel || 
        t.product_model === this.deleteSearchDeviceOrModel
      );
      
      if (foundTask) {
        this.taskToDelete = foundTask;
      } else {
        this.errorMsg = '未找到匹配的任务';
      }
    } catch (error: any) {
      this.errorMsg = '搜索任务失败';
    }
  }

  async deleteTask() {
    if (!this.taskToDelete) return;

    try {
      await this.http.delete(`${environment.apiBase}/api/tasks/${this.taskToDelete.id}`).toPromise();
      this.closeDeleteTaskModal();
      await this.loadData();
      this.errorMsg = '';
    } catch (error: any) {
      this.errorMsg = error.error?.message || '删除任务失败';
    }
  }

  // ========== 派工任务可视化相关方法 ==========

  async openVizModal() {
    this.isVizModalOpen = true;
    await this.loadVizData();
  }

  closeVizModal() {
    this.isVizModalOpen = false;
  }

  async loadVizData() {
    try {
      // 获取所有任务和用户
      const [tasks, users] = await Promise.all([
        this.http.get<any[]>(`${environment.apiBase}/api/tasks`).toPromise(),
        this.http.get<any[]>(`${environment.apiBase}/api/users`).toPromise()
      ]);

      const tasksArray = tasks || [];
      const usersArray = users || [];
      
      // 加载待分配任务（动态口径：当前有效阶段负责人为空）
      this.unassignedTasks = tasksArray.filter(task => {
        if (task.status === 'completed') return false;
        const phase = this.getEffectivePhase(task);
        const assignee = this.getAssigneeByPhase(task, phase);
        return !assignee;
      });
      
      // 应用待分配任务筛选
      this.filterUnassignedTasks();

      // 按员工分组，收集所有已分配的任务
      const employeeTasks = new Map<number, any[]>();

      tasksArray.forEach((task: any) => {
        // 检查所有阶段的 assignee，而不仅仅是 current_phase 对应的阶段
        // 收集所有未完成阶段的负责人
        const phaseMap: any = { machining: '机加', electrical: '电控', pre_assembly: '总装前段', post_assembly: '总装后段', debugging: '调试' };
        const assignees: Array<{assigneeId: number, phase: string, phaseCn: string}> = [];
        
        if (task.machining_phase === 0 && task.machining_assignee) {
          assignees.push({ assigneeId: task.machining_assignee, phase: 'machining', phaseCn: phaseMap['machining'] });
        }
        if (task.electrical_phase === 0 && task.electrical_assignee) {
          assignees.push({ assigneeId: task.electrical_assignee, phase: 'electrical', phaseCn: phaseMap['electrical'] });
        }
        if (task.pre_assembly_phase === 0 && task.pre_assembly_assignee) {
          assignees.push({ assigneeId: task.pre_assembly_assignee, phase: 'pre_assembly', phaseCn: phaseMap['pre_assembly'] });
        }
        if (task.post_assembly_phase === 0 && task.post_assembly_assignee) {
          assignees.push({ assigneeId: task.post_assembly_assignee, phase: 'post_assembly', phaseCn: phaseMap['post_assembly'] });
        }
        if (task.debugging_phase === 0 && task.debugging_assignee) {
          assignees.push({ assigneeId: task.debugging_assignee, phase: 'debugging', phaseCn: phaseMap['debugging'] });
        }
        
        // 为每个 assignee 添加任务
        assignees.forEach(({ assigneeId, phaseCn }) => {
          if (!employeeTasks.has(assigneeId)) {
            employeeTasks.set(assigneeId, []);
          }
          employeeTasks.get(assigneeId)!.push({
            ...task,
            assignedPhase: phaseCn
          });
        });
      });

      // 仅保留工人，剔除主管/管理员
      const workerUsers = usersArray.filter((u: any) => u.role === 'worker');

      // 先为所有用户创建条目
      let employeeData = workerUsers.map(user => {
        const tasks = employeeTasks.get(user.id) || [];
        
        // 对任务进行排序：按拖动顺序（*_order字段）排序
        // 先分配的放上面（order值小的在上），后分配的放下面（order值大的在下）
        tasks.sort((a, b) => {
          // 获取任务的阶段key（从assignedPhase中文名转换为key）
          const getPhaseKey = (phaseCn: string): string => {
            const phaseMap: any = { '机加': 'machining', '电控': 'electrical', '总装前段': 'pre_assembly', '总装后段': 'post_assembly', '调试': 'debugging' };
            return phaseMap[phaseCn] || 'machining';
          };
          
          // 获取任务对应的order字段值
          const getTaskOrder = (task: any): number => {
            const phaseKey = getPhaseKey(task.assignedPhase || '');
            const orderField = `${phaseKey}_order`;
            const orderValue = task[orderField];
            // 如果没有order值，返回999（排到最后）
            return orderValue !== null && orderValue !== undefined ? Number(orderValue) : 999;
          };
          
          const orderA = getTaskOrder(a);
          const orderB = getTaskOrder(b);
          // 升序排序：order值小的（先分配的/先拖动的）在上
          return orderA - orderB;
        });
        
        return {
          id: user.id,
          name: user.name,  // 使用中文名称
          department: user.department || '',
          user_group: user.user_group || '',
          tasks: tasks
        };
      });

      // 按部门筛选
      if (this.vizDepartmentFilter) {
        employeeData = employeeData.filter(e => e.department === this.vizDepartmentFilter);
      }
      
      // 按组筛选
      if (this.vizGroupFilter) {
        employeeData = employeeData.filter(e => e.user_group === this.vizGroupFilter);
      }

      // 排序：有任务的员工优先（按任务数降序），无任务员工放最后
      employeeData.sort((a, b) => {
        if (a.tasks.length > 0 && b.tasks.length > 0) {
          // 两者都有任务，按任务数降序
          return b.tasks.length - a.tasks.length;
        } else if (a.tasks.length > 0) {
          // a有任务，b没有，a优先
          return -1;
        } else if (b.tasks.length > 0) {
          // b有任务，a没有，b优先
          return 1;
        } else {
          // 两者都无任务，按姓名排序
          return a.name.localeCompare(b.name);
        }
      });

      // 取前 N 个（可调）
      const limit = Math.max(1, Number(this.vizEmployeeLimit) || 10);
      this.vizData = employeeData.slice(0, limit);

    } catch (error: any) {
      console.error('加载可视化数据失败:', error);
      this.vizData = [];
    }
  }

  // 保存员工上限设置并刷新
  onVizEmployeeLimitChange() {
    const limit = Math.max(1, Number(this.vizEmployeeLimit) || 10);
    this.vizEmployeeLimit = limit;
    localStorage.setItem('vizEmployeeLimit', String(limit));
    this.loadVizData();
  }

  getTaskDisplayName(taskName: string): string {
    if (!taskName) return '';
    // 如果任务名太长，截取前20个字符
    return taskName.length > 20 ? taskName.substring(0, 20) + '...' : taskName;
  }

  // ========== 拖放功能 ==========
  
  onDragStart(event: DragEvent, task: any, employeeId: number) {
    this.isDragging = true;
    this.draggedTask = task;
    this.draggedTaskEmployee = employeeId;
    
    // 设置拖动的视觉效果
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('text/plain', task.id.toString());
  }

  onDragOver(event: DragEvent, employeeId: number) {
    event.preventDefault();
    event.stopPropagation();
    
    // 允许拖放到不同的员工，或从未分配区拖到员工
    if (this.isDragging && this.draggedTask && (this.draggedTaskEmployee !== employeeId || this.draggedTaskEmployee === null)) {
      event.dataTransfer!.dropEffect = 'move';
      this.dragOverEmployee = employeeId;
    } else {
      event.dataTransfer!.dropEffect = 'none';
      this.dragOverEmployee = null;
    }
  }

  onDragLeave(event: DragEvent) {
    // 不要立即清空dragOverEmployee，让dragend有机会检测
    // this.dragOverEmployee = null;
  }

  async onDrop(event: DragEvent, targetEmployeeId: number) {
    event.preventDefault();
    event.stopPropagation();
    
    this.dragOverEmployee = null;
    
    if (!this.draggedTask || this.draggedTaskEmployee === targetEmployeeId) {
      this.onDragEnd(event);
      return;
    }

    // 未分配 → 员工：弹出阶段选择；员工 → 员工：直接重分配
    if (this.draggedTaskEmployee === null) {
      await this.choosePhaseAndAssign(this.draggedTask, targetEmployeeId);
    } else {
      const confirmed = confirm(`确定要将任务"${this.draggedTask.name}"重新分配给${this.vizData.find(e => e.id === targetEmployeeId)?.name}吗？`);
      if (confirmed) {
        await this.reassignTask(this.draggedTask, this.draggedTaskEmployee, targetEmployeeId);
      }
    }
    
    this.onDragEnd(event);
  }

  async onDragEnd(event: DragEvent) {
    // 如果拖放到了目标员工，执行重新分配或新分配
    if (this.isDragging && this.draggedTask && this.dragOverEmployee && 
        this.dragOverEmployee !== this.draggedTaskEmployee) {
      const targetEmployee = this.vizData.find(e => e.id === this.dragOverEmployee);
      
      if (this.draggedTaskEmployee === null) {
        await this.choosePhaseAndAssign(this.draggedTask, this.dragOverEmployee);
      } else {
        // 禁止：当前阶段已开始
        if (this.hasCurrentPhaseStarted(this.draggedTask)) {
          this.presentToast('当前阶段已开始，禁止重新分配');
        } else {
          const confirmed = confirm(`确定要将任务"${this.draggedTask.name}"重新分配给${targetEmployee?.name}吗？`);
          if (confirmed) {
            await this.reassignTask(this.draggedTask, this.draggedTaskEmployee, this.dragOverEmployee);
          }
        }
      }
    }
    
    this.isDragging = false;
    this.draggedTask = null;
    this.draggedTaskEmployee = null;
    this.dragOverEmployee = null;
  }

  // ========== 任务进度计算 ==========
  
  getTaskProgress(task: any): number {
    if (!task) return 0;
    
    const phases = [
      { key: 'machining_status', name: '机加', completed: false },
      { key: 'electrical_status', name: '电控', completed: false },
      { key: 'pre_assembly_status', name: '总装前段', completed: false },
      { key: 'post_assembly_status', name: '总装后段', completed: false },
      { key: 'debugging_status', name: '调试', completed: false }
    ];

    let completedCount = 0;
    
    phases.forEach(phase => {
      if (task[phase.key] === 'completed') {
        completedCount++;
      }
    });
    
    return (completedCount / phases.length) * 100;
  }

  // 获取任务进度百分比
  getTaskProgressPercent(task: any): number {
    if (!task) return 0;
    
    // 如果已预计算，直接返回
    if (task._progressPercent !== undefined) {
      return task._progressPercent;
    }
    
    const phases = [
      { key: 'machining_phase', name: '机加' },
      { key: 'electrical_phase', name: '电控' },
      { key: 'pre_assembly_phase', name: '总装前段' },
      { key: 'post_assembly_phase', name: '总装后段' },
      { key: 'debugging_phase', name: '调试' }
    ];
    
    let completedCount = 0;
    phases.forEach(phase => {
      if (task[phase.key] === 1 || task[phase.key] === '1') {
        completedCount++;
      }
    });
    
    return Math.round((completedCount / phases.length) * 100);
  }

  // 获取任务的所有阶段信息
  getTaskPhases(task: any): any[] {
    // 如果已预计算，直接返回
    if (task._phases !== undefined) {
      return task._phases;
    }
    
    const phases = [
      {
        key: 'machining',
        name: '机加',
        icon: 'build',
        phaseField: 'machining_phase',
        assigneeField: 'machining_assignee',
        assigneeNameField: 'machining_assignee_name',
        startTimeField: 'machining_start_time'
      },
      {
        key: 'electrical',
        name: '电控',
        icon: 'flash',
        phaseField: 'electrical_phase',
        assigneeField: 'electrical_assignee',
        assigneeNameField: 'electrical_assignee_name',
        startTimeField: 'electrical_start_time'
      },
      {
        key: 'pre_assembly',
        name: '总装前段',
        icon: 'construct',
        phaseField: 'pre_assembly_phase',
        assigneeField: 'pre_assembly_assignee',
        assigneeNameField: 'pre_assembly_assignee_name',
        startTimeField: 'pre_assembly_start_time'
      },
      {
        key: 'post_assembly',
        name: '总装后段',
        icon: 'hammer',
        phaseField: 'post_assembly_phase',
        assigneeField: 'post_assembly_assignee',
        assigneeNameField: 'post_assembly_assignee_name',
        startTimeField: 'post_assembly_start_time'
      },
      {
        key: 'debugging',
        name: '调试',
        icon: 'bug',
        phaseField: 'debugging_phase',
        assigneeField: 'debugging_assignee',
        assigneeNameField: 'debugging_assignee_name',
        startTimeField: 'debugging_start_time'
      }
    ];
    
    return phases.map(phase => {
      const completed = task[phase.phaseField] === 1 || task[phase.phaseField] === '1';
      const hasAssignee = !!task[phase.assigneeField];
      const hasStartTime = !!task[phase.startTimeField];
      
      // 进行中的定义：有分配人 + 已开始（有开始时间）+ 未完成
      const inProgress = hasAssignee && hasStartTime && !completed;
      
      return {
        ...phase,
        completed,
        inProgress,
        assignee: task[phase.assigneeNameField] || (hasAssignee ? `用户#${task[phase.assigneeField]}` : null)
      };
    });
  }

  getPhaseAssigneeName(task: any, phaseKey: string): string {
    if (!task || !phaseKey) return '';

    if (Array.isArray(task._phases)) {
      const phase = task._phases.find((p: any) => p.key === phaseKey);
      if (phase && phase.assignee) {
        return phase.assignee;
      }
    }

    const assigneeFieldMap: Record<string, string> = {
      machining: 'machining_assignee',
      electrical: 'electrical_assignee',
      pre_assembly: 'pre_assembly_assignee',
      post_assembly: 'post_assembly_assignee',
      debugging: 'debugging_assignee'
    };

    const assigneeNameFieldMap: Record<string, string> = {
      machining: 'machining_assignee_name',
      electrical: 'electrical_assignee_name',
      pre_assembly: 'pre_assembly_assignee_name',
      post_assembly: 'post_assembly_assignee_name',
      debugging: 'debugging_assignee_name'
    };

    const nameField = assigneeNameFieldMap[phaseKey];
    if (nameField && task[nameField]) {
      return task[nameField];
    }

    const assigneeField = assigneeFieldMap[phaseKey];
    if (assigneeField && task[assigneeField]) {
      return this.getEmployeeName(task[assigneeField]) || `用户#${task[assigneeField]}`;
    }

    return '';
  }

  private applyTableFilters(tasks: any[]): any[] {
    if (this.selectedView !== 'all') {
      return tasks;
    }

    return tasks.filter(task => {
      if (this.tableFilters.device) {
        const device = (task.device_number || '').toLowerCase();
        if (!device.includes(this.tableFilters.device.toLowerCase())) {
          return false;
        }
      }

      if (this.tableFilters.model) {
        const model = (task.product_model || '').toLowerCase();
        if (!model.includes(this.tableFilters.model.toLowerCase())) {
          return false;
        }
      }

      if (this.tableFilters.priority) {
        if (this.normalizePriorityValue(task.priority) !== this.tableFilters.priority) {
          return false;
        }
      }

      if (this.tableFilters.status) {
        if ((task.status || '').toLowerCase() !== this.tableFilters.status) {
          return false;
        }
      }

      if (this.tableFilters.phase) {
        const currentPhase = (task._currentPhaseDisplay || this.getCurrentPhaseDisplay(task) || '').toLowerCase();
        if (!currentPhase.includes(this.getPhaseName(this.tableFilters.phase).toLowerCase())) {
          return false;
        }
      }

      if (this.tableFilters.assignee) {
        const keyword = this.tableFilters.assignee.toLowerCase();
        const assignees = this.getTaskAssignees(task).toLowerCase();
        const assistants = (this.getAssistantDisplayNames(task) || '').toLowerCase();
        if (!assignees.includes(keyword) && !assistants.includes(keyword)) {
          return false;
        }
      }

      // 开工日期筛选：筛选出某个日期前所有的任务
      if (this.tableFilters.productionTime) {
        const filterDate = new Date(this.tableFilters.productionTime);
        if (task.production_time) {
          const taskDate = new Date(task.production_time);
          if (taskDate > filterDate) {
            return false;
          }
        } else {
          // 如果没有开工日期，不显示
          return false;
        }
      }

      // 承诺交付日期筛选：筛选出某个日期前所有的任务
      if (this.tableFilters.promisedTime) {
        const filterDate = new Date(this.tableFilters.promisedTime);
        if (task.promised_completion_time) {
          const taskDate = new Date(task.promised_completion_time);
          if (taskDate > filterDate) {
            return false;
          }
        } else {
          // 如果没有承诺交付日期，不显示
          return false;
        }
      }

      // 整体进度筛选：筛选出进度大于等于某个值的任务
      if (this.tableFilters.progress) {
        const filterProgress = parseFloat(this.tableFilters.progress);
        if (!isNaN(filterProgress)) {
          const taskProgress = task._progressPercent !== undefined 
            ? task._progressPercent 
            : this.getTaskProgressPercent(task);
          if (taskProgress < filterProgress) {
            return false;
          }
        }
      }

      // 各阶段完成状态筛选
      if (this.tableFilters.machining) {
        const isCompleted = this.isPhaseCompleted(task, 'machining');
        if (this.tableFilters.machining === 'completed' && !isCompleted) {
          return false;
        }
        if (this.tableFilters.machining === 'not_completed' && isCompleted) {
          return false;
        }
      }

      if (this.tableFilters.electrical) {
        const isCompleted = this.isPhaseCompleted(task, 'electrical');
        if (this.tableFilters.electrical === 'completed' && !isCompleted) {
          return false;
        }
        if (this.tableFilters.electrical === 'not_completed' && isCompleted) {
          return false;
        }
      }

      if (this.tableFilters.pre_assembly) {
        const isCompleted = this.isPhaseCompleted(task, 'pre_assembly');
        if (this.tableFilters.pre_assembly === 'completed' && !isCompleted) {
          return false;
        }
        if (this.tableFilters.pre_assembly === 'not_completed' && isCompleted) {
          return false;
        }
      }

      if (this.tableFilters.post_assembly) {
        const isCompleted = this.isPhaseCompleted(task, 'post_assembly');
        if (this.tableFilters.post_assembly === 'completed' && !isCompleted) {
          return false;
        }
        if (this.tableFilters.post_assembly === 'not_completed' && isCompleted) {
          return false;
        }
      }

      if (this.tableFilters.debugging) {
        const isCompleted = this.isPhaseCompleted(task, 'debugging');
        if (this.tableFilters.debugging === 'completed' && !isCompleted) {
          return false;
        }
        if (this.tableFilters.debugging === 'not_completed' && isCompleted) {
          return false;
        }
      }

      return true;
    });
  }

  // 计算各阶段的完成/未完成数量（基于所有任务，不受筛选影响）
  getPhaseStats(phaseKey: string): { completed: number; notCompleted: number } {
    // 直接使用所有任务计算统计，不受筛选条件影响
    const allTasks = (this.tasks || []).filter(t => 
      t.status !== 'completed' && 
      !this.isTaskCompleted(t)
    );
    
    let completed = 0;
    let notCompleted = 0;

    allTasks.forEach(task => {
      if (this.isPhaseCompleted(task, phaseKey)) {
        completed++;
      } else {
        notCompleted++;
      }
    });

    return { completed, notCompleted };
  }

  // ========== 任务重新分配 ==========
  
  async reassignTask(task: any, fromEmployeeId: number | null, toEmployeeId: number) {
    if (!task || !toEmployeeId) return;

    try {
      // 找到原员工和新员工
      const fromEmployee = this.vizData.find(e => e.id === fromEmployeeId);
      const toEmployee = this.vizData.find(e => e.id === toEmployeeId);
      
      if (!fromEmployee || !toEmployee) return;

      console.log('任务信息:', task);
      console.log('assignedPhase:', task.assignedPhase);
      
      // 确定任务被分配到的阶段
      let phase = task.assignedPhase;
      if (!phase) {
        // 根据任务状态推断阶段
        if (task.machining_assignee) phase = 'machining';
        else if (task.electrical_assignee) phase = 'electrical';
        else if (task.pre_assembly_assignee) phase = 'pre_assembly';
        else if (task.post_assembly_assignee) phase = 'post_assembly';
        else if (task.debugging_assignee) phase = 'debugging';
      }
      
      console.log('推断的phase:', phase);
      
      // 将中文阶段转换为英文
      const phaseMap: any = {
        '机加': 'machining',
        '电控': 'electrical',
        '预装': 'pre_assembly',
        '总装前段': 'pre_assembly',
        '总装': 'post_assembly',
        '总装后段': 'post_assembly',
        '调试': 'debugging'
      };
      
      // 如果phase是中文，转换为英文
      const englishPhase = phaseMap[phase] || phase;
      
      const assigneeFieldMap: any = {
        'machining': 'machining_assignee',
        'electrical': 'electrical_assignee',
        'pre_assembly': 'pre_assembly_assignee',
        'post_assembly': 'post_assembly_assignee',
        'debugging': 'debugging_assignee'
      };

      const assigneeField = assigneeFieldMap[englishPhase];
      
      if (!assigneeField) {
        console.error('无法确定assignee字段, phase:', phase, 'englishPhase:', englishPhase);
        this.presentToast('无法确定任务阶段');
        return;
      }
      
      // 只更新对应阶段的assignee
      const updateData: any = {
        [assigneeField]: toEmployeeId
      };

      console.log('Sending update request:', {
        url: `${environment.apiBase}/api/tasks/${task.id}`,
        data: updateData
      });
      
      await this.http.put(`${environment.apiBase}/api/tasks/${task.id}`, updateData).toPromise();
      
      this.presentToast('任务重新分配成功');
      
      // 重新加载数据（包括主任务列表和可视化数据）
      await this.loadData();
      await this.loadVizData();
      
    } catch (error: any) {
      console.error('重新分配任务失败:', error);
      console.error('Error details:', error.error);
      this.presentToast('重新分配任务失败: ' + (error.error?.message || error.message || '未知错误'));
    }
  }

  // ========== 工具提示 ==========
  
  getTaskTooltip(task: any): string {
    if (!task) return '';
    
    let tooltip = `任务: ${task.name || task.device_number || ('任务#' + task.id)}\n`;
    tooltip += `优先级: ${this.getPriorityText(task.priority)}\n`;
    
    // 显示被分配的阶段（优先使用 assignedPhase，如果没有则根据 assignee 推断）
    const assignedPhase = this.getAssignedPhase(task);
    if (assignedPhase) {
      tooltip += `被分配阶段: ${assignedPhase}\n`;
    }
    
    // 显示当前阶段
    tooltip += `当前阶段: ${this.getCurrentPhaseDisplay(task) || '未开始'}\n`;
    
    // 添加开工日期和承诺日期
    if (task.production_time) {
      tooltip += `开工日期: ${this.formatDate(task.production_time)}\n`;
    }
    if (task.promised_completion_time) {
      tooltip += `承诺日期: ${this.formatDate(task.promised_completion_time)}\n`;
    }
    
    return tooltip;
  }

  // 获取任务被分配到的阶段
  getAssignedPhase(task: any): string {
    if (!task) return '';
    
    // 优先使用 assignedPhase（可视化数据中的字段）
    if (task.assignedPhase) {
      return task.assignedPhase;
    }
    
    // 根据 assignee 推断被分配的阶段
    const phaseMap: any = {
      'machining': '机加',
      'electrical': '电控',
      'pre_assembly': '总装前段',
      'post_assembly': '总装后段',
      'debugging': '调试'
    };
    
    // 检查各个阶段的 assignee
    if (task.machining_assignee && (task.machining_phase === 0 || task.machining_phase === '0')) {
      return phaseMap['machining'] || '机加';
    }
    if (task.electrical_assignee && (task.electrical_phase === 0 || task.electrical_phase === '0')) {
      return phaseMap['electrical'] || '电控';
    }
    if (task.pre_assembly_assignee && (task.pre_assembly_phase === 0 || task.pre_assembly_phase === '0')) {
      return phaseMap['pre_assembly'] || '总装前段';
    }
    if (task.post_assembly_assignee && (task.post_assembly_phase === 0 || task.post_assembly_phase === '0')) {
      return phaseMap['post_assembly'] || '总装后段';
    }
    if (task.debugging_assignee && (task.debugging_phase === 0 || task.debugging_phase === '0')) {
      return phaseMap['debugging'] || '调试';
    }
    
    return '';
  }
  
  // 格式化日期（仅显示日期部分）
  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('zh-CN');
    } catch {
      return dateStr;
    }
  }

  getPriorityText(priority: string): string {
    return this.isUrgentPriority(priority) ? '紧急' : '非紧急';
  }

  // ========== 任务排序菜单 ==========
  
  async showTaskMenu(task: any, employeeId: number, taskIndex: number) {
    const employee = this.vizData.find(e => e.id === employeeId);
    if (!employee) return;

    const taskCount = employee.tasks.length;
    const buttons: any[] = [];

    // 置顶
    if (taskIndex > 0) {
      buttons.push({
        text: '置顶',
        icon: 'arrow-up-circle-outline',
        handler: () => this.moveTaskToTop(employeeId, taskIndex)
      });
    }

    // 上移
    if (taskIndex > 0) {
      buttons.push({
        text: '上移',
        icon: 'arrow-up-outline',
        handler: () => this.moveTaskUp(employeeId, taskIndex)
      });
    }

    // 下移
    if (taskIndex < taskCount - 1) {
      buttons.push({
        text: '下移',
        icon: 'arrow-down-outline',
        handler: () => this.moveTaskDown(employeeId, taskIndex)
      });
    }

    // 置底
    if (taskIndex < taskCount - 1) {
      buttons.push({
        text: '置底',
        icon: 'arrow-down-circle-outline',
        handler: () => this.moveTaskToBottom(employeeId, taskIndex)
      });
    }

    // 删除任务（可视化界面直接删除）
    buttons.push({
      text: '取消分配',
      role: 'destructive',
      icon: 'remove-circle-outline',
      handler: async () => {
        try {
          // 禁止：当前阶段已开始
          if (this.hasCurrentPhaseStarted(task)) {
            this.presentToast('当前阶段已开始，禁止取消分配');
            return;
          }
          await this.assignTask(task.id, null, task.current_phase || 'machining');
          this.presentToast('已取消分配，任务回到待分配');
          // 后台更新可视化
          try { this.loadVizData && this.loadVizData(); } catch {}
        } catch (e) {
          this.presentToast('取消分配失败');
        }
      }
    });

    // 如果没有可用操作
    if (buttons.length === 0) {
      this.presentToast('任务已在目标位置');
      return;
    }

    // 添加取消按钮
    buttons.push({
      text: '取消',
      role: 'cancel'
    });

    const actionSheet = await this.actionSheetController.create({
      header: `调整任务紧急程度\n${this.getTaskDisplayName(task.name)}`,
      subHeader: `当前位置: ${taskIndex + 1}/${employee.tasks.length}，越靠上越紧急`,
      buttons: buttons
    });

    await actionSheet.present();
  }

  // 已移除“直接删除任务”，改为上方菜单的取消分配
  async moveTaskToTop(employeeId: number, taskIndex: number) {
    const employee = this.vizData.find(e => e.id === employeeId);
    if (!employee || taskIndex <= 0) return;
    
    const task = employee.tasks.splice(taskIndex, 1)[0];
    employee.tasks.unshift(task);
    await this.saveTaskOrder(employee);
    this.presentToast('任务已置顶，已反馈给员工');
  }

  async moveTaskUp(employeeId: number, taskIndex: number) {
    const employee = this.vizData.find(e => e.id === employeeId);
    if (!employee || taskIndex <= 0) return;
    
    const temp = employee.tasks[taskIndex];
    employee.tasks[taskIndex] = employee.tasks[taskIndex - 1];
    employee.tasks[taskIndex - 1] = temp;
    await this.saveTaskOrder(employee);
    this.presentToast('任务已上移，已反馈给员工');
  }

  async moveTaskDown(employeeId: number, taskIndex: number) {
    const employee = this.vizData.find(e => e.id === employeeId);
    if (!employee || taskIndex >= employee.tasks.length - 1) return;
    
    const temp = employee.tasks[taskIndex];
    employee.tasks[taskIndex] = employee.tasks[taskIndex + 1];
    employee.tasks[taskIndex + 1] = temp;
    await this.saveTaskOrder(employee);
    this.presentToast('任务已下移，已反馈给员工');
  }

  async moveTaskToBottom(employeeId: number, taskIndex: number) {
    const employee = this.vizData.find(e => e.id === employeeId);
    if (!employee || taskIndex >= employee.tasks.length - 1) return;
    
    const task = employee.tasks.splice(taskIndex, 1)[0];
    employee.tasks.push(task);
    await this.saveTaskOrder(employee);
    this.presentToast('任务已置底，已反馈给员工');
  }

  async saveTaskOrder(employee: any) {
    try {
      // 为每个任务更新紧急顺序（数字越小越紧急）
      const orderUpdates = employee.tasks.map((task: any, index: number) => {
        // 构造 update data，包括紧急顺序
        const updateData: any = {};

        // 优先根据可视化里的 assignedPhase 决定具体阶段
        const phaseMap: any = {
          '机加': 'machining',
          '电控': 'electrical',
          '总装前段': 'pre_assembly',
          '总装后段': 'post_assembly',
          '调试': 'debugging'
        };

        const phaseKeyFromAssigned = task.assignedPhase ? phaseMap[task.assignedPhase] : null;
        // 如果 assignedPhase 没有匹配到（理论上不应发生），退回到根据负责人推断阶段
        const phase = phaseKeyFromAssigned || this.getTaskPhase(task);

        // 根据阶段设置紧急顺序字段
        const orderField = `${phase}_order`;
        updateData[orderField] = index;

        return this.http.put(`${environment.apiBase}/api/tasks/${task.id}`, updateData).toPromise();
      });
      
      await Promise.all(orderUpdates);
      console.log(`已保存员工 ${employee.name} 的任务排序`);
    } catch (error: any) {
      console.error('保存任务排序失败:', error);
      this.presentToast('保存排序失败');
    }
  }

  getTaskPhase(task: any): string {
    if (task.machining_assignee) return 'machining';
    if (task.electrical_assignee) return 'electrical';
    if (task.pre_assembly_assignee) return 'pre_assembly';
    if (task.post_assembly_assignee) return 'post_assembly';
    if (task.debugging_assignee) return 'debugging';
    return 'machining'; // 默认
  }
  
  // 筛选待分配任务
  filterUnassignedTasks() {
    // 筛选逻辑会在HTML中通过getFilteredUnassignedTasks()方法实现
  }
  
  // 获取筛选后的待分配任务
  // 缓存筛选结果，避免重复计算
  private _cachedFilteredUnassignedTasks: any[] | null = null;
  private _cachedFilterKey: string = '';
  private _cachedDisplayTasks: any[] | null = null;
  private _cachedDisplayTasksKey: string = '';

  // 清除所有缓存
  private clearAllCache() {
    this._cachedFilteredUnassignedTasks = null;
    this._cachedFilterKey = '';
    this._cachedDisplayTasks = null;
    this._cachedDisplayTasksKey = '';
  }

  // 清除待分配任务缓存
  private clearUnassignedTasksCache() {
    this._cachedFilteredUnassignedTasks = null;
    this._cachedFilterKey = '';
  }

  getFilteredUnassignedTasks(): any[] {
    // 生成缓存键
    const filterKey = JSON.stringify(this.unassignedTaskFilters);
    
    // 如果筛选条件没变，直接返回缓存
    if (this._cachedFilteredUnassignedTasks && this._cachedFilterKey === filterKey) {
      return this._cachedFilteredUnassignedTasks;
    }

    // 动态从全量 tasks 计算，避免缓存滞后
    const result = (this.tasks || []).filter(task => {
      // 排除已完成任务
      if (task.status === 'completed') return false;

      // 特殊处理：如果筛选总装前段，机加已派工但总装前段未分配的任务应该显示
      if (this.unassignedTaskFilters.phase === 'pre_assembly') {
        // 如果总装前段已分配，直接排除
        if (task.pre_assembly_assignee) return false;
        const machiningAssigned = task.machining_assignee != null && 
                                 task.machining_assignee !== '' && 
                                 task.machining_assignee !== 0;
        const machiningCompleted = task.machining_phase === 1 || task.machining_phase === '1';
        if ((machiningAssigned || machiningCompleted) && task.pre_assembly_phase === 0) {
          // 这个任务应该显示，继续后续筛选
        } else {
          // 其他情况，使用原有逻辑
          const phase = this.getEffectivePhase(task);
          const assignee = this.getAssigneeByPhase(task, phase);
          if (assignee) return false;
        }
      } else if (this.unassignedTaskFilters.phase === 'post_assembly') {
        // 特殊处理：如果筛选总装后段，总装前段已派工但总装后段未分配的任务应该显示
        if (task.post_assembly_assignee) return false;
        const preAssemblyAssigned = task.pre_assembly_assignee != null && 
                                   task.pre_assembly_assignee !== '' && 
                                   task.pre_assembly_assignee !== 0;
        const preAssemblyCompleted = task.pre_assembly_phase === 1 || task.pre_assembly_phase === '1';
        if ((preAssemblyAssigned || preAssemblyCompleted) && task.post_assembly_phase === 0) {
          // 这个任务应该显示，继续后续筛选
        } else {
          // 其他情况，使用原有逻辑
          const phase = this.getEffectivePhase(task);
          const assignee = this.getAssigneeByPhase(task, phase);
          if (assignee) return false;
        }
      } else if (this.unassignedTaskFilters.phase === 'debugging') {
        // 特殊处理：如果筛选调试阶段，总装后段已派工但调试未分配的任务应该显示
        // 如果调试已分配，直接排除
        if (task.debugging_assignee) return false;
        // 总装后段已派工：post_assembly_assignee 不为空 或 post_assembly_phase === 1
        const postAssemblyAssigned = task.post_assembly_assignee != null && 
                                     task.post_assembly_assignee !== '' && 
                                     task.post_assembly_assignee !== 0;
        const postAssemblyCompleted = task.post_assembly_phase === 1 || task.post_assembly_phase === '1';
        if ((postAssemblyAssigned || postAssemblyCompleted) && task.debugging_phase === 0) {
          // 这个任务应该显示，继续后续筛选
        } else {
          // 其他情况，使用原有逻辑
          const phase = this.getEffectivePhase(task);
          const assignee = this.getAssigneeByPhase(task, phase);
          if (assignee) return false;
        }
      } else {
      // 统一口径：当前有效阶段负责人为空才算待分配
      const phase = this.getEffectivePhase(task);
      const assignee = this.getAssigneeByPhase(task, phase);
      if (assignee) return false;
      }

      // 按设备号筛选
      if (this.unassignedTaskFilters.deviceNumber) {
        if (!task.device_number || !task.device_number.toLowerCase().includes(this.unassignedTaskFilters.deviceNumber.toLowerCase())) {
          return false;
        }
      }
      
      // 按型号筛选
      if (this.unassignedTaskFilters.productModel) {
        if (!task.product_model || !task.product_model.toLowerCase().includes(this.unassignedTaskFilters.productModel.toLowerCase())) {
          return false;
        }
      }
      
      if (this.unassignedTaskFilters.productionDateEnd) {
        if (!task.production_time || task.production_time > this.unassignedTaskFilters.productionDateEnd) {
          return false;
        }
      }
      
      // 按阶段筛选：
      // - 机加/电控：只要该阶段未完成（*_phase===0）即可显示（允许作为初始阶段并行起步）
      // - 总装前段：机加阶段已派工（已分配或已完成）且总装前段未分配且未完成
      // - 总装后段：总装前段已派工（已分配或已完成）且总装后段未分配且未完成
      // - 调试阶段：总装后段已派工（已分配或已完成）且调试未分配且未完成
      // - 其他阶段：保持仅当 current_phase 等于所选阶段
      if (this.unassignedTaskFilters.phase) {
        const p = this.unassignedTaskFilters.phase;
        if (p === 'machining') {
          if (task.machining_phase !== 0) return false;
        } else if (p === 'electrical') {
          if (task.electrical_phase !== 0) return false;
        } else if (p === 'pre_assembly') {
          // 总装前段：机加阶段已派工（已分配或已完成）且总装前段未分配且未完成
          // 机加阶段已派工：machining_assignee 不为空 或 machining_phase === 1
          const machiningAssigned = task.machining_assignee || task.machining_phase === 1;
          if (!machiningAssigned) return false;
          // 如果总装前段已分配，则不在待派工列表中（这是关键检查）
          if (task.pre_assembly_assignee) return false;
          if (task.pre_assembly_phase !== 0) return false; // 已完成则不在待派工列表中
        } else if (p === 'post_assembly') {
          // 总装后段：总装前段已派工（已分配或已完成）且总装后段未分配且未完成
          // 总装前段已派工：pre_assembly_assignee 不为空 或 pre_assembly_phase === 1
          const preAssemblyAssigned = task.pre_assembly_assignee != null && 
                                      task.pre_assembly_assignee !== '' && 
                                      task.pre_assembly_assignee !== 0;
          const preAssemblyCompleted = task.pre_assembly_phase === 1 || task.pre_assembly_phase === '1';
          if (!preAssemblyAssigned && !preAssemblyCompleted) return false;
          if (task.post_assembly_assignee) return false; // 已分配则不在待派工列表中
          if (task.post_assembly_phase !== 0) return false; // 已完成则不在待派工列表中
        } else if (p === 'debugging') {
          // 调试阶段：总装后段已派工（已分配或已完成）且调试未分配且未完成
          // 总装后段已派工：post_assembly_assignee 不为空 或 post_assembly_phase === 1
          const postAssemblyAssigned = task.post_assembly_assignee != null && 
                                      task.post_assembly_assignee !== '' && 
                                      task.post_assembly_assignee !== 0;
          const postAssemblyCompleted = task.post_assembly_phase === 1 || task.post_assembly_phase === '1';
          if (!postAssemblyAssigned && !postAssemblyCompleted) return false;
          if (task.debugging_assignee) return false; // 已分配则不在待派工列表中
          if (task.debugging_phase !== 0) return false; // 已完成则不在待派工列表中
        } else {
          if (task.current_phase !== p) return false;
        }
      }
      
      return true;
    });

    // 更新缓存
    this._cachedFilteredUnassignedTasks = result;
    this._cachedFilterKey = filterKey;
    
    return result;
  }
  
  // 从待分配任务区拖动分配
  onDragStartFromUnassigned(event: DragEvent, task: any) {
    this.isDragging = true;
    this.draggedTask = task;
    this.draggedTaskEmployee = null; // 从未分配区拖动的标记
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('text/plain', task.id.toString());
  }
  
  // 拖动未分配任务到员工
  async onDropUnassignedTask(event: DragEvent, targetEmployeeId: number) {
    event.preventDefault();
    event.stopPropagation();
    
    if (!this.draggedTask || this.draggedTaskEmployee !== null) {
      this.onDragEnd(event);
      return;
    }
    
    // 直接弹出阶段选择
    await this.choosePhaseAndAssign(this.draggedTask, targetEmployeeId);
    
    this.onDragEnd(event);
  }
  
  // 分配待分配任务给员工（乐观更新，不触发全量刷新）
  async assignTaskFromUnassigned(task: any, employeeId: number, phase?: string) {
      // 使用用户选择或系统推断的阶段
    // 如果明确传递了 phase 参数，使用它；否则根据任务状态推断（仅用于机加和电控）
    const phaseToAssign = phase !== undefined && phase !== null && phase !== '' 
      ? phase 
      : (task.machining_phase === 0 ? 'machining' : (task.electrical_phase === 0 ? 'electrical' : undefined));
    
    // 调试信息：记录分配阶段
    console.log('assignTaskFromUnassigned 调用:', {
      taskId: task.id,
      taskName: task.name,
      employeeId,
      phase参数: phase,
      phaseToAssign,
      unassignedTaskFilters_phase: this.unassignedTaskFilters.phase,
      machining_phase: task.machining_phase,
      electrical_phase: task.electrical_phase,
      pre_assembly_phase: task.pre_assembly_phase
    });
    
    try {
      if (!phaseToAssign) {
        this.presentToast('没有可分配的阶段');
        return;
      }

      // 确认分配信息
      const employeeName = this.getEmployeeName(employeeId) || '目标员工';
      const phaseName = this.getPhaseName(phaseToAssign);
      const taskName = task.device_number || this.getTaskDisplayName(task.name);
      const confirmMessage = `确定要将任务「${taskName}」的「${phaseName}」阶段分配给「${employeeName}」吗？`;
      const confirmed = confirm(confirmMessage);
      if (!confirmed) {
        return;
      }

      const result: any = await this.assignTask(task.id, employeeId, phaseToAssign);
      
      // 检查分配是否真的成功
      if (result && result.success === false) {
        this.presentToast('任务分配失败: ' + (result.error || result.message || '未知错误'));
        return;
      }
      
      this.presentToast('任务分配成功');
      // assignTask 内部会调用 loadData() 和 loadVizData()
      // 但为了确保待派工列表正确更新，我们再次刷新可视化数据
      // 因为 getFilteredUnassignedTasks() 是从 this.tasks 动态计算的
      setTimeout(async () => {
        if (this.loadVizData) {
          await this.loadVizData();
        }
      }, 500);
    } catch (error: any) {
      console.error('分配任务失败:', error);
      const errorMessage = error.error?.error || error.error?.message || error.message || '未知错误';
      console.error('详细错误信息:', {
        error,
        errorMessage,
        taskId: task.id,
        employeeId,
        phase: phaseToAssign
      });
      this.presentToast('分配任务失败: ' + errorMessage);
    }
  }

  // 弹出选择机加/电控，再派工
  private async choosePhaseAndAssign(task: any, employeeId: number) {
    try {
      // 调试信息：记录筛选条件和任务状态
      console.log('choosePhaseAndAssign 调用:', {
        taskId: task.id,
        taskName: task.name,
        employeeId,
        unassignedTaskFilters_phase: this.unassignedTaskFilters.phase,
        pre_assembly_phase: task.pre_assembly_phase,
        pre_assembly_assignee: task.pre_assembly_assignee
      });
      
      // 如果筛选条件是机加阶段，直接分配机加阶段
      if (this.unassignedTaskFilters.phase === 'machining') {
        if (task.machining_phase === 0 && !task.machining_assignee) {
          await this.assignTaskFromUnassigned(task, employeeId, 'machining');
        } else {
          this.presentToast('机加阶段已完成或已分配，无法分配');
        }
        return;
      }

      // 如果筛选条件是电控阶段，直接分配电控阶段
      if (this.unassignedTaskFilters.phase === 'electrical') {
        if (task.electrical_phase === 0 && !task.electrical_assignee) {
          await this.assignTaskFromUnassigned(task, employeeId, 'electrical');
        } else {
          this.presentToast('电控阶段已完成或已分配，无法分配');
        }
        return;
      }

      // 如果筛选条件是总装前段，直接分配总装前段
      if (this.unassignedTaskFilters.phase === 'pre_assembly') {
        if (task.pre_assembly_phase === 0 && !task.pre_assembly_assignee) {
          console.log('准备分配总装前段，调用 assignTaskFromUnassigned 并传递 phase="pre_assembly"');
          await this.assignTaskFromUnassigned(task, employeeId, 'pre_assembly');
        } else {
          this.presentToast('总装前段已完成或已分配，无法分配');
        }
        return;
      }
      
      // 如果筛选条件是总装后段，直接分配总装后段
      if (this.unassignedTaskFilters.phase === 'post_assembly') {
        if (task.post_assembly_phase === 0 && !task.post_assembly_assignee) {
          await this.assignTaskFromUnassigned(task, employeeId, 'post_assembly');
        } else {
          this.presentToast('总装后段已完成或已分配，无法分配');
        }
        return;
      }
      
      // 如果筛选条件是调试，直接分配调试
      if (this.unassignedTaskFilters.phase === 'debugging') {
        if (task.debugging_phase === 0 && !task.debugging_assignee) {
          await this.assignTaskFromUnassigned(task, employeeId, 'debugging');
        } else {
          this.presentToast('调试阶段已完成或已分配，无法分配');
        }
        return;
      }
      
      // 其他情况，弹出选择对话框（机加和电控）
      const actionSheet = await this.actionSheetController.create({
        header: '选择分配阶段',
        buttons: [
          {
            text: '机加阶段',
            icon: 'build',
            handler: async () => {
              if (task.machining_phase === 0) {
                await this.assignTaskFromUnassigned(task, employeeId, 'machining');
              } else {
                this.presentToast('机加已完成，无法分配');
              }
            }
          },
          {
            text: '电控阶段',
            icon: 'flash',
            handler: async () => {
              if (task.electrical_phase === 0) {
                await this.assignTaskFromUnassigned(task, employeeId, 'electrical');
              } else {
                this.presentToast('电控已完成，无法分配');
              }
            }
          },
          { text: '取消', role: 'cancel' }
        ]
      });
      await actionSheet.present();
    } catch (e) {
      // Fallback：某些环境下 overlay 创建失败，退回 prompt 选择
      let input: string | null = null;
      try { input = prompt('请选择阶段: 输入 "1" 机加 / "2" 电控', '1'); } catch {}
      if (input === '1') {
        if (task.machining_phase === 0) {
          await this.assignTaskFromUnassigned(task, employeeId, 'machining');
        } else {
          this.presentToast('机加已完成，无法分配');
        }
      } else if (input === '2') {
        if (task.electrical_phase === 0) {
          await this.assignTaskFromUnassigned(task, employeeId, 'electrical');
        } else {
          this.presentToast('电控已完成，无法分配');
        }
      }
    }
  }

  // 回滚后不再弹出阶段选择面板

  // ========== 协助人员管理方法 ==========

  // 打开指定协助人员模态框
  async openAssignAssistantModal(task: any) {
    this.selectedTaskForAssist = task;
    
    // 不设置默认阶段，让用户自己选择
    this.selectedPhaseForAssist = '';
    
    this.selectedAssistantUserIds = [];
    this.assistantSearchKeyword = '';
    this.assistantTimes = {};
    this.assignAssistantManagerId = this.managerUsers[0]?.id || null;
    
    // 设置默认时间为当前年月的第一天 00:00（年月有默认值，日、时、分用户手动填写）
    const currentDateTime = this.getCurrentDateTime();
    this.unifiedAssistStart = currentDateTime;
    this.unifiedAssistEnd = currentDateTime;
    
    // 初始化确认协助时间相关字段
    this.confirmAssistUserId = null;
    this.confirmAssistStart = currentDateTime;
    this.confirmAssistEnd = currentDateTime;
    this.confirmAssistManagerId = this.managerUsers[0]?.id || null;
    
    // 不自动加载协助人员列表，等用户选择阶段后再加载
    this.assistants = [];
    
    this.isAssignAssistantModalOpen = true;
  }

  // 当协助阶段改变时
  async onAssistPhaseChange() {
    if (!this.selectedTaskForAssist || !this.selectedPhaseForAssist) {
      return;
    }
    
    // 重新加载协助人员列表
    await this.loadAssistants(this.selectedTaskForAssist.id, this.selectedPhaseForAssist);
    
    // 重置协助人员选择和时间
    this.selectedAssistantUserIds = [];
    this.assistantTimes = {};
    this.assignAssistantManagerId = this.managerUsers[0]?.id || null;
    this.unifiedAssistStart = null;
    this.unifiedAssistEnd = null;
    
    // 更新确认协助时间相关字段
    if (this.assistants.length > 0) {
      const firstAssistant = this.assistants[0];
      this.confirmAssistUserId = (firstAssistant.user_id || firstAssistant.id || null) as number | 'ALL' | null;
      this.confirmAssistStart = firstAssistant?.assist_start || null;
      this.confirmAssistEnd = firstAssistant?.assist_end || null;
    } else {
      this.confirmAssistUserId = null;
      this.confirmAssistStart = null;
      this.confirmAssistEnd = null;
    }
  }

  // 关闭指定协助人员模态框
  closeAssignAssistantModal() {
    this.isAssignAssistantModalOpen = false;
    this.selectedTaskForAssist = null;
    this.selectedPhaseForAssist = '';
    this.assistants = [];
    this.selectedAssistantUserIds = [];
    this.assistantSearchKeyword = '';
    this.assistantTimes = {};
    this.assignAssistantManagerId = null;
    this.unifiedAssistStart = null;
    this.unifiedAssistEnd = null;
    // 清除确认协助时间相关字段
    this.confirmAssistUserId = null;
    this.confirmAssistStart = null;
    this.confirmAssistEnd = null;
    this.confirmAssistManagerId = null;
  }

  // 加载协助人员列表
  async loadAssistants(taskId: number, phaseKey: string) {
    try {
      this.assistants = await this.http.get<any[]>(
        `${environment.apiBase}/api/tasks/${taskId}/phases/${phaseKey}/assistants`
      ).toPromise() || [];
    } catch (error) {
      console.error('加载协助人员列表失败:', error);
      this.assistants = [];
    }
  }

  // 指定协助人员
  async confirmAssignAssistant() {
    if (!this.selectedTaskForAssist || !this.selectedPhaseForAssist || this.selectedAssistantUserIds.length === 0) {
      this.presentToast('请选择协助人员');
      return;
    }
    
    try {
      for (const userId of this.selectedAssistantUserIds) {
        const times = this.assistantTimes[userId] || { start: null, end: null };
        
        // 先指定协助人员
        await this.http.post(
          `${environment.apiBase}/api/tasks/${this.selectedTaskForAssist.id}/phases/${this.selectedPhaseForAssist}/assign-assistant`,
          {
            assistantUserId: userId,
            assistStart: times.start,
            assistEnd: times.end
          }
        ).toPromise();
        
        // 如果有时间和经理，提交审批申请
        if (times.start && times.end && this.assignAssistantManagerId && this.currentUser?.id) {
          await this.http.post(
            `${environment.apiBase}/api/assist-approvals`,
            {
              taskId: this.selectedTaskForAssist.id,
              phaseKey: this.selectedPhaseForAssist,
              assistantUserId: userId,
              assistStart: times.start,
              assistEnd: times.end,
              managerId: this.assignAssistantManagerId,
              requestedBy: this.currentUser.id
            }
          ).toPromise();
        }
      }
      
      this.presentToast('协助人员指定成功（协助人员仅帮助工作，不参与报工和完成）');
      await this.loadAssistants(this.selectedTaskForAssist.id, this.selectedPhaseForAssist);
      await this.loadData(); // 刷新任务列表
      
      // 关闭模态框
      this.closeAssignAssistantModal();
    } catch (error: any) {
      this.presentToast('指定失败：' + (error.error?.error || error.message));
    }
  }

  // 获取协助人员的时间
  getAssistantTime(userId: number, field: 'start' | 'end'): string | null {
    const time = this.assistantTimes[userId]?.[field];
    // 如果时间为空，返回当前年月的第一天 00:00（年月有默认值，日、时、分用户手动填写）
    return time || this.getCurrentDateTime();
  }

  // 设置协助人员的时间
  setAssistantTime(userId: number, field: 'start' | 'end', value: string | null) {
    if (!this.assistantTimes[userId]) {
      this.assistantTimes[userId] = { start: null, end: null };
    }
    this.assistantTimes[userId][field] = value;
  }

  // 统一设置所有协助人员的时间
  applyUnifiedTime() {
    if (!this.unifiedAssistStart || !this.unifiedAssistEnd) {
      this.presentToast('请先填写统一时间');
      return;
    }
    
    for (const userId of this.selectedAssistantUserIds) {
      if (!this.assistantTimes[userId]) {
        this.assistantTimes[userId] = { start: null, end: null };
      }
      this.assistantTimes[userId].start = this.unifiedAssistStart;
      this.assistantTimes[userId].end = this.unifiedAssistEnd;
    }
    this.presentToast('已为所有协助人员设置统一时间');
  }

  // 取消协助人员
  async removeAssistant(task: any, assistantUserId: number, phaseKey?: string) {
    let resolvedPhase = phaseKey;
    if (!resolvedPhase) {
      const phase = this.getEffectivePhase(task);
      if (!phase) return;
      resolvedPhase = Array.isArray(phase) ? phase[0] : phase;
    }
    
    try {
      await this.http.delete(
        `${environment.apiBase}/api/tasks/${task.id}/phases/${resolvedPhase}/assistants/${assistantUserId}`
      ).toPromise();
      
      this.presentToast('协助人员已取消');
      await this.loadAssistants(task.id, resolvedPhase);
      await this.loadData();
    } catch (error: any) {
      this.presentToast('取消失败：' + (error.error?.error || error.message));
    }
  }

  // 获取任务的协助人员列表
  getAssistants(task: any): any[] {
    return task.assistants || [];
  }

  // 获取阶段的协助人员列表
  getPhaseAssistants(task: any, phaseKey: string | undefined): any[] {
    if (!phaseKey) return [];
    return (task.assistants || []).filter((assistant: any) => {
      const assistPhase = assistant.assist_phase || assistant.phase || assistant.phase_key;
      return assistPhase === phaseKey;
    });
  }

  // 判断是否可以管理协助人员（只有主管可以）
  canManageAssistants(task: any): boolean {
    return this.canImportTasks; // 使用现有的权限检查
  }

  // 获取可用的协助人员列表（排除负责人）
  getAvailableAssistantUsers(task: any, phaseKey?: string): any[] {
    if (!task) return [];

    let resolvedPhase = phaseKey;
    if (!resolvedPhase) {
      const phase = this.getEffectivePhase(task);
      if (!phase) return [];
      resolvedPhase = Array.isArray(phase) ? phase[0] : phase;
    }

    const assigneeField = `${resolvedPhase}_assignee`;
    const assigneeId = task[assigneeField];
    
    // 排除负责人和已经是协助人员的人员
    const existingAssistantIds = this.getPhaseAssistants(task, resolvedPhase).map((a: any) => a.id);
    
    return this.users.filter(user => 
      user.role === 'worker' && 
      user.id !== assigneeId && 
      !existingAssistantIds.includes(user.id)
    );
  }

  getFilteredAssistantUsers(task: any, phaseKey?: string): any[] {
    const available = this.getAvailableAssistantUsers(task, phaseKey);
    
    // 阶段与部门的映射关系
    const phaseDepartmentMap: Record<string, string> = {
      'machining': '机加',
      'electrical': '电控',
      'pre_assembly': '总装前段',
      'post_assembly': '总装后段',
      'debugging': '调试'
    };
    
    // 如果有搜索关键词，先进行搜索筛选
    let filtered = available;
    if (this.assistantSearchKeyword) {
      const keyword = this.assistantSearchKeyword.toLowerCase();
      filtered = available.filter(user =>
        (user.name && user.name.toLowerCase().includes(keyword)) ||
        (user.department && user.department.toLowerCase().includes(keyword)) ||
        (user.user_group && user.user_group.toLowerCase().includes(keyword))
      );
    }
    
    // 如果选择了阶段，优先显示该阶段对应部门的人员
    if (phaseKey && phaseDepartmentMap[phaseKey]) {
      const targetDepartment = phaseDepartmentMap[phaseKey];
      const phaseUsers: any[] = [];
      const otherUsers: any[] = [];
      
      filtered.forEach(user => {
        if (user.department === targetDepartment) {
          phaseUsers.push(user);
        } else {
          otherUsers.push(user);
        }
      });
      
      // 返回：该阶段部门的人员在前，其他人员在后
      return [...phaseUsers, ...otherUsers];
    }
    
    return filtered;
  }

  getAssistantName(userId: number | null): string {
    if (!userId) return '';
    const user = this.users.find(u => u.id === userId);
    return user?.name || '';
  }

  getAssistantNames(userIds: number[]): string[] {
    return (userIds || []).map(id => this.getAssistantName(id)).filter(name => !!name);
  }

  getAssistantNamesForPhase(task: any, phaseKey: string): string[] {
    if (!task || !phaseKey) return [];
    return this.getPhaseAssistants(task, phaseKey).map((assistant: any) => assistant.name || assistant.user_name || `用户#${assistant.id}`);
  }

  toggleAssistantSelection(userId: number) {
    if (this.selectedAssistantUserIds.includes(userId)) {
      this.selectedAssistantUserIds = this.selectedAssistantUserIds.filter(id => id !== userId);
    } else {
      this.selectedAssistantUserIds = [...this.selectedAssistantUserIds, userId];
      // 当选择协助人员时，如果时间未设置，初始化默认时间为当前年月的第一天 00:00（年月有默认值，日、时、分用户手动填写）
      if (!this.assistantTimes[userId]) {
        const currentDateTime = this.getCurrentDateTime();
        this.assistantTimes[userId] = {
          start: currentDateTime,
          end: currentDateTime
        };
      }
    }
  }

  onConfirmAssistUserChange() {
    // 在协助模态框中使用 selectedTaskForAssist 和 selectedPhaseForAssist
    const task = this.selectedTaskForAssist;
    const phase = this.selectedPhaseForAssist;
    
    if (!task || !phase || !this.confirmAssistUserId) return;
    if (this.confirmAssistUserId === 'ALL') {
      this.confirmAssistStart = null;
      this.confirmAssistEnd = null;
      return;
    }
    const assistant = this.getPhaseAssistants(task, phase)
      .find(a => (a.user_id || a.id) === this.confirmAssistUserId);
    this.confirmAssistStart = assistant?.assist_start || null;
    this.confirmAssistEnd = assistant?.assist_end || null;
  }

  async submitConfirmAssistTime() {
    // 在协助模态框中使用 selectedTaskForAssist 和 selectedPhaseForAssist
    const task = this.selectedTaskForAssist;
    const phase = this.selectedPhaseForAssist;
    
    if (!task || !phase || !this.confirmAssistStart || !this.confirmAssistEnd || !this.confirmAssistManagerId) {
      this.presentToast('请完整填写协助时间及审批经理');
      return;
    }
    if (!this.currentUser?.id) {
      this.presentToast('未获取到当前用户信息，无法提交审批');
      return;
    }

    let targetAssistantIds: number[] = [];
    if (this.confirmAssistUserId === 'ALL') {
      const assistants = this.getPhaseAssistants(task, phase);
      targetAssistantIds = assistants
        .map(a => (a.user_id ?? a.id) as number | undefined)
        .filter((id): id is number => !!id);
    } else if (typeof this.confirmAssistUserId === 'number') {
      targetAssistantIds = [this.confirmAssistUserId];
    }

    if (targetAssistantIds.length === 0) {
      this.presentToast('请选择协助人员');
      return;
    }

    try {
      for (const assistantId of targetAssistantIds) {
        await this.http.post(
          `${environment.apiBase}/api/assist-approvals`,
          {
            taskId: task.id,
            phaseKey: phase,
            assistantUserId: assistantId,
            assistStart: this.confirmAssistStart,
            assistEnd: this.confirmAssistEnd,
            managerId: this.confirmAssistManagerId,
            requestedBy: this.currentUser.id
          }
        ).toPromise();
      }
      this.presentToast('协助时间已提交，等待经理审批');
      
      // 重新加载协助人员列表并更新确认协助时间字段
      if (this.isAssignAssistantModalOpen && this.selectedTaskForAssist && this.selectedPhaseForAssist) {
        await this.loadAssistants(this.selectedTaskForAssist.id, this.selectedPhaseForAssist);
        // 更新确认协助时间的用户选择
        if (this.assistants.length > 0) {
          const firstAssistant = this.assistants[0];
          this.confirmAssistUserId = (firstAssistant.user_id || firstAssistant.id || null) as number | 'ALL' | null;
          this.confirmAssistStart = firstAssistant?.assist_start || null;
          this.confirmAssistEnd = firstAssistant?.assist_end || null;
        }
      }
    } catch (error: any) {
      this.presentToast('提交失败：' + (error.error?.error || error.message));
    }
  }


  getAssistantDisplayNames(task: any): string {
    if (!task || !task.assistants || !task.assistants.length) return '';
    return task.assistants
      .map((assistant: any) => assistant.name || assistant.user_name || `用户#${assistant.id}`)
      .join('、');
  }

  // 导出Excel表格
  exportToExcel() {
    try {
      const tasks = this.getDisplayTasks();
      
      if (tasks.length === 0) {
        this.presentToast('没有可导出的任务数据');
        return;
      }

      // 获取可见的列
      const visibleColumns = this.columnVisibilityOptions.filter(col => this.tableColumnVisibility[col.key]);
      
      // 构建表头
      const headers: string[] = [];
      visibleColumns.forEach(col => {
        headers.push(col.label);
      });

      // 构建数据行
      const data: any[][] = [headers];
      
      tasks.forEach((task, index) => {
        const row: any[] = [];
        
        visibleColumns.forEach(col => {
          let value = '';
          
          switch (col.key) {
            case 'index':
              value = String(index + 1);
              break;
            case 'device':
              value = task.device_number || `任务#${task.id}`;
              break;
            case 'model':
              value = task.product_model || '-';
              break;
            case 'priority':
              value = this.getPriorityText(task.priority);
              break;
            case 'status':
              value = task.status === 'pending' ? '待处理' : task.status === 'completed' ? '已完成' : '已取消';
              break;
            case 'currentPhase':
              value = task._currentPhaseDisplay || this.getCurrentPhaseDisplay(task);
              break;
            case 'productionTime':
              value = task.production_time ? new Date(task.production_time).toLocaleDateString('zh-CN') : '-';
              break;
            case 'promisedTime':
              value = task.promised_completion_time ? new Date(task.promised_completion_time).toLocaleDateString('zh-CN') : '-';
              break;
            case 'progress':
              value = `${task._progressPercent !== undefined ? task._progressPercent : this.getTaskProgressPercent(task)}%`;
              break;
            case 'machining':
              const machiningCompleted = this.isPhaseCompleted(task, 'machining') ? '✓' : '';
              const machiningAssignee = this.getPhaseAssigneeName(task, 'machining') || '';
              const machiningAssistants = this.getAssistantNamesForPhase(task, 'machining');
              value = `${machiningCompleted} ${machiningAssignee}${machiningAssistants.length > 0 ? ' 协助：' + machiningAssistants.join('、') : ''}`.trim();
              break;
            case 'electrical':
              const electricalCompleted = this.isPhaseCompleted(task, 'electrical') ? '✓' : '';
              const electricalAssignee = this.getPhaseAssigneeName(task, 'electrical') || '';
              const electricalAssistants = this.getAssistantNamesForPhase(task, 'electrical');
              value = `${electricalCompleted} ${electricalAssignee}${electricalAssistants.length > 0 ? ' 协助：' + electricalAssistants.join('、') : ''}`.trim();
              break;
            case 'pre_assembly':
              const preAssemblyCompleted = this.isPhaseCompleted(task, 'pre_assembly') ? '✓' : '';
              const preAssemblyAssignee = this.getPhaseAssigneeName(task, 'pre_assembly') || '';
              const preAssemblyAssistants = this.getAssistantNamesForPhase(task, 'pre_assembly');
              value = `${preAssemblyCompleted} ${preAssemblyAssignee}${preAssemblyAssistants.length > 0 ? ' 协助：' + preAssemblyAssistants.join('、') : ''}`.trim();
              break;
            case 'post_assembly':
              const postAssemblyCompleted = this.isPhaseCompleted(task, 'post_assembly') ? '✓' : '';
              const postAssemblyAssignee = this.getPhaseAssigneeName(task, 'post_assembly') || '';
              const postAssemblyAssistants = this.getAssistantNamesForPhase(task, 'post_assembly');
              value = `${postAssemblyCompleted} ${postAssemblyAssignee}${postAssemblyAssistants.length > 0 ? ' 协助：' + postAssemblyAssistants.join('、') : ''}`.trim();
              break;
            case 'debugging':
              const debuggingCompleted = this.isPhaseCompleted(task, 'debugging') ? '✓' : '';
              const debuggingAssignee = this.getPhaseAssigneeName(task, 'debugging') || '';
              const debuggingAssistants = this.getAssistantNamesForPhase(task, 'debugging');
              value = `${debuggingCompleted} ${debuggingAssignee}${debuggingAssistants.length > 0 ? ' 协助：' + debuggingAssistants.join('、') : ''}`.trim();
              break;
            default:
              value = '-';
          }
          
          row.push(value);
        });
        
        data.push(row);
      });

      // 创建工作簿和工作表
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '任务列表');

      // 设置列宽
      const colWidths = visibleColumns.map(col => {
        if (col.key === 'index') return { wch: 8 };
        if (col.key === 'device') return { wch: 15 };
        if (col.key === 'model') return { wch: 20 };
        if (col.key === 'priority') return { wch: 10 };
        if (col.key === 'status') return { wch: 10 };
        if (col.key === 'currentPhase') return { wch: 12 };
        if (col.key === 'productionTime' || col.key === 'promisedTime') return { wch: 12 };
        if (col.key === 'progress') return { wch: 10 };
        if (['machining', 'electrical', 'pre_assembly', 'post_assembly', 'debugging'].includes(col.key)) return { wch: 25 };
        return { wch: 15 };
      });
      ws['!cols'] = colWidths;

      // 生成文件名（包含当前日期）
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
      const filename = `任务列表_${dateStr}.xlsx`;

      // 导出文件
      XLSX.writeFile(wb, filename);
      
      this.presentToast(`成功导出 ${tasks.length} 条任务数据`);
    } catch (error: any) {
      console.error('导出Excel失败:', error);
      this.presentToast('导出失败：' + (error.message || '未知错误'));
    }
  }

  // 获取当前年月日期的方法（格式：YYYY-MM-DD，使用当前年月的第一天）
  getCurrentYearMonthDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  }

  // 获取当前日期时间的方法（格式：YYYY-MM-DDTHH:mm，用于 datetime-local）
  // 默认只设置年月，日为01，时间为00:00
  getCurrentDateTime(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01T00:00`;
  }
}



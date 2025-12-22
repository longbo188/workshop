import { Component, OnInit, inject } from '@angular/core';
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
  IonButton,
  IonButtons,
  IonIcon,
  IonBadge,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonModal,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonAlert,
  IonBackButton,
  IonInput,
  IonNote
} from '@ionic/angular/standalone';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Capacitor } from '@capacitor/core';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-exception-approval',
  templateUrl: './exception-approval.page.html',
  styleUrls: ['./exception-approval.page.scss'],
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
    IonButton,
    IonButtons,
    IonIcon,
    IonBadge,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonModal,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonAlert,
    IonBackButton,
    IonInput,
    IonNote,
    CommonModule,
    FormsModule
  ]
})
export class ExceptionApprovalPage implements OnInit {
  exceptionReports: any[] = [];
  allExceptionReports: any[] = []; // 保存所有报告，用于筛选
  isLoading: boolean = true;
  errorMsg: string = '';
  currentUser: any = null;

  // 筛选条件
  filterStatus: string = ''; // 默认根据用户角色自动设置
  filterType: string = '';
  exportStartDate: string = ''; // 导出用开始日期
  exportEndDate: string = '';   // 导出用结束日期

  // 审批模态框相关
  isApprovalModalOpen: boolean = false;
  selectedReport: any = null;
  approvalAction: string = 'approve'; // 'approve' or 'reject'
  approvalNote: string = '';
  
  // 主管修改异常信息相关（仅一级审批时可用）
  modifiedExceptionType: string = '';
  modifiedDescription: string = '';
  modifiedStartDateTime: string = '';
  modifiedEndDateTime: string = '';
  canModify: boolean = false; // 是否可以修改（只有supervisor/admin在一级审批时可以修改）
  
  // 二级审批人选择相关（仅一级审批批准时可用）
  approvers: any[] = []; // manager角色的用户列表
  selectedSecondApproverId: number | null = null; // 选中的二级审批人ID
  
  // 图片查看相关
  isImageViewModalOpen: boolean = false;
  selectedImageUrl: string = '';

  private http = inject(HttpClient);
  private router = inject(Router);

  ngOnInit() {
    // 获取当前用户信息
    const userStr = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (userStr) {
      this.currentUser = JSON.parse(userStr);
    }

    // 检查权限
    if (!this.currentUser || (this.currentUser.role !== 'admin' && this.currentUser.role !== 'supervisor' && this.currentUser.role !== 'manager' && this.currentUser.role !== 'staff')) {
      this.router.navigate(['/home']);
      return;
    }

    // 根据用户角色设置默认筛选状态
    if (this.currentUser.role === 'manager') {
      this.filterStatus = 'pending_second_approval';
    } else if (this.currentUser.role === 'staff') {
      this.filterStatus = 'pending_staff_confirmation';
    } else {
      this.filterStatus = 'pending';
    }

    this.loadExceptionReports();
  }

  // 加载异常报告列表
  async loadExceptionReports() {
    this.isLoading = true;
    this.errorMsg = '';

    try {
      let response: any;
      
      // 根据筛选状态决定加载哪些数据
      // Staff角色：使用all API，因为需要显示待确认和已确认两种状态
      // 其他角色：如果筛选的是待审批状态（pending、pending_second_approval），使用pending API；否则使用all API
      const approverId = this.currentUser?.id;
      if (!approverId) {
        this.errorMsg = '未获取到当前用户信息';
        this.isLoading = false;
        return;
      }
      
      if (this.currentUser?.role === 'staff') {
        // Staff角色：使用all API，因为需要显示待确认和已确认
        response = await this.http.get(`${environment.apiBase}/api/exception-reports/all?approverId=${approverId}`).toPromise();
      } else if (this.filterStatus === 'pending' || this.filterStatus === 'pending_second_approval' || !this.filterStatus) {
        // 其他角色：待审批状态使用pending API
        response = await this.http.get(`${environment.apiBase}/api/exception-reports/pending?approverId=${approverId}`).toPromise();
      } else {
        // 其他角色：已审批、已驳回等状态使用all API
        response = await this.http.get(`${environment.apiBase}/api/exception-reports/all?approverId=${approverId}`).toPromise();
      }
      
      this.allExceptionReports = response as any[];
      
      // 应用筛选条件（会自动根据用户角色筛选）
      this.applyFilters();
      
    } catch (error: any) {
      this.errorMsg = '加载异常报告失败：' + (error.error?.error || error.message);
      console.error('加载异常报告失败:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // 应用筛选条件
  applyFilters() {
    // 从所有报告中筛选
    this.exceptionReports = this.allExceptionReports.filter(report => {
      // 状态筛选：如果设置了筛选状态，则只显示该状态的报告
      // 如果没有设置筛选状态，根据用户角色显示相应的报告
      let statusOk = true;
      
      // 如果filterStatus为空字符串，需要根据用户角色设置默认筛选
      if (!this.filterStatus || this.filterStatus === '') {
        // 根据用户角色显示相应的报告
        if (this.currentUser?.role === 'manager') {
          statusOk = report.status === 'pending_second_approval';
        } else if (this.currentUser?.role === 'staff') {
          // Staff角色默认显示待责任部门确认和责任部门已确认
          statusOk = report.status === 'pending_staff_confirmation' || report.status === 'staff_confirmed';
        } else if (this.currentUser?.role === 'supervisor' || this.currentUser?.role === 'admin') {
          statusOk = report.status === 'pending';
        } else {
          statusOk = false; // 其他角色不显示
        }
      } else {
        // 如果设置了筛选状态，则只显示该状态的报告
        // Staff角色：如果筛选状态为空，显示待责任部门确认和责任部门已确认；否则只显示选中的状态
        if (this.currentUser?.role === 'staff' && !this.filterStatus) {
          statusOk = report.status === 'pending_staff_confirmation' || report.status === 'staff_confirmed';
        } else {
          statusOk = report.status === this.filterStatus;
        }
      }
      
      // 类型筛选：优先使用修改后的类型，如果没有则使用原始类型
      const reportType = report.modified_exception_type || report.exception_type;
      const typeOk = this.filterType ? reportType === this.filterType : true;

      // 日期筛选：按异常开始时间（优先使用修改后的开始时间）
      let dateOk = true;
      if (this.exportStartDate || this.exportEndDate) {
        const dtStr = report.modified_start_datetime || report.exception_start_datetime;
        if (!dtStr) {
          dateOk = false;
        } else {
          const d = new Date(dtStr);
          if (isNaN(d.getTime())) {
            dateOk = false;
          } else {
            if (this.exportStartDate) {
              const start = new Date(this.exportStartDate + 'T00:00:00');
              if (d < start) dateOk = false;
            }
            if (dateOk && this.exportEndDate) {
              const end = new Date(this.exportEndDate + 'T23:59:59');
              if (d > end) dateOk = false;
            }
          }
        }
      }
      
      return statusOk && typeOk && dateOk;
    });
  }

  // 筛选状态改变时的处理
  onFilterStatusChange() {
    // 当筛选状态改变时，需要重新加载数据（因为不同状态需要调用不同的API）
    this.loadExceptionReports();
  }

  // Staff角色设置筛选状态（使用按钮切换）
  setStaffFilter(status: string) {
    this.filterStatus = status;
    // 不需要重新加载数据，只需要应用筛选
    this.applyFilters();
  }
  
  // 重置筛选
  resetFilters() {
    // 根据用户角色设置默认筛选状态
    if (this.currentUser?.role === 'manager') {
      this.filterStatus = 'pending_second_approval';
    } else if (this.currentUser?.role === 'staff') {
      // Staff角色：默认显示所有（待确认和已确认），所以设置为空字符串
      this.filterStatus = '';
    } else {
      this.filterStatus = 'pending';
    }
    this.filterType = '';
    this.loadExceptionReports();
  }

  // 下拉刷新
  async doRefresh(event: any) {
    await this.loadExceptionReports();
    event.target.complete();
  }

  // 导出当前筛选条件下的异常报告（staff / supervisor / admin / manager）
  exportExceptions() {
    const role = this.currentUser?.role;
    const dept = this.currentUser?.department;

    // 工程部 staff、manager、admin：导出当前已加载的所有异常（allExceptionReports）
    const useAll =
      (role === 'staff' && dept === '工程部') ||
      role === 'manager' ||
      role === 'admin';

    let source = useAll ? this.allExceptionReports : this.exceptionReports;

    // 导出前按日期范围再过滤（按异常开始时间）
    const hasDateFilter = this.exportStartDate || this.exportEndDate;
    if (hasDateFilter) {
      const start = this.exportStartDate
        ? new Date(this.exportStartDate + 'T00:00:00')
        : null;
      const end = this.exportEndDate
        ? new Date(this.exportEndDate + 'T23:59:59')
        : null;

      source = source.filter((report: any) => {
        const dtStr =
          report.modified_start_datetime || report.exception_start_datetime;
        if (!dtStr) return false;
        const d = new Date(dtStr);
        if (isNaN(d.getTime())) return false;
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }

    if (!source || source.length === 0) {
      alert(useAll ? '当前暂无可导出的异常记录' : '当前筛选条件下没有异常记录可以导出');
      return;
    }

    const data: any[][] = [];
    const header = [
      '异常ID',
      '任务名称',
      '上报人',
      '异常类型',
      '最终异常类型',
      '异常开始时间',
      '异常结束时间',
      '状态',
      '提交时间',
      '一级审批人',
      '一级审批时间',
      '一级备注',
      '二级审批人',
      '二级审批时间',
      '二级备注',
      '责任部门',
      '责任部门确定时间',
      '责任部门备注',
      '图片链接',
      '解决时间',
      '解决备注'
    ];
    data.push(header);

    const toBjTime = (value: any): string => {
      if (!value) return '';
      try {
        const d = new Date(value);
        if (isNaN(d.getTime())) return String(value);
        return d.toLocaleString('zh-CN', {
          timeZone: 'Asia/Shanghai',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {
        return String(value);
      }
    };

    source.forEach((report: any) => {
      const imageUrl = report.image_path
        ? `${environment.apiBase.replace('localhost', '10.0.2.2')}${report.image_path}`
        : '';

      data.push([
        report.id,
        report.task_name || '',
        report.user_name || '',
        report.exception_type || '',
        report.modified_exception_type || report.exception_type || '',
        toBjTime(report.modified_start_datetime || report.exception_start_datetime),
        toBjTime(report.modified_end_datetime || report.exception_end_datetime),
        report.status || '',
        toBjTime(report.submitted_at),
        report.first_approver_name || '',
        toBjTime(report.first_approved_at),
        report.first_approval_note || '',
        report.second_approver_name || '',
        toBjTime(report.second_approved_at),
        report.second_approval_note || '',
        report.assigned_staff_name || '',
        toBjTime(report.staff_confirmed_at),
        report.staff_confirmation_note || '',
        imageUrl ? `=HYPERLINK("${imageUrl}","查看图片")` : '',
        toBjTime(report.resolved_at),
        report.resolution_note || ''
      ]);
    });

    const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(data);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '异常报告');

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate()
    ).padStart(2, '0')}`;
    XLSX.writeFile(wb, `异常报告_${dateStr}.xlsx`);
  }

  // 打包下载当前可见范围内的异常图片（方案3）
  exportExceptionImages() {
    if (!this.currentUser) return;
    const role = this.currentUser.role;
    if (!['staff', 'supervisor', 'admin', 'manager'].includes(role)) {
      return;
    }

    const isNative = Capacitor.isNativePlatform();
    const base = isNative ? environment.apiBase.replace('localhost', '10.0.2.2') : environment.apiBase;

    const params = new URLSearchParams();
    params.set('role', role);
    params.set('userId', String(this.currentUser.id));
    if (this.filterStatus) {
      params.set('status', this.filterStatus);
    }
    if (this.filterType) {
      params.set('type', this.filterType);
    }
    // 日期范围（按异常开始时间）
    if (this.exportStartDate) {
      params.set('startDate', `${this.exportStartDate} 00:00:00`);
    }
    if (this.exportEndDate) {
      params.set('endDate', `${this.exportEndDate} 23:59:59`);
    }

    const url = `${base}/api/exception-reports/export-images?${params.toString()}`;
    try {
      window.open(url, '_blank');
    } catch {
      window.location.href = url;
    }
  }

  // 格式化日期时间
  formatDateTime(dateTimeStr: string): string {
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

  // 获取状态颜色
  getStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'warning';
      case 'pending_second_approval': return 'tertiary';
      case 'pending_staff_confirmation': return 'primary';
      case 'staff_confirmed': return 'success';
      case 'approved': return 'success';
      case 'rejected': return 'danger';
      case 'processing': return 'primary';
      case 'resolved': return 'medium';
      default: return 'medium';
    }
  }


  // 获取影响程度颜色
  getImpactColor(impactLevel: string): string {
    switch (impactLevel) {
      case '紧急': return 'danger';
      case '高': return 'warning';
      case '中': return 'primary';
      case '低': return 'medium';
      default: return 'medium';
    }
  }

  // 加载审批人列表（只加载manager角色）
  async loadApprovers() {
    try {
      const response = await this.http.get(`${environment.apiBase}/api/users`).toPromise();
      this.approvers = (response as any[]).filter(user => user.role === 'manager');
      
      // 自动选择默认经理
      if (this.approvers.length > 0) {
        // 优先根据当前用户的user_group或department匹配对应的manager
        if (this.currentUser?.user_group || this.currentUser?.department) {
          const matchedManager = this.approvers.find(manager => 
            (this.currentUser.user_group && manager.user_group === this.currentUser.user_group) ||
            (this.currentUser.department && manager.department === this.currentUser.department)
          );
          
          if (matchedManager) {
            this.selectedSecondApproverId = matchedManager.id;
            return;
          }
        }
        
        // 如果没有匹配的，选择第一个manager作为默认值
        this.selectedSecondApproverId = this.approvers[0].id;
      }
    } catch (error) {
      console.error('加载审批人列表失败：', error);
      this.approvers = [];
    }
  }

  // 打开审批模态框
  async openApprovalModal(report: any, action: string) {
    this.selectedReport = report;
    this.approvalAction = action;
    this.approvalNote = '';
    this.selectedSecondApproverId = null;
    
    // 判断是否可以修改：只有supervisor/admin在一级审批时可以修改
    this.canModify = (this.currentUser?.role === 'supervisor' || this.currentUser?.role === 'admin') 
                      && report.status === 'pending';
    
    // 如果是一级审批批准，加载审批人列表
    if (report.status === 'pending' && this.approvalAction === 'approve' && this.canModify) {
      await this.loadApprovers();
    }
    
    // 初始化修改后的值（如果有修改过的值，使用修改后的值，否则使用原始值）
    this.modifiedExceptionType = report.modified_exception_type || report.exception_type || '';
    this.modifiedDescription = report.modified_description || report.description || '';
    
    // 转换日期时间格式为HTML5 datetime-local格式 (YYYY-MM-DDTHH:mm)
    this.modifiedStartDateTime = this.convertToDateTimeLocal(
      report.modified_start_datetime || report.exception_start_datetime
    );
    this.modifiedEndDateTime = this.convertToDateTimeLocal(
      report.modified_end_datetime || report.exception_end_datetime
    );
    
    this.isApprovalModalOpen = true;
  }
  
  // 将日期时间转换为HTML5 datetime-local格式
  convertToDateTimeLocal(dateTimeStr: string): string {
    if (!dateTimeStr) return '';
    try {
      const date = new Date(dateTimeStr);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      return dateTimeStr;
    }
  }
  
  // 将HTML5 datetime-local格式转换为数据库格式
  convertFromDateTimeLocal(dateTimeLocal: string): string {
    if (!dateTimeLocal) return '';
    // 如果已经是正确的格式，直接返回
    if (dateTimeLocal.includes('T') && dateTimeLocal.length >= 16) {
      return dateTimeLocal.replace('T', ' ') + ':00';
    }
    return dateTimeLocal;
  }

  // 关闭审批模态框
  closeApprovalModal() {
    this.isApprovalModalOpen = false;
    this.selectedReport = null;
    this.approvalAction = 'approve';
    this.approvalNote = '';
    this.modifiedExceptionType = '';
    this.modifiedDescription = '';
    this.modifiedStartDateTime = '';
    this.modifiedEndDateTime = '';
    this.canModify = false;
    this.selectedSecondApproverId = null;
    this.approvers = [];
  }

  // 确认审批
  async confirmApproval() {
    if (!this.selectedReport) return;

    // 如果是责任部门确认，使用不同的接口
    if (this.currentUser?.role === 'staff' && this.selectedReport.status === 'pending_staff_confirmation') {
      await this.confirmStaffApproval();
      return;
    }

    // 如果是一级审批批准，必须选择二级审批人（应该有默认值，但再次检查）
    if (this.selectedReport.status === 'pending' && this.approvalAction === 'approve' && this.canModify) {
      if (!this.selectedSecondApproverId) {
        // 如果还是没有选择，尝试选择第一个manager
        if (this.approvers.length > 0) {
          this.selectedSecondApproverId = this.approvers[0].id;
        } else {
          alert('请选择二级审批人');
          return;
        }
      }
    }

    try {
      const requestBody: any = {
        approverId: this.currentUser.id,
        action: this.approvalAction,
        approvalNote: this.approvalNote
      };
      
      // 如果是一级审批且可以修改，发送修改后的信息和二级审批人ID
      if (this.canModify && this.approvalAction === 'approve') {
        requestBody.modifiedExceptionType = this.modifiedExceptionType;
        requestBody.modifiedDescription = this.modifiedDescription;
        // 转换日期时间格式
        requestBody.modifiedStartDateTime = this.convertFromDateTimeLocal(this.modifiedStartDateTime);
        requestBody.modifiedEndDateTime = this.convertFromDateTimeLocal(this.modifiedEndDateTime);
        // 发送二级审批人ID
        if (this.selectedSecondApproverId) {
          requestBody.secondApproverId = this.selectedSecondApproverId;
        }
      }
      
      const response = await this.http.post(
        `${environment.apiBase}/api/exception-reports/${this.selectedReport.id}/approve`,
        requestBody
      ).toPromise();

      if (response && (response as any).success) {
        const message = (response as any).message || 
                       (this.approvalAction === 'approve' ? '异常报告已批准' : '异常报告已驳回');
        alert(message);
        this.closeApprovalModal();
        this.loadExceptionReports();
      } else {
        throw new Error((response as any).error || '操作失败');
      }
    } catch (error: any) {
      alert('操作失败：' + (error.error?.error || error.message));
    }
  }

  // 责任部门确认异常报告
  async confirmStaffApproval() {
    if (!this.selectedReport) return;

    try {
      // 将'approve'转换为'confirm'，因为后端接口期望'confirm'或'reject'
      const action = this.approvalAction === 'approve' ? 'confirm' : 'reject';
      
      const requestBody = {
        staffId: this.currentUser.id,
        action: action, // 'confirm' or 'reject'
        confirmationNote: this.approvalNote
      };
      
      const response = await this.http.post(
        `${environment.apiBase}/api/exception-reports/${this.selectedReport.id}/staff-confirm`,
        requestBody
      ).toPromise();

      if (response && (response as any).success) {
        const message = (response as any).message || 
                       (this.approvalAction === 'approve' ? '异常报告已确认' : '异常报告已处理');
        alert(message);
        this.closeApprovalModal();
        this.loadExceptionReports();
      } else {
        throw new Error((response as any).error || '操作失败');
      }
    } catch (error: any) {
      alert('操作失败：' + (error.error?.error || error.message));
    }
  }
  
  // 获取状态文本（包含二级审批状态和staff确认状态）
  getStatusText(status: string): string {
    switch (status) {
      case 'pending': return '待一级审批';
      case 'pending_second_approval': return '待二级审批';
      case 'pending_staff_confirmation': return '待责任部门确认';
      case 'staff_confirmed': return '责任部门已确认';
      case 'approved': return '已批准';
      case 'rejected': return '已驳回';
      case 'processing': return '处理中';
      case 'resolved': return '已解决';
      default: return status;
    }
  }
  
  // 判断当前用户是否可以审批该报告
  canApproveReport(report: any): boolean {
    if (!this.currentUser) return false;
    
    const userRole = this.currentUser.role;
    const reportStatus = report.status;
    
    // 一级审批：supervisor/admin可以审批pending状态的报告
    if (reportStatus === 'pending' && (userRole === 'supervisor' || userRole === 'admin')) {
      return true;
    }
    
    // 二级审批：manager可以审批pending_second_approval状态的报告
    if (reportStatus === 'pending_second_approval' && userRole === 'manager') {
      return true;
    }
    
    // 责任部门确认：staff可以确认pending_staff_confirmation状态的报告（且必须是指定给自己的）
    if (reportStatus === 'pending_staff_confirmation' && userRole === 'staff' && report.assigned_to_staff_id === this.currentUser.id) {
      return true;
    }
    
    return false;
  }

  
  // 获取图片URL
  getImageUrl(imagePath: string): string {
    if (!imagePath) return '';
    return `${environment.apiBase}${imagePath}`;
  }
  
  // 查看图片
  viewImage(imagePath: string) {
    this.selectedImageUrl = this.getImageUrl(imagePath);
    this.isImageViewModalOpen = true;
  }
  
  // 关闭图片查看模态框
  closeImageViewModal() {
    this.isImageViewModalOpen = false;
    this.selectedImageUrl = '';
  }
}

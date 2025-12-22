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
  IonBadge,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption
} from '@ionic/angular/standalone';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-exception-reports',
  templateUrl: './exception-reports.page.html',
  styleUrls: ['./exception-reports.page.scss'],
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
    IonBadge,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonButton,
    IonButtons,
    IonIcon,
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption,
    CommonModule,
    FormsModule,
    RouterLink
  ]
})
export class ExceptionReportsPage implements OnInit {
  exceptionReports: any[] = [];
  filteredReports: any[] = [];
  isLoading: boolean = true;
  errorMsg: string = '';
  currentUser: any = null;
  
  // 筛选条件
  filterStatus: string = '';
  filterType: string = '';
  
  // 使用 inject() 函数注入 HttpClient
  private http = inject(HttpClient);
  private router = inject(Router);

  ngOnInit() {
    // 获取当前用户信息
    const userStr = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (userStr) {
      this.currentUser = JSON.parse(userStr);
    }
    this.loadExceptionReports();
  }

  loadExceptionReports() {
    if (!this.currentUser?.id) {
      this.errorMsg = '用户信息不存在';
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.errorMsg = '';
    
    const isNative = Capacitor.isNativePlatform();
    const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
    
    this.http.get(`${base}/api/exception-reports/user/${this.currentUser.id}`).subscribe({
      next: (data: any) => {
        this.exceptionReports = Array.isArray(data) ? data : [];
        this.applyFilters();
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMsg = '获取异常报告失败: ' + (err.error?.error || err.message);
        this.isLoading = false;
      }
    });
  }

  doRefresh(event: any) {
    this.loadExceptionReports();
    setTimeout(() => event.target.complete(), 500);
  }

  applyFilters() {
    this.filteredReports = this.exceptionReports.filter(report => {
      const statusOk = this.filterStatus ? report.status === this.filterStatus : true;
      const typeOk = this.filterType ? report.exception_type === this.filterType : true;
      return statusOk && typeOk;
    });
  }

  resetFilters() {
    this.filterStatus = '';
    this.filterType = '';
    this.applyFilters();
  }

  getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': '待审批',
      'approved': '已审批',
      'rejected': '已驳回',
      'processing': '处理中',
      'resolved': '已解决',
      // 兼容更多后台状态，统一显示中文
      'pending_second_approval': '待二级审批',
      'pending_staff_confirmation': '待责任部门确认',
      'staff_confirmed': '责任部门已确认'
    };
    return statusMap[status] || status;
  }

  getStatusColor(status: string): string {
    const colorMap: { [key: string]: string } = {
      'pending': 'warning',
      'approved': 'success',
      'rejected': 'danger',
      'processing': 'primary',
      'resolved': 'medium'
    };
    return colorMap[status] || 'medium';
  }

  getTypeText(type: string): string {
    return type || '未知类型';
  }

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

  goBack() {
    this.router.navigate(['/home']);
  }
}


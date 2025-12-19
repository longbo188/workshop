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
  IonIcon,
  IonBadge,
  IonSpinner,
  IonSelect,
  IonSelectOption,
  IonAlert,
  IonButtons
} from '@ionic/angular/standalone';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-task-pool',
  templateUrl: './task-pool.page.html',
  styleUrls: ['./task-pool.page.scss'],
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
    IonIcon,
    IonBadge,
    IonSpinner,
    IonSelect,
    IonSelectOption,
    IonAlert,
    IonButtons,
    CommonModule,
    FormsModule
  ]
})
export class TaskPoolPage implements OnInit {
  tasks: any[] = [];
  workers: any[] = [];
  isLoading: boolean = true;
  errorMsg: string = '';
  currentUser: any = null;
  selectedTaskId: number | null = null;
  selectedWorkerId: number | null = null;
  isAssigning: boolean = false;

  private http = inject(HttpClient);

  ngOnInit() {
    // 获取当前用户信息
    const userStr = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (userStr) {
      this.currentUser = JSON.parse(userStr);
    }
    
    // 检查权限
    if (!this.currentUser || (this.currentUser.role !== 'admin' && this.currentUser.role !== 'supervisor' && this.currentUser.role !== 'manager')) {
      this.errorMsg = '无权限访问此页面';
      return;
    }
    
    this.loadTasks();
    this.loadWorkers();
  }

  loadTasks() {
    this.isLoading = true;
    this.errorMsg = '';
    
    const isNative = Capacitor.isNativePlatform();
    const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
    
    this.http.get(`${base}/api/task-pool`).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.tasks = (response.tasks || []).map(task => ({
            ...task,
            priority: this.normalizePriorityValue(task.priority)
          }));
        } else {
          this.errorMsg = '获取任务池失败';
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMsg = '获取任务池失败：' + (error.error?.error || error.message);
        this.isLoading = false;
      }
    });
  }

  loadWorkers() {
    const isNative = Capacitor.isNativePlatform();
    const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
    
    this.http.get(`${base}/api/workers`).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.workers = response.workers;
        }
      },
      error: (error) => {
        console.error('获取工人列表失败：', error);
      }
    });
  }

  getPhaseName(phaseKey: string): string {
    const phaseNames: { [key: string]: string } = {
      'machining': '机加',
      'electrical': '电控',
      'pre_assembly': '组装前段',
      'post_assembly': '组装后段',
      'debugging': '调试'
    };
    return phaseNames[phaseKey] || phaseKey;
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

  getCurrentAssigneeName(task: any): string | null {
    if (task.current_phase === 'machining' && task.machining_assignee_name) {
      return task.machining_assignee_name;
    } else if (task.current_phase === 'electrical' && task.electrical_assignee_name) {
      return task.electrical_assignee_name;
    } else if (task.current_phase === 'pre_assembly' && task.pre_assembly_assignee_name) {
      return task.pre_assembly_assignee_name;
    } else if (task.current_phase === 'post_assembly' && task.post_assembly_assignee_name) {
      return task.post_assembly_assignee_name;
    } else if (task.current_phase === 'debugging' && task.debugging_assignee_name) {
      return task.debugging_assignee_name;
    }
    return null;
  }

  selectTask(taskId: number) {
    this.selectedTaskId = taskId;
    this.selectedWorkerId = null;
  }

  async assignTask() {
    if (!this.selectedTaskId || !this.selectedWorkerId) {
      this.errorMsg = '请选择任务和工人';
      return;
    }

    this.isAssigning = true;
    this.errorMsg = '';

    try {
      const isNative = Capacitor.isNativePlatform();
      const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
      
      const response: any = await this.http.post(
        `${base}/api/task-pool/${this.selectedTaskId}/assign`,
        { userId: this.selectedWorkerId }
      ).toPromise();

      if (response.success) {
        // 重新加载任务列表
        this.loadTasks();
        this.selectedTaskId = null;
        this.selectedWorkerId = null;
        this.errorMsg = '';
        alert('任务分配成功！');
      } else {
        this.errorMsg = '分配失败：' + (response.error || '未知错误');
      }
    } catch (error: any) {
      this.errorMsg = '分配失败：' + (error.error?.error || error.message);
    } finally {
      this.isAssigning = false;
    }
  }

  refresh() {
    this.loadTasks();
    this.loadWorkers();
  }
}







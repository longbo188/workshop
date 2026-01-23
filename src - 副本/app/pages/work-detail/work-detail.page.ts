import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Capacitor } from '@capacitor/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonButton,
  IonInput,
  IonTextarea,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonAlert,
  IonIcon,
  IonButtons
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-work-detail',
  templateUrl: './work-detail.page.html',
  styleUrls: ['./work-detail.page.scss'],
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
    IonButton,
    IonInput,
    IonTextarea,
    IonItem,
    IonLabel,
    IonList,
    IonSpinner,
    IonAlert,
    IonIcon,
    IonButtons,
    CommonModule,
    FormsModule
  ]
})
export class WorkDetailPage implements OnInit {
  taskId: string = '';
  task: any = null;
  currentUser: any = null;
  isLoading: boolean = true;
  errorMsg: string = '';
  
  // 阶段流程控制
  phaseInfo: any = null;
  currentPhase: string = '';
  
  // 报工表单
  quantityCompleted: number = 0;
  qualityNotes: string = '';
  issues: string = '';
  isSubmitting: boolean = false;
  history: any[] = [];

  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  ngOnInit() {
    this.taskId = this.route.snapshot.paramMap.get('id') || '';
    this.currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    this.loadTask();
  }

  loadTask() {
    this.isLoading = true;
    const isNative = Capacitor.isNativePlatform();
    const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
    this.http.get(`${base}/api/tasks`).subscribe({
      next: (data: any) => {
        this.task = data.find((t: any) => t.id == this.taskId);
        if (this.task) {
          this.task = {
            ...this.task,
            priority: this.normalizePriorityValue(this.task.priority)
          };
        }
        this.loadPhaseInfo();
        this.loadHistory();
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMsg = '获取任务详情失败: ' + (err.error?.error || err.message);
        this.isLoading = false;
      }
    });
  }

  loadPhaseInfo() {
    if (!this.taskId) return;
    
    const isNative = Capacitor.isNativePlatform();
    const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
    this.http.get(`${base}/api/tasks/${this.taskId}/phases`).subscribe({
      next: (data: any) => {
        this.phaseInfo = data;
        this.currentPhase = data.currentPhase;
      },
      error: (err) => {
        console.error('获取阶段信息失败:', err);
      }
    });
  }

  loadHistory() {
    const isNative = Capacitor.isNativePlatform();
    const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
    this.http.get(`${base}/api/work-reports/by-task/${this.taskId}`).subscribe({
      next: (rows: any) => this.history = rows || [],
      error: () => this.history = []
    });
  }

  async completeWork() {
    if (this.quantityCompleted <= 0) {
      this.errorMsg = '请输入完成数量';
      return;
    }

    // 提交前确认
    const ok = confirm(`确认提交完成报工？数量：${this.quantityCompleted}`);
    if (!ok) {
      return;
    }

    this.isSubmitting = true;
    this.errorMsg = '';

    try {
      const isNative = Capacitor.isNativePlatform();
      const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
      const response: any = await this.http.post(`${base}/api/work/complete`, {
        taskId: this.taskId,
        userId: this.currentUser.id,
        quantity: this.quantityCompleted,
        qualityNotes: this.qualityNotes,
        issues: this.issues
      }).toPromise();

      if (response.success) {
        // 完成报工成功，返回首页
        this.router.navigate(['/home']);
      }
    } catch (error: any) {
      this.errorMsg = '完成报工失败：' + (error.error?.error || error.message);
    } finally {
      this.isSubmitting = false;
    }
  }

  // 阶段流程控制方法
  async startPhase(phaseKey: string) {
    this.isSubmitting = true;
    this.errorMsg = '';

    try {
      const isNative = Capacitor.isNativePlatform();
      const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
      const response: any = await this.http.post(`${base}/api/tasks/${this.taskId}/phases/${phaseKey}/start`, {
        userId: this.currentUser.id
      }).toPromise();

      if (response.success) {
        // 重新加载阶段信息
        this.loadPhaseInfo();
      }
    } catch (error: any) {
      this.errorMsg = '开始阶段失败：' + (error.error?.error || error.message);
    } finally {
      this.isSubmitting = false;
    }
  }

  async completePhase(phaseKey: string) {
    if (this.quantityCompleted <= 0) {
      this.errorMsg = '请输入完成数量';
      return;
    }

    // 提交前确认
    const phaseName = this.getPhaseName(phaseKey);
    const ok = confirm(`确认完成${phaseName}阶段？数量：${this.quantityCompleted}`);
    if (!ok) {
      return;
    }

    this.isSubmitting = true;
    this.errorMsg = '';

    try {
      const isNative = Capacitor.isNativePlatform();
      const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
      const response: any = await this.http.post(`${base}/api/tasks/${this.taskId}/phases/${phaseKey}/complete`, {
        userId: this.currentUser.id,
        quantity: this.quantityCompleted,
        qualityNotes: this.qualityNotes,
        issues: this.issues
      }).toPromise();

      if (response.success) {
        // 清空表单
        this.quantityCompleted = 0;
        this.qualityNotes = '';
        this.issues = '';
        
        // 重新加载阶段信息
        this.loadPhaseInfo();
        
        if (response.taskCompleted) {
          // 任务完成，返回首页
          setTimeout(() => {
            this.router.navigate(['/home']);
          }, 1000);
        }
      }
    } catch (error: any) {
      this.errorMsg = '完成阶段失败：' + (error.error?.error || error.message);
    } finally {
      this.isSubmitting = false;
    }
  }

  async completeCurrentPhase() {
    if (this.currentPhase) {
      await this.completePhase(this.currentPhase);
    }
  }

  getCurrentPhaseName(): string {
    if (!this.phaseInfo || !this.currentPhase) return '';
    const phase = this.phaseInfo.phases.find((p: any) => p.key === this.currentPhase);
    return phase ? phase.name : '';
  }

  getPriorityText(priority: string): string {
    return this.normalizePriorityValue(priority) === 'urgent' ? '紧急' : '非紧急';
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

  goBack() {
    this.router.navigate(['/home']);
  }
}

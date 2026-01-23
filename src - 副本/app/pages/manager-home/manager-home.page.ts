import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButton, IonIcon, IonSpinner, IonButtons } from '@ionic/angular/standalone';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';

@Component({
  selector: 'app-manager-home',
  standalone: true,
  templateUrl: './manager-home.page.html',
  styleUrls: ['./manager-home.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonButton, IonIcon, IonSpinner, IonButtons,
    CommonModule, FormsModule
  ]
})
export class ManagerHomePage implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);

  pendingAssistApprovals: any[] = [];
  isLoading = false;
  errorMsg = '';
  managers: any[] = [];
  currentUser: any = null;
  currentUserId: string | null = null;

  async ngOnInit() {
    this.resolveCurrentUser();
    if (!this.currentUserId) {
      this.errorMsg = '尚未登录，请先登录后查看审批项';
      setTimeout(() => this.router.navigate(['/login']), 1500);
      return;
    }
    await this.loadPendingAssistApprovals();
  }

  private resolveCurrentUser() {
    const userStr = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (userStr) {
      try {
        this.currentUser = JSON.parse(userStr);
        if (this.currentUser?.id) {
          this.currentUserId = String(this.currentUser.id);
          return;
        }
      } catch (error) {
        console.warn('解析 currentUser 失败', error);
      }
    }
    this.currentUserId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
  }

  async loadPendingAssistApprovals() {
    try {
      if (!this.currentUserId) {
        this.errorMsg = '未登录用户无法查看审批项';
        this.pendingAssistApprovals = [];
        return;
      }
      this.isLoading = true;
      this.errorMsg = '';
      this.pendingAssistApprovals = await this.http.get<any[]>(
        `${environment.apiBase}/api/assist-approvals/pending`,
        { params: { managerId: this.currentUserId } }
      ).toPromise() || [];
    } catch (error: any) {
      this.errorMsg = error?.error?.error || error.message || '加载审批列表失败';
    } finally {
      this.isLoading = false;
    }
  }

  async approveAssist(approvalId: number, decision: 'approved' | 'rejected') {
    if (!this.currentUserId) {
      this.errorMsg = '未登录，无法审批';
      return;
    }
    try {
      await this.http.post(
        `${environment.apiBase}/api/assist-approvals/${approvalId}/decision`,
        {
          decision,
          managerId: this.currentUserId
        }
      ).toPromise();
      await this.loadPendingAssistApprovals();
    } catch (error: any) {
      this.errorMsg = error?.error?.error || error.message || '审批失败';
    }
  }
}


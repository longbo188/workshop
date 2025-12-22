import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonButton, IonList, IonSpinner, IonSelect, IonSelectOption, IonInput } from '@ionic/angular/standalone';
import { environment } from '../../../environments/environment';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-work-records-admin',
  standalone: true,
  templateUrl: './work-records-admin.page.html',
  styleUrls: ['./work-records-admin.page.scss'],
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonCard, IonCardContent, IonItem, IonLabel, IonButton, IonList, IonSpinner, IonSelect, IonSelectOption, IonInput
  ]
})
export class WorkRecordsAdminPage implements OnInit {
  isLoading = false;
  errorMsg = '';
  list: any[] = [];
  start = '';
  end = '';
  userId: number | null = null;
  taskId: number | null = null;

  private http = inject(HttpClient);

  ngOnInit(): void {
    this.load();
  }

  private getApiBase(): string {
    const isNative = Capacitor.isNativePlatform();
    return isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
  }

  load() {
    this.isLoading = true;
    this.errorMsg = '';
    const base = this.getApiBase();
    const params = new URLSearchParams();
    if (this.start) params.set('start', this.start);
    if (this.end) params.set('end', this.end);
    if (this.userId) params.set('userId', String(this.userId));
    if (this.taskId) params.set('taskId', String(this.taskId));
    this.http.get(`${base}/api/work-records?${params.toString()}`).subscribe({
      next: (rows: any) => { this.list = rows || []; this.isLoading = false; },
      error: (err) => { this.errorMsg = '加载失败：' + (err?.error?.error || err?.message); this.isLoading = false; }
    });
  }
}










































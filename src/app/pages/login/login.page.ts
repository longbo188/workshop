import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { 
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonInput,
  IonButton,
  IonSpinner,
  IonIcon,
  IonCheckbox,
  IonItem,
  IonLabel
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms'; // 导入模块
import { environment } from '../../../environments/environment';
import { Capacitor } from '@capacitor/core';
import { OnInit } from '@angular/core';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true, // 标记为独立组件
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonInput,
    IonButton,
    IonSpinner,
    IonIcon,
    IonCheckbox,
    IonItem,
    IonLabel,
    FormsModule,
    CommonModule
  ]
})
export class LoginPage implements OnInit {
  username: string = '';
  password: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';
  rememberMe: boolean = false;
  

  // 数据可视化元素数据
  mapPoints = [
    { x: 20, y: 30 },
    { x: 40, y: 25 },
    { x: 60, y: 35 },
    { x: 30, y: 50 },
    { x: 50, y: 60 },
    { x: 70, y: 45 },
    { x: 15, y: 70 },
    { x: 80, y: 20 }
  ];

  pieData = [
    { rotation: 0 },
    { rotation: 120 },
    { rotation: 240 }
  ];

  lineData = [
    { value: 60, position: 0 },
    { value: 80, position: 15 },
    { value: 40, position: 30 },
    { value: 90, position: 45 },
    { value: 70, position: 60 }
  ];

  barData = [
    { value: 80, position: 0 },
    { value: 60, position: 12 },
    { value: 90, position: 24 },
    { value: 70, position: 36 },
    { value: 85, position: 48 }
  ];

  private router = inject(Router);
  private http = inject(HttpClient);

  constructor() {
    // 添加页面加载完成后的测试
    setTimeout(() => {
      console.log('登录页面已加载，所有元素应该可以点击');
    }, 1000);
  }

  ngOnInit(): void {
    // 预填充用户名与记住选项
    const savedUsername = localStorage.getItem('savedUsername');
    if (savedUsername) {
      this.username = savedUsername;
      this.rememberMe = true;
    }
  }


  async login() {
    console.log('登录按钮被点击'); // 调试信息
    
    if (!this.username || !this.password) {
      this.errorMessage = '请输入用户名和密码';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      const isNative = Capacitor.isNativePlatform();
      // Android 模拟器访问宿主机: 10.0.2.2；真机请将 apiBase 改为电脑局域网IP
      const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;
      const response: any = await this.http.post(`${base}/api/login`, {
        username: this.username,
        password: this.password
      }).toPromise();

      if (response.success) {
        // 根据记住密码选项保存会话
        if (this.rememberMe) {
          localStorage.setItem('currentUser', JSON.stringify(response.user));
          localStorage.setItem('savedUsername', this.username);
          sessionStorage.removeItem('currentUser');
        } else {
          sessionStorage.setItem('currentUser', JSON.stringify(response.user));
          localStorage.removeItem('currentUser');
          localStorage.removeItem('savedUsername');
        }
        // 登录成功跳转到首页
        this.router.navigate(['/home']);
      } else {
        this.errorMessage = response.message || '登录失败';
      }
    } catch (error: any) {
      this.errorMessage = '登录失败：' + (error.error?.error || error.message);
    } finally {
      this.isLoading = false;
    }
  }
}
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
  IonLabel,
  IonModal,
  IonButtons
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
    IonModal,
    IonButtons,
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

  // 保存的用户名列表
  savedUsernames: string[] = [];

  // 修改密码相关
  isChangePasswordModalOpen: boolean = false;
  oldPassword: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  changePasswordMessage: string = '';
  changePasswordSuccess: boolean = false;

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
    // 加载保存的用户名列表
    this.loadSavedUsernames();
    
    // 预填充用户名与记住选项（兼容旧版本）
    const savedUsername = localStorage.getItem('savedUsername');
    if (savedUsername) {
      this.username = savedUsername;
      this.rememberMe = true;
      // 如果旧版本保存的用户名不在列表中，添加到列表
      if (!this.savedUsernames.includes(savedUsername)) {
        this.saveUsername(savedUsername);
      }
    } else if (this.savedUsernames.length > 0) {
      // 如果有保存的用户名列表，自动填充第一个
      this.username = this.savedUsernames[0];
    }
  }

  /**
   * 加载保存的用户名列表
   */
  loadSavedUsernames(): void {
    const saved = localStorage.getItem('savedUsernames');
    if (saved) {
      try {
        this.savedUsernames = JSON.parse(saved);
      } catch (error) {
        console.error('解析保存的用户名列表失败:', error);
        this.savedUsernames = [];
      }
    }
  }

  /**
   * 保存用户名到列表
   * 无论是否勾选"记住密码"，都会保存用户名（只保存用户名，不保存密码）
   */
  saveUsername(username: string): void {
    if (!username || username.trim() === '') return;
    
    const trimmedUsername = username.trim();
    
    // 移除已存在的同名项
    this.savedUsernames = this.savedUsernames.filter(u => u !== trimmedUsername);
    
    // 添加到最前面
    this.savedUsernames.unshift(trimmedUsername);
    
    // 最多保存10个用户名
    if (this.savedUsernames.length > 10) {
      this.savedUsernames = this.savedUsernames.slice(0, 10);
    }
    
    // 保存到 localStorage（无论是否勾选"记住密码"都保存）
    localStorage.setItem('savedUsernames', JSON.stringify(this.savedUsernames));
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
        // 无论是否勾选"记住密码"，都保存用户名（只保存用户名，不保存密码）
        // 必须在跳转前保存，确保用户名被记录
        this.saveUsername(this.username);
        
        // 根据记住密码选项保存会话
        if (this.rememberMe) {
          localStorage.setItem('currentUser', JSON.stringify(response.user));
          localStorage.setItem('savedUsername', this.username); // 保留兼容性
          sessionStorage.removeItem('currentUser');
        } else {
          sessionStorage.setItem('currentUser', JSON.stringify(response.user));
          localStorage.removeItem('currentUser');
          // 注意：不删除 savedUsername，因为我们要保存用户名列表
          // 但清除旧的 savedUsername，因为用户没有勾选"记住密码"
          // 不过用户名已经通过 saveUsername 保存到 savedUsernames 列表中了
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

  // 打开/关闭修改密码弹窗
  openChangePasswordModal() {
    this.isChangePasswordModalOpen = true;
    this.oldPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.errorMessage = '';
    this.changePasswordMessage = '';
  }

  closeChangePasswordModal() {
    this.isChangePasswordModalOpen = false;
    this.oldPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.changePasswordMessage = '';
  }

  // 登录页修改密码（通过用户名 + 原密码）
  async changePassword() {
    if (!this.username) {
      this.changePasswordMessage = '请先输入用户名';
      this.changePasswordSuccess = false;
      return;
    }
    if (!this.oldPassword || !this.newPassword || !this.confirmPassword) {
      this.changePasswordMessage = '请完整填写原密码和新密码';
      this.changePasswordSuccess = false;
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.changePasswordMessage = '两次输入的新密码不一致';
      this.changePasswordSuccess = false;
      return;
    }
    if (this.newPassword.length < 6) {
      this.changePasswordMessage = '新密码长度不能少于6位';
      this.changePasswordSuccess = false;
      return;
    }

    this.isLoading = true;
    this.changePasswordMessage = '';

    try {
      const isNative = Capacitor.isNativePlatform();
      const base = isNative ? (environment.apiBase.replace('localhost', '10.0.2.2')) : environment.apiBase;

      await this.http.post(`${base}/api/users/change-password`, {
        username: this.username,
        oldPassword: this.oldPassword,
        newPassword: this.newPassword
      }).toPromise();

      // 修改成功，在模态框中提示
      this.changePasswordSuccess = true;
      this.changePasswordMessage = '密码修改成功，请使用新密码登录';
      // 保留用户名，新密码让用户在登录框里重新输入
      this.password = '';
    } catch (error: any) {
      this.changePasswordSuccess = false;
      this.changePasswordMessage = error?.error?.error || error?.message || '修改密码失败';
    } finally {
      this.isLoading = false;
    }
  }
}
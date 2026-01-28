import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AutoLogoutService {
  private readonly IDLE_TIME = 3 * 60 * 1000; // 3分钟（毫秒）
  private idleTimer: any = null;
  private isActive = false;
  private activityListeners: Array<{ event: string; handler: () => void }> = [];

  constructor(
    private router: Router,
    private ngZone: NgZone
  ) {}

  /**
   * 启动自动登出监听
   */
  start(): void {
    if (this.isActive) {
      return;
    }

    // 检查用户是否已登录
    if (!this.isUserLoggedIn()) {
      return;
    }

    this.isActive = true;
    this.resetTimer();

    // 监听用户活动事件
    this.setupActivityListeners();
  }

  /**
   * 停止自动登出监听
   */
  stop(): void {
    this.isActive = false;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.removeActivityListeners();
  }

  /**
   * 重置计时器
   */
  resetTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.ngZone.runOutsideAngular(() => {
      this.idleTimer = setTimeout(() => {
        this.ngZone.run(() => {
          this.handleAutoLogout();
        });
      }, this.IDLE_TIME);
    });
  }

  /**
   * 检查用户是否已登录
   */
  private isUserLoggedIn(): boolean {
    const userStr = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    return !!userStr;
  }

  /**
   * 设置用户活动监听器
   */
  private setupActivityListeners(): void {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      const handler = this.onUserActivity.bind(this);
      this.activityListeners.push({ event, handler });
      document.addEventListener(event, handler, true);
    });
  }

  /**
   * 移除用户活动监听器
   */
  private removeActivityListeners(): void {
    this.activityListeners.forEach(({ event, handler }) => {
      document.removeEventListener(event, handler, true);
    });
    this.activityListeners = [];
  }

  /**
   * 用户活动处理
   */
  private onUserActivity(): void {
    if (this.isActive && this.isUserLoggedIn()) {
      this.resetTimer();
    } else {
      // 如果用户已登出，停止监听
      this.stop();
    }
  }

  /**
   * 处理自动登出
   */
  private handleAutoLogout(): void {
    // 再次检查用户是否已登录（可能在计时器期间已登出）
    if (!this.isUserLoggedIn()) {
      this.stop();
      return;
    }

    // 清除用户数据
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUser');

    // 停止监听
    this.stop();

    // 跳转到登录页
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}

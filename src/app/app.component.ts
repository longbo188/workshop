import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AutoLogoutService } from './services/auto-logout.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  imports: [IonApp, IonRouterOutlet]
})
export class AppComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private autoLogoutService = inject(AutoLogoutService);

  /** 不启用空闲自动登出的路由（大屏/登录等） */
  private isAutoLogoutDisabledRoute(url: string): boolean {
    const path = url.split('?')[0].split('#')[0];
    return (
      path === '/login' ||
      path.startsWith('/login/') ||
      path === '/production-board' ||
      path.startsWith('/production-board/')
    );
  }

  ngOnInit(): void {
    // 监听路由变化，在登录页、生产看板时停止自动登出，在其他页面时启动
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        if (this.isAutoLogoutDisabledRoute(event.url)) {
          this.autoLogoutService.stop();
        } else {
          // 延迟启动，确保页面已加载
          setTimeout(() => {
            this.autoLogoutService.start();
          }, 100);
        }
      });

    // 初始检查
    const currentUrl = this.router.url;
    if (!this.isAutoLogoutDisabledRoute(currentUrl)) {
      setTimeout(() => {
        this.autoLogoutService.start();
      }, 100);
    }
  }

  ngOnDestroy(): void {
    this.autoLogoutService.stop();
  }
}
// 导入必要的模块和页面
import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

// 定义路由规则
const routes: Routes = [
  {
    path: '', // 根路径（应用启动时默认访问的路径）
    redirectTo: 'login', // 重定向到登录页
    pathMatch: 'full' // 完全匹配路径
  },
  {
    path: 'login', // 登录页路径（URL 为 /login 时显示）
    loadChildren: () => import('./pages/login/login.module').then(m => m.LoginPageModule)
    // 懒加载登录页模块（优化性能，只在需要时加载）ionic
  },
  {
    path: 'home', // 首页路径（URL 为 /home 时显示）
    loadChildren: () => import('./pages/home/home.module').then(m => m.HomePageModule)
  },
 
];

// 配置路由模块
@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
    // forRoot() 表示这是根路由模块
    // PreloadAllModules 策略：预加载所有模块，提升用户体验
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
// 1. 导入 Angular 核心模块
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common'; // 提供 Angular 基础指令（如 *ngIf、*ngFor）

// 2. 导入表单模块（如果首页需要使用表单）
import { FormsModule } from '@angular/forms'; // 提供双向绑定 [(ngModel)] 等表单功能

// 3. 导入 Ionic 模块（关键：确保能使用 <ion-header>、<ion-button> 等组件）
import { IonicModule } from '@ionic/angular';

// 4. 导入首页专属路由模块（控制首页的路由跳转）
import { HomePageRoutingModule } from './home-routing.module';

// 5. 导入首页组件本身
import { HomePage } from './home.page';


// 6. 模块定义（核心配置）
@NgModule({
  // 导入依赖模块：声明当前页面需要用到的其他模块
  imports: [
    CommonModule,    // 必须导入，否则 *ngIf 等指令无法使用
    FormsModule,     // 如果首页有表单（如输入框），必须导入
    IonicModule,     // 必须导入，否则 Ionic 组件（如 <ion-list>）会报错
    HomePageRoutingModule // 必须导入，否则首页无法通过路由访问
  ],
  // 声明当前模块包含的组件（这里只能放当前页面的组件）
  declarations: [HomePage]
})
// 7. 导出模块类（供 Angular 框架识别）
export class HomePageModule {}
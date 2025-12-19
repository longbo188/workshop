import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then( m => m.LoginPage)
  },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'work-detail/:id',
    loadComponent: () => import('./pages/work-detail/work-detail.page').then( m => m.WorkDetailPage)
  },
  {
    path: 'task-list',
    loadComponent: () => import('./task-list/task-list.page').then( m => m.TaskListPage)
  },
  {
    path: 'dispatch',
    loadComponent: () => import('./pages/dispatch/dispatch.page').then( m => m.DispatchPage)
  },
  {
    path: 'attendance-admin',
    loadComponent: () => import('./pages/attendance-admin/attendance-admin.page').then( m => m.AttendanceAdminPage)
  },
  {
    path: 'work-records',
    loadComponent: () => import('./pages/work-records-admin/work-records-admin.page').then( m => m.WorkRecordsAdminPage)
  },
  {
    path: 'exception-approval',
    loadComponent: () => import('./pages/exception-approval/exception-approval.page').then( m => m.ExceptionApprovalPage)
  },
  {
    path: 'exception-reports',
    loadComponent: () => import('./pages/exception-reports/exception-reports.page').then( m => m.ExceptionReportsPage)
  },
  {
    path: 'efficiency-calc',
    loadComponent: () => import('./pages/efficiency-calc/efficiency-calc.page').then( m => m.EfficiencyCalcPage)
  },
  {
    path: 'manager-home',
    loadComponent: () => import('./pages/manager-home/manager-home.page').then( m => m.ManagerHomePage)
  },
];

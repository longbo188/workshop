import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Capacitor } from '@capacitor/core';
import {
  BoardDayColumn,
  buildBoardColumnsFromDateKeys,
  formatDateOnly,
  getProductionBoardFetchRange,
  isDateKeyInRange,
  productionTimeDateKey
} from '../../utils/production-board-dates';
import {
  BoardPhaseKey,
  areAllBoardKanbanPhasesCompleted,
  getPhaseDisplayStatus,
  getPhaseStatusLabel
} from '../../utils/phase-status';

/** 看板卡片右侧四阶段：展示负责人姓名 */
const BOARD_TABLE_PHASE_COLUMNS: { key: BoardPhaseKey; title: string }[] = [
  { key: 'machining', title: '机加' },
  { key: 'electrical', title: '电控' },
  { key: 'pre_assembly', title: '总装前段' },
  { key: 'post_assembly', title: '总装后段' }
];

const PHASE_ASSIGNEE_NAME_FIELD: Record<
  'machining' | 'electrical' | 'pre_assembly' | 'post_assembly',
  string
> = {
  machining: 'machining_assignee_name',
  electrical: 'electrical_assignee_name',
  pre_assembly: 'pre_assembly_assignee_name',
  post_assembly: 'post_assembly_assignee_name'
};

const PHASE_ASSIGNEE_ID_FIELD: Record<
  'machining' | 'electrical' | 'pre_assembly' | 'post_assembly',
  string
> = {
  machining: 'machining_assignee',
  electrical: 'electrical_assignee',
  pre_assembly: 'pre_assembly_assignee',
  post_assembly: 'post_assembly_assignee'
};

/** 任务较少时优先达到的行高；放不下时按视口均分并不低于 FLOOR */
const TASK_ROW_MIN_PX = 96;
const TASK_ROW_FLOOR_PX = 52;
const MONTH_TARGET_STORAGE_PREFIX = 'production-board-month-target-';

@Component({
  selector: 'app-production-board',
  templateUrl: './production-board.page.html',
  styleUrls: ['./production-board.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonButtons,
    IonIcon,
    IonSpinner,
    FormsModule
  ]
})
export class ProductionBoardPage implements OnInit, AfterViewInit, OnDestroy {
  isLoading = true;
  errorMsg = '';
  tasks: any[] = [];
  dayColumns: BoardDayColumn[] = [];
  /** 仅含当天有任务的日期列 */
  visibleDayColumns: BoardDayColumn[] = [];
  private thisWeekMondayKey = '';
  private boardRange = getProductionBoardFetchRange();
  periodStart = '';
  periodEnd = '';
  lastRefreshedAt: Date | null = null;
  nextRefreshAt: Date | null = null;

  readonly phaseColumns = BOARD_TABLE_PHASE_COLUMNS;

  @ViewChild('boardGrid') boardGrid?: ElementRef<HTMLElement>;

  private http = inject(HttpClient);
  private router = inject(Router);
  private refreshTimer?: ReturnType<typeof setInterval>;
  private clockTimer?: ReturnType<typeof setInterval>;
  private gridResizeObserver?: ResizeObserver;
  private resizeObservedEl?: HTMLElement;
  private readonly onFullscreenChange = () => this.scheduleTaskRowHeightUpdate();
  private userNameById = new Map<number, string>();
  now = new Date();
  /** 当月目标台数（按自然月本地存储） */
  monthlyTarget: number | null = null;
  monthTargetMonthKey = '';
  monthStatsYearMonth = '';
  /** 当月总装后段完成台数（post_assembly_complete_time 归属当月） */
  monthAllPhasesCompletedCount = 0;

  get monthTargetTitle(): string {
    if (!this.monthTargetMonthKey) return '月度目标';
    const [y, m] = this.monthTargetMonthKey.split('-');
    const monthNum = Number(m);
    return `${y}年${monthNum}月月度目标`;
  }

  get monthStatsTitle(): string {
    if (!this.monthStatsYearMonth) return '当月';
    const [y, m] = this.monthStatsYearMonth.split('-');
    return `${y}年${Number(m)}月`;
  }

  ngOnInit(): void {
    const userStr = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    const user = userStr ? JSON.parse(userStr) : null;
    const role = user?.role;
    if (!user || !['admin', 'supervisor', 'manager'].includes(role)) {
      this.router.navigate(['/home']);
      return;
    }

    this.loadMonthlyTarget();
    this.loadBoard();
    this.refreshTimer = setInterval(() => this.loadBoard(), 60 * 60 * 1000);
    this.clockTimer = setInterval(() => {
      this.now = new Date();
      this.syncMonthlyTargetMonthKey();
    }, 30_000);
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    window.visualViewport?.addEventListener('resize', this.onFullscreenChange);
  }

  ngAfterViewInit(): void {
    this.attachGridResizeObserver();
    this.scheduleTaskRowHeightUpdate();
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    if (this.clockTimer) clearInterval(this.clockTimer);
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    window.visualViewport?.removeEventListener('resize', this.onFullscreenChange);
    this.gridResizeObserver?.disconnect();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.scheduleTaskRowHeightUpdate();
  }

  private getMonthStorageKey(d = new Date()): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  private loadMonthlyTarget(): void {
    this.monthTargetMonthKey = this.getMonthStorageKey();
    const raw = localStorage.getItem(`${MONTH_TARGET_STORAGE_PREFIX}${this.monthTargetMonthKey}`);
    if (raw == null || raw.trim() === '') {
      this.monthlyTarget = null;
      return;
    }
    const n = Number(raw);
    this.monthlyTarget = Number.isFinite(n) ? n : null;
  }

  private syncMonthlyTargetMonthKey(): void {
    const key = this.getMonthStorageKey();
    if (key === this.monthTargetMonthKey) return;
    this.loadMonthlyTarget();
  }

  saveMonthlyTarget(): void {
    const storageKey = `${MONTH_TARGET_STORAGE_PREFIX}${this.monthTargetMonthKey}`;
    if (this.monthlyTarget == null || (this.monthlyTarget as unknown) === '') {
      localStorage.removeItem(storageKey);
      return;
    }
    const n = Math.max(0, Math.floor(Number(this.monthlyTarget)));
    this.monthlyTarget = Number.isFinite(n) ? n : null;
    if (this.monthlyTarget == null) {
      localStorage.removeItem(storageKey);
      return;
    }
    localStorage.setItem(storageKey, String(this.monthlyTarget));
  }

  private getApiBase(): string {
    const isNative = Capacitor.isNativePlatform();
    return isNative ? environment.apiBase.replace('localhost', '10.0.2.2') : environment.apiBase;
  }

  loadBoard(): void {
    this.isLoading = true;
    this.errorMsg = '';
    const base = this.getApiBase();
    forkJoin({
      board: this.http.get<any>(`${base}/api/dashboard/production-board`),
      users: this.http.get<any[]>(`${base}/api/users`)
    }).subscribe({
      next: ({ board, users }) => {
        this.userNameById = new Map();
        for (const u of users || []) {
          if (u?.id == null) continue;
          const name = u?.name != null ? String(u.name).trim() : '';
          if (name) this.userNameById.set(Number(u.id), name);
        }
        this.periodStart = board?.periodStart || '';
        this.periodEnd = board?.periodEnd || '';
        this.monthStatsYearMonth = board?.monthStatsYearMonth || this.getMonthStorageKey();
        this.monthAllPhasesCompletedCount = Number(board?.monthAllPhasesCompletedCount) || 0;
        const rawTasks = Array.isArray(board?.tasks) ? board.tasks : [];
        this.tasks = rawTasks.map((t: any) => this.enrichTaskAssigneeNames(t));
        this.refreshVisibleDayColumns();
        this.dayColumns = this.visibleDayColumns;
        this.lastRefreshedAt = new Date();
        this.nextRefreshAt = new Date(Date.now() + 60 * 60 * 1000);
        this.isLoading = false;
        this.scheduleTaskRowHeightUpdate();
      },
      error: (err) => {
        this.errorMsg = err?.error?.error || err?.message || '加载看板失败';
        this.isLoading = false;
      }
    });
  }

  /** 按视口高度与全板最多任务数，统一放大任务行高以铺满一屏 */
  private scheduleTaskRowHeightUpdate(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.attachGridResizeObserver();
        this.updateAdaptiveTaskRowHeight();
      });
    });
  }

  private attachGridResizeObserver(): void {
    const grid = this.boardGrid?.nativeElement;
    const shell = grid?.closest('.board-shell') as HTMLElement | null;
    const target = shell ?? grid;
    if (!target || typeof ResizeObserver === 'undefined') return;
    if (this.gridResizeObserver && this.resizeObservedEl === target) return;

    this.gridResizeObserver?.disconnect();
    this.gridResizeObserver = new ResizeObserver(() => this.updateAdaptiveTaskRowHeight());
    this.gridResizeObserver.observe(target);
    this.resizeObservedEl = target;
  }

  private measureTaskAreaHeightPx(grid: HTMLElement): number {
    const bodyEl = grid.querySelector('.board-day-body') as HTMLElement | null;
    if (bodyEl && bodyEl.clientHeight > 0) {
      return bodyEl.clientHeight;
    }

    const dayEl = grid.querySelector('.board-day') as HTMLElement | null;
    const headerEl = dayEl?.querySelector('.board-day-header') as HTMLElement | null;
    const headerH = headerEl?.offsetHeight ?? 32;

    if (dayEl && dayEl.clientHeight > 0) {
      return Math.max(0, dayEl.clientHeight - headerH);
    }

    const shell = grid.closest('.board-shell') as HTMLElement | null;
    if (shell && shell.clientHeight > 0) {
      const meta = shell.querySelector('.board-meta-bar') as HTMLElement | null;
      const metaH = meta?.offsetHeight ?? 0;
      return Math.max(0, shell.clientHeight - metaH - headerH);
    }

    const gridTop = grid.getBoundingClientRect().top;
    const viewportH = window.visualViewport?.height ?? window.innerHeight;
    return Math.max(0, Math.floor(viewportH - gridTop - headerH));
  }

  private getRowLinePx(grid: HTMLElement): number {
    const raw = getComputedStyle(grid).getPropertyValue('--board-row-line').trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 3;
  }

  private updateAdaptiveTaskRowHeight(): void {
    const grid = this.boardGrid?.nativeElement;
    if (!grid) return;

    const cols = this.visibleDayColumns.length ? this.visibleDayColumns : this.dayColumns;
    const maxTasks = Math.max(1, ...cols.map((d) => d.tasks.length));
    const available = this.measureTaskAreaHeightPx(grid);
    if (available <= 0) return;

    const rowLinePx = this.getRowLinePx(grid);
    grid.style.setProperty('--board-slot-count', String(maxTasks));
    const rowH = this.computeTaskRowHeightPx(grid, maxTasks, available);
    if (rowH > 0) {
      grid.style.setProperty('--board-task-row-h', `${rowH}px`);
    }
    this.scrollTodayColumnIntoView();

    // 布局稳定后再测算一次（双 rAF），消除亚像素裁切
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const remeasure = this.measureTaskAreaHeightPx(grid);
        if (remeasure <= 0) return;
        const rowH2 = this.computeTaskRowHeightPx(grid, maxTasks, remeasure);
        if (rowH2 > 0 && rowH2 !== rowH) {
          grid.style.setProperty('--board-task-row-h', `${rowH2}px`);
        }
      });
    });
  }

  /** 行高 + 行间线须落在 available 内，略留余量避免最后一行被裁切 */
  private computeTaskRowHeightPx(grid: HTMLElement, maxTasks: number, available: number): number {
    const rowLinePx = this.getRowLinePx(grid);
    const borderTotal = maxTasks > 1 ? (maxTasks - 1) * rowLinePx : 0;
    const layoutFudgePx = 8 + maxTasks * 2;
    const contentAvailable = Math.max(0, available - borderTotal - layoutFudgePx);

    if (contentAvailable <= 0) return TASK_ROW_FLOOR_PX;

    let rowH = Math.floor(contentAvailable / maxTasks);
    const maxRowH = Math.floor(contentAvailable / maxTasks);
    if (maxTasks * TASK_ROW_MIN_PX <= contentAvailable) {
      rowH = Math.max(TASK_ROW_MIN_PX, rowH);
    } else {
      rowH = Math.max(TASK_ROW_FLOOR_PX, rowH);
    }
    rowH = Math.min(rowH, maxRowH);
    return Math.max(TASK_ROW_FLOOR_PX, rowH - 1);
  }

  /** 当天列在横向可滚动时尽量完整露出 */
  private scrollTodayColumnIntoView(): void {
    const grid = this.boardGrid?.nativeElement;
    if (!grid) return;
    const pane = grid.querySelector('.board-week-pane') as HTMLElement | null;
    const today = grid.querySelector('.board-day--today') as HTMLElement | null;
    if (!pane || !today) return;

    requestAnimationFrame(() => {
      const paneRect = pane.getBoundingClientRect();
      const todayRect = today.getBoundingClientRect();
      if (todayRect.left >= paneRect.left && todayRect.right <= paneRect.right) return;

      const target =
        today.offsetLeft - Math.max(0, (pane.clientWidth - today.offsetWidth) / 2);
      pane.scrollLeft = Math.max(0, target);
    });
  }

  formatDateTime(d: Date | null): string {
    if (!d) return '-';
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatProductionDate(value: string | null): string {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return formatDateOnly(d);
  }

  /** 承诺交付：右图样式 10.29 */
  formatDeliveryShort(value: string | null): string {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '-';
    return `${d.getMonth() + 1}.${d.getDate()}`;
  }

  isToday(day: BoardDayColumn): boolean {
    return day.dateKey === formatDateOnly(new Date());
  }

  /** 本周第一天（有任务时用于列分隔） */
  isThisWeekStartDay(day: BoardDayColumn): boolean {
    return !!this.thisWeekMondayKey && day.dateKey === this.thisWeekMondayKey;
  }

  private refreshVisibleDayColumns(): void {
    this.boardRange = getProductionBoardFetchRange();
    this.thisWeekMondayKey = this.boardRange.thisWeekMondayKey;

    const allByDate = new Map<string, any[]>();
    for (const task of this.tasks) {
      const key = productionTimeDateKey(task.production_time);
      if (!key) continue;
      if (!allByDate.has(key)) allByDate.set(key, []);
      allByDate.get(key)!.push(task);
    }

    const sortedKeys = [...allByDate.keys()]
      .filter((dateKey) => this.shouldShowDayColumn(dateKey, allByDate.get(dateKey) || []))
      .sort();

    this.visibleDayColumns = buildBoardColumnsFromDateKeys(allByDate, sortedKeys);
  }

  /**
   * 是否展示该日列：当天有任务则全显示；其他日若有任一台四阶段未全部完成，则当日任务全部显示
   */
  private shouldShowDayColumn(dateKey: string, dayTasks: any[]): boolean {
    if (!dayTasks.length) return false;
    const r = this.boardRange;
    if (dateKey === r.todayKey) return true;

    const hasIncomplete = dayTasks.some((t) => !areAllBoardKanbanPhasesCompleted(t));
    if (!hasIncomplete) return false;

    if (isDateKeyInRange(dateKey, r.lastThisStartKey, r.lastThisEndKey)) return true;
    if (isDateKeyInRange(dateKey, r.thirtyStartKey, r.todayKey)) return true;
    return false;
  }

  phaseLabel(task: any, phaseKey: BoardPhaseKey): string {
    return getPhaseStatusLabel(getPhaseDisplayStatus(task, phaseKey));
  }

  /** 单元格短文案，便于一屏展示 */
  phaseShortLabel(task: any, phaseKey: BoardPhaseKey): string {
    switch (getPhaseDisplayStatus(task, phaseKey)) {
      case 'completed':
        return '完';
      case 'in_progress':
        return '中';
      case 'paused':
        return '停';
      default:
        return '未';
    }
  }

  phaseClass(task: any, phaseKey: BoardPhaseKey): string {
    return `phase-slot phase-${getPhaseDisplayStatus(task, phaseKey)}`;
  }

  private enrichTaskAssigneeNames(task: any): any {
    const enriched = { ...task };
    const phases = ['machining', 'electrical', 'pre_assembly', 'post_assembly'] as const;
    for (const phase of phases) {
      const nameField = PHASE_ASSIGNEE_NAME_FIELD[phase];
      const idField = PHASE_ASSIGNEE_ID_FIELD[phase];
      const existing = enriched[nameField];
      if (existing != null && String(existing).trim()) continue;
      const id = enriched[idField];
      if (id == null || id === '' || id === 0) continue;
      const resolved = this.userNameById.get(Number(id));
      if (resolved) enriched[nameField] = resolved;
    }
    return enriched;
  }

  phaseAssigneeName(task: any, phaseKey: BoardPhaseKey): string {
    if (
      phaseKey !== 'machining' &&
      phaseKey !== 'electrical' &&
      phaseKey !== 'pre_assembly' &&
      phaseKey !== 'post_assembly'
    ) {
      return '-';
    }
    const nameRaw = task?.[PHASE_ASSIGNEE_NAME_FIELD[phaseKey]];
    if (nameRaw != null && String(nameRaw).trim()) {
      return String(nameRaw).trim();
    }
    const id = task?.[PHASE_ASSIGNEE_ID_FIELD[phaseKey]];
    if (id != null && id !== '' && id !== 0) {
      const resolved = this.userNameById.get(Number(id));
      if (resolved) return resolved;
      return `用户#${id}`;
    }
    return '-';
  }

  phaseSlotTitle(task: any, phaseKey: BoardPhaseKey, phaseTitle: string): string {
    return `${phaseTitle} · ${this.phaseAssigneeName(task, phaseKey)} · ${this.phaseLabel(task, phaseKey)}`;
  }

  goBack(): void {
    this.router.navigate(['/dispatch']);
  }

  toggleFullscreen(): void {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
    this.scheduleTaskRowHeightUpdate();
  }
}

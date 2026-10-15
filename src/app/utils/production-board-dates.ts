/** 格式化为 YYYY-MM-DD（本地日历日） */
export function formatDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 上周周一 ~ 本周周日（共 14 天）。
 * 例：周六 10-10 → 9.29（上周一）~ 10-11（本周日）
 */
export function getLastAndThisWeekRange(now = new Date()): { start: Date; end: Date } {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = d.getDay();
  const offsetToMonday = day === 0 ? 5 : day - 1;
  const thisWeekMonday = new Date(d);
  thisWeekMonday.setDate(d.getDate() - offsetToMonday);
  const start = new Date(thisWeekMonday);
  start.setDate(thisWeekMonday.getDate() - 7);
  const end = new Date(thisWeekMonday);
  end.setDate(thisWeekMonday.getDate() + 6);
  return { start, end };
}

/** @deprecated 请使用 getLastAndThisWeekRange */
export function getThisAndNextWeekRange(now = new Date()): { start: Date; end: Date } {
  return getLastAndThisWeekRange(now);
}

export const BOARD_INCOMPLETE_LOOKBACK_DAYS = 30;

export function getTodayDateKey(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return formatDateOnly(d);
}

export function getDateKeyDaysAgo(days: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - days);
  return formatDateOnly(d);
}

export function isDateKeyInRange(dateKey: string, startKey: string, endKey: string): boolean {
  return dateKey >= startKey && dateKey <= endKey;
}

/** 接口拉取区间 + 上周/本周、近 30 天窗口（展示规则用） */
export function getProductionBoardFetchRange(now = new Date()) {
  const { start: lastThisStart, end: lastThisEnd } = getLastAndThisWeekRange(now);
  const lastThisStartKey = formatDateOnly(lastThisStart);
  const lastThisEndKey = formatDateOnly(lastThisEnd);
  const todayKey = getTodayDateKey(now);
  const thirtyStartKey = getDateKeyDaysAgo(BOARD_INCOMPLETE_LOOKBACK_DAYS, now);
  const fetchStartKey = lastThisStartKey < thirtyStartKey ? lastThisStartKey : thirtyStartKey;
  const fetchEndKey = lastThisEndKey;
  const thisWeekMonday = new Date(lastThisStart);
  thisWeekMonday.setDate(thisWeekMonday.getDate() + 7);
  return {
    fetchStartKey,
    fetchEndKey,
    lastThisStartKey,
    lastThisEndKey,
    thirtyStartKey,
    todayKey,
    thisWeekMondayKey: formatDateOnly(thisWeekMonday)
  };
}

export function isProductionTimeInRange(
  productionTime: string | null | undefined,
  start: Date,
  end: Date
): boolean {
  if (!productionTime) return false;
  const t = new Date(productionTime);
  if (isNaN(t.getTime())) return false;
  t.setHours(0, 0, 0, 0);
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(23, 59, 59, 999);
  return t >= s && t <= e;
}

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 从 production_time 取本地日期 YYYY-MM-DD */
export function productionTimeDateKey(productionTime: string | null | undefined): string | null {
  if (!productionTime) return null;
  const t = new Date(productionTime);
  if (isNaN(t.getTime())) return null;
  return formatDateOnly(t);
}

export interface BoardDayColumn {
  dateKey: string;
  /** 兼容旧展示：如 10/5 周一 */
  headerLabel: string;
  weekdayLabel: string;
  /** 如 10-5 */
  dateLabel: string;
  tasks: any[];
}

/** 按开工日期生成 14 天列（含空日） */
export function buildBoardDayColumns(
  periodStart: string,
  periodEnd: string,
  tasks: any[]
): BoardDayColumn[] {
  if (!periodStart || !periodEnd) return [];

  const byDate = new Map<string, any[]>();
  for (const task of tasks) {
    const key = productionTimeDateKey(task.production_time);
    if (!key) continue;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(task);
  }

  const start = new Date(`${periodStart}T00:00:00`);
  const end = new Date(`${periodEnd}T00:00:00`);
  const columns: BoardDayColumn[] = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateKey = formatDateOnly(d);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekday = WEEKDAY_LABELS[d.getDay()];
    columns.push({
      dateKey,
      headerLabel: `${month}/${day} ${weekday}`,
      weekdayLabel: weekday,
      dateLabel: `${month}-${day}`,
      tasks: byDate.get(dateKey) || []
    });
  }

  return columns;
}

export function makeBoardDayColumn(dateKey: string, tasks: any[]): BoardDayColumn {
  const d = new Date(`${dateKey}T00:00:00`);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = WEEKDAY_LABELS[d.getDay()];
  return {
    dateKey,
    headerLabel: `${month}/${day} ${weekday}`,
    weekdayLabel: weekday,
    dateLabel: `${month}-${day}`,
    tasks
  };
}

/** 按日期键顺序生成列（仅含传入的任务分组） */
export function buildBoardColumnsFromDateKeys(
  byDate: Map<string, any[]>,
  sortedDateKeys: string[]
): BoardDayColumn[] {
  return sortedDateKeys.map((dateKey) => makeBoardDayColumn(dateKey, byDate.get(dateKey) || []));
}

export type BoardPhaseKey =
  | 'machining'
  | 'electrical'
  | 'pre_assembly'
  | 'post_assembly'
  | 'debugging';

export type PhaseDisplayStatus = 'completed' | 'in_progress' | 'paused' | 'not_started';

const PHASE_FIELD: Record<BoardPhaseKey, string> = {
  machining: 'machining_phase',
  electrical: 'electrical_phase',
  pre_assembly: 'pre_assembly_phase',
  post_assembly: 'post_assembly_phase',
  debugging: 'debugging_phase'
};

function isTruthyPhaseComplete(raw: unknown): boolean {
  if (raw == null) return false;
  const normalized = String(raw).trim().toLowerCase();
  return ['1', 'true', 'completed', 'complete', 'done', 'yes', 'y'].includes(normalized);
}

export function isPhaseCompleted(task: any, phaseKey: BoardPhaseKey): boolean {
  if (!task) return false;
  const field = PHASE_FIELD[phaseKey];
  return isTruthyPhaseComplete(task[field]);
}

export function isPhasePaused(task: any, phaseKey: BoardPhaseKey): boolean {
  if (!task || isPhaseCompleted(task, phaseKey)) return false;
  const v = task[`${phaseKey}_paused_at`];
  return v != null && v !== '';
}

export function isPhaseInProgress(task: any, phaseKey: BoardPhaseKey): boolean {
  if (!task || isPhaseCompleted(task, phaseKey) || isPhasePaused(task, phaseKey)) {
    return false;
  }
  return !!task[`${phaseKey}_start_time`];
}

export function getPhaseDisplayStatus(task: any, phaseKey: BoardPhaseKey): PhaseDisplayStatus {
  if (isPhaseCompleted(task, phaseKey)) return 'completed';
  if (isPhasePaused(task, phaseKey)) return 'paused';
  if (isPhaseInProgress(task, phaseKey)) return 'in_progress';
  return 'not_started';
}

export function getPhaseStatusLabel(status: PhaseDisplayStatus): string {
  switch (status) {
    case 'completed':
      return '已完成';
    case 'in_progress':
      return '进行中';
    case 'paused':
      return '已暂停';
    default:
      return '未开工';
  }
}

/** 生产看板卡片展示的四阶段（不含调试） */
export const BOARD_KANBAN_PHASE_KEYS: BoardPhaseKey[] = [
  'machining',
  'electrical',
  'pre_assembly',
  'post_assembly'
];

export function areAllBoardKanbanPhasesCompleted(task: any): boolean {
  return BOARD_KANBAN_PHASE_KEYS.every((key) => isPhaseCompleted(task, key));
}

export const BOARD_PHASE_COLUMNS: { key: BoardPhaseKey; label: string }[] = [
  { key: 'machining', label: '机加' },
  { key: 'electrical', label: '电控' },
  { key: 'pre_assembly', label: '总装前段' },
  { key: 'post_assembly', label: '总装后段' },
  { key: 'debugging', label: '调试' }
];

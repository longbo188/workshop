export interface ExceptionTypeOption {
  value: string;
  label: string;
  scopeExample: string;
}

/** 员工可选的异常类型；范围示例仅作展示，不可单独选择 */
export const EXCEPTION_TYPES: ExceptionTypeOption[] = [
  {
    value: '生产',
    label: '生产',
    scopeExample: '工序内部品质问题、帮忙包装、临时安排（5S、整理工具等），不含协助装配'
  },
  {
    value: '工程',
    label: '工程',
    scopeExample: 'BOM物料错误、指导书/说明书问题等'
  },
  {
    value: '研发',
    label: '研发',
    scopeExample: '设计问题'
  },
  {
    value: 'PMC',
    label: 'PMC',
    scopeExample: '库存机改造、样机改造、返厂改造、缺料或替代料'
  },
  {
    value: '仓库',
    label: '仓库',
    scopeExample: '发错物料'
  },
  {
    value: '品质',
    label: '品质',
    scopeExample: '来料品质问题'
  },
  {
    value: '销售',
    label: '销售',
    scopeExample: '需求变更'
  },
  {
    value: '其他',
    label: '其他',
    scopeExample: '其他部门借调人员、管理工时等'
  }
];

export function getExceptionScopeExample(type: string): string {
  const found = EXCEPTION_TYPES.find(t => t.value === type);
  return found?.scopeExample || '';
}

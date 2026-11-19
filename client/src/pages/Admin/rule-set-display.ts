import type {
  AdminSummaryItem,
  PositionAdminSummaryItem,
  RuleSetConfig,
  RuleSetRecord,
} from '@shared/api.interface';

// ===== HQ（总部）维度 code → 数据字段映射 =====
const HQ_DIM_FIELD_MAP: Record<string, keyof AdminSummaryItem> = {
  value: 'valueAvg',
  ability: 'abilityAvg',
  will: 'willAvg',
  performance: 'performanceScore',
  performanceScore: 'performanceScore',
  totalScore: 'performanceScore',
  total: 'performanceScore',
};

// ===== 分岗维度 code → 数据字段映射 =====
const POSITION_DIM_FIELD_MAP: Record<string, keyof PositionAdminSummaryItem> = {
  performance: 'performanceScore',
  value: 'valueAvg',
  will: 'willAvg',
  comprehensive: 'comprehensiveScore',
  total: 'totalScore',
};

export interface AxisDisplayInfo {
  /** 轴上展示的名称 */
  label: string;
  /** 对应数据字段名 */
  fieldKey: string;
}

/**
 * 从规则集配置中查找维度或合成维度的显示名称
 */
const TOTAL_DIMENSION_NAMES: Record<string, string> = {
  performance: '表现分',
  performanceScore: '表现分',
  totalScore: '总分',
  total: '总分',
};

function findDimensionName(config: RuleSetConfig, code: string): string {
  const dim = config.dimensions.find((d) => d.code === code);
  if (dim) return dim.name;
  const comp = config.compositeDimensions?.find((d) => d.code === code);
  if (comp) return comp.name;
  if (TOTAL_DIMENSION_NAMES[code]) return TOTAL_DIMENSION_NAMES[code];
  return code;
}

/**
 * 获取 HQ 散点图 X/Y 轴的显示信息
 */
export function getHqAxisInfo(
  ruleSet: RuleSetRecord | null | undefined,
  defaultXLabel: string,
  defaultYLabel: string,
): { x: AxisDisplayInfo; y: AxisDisplayInfo; xField: keyof AdminSummaryItem; yField: keyof AdminSummaryItem } {
  if (!ruleSet?.config) {
    return {
      x: { label: defaultXLabel, fieldKey: 'abilityAvg' },
      y: { label: defaultYLabel, fieldKey: 'performanceScore' },
      xField: 'abilityAvg',
      yField: 'performanceScore',
    };
  }
  const { config } = ruleSet;
  const xCode = config.xAxisDimension;
  const yCode = config.yAxisDimension;
  const xLabel = findDimensionName(config, xCode);
  const yLabel = findDimensionName(config, yCode);
  const xField = (HQ_DIM_FIELD_MAP[xCode] ?? 'performanceScore') as keyof AdminSummaryItem;
  const yField = (HQ_DIM_FIELD_MAP[yCode] ?? 'performanceScore') as keyof AdminSummaryItem;
  return {
    x: { label: xLabel, fieldKey: xField },
    y: { label: yLabel, fieldKey: yField },
    xField,
    yField,
  };
}

/**
 * 获取分岗散点图 X/Y 轴的显示信息
 */
export function getPositionAxisInfo(
  ruleSet: RuleSetRecord | null | undefined,
  defaultXLabel: string,
  defaultYLabel: string,
): { x: AxisDisplayInfo; y: AxisDisplayInfo; xField: keyof PositionAdminSummaryItem; yField: keyof PositionAdminSummaryItem } {
  if (!ruleSet?.config) {
    return {
      x: { label: defaultXLabel, fieldKey: 'comprehensiveScore' },
      y: { label: defaultYLabel, fieldKey: 'performanceScore' },
      xField: 'comprehensiveScore',
      yField: 'performanceScore',
    };
  }
  const { config } = ruleSet;
  const xCode = config.xAxisDimension;
  const yCode = config.yAxisDimension;
  const xLabel = findDimensionName(config, xCode);
  const yLabel = findDimensionName(config, yCode);
  const xField = (POSITION_DIM_FIELD_MAP[xCode] ?? 'comprehensiveScore') as keyof PositionAdminSummaryItem;
  const yField = (POSITION_DIM_FIELD_MAP[yCode] ?? 'performanceScore') as keyof PositionAdminSummaryItem;
  return {
    x: { label: xLabel, fieldKey: xField },
    y: { label: yLabel, fieldKey: yField },
    xField,
    yField,
  };
}

/**
 * 获取九宫格阈值（高分线 / 低分线）
 */
export function getGridThresholds(
  ruleSet: RuleSetRecord | null | undefined,
): { high: number; low: number } {
  const thresholds = ruleSet?.config?.gridThresholds;
  if (thresholds && typeof thresholds.high === 'number' && typeof thresholds.low === 'number') {
    return { high: thresholds.high, low: thresholds.low };
  }
  return { high: 4.0, low: 2.5 };
}

export interface HqDisplayColumn {
  code: string;
  name: string;
  fieldKey: keyof AdminSummaryItem;
}

/**
 * 获取 HQ 列表/表格中显示的均分列（按规则集 dimensions）
 * 加上 x 轴对应的"当前表现"列
 */
export function getHqDisplayColumns(
  ruleSet: RuleSetRecord | null | undefined,
): { dimensions: HqDisplayColumn[]; xAxisColumn: HqDisplayColumn } {
  const defaultDimensions: HqDisplayColumn[] = [
    { code: 'value', name: '价值观均分', fieldKey: 'valueAvg' },
    { code: 'ability', name: '能力均分', fieldKey: 'abilityAvg' },
    { code: 'will', name: '意愿均分', fieldKey: 'willAvg' },
  ];
  const defaultXAxis: HqDisplayColumn = {
    code: 'performance',
    name: '当前表现',
    fieldKey: 'performanceScore',
  };

  if (!ruleSet?.config) {
    return { dimensions: defaultDimensions, xAxisColumn: defaultXAxis };
  }
  const { config } = ruleSet;
  const dimensions: HqDisplayColumn[] = config.dimensions.map((dim) => ({
      code: dim.code,
      name: `${dim.name}均分`,
      fieldKey: (HQ_DIM_FIELD_MAP[dim.code] ?? 'valueAvg') as keyof AdminSummaryItem,
    }));

  const xCode = config.xAxisDimension;
  const xDim = config.dimensions.find((d) => d.code === xCode);
  const xComp = config.compositeDimensions?.find((d) => d.code === xCode);
  const xAxisColumn: HqDisplayColumn = {
    code: xCode,
    name: xDim?.name ?? xComp?.name ?? defaultXAxis.name,
    fieldKey: (HQ_DIM_FIELD_MAP[xCode] ?? 'performanceScore') as keyof AdminSummaryItem,
  };

  return { dimensions, xAxisColumn };
}

export interface PositionDisplayColumn {
  code: string;
  name: string;
  fieldKey: keyof PositionAdminSummaryItem;
}

/**
 * 获取分岗列表/表格中显示的均分列
 */
export function getPositionDisplayColumns(
  ruleSet: RuleSetRecord | null | undefined,
): PositionDisplayColumn[] {
  const defaults: PositionDisplayColumn[] = [
    { code: 'performance', name: '绩效分', fieldKey: 'performanceScore' },
    { code: 'value', name: '价值观', fieldKey: 'valueAvg' },
    { code: 'will', name: '意愿', fieldKey: 'willAvg' },
    { code: 'comprehensive', name: '综合分', fieldKey: 'comprehensiveScore' },
    { code: 'total', name: '总分', fieldKey: 'totalScore' },
  ];

  if (!ruleSet?.config) return defaults;

  // 按规则集维度 + 合成维度生成显示列
  const { config } = ruleSet;
  const cols: PositionDisplayColumn[] = [];

  for (const dim of config.dimensions) {
    const fieldKey = POSITION_DIM_FIELD_MAP[dim.code];
    if (fieldKey) {
      cols.push({ code: dim.code, name: dim.name, fieldKey });
    }
  }
  for (const comp of config.compositeDimensions ?? []) {
    const fieldKey = POSITION_DIM_FIELD_MAP[comp.code];
    if (fieldKey) {
      cols.push({ code: comp.code, name: comp.name, fieldKey });
    }
  }
  // total 总分如果没在合成维度里就补上
  if (!cols.some((c) => c.code === 'total')) {
    cols.push({ code: 'total', name: '总分', fieldKey: 'totalScore' });
  }
  return cols.length > 0 ? cols : defaults;
}

/**
 * 根据批次 id 从规则集列表中查找对应规则集
 */
export function findRuleSetByBatch(
  batches: ReviewBatchLike[] | null | undefined,
  ruleSets: RuleSetRecord[] | null | undefined,
  batchId: string,
): RuleSetRecord | null {
  if (!batchId || batchId === 'all') return null;
  const batch = batches?.find((b) => b.id === batchId);
  if (!batch) return null;
  return ruleSets?.find((r) => r.id === batch.ruleSetId) ?? null;
}

/** 最小批次类型，仅用于按 ruleSetId 查找 */
interface ReviewBatchLike {
  id: string;
  ruleSetId: string;
}

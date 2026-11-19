import type {
  ComprehensiveScores,
  ComputedMetrics,
  PerformanceItem,
  PositionType,
  GridCategory,
  RuleSetConfig,
  PositionTypeConfig,
  RuleDimension,
  EvidenceLevel,
  ScoreDimension,
} from '@shared/api.interface';

export interface PerformanceDimensionMeta {
  key: string;
  name: string;
  weight: number;
  desc12: string;
  desc3: string;
  desc45: string;
  evidenceHigh: string;
  evidenceMid: string;
  evidenceLow: string;
  hasTiers?: boolean;
  tier1Label?: string;
  tier2Label?: string;
  tier3Label?: string;
}

export const COMPREHENSIVE_DIMENSIONS: {
  key: keyof ComprehensiveScores;
  name: string;
  group: 'value' | 'will';
  desc12: string;
  desc3: string;
  desc45: string;
  evidenceHigh: string;
  evidenceMid: string;
  evidenceLow: string;
}[] = [
  {
    key: 'valueCoCreate',
    name: '共创共享认同',
    group: 'value',
    desc12: '不认同多劳多得、计较眼前得失',
    desc3: '认可机制、能接受按贡献分配',
    desc45: '主动把公司目标当自己目标、愿共担风险',
    evidenceHigh: '主动把公司目标当自己目标，愿共担风险、让渡个人短期利益',
    evidenceMid: '认可机制，能接受按贡献分配，按要求执行无抵触',
    evidenceLow: '对机制有保留、计较眼前得失，偶有抱怨、执行打折扣',
  },
  {
    key: 'valueCost',
    name: '成本利润意识',
    group: 'value',
    desc12: '不计投入产出',
    desc3: '做事基本考虑成本',
    desc45: '像花自己的钱一样、主动优化投入产出',
    evidenceHigh: '像花自己的钱一样，主动优化投入产出，有具体增效动作',
    evidenceMid: '做事基本考虑成本，无明显浪费也无主动优化',
    evidenceLow: '不计投入产出，存在浪费或不关心成本',
  },
  {
    key: 'valueOwnership',
    name: '主人翁与协同',
    group: 'value',
    desc12: '推诿、问题上交',
    desc3: '完成本职不添乱',
    desc45: '主动补位、结果导向、协同顺畅',
    evidenceHigh: '主动补位、结果导向，跨部门协同顺畅，问题不上交',
    evidenceMid: '完成本职不添乱，协同中被动配合',
    evidenceLow: '推诿、问题上交，协同不畅',
  },
  {
    key: 'willInitiative',
    name: '主动性',
    group: 'will',
    desc12: '安排才动',
    desc3: '本职内主动',
    desc45: '自带节奏主动推进',
    evidenceHigh: '自带节奏主动推进，无需催促',
    evidenceMid: '本职内主动，交办任务及时完成',
    evidenceLow: '安排才动，需要持续跟催',
  },
  {
    key: 'willGrowth',
    name: '成长意愿',
    group: 'will',
    desc12: '抗拒学习',
    desc3: '能接受新任务',
    desc45: '主动求教、接受挑战轮岗',
    evidenceHigh: '主动求教、接受挑战轮岗，有明显学习投入',
    evidenceMid: '能接受新任务，不抗拒学习',
    evidenceLow: '抗拒学习、安于现状',
  },
  {
    key: 'willStability',
    name: '稳定性与心态',
    group: 'will',
    desc12: '消极观望',
    desc3: '心态平稳',
    desc45: '稳定踏实、拥抱变革',
    evidenceHigh: '稳定踏实、拥抱变革，心态积极',
    evidenceMid: '心态平稳，无明显波动',
    evidenceLow: '消极观望，情绪波动或频现离职倾向',
  },
];

const PROFESSIONAL_DIMENSIONS: PerformanceDimensionMeta[] = [
  {
    key: 'professional_tier',
    name: '专业技术梯队',
    weight: 35,
    desc12: '第三梯队',
    desc3: '第二梯队',
    desc45: '第一梯队',
    evidenceHigh: '第一梯队：专业技术顶尖，学科带头人，能独立开展高难度项目',
    evidenceMid: '第二梯队：技术成熟，能独立完成常规工作，需继续提升',
    evidenceLow: '第三梯队：技术基础阶段，需带教指导',
    hasTiers: true,
    tier1Label: '第一梯队',
    tier2Label: '第二梯队',
    tier3Label: '第三梯队',
  },
  {
    key: 'customer_referral',
    name: '客户转介绍',
    weight: 15,
    desc12: '无转介绍',
    desc3: '有一定转介绍',
    desc45: '转介绍率高',
    evidenceHigh: '客户满意度高，转介绍量大，口碑传播效果好',
    evidenceMid: '客户评价良好，有一定转介绍基础',
    evidenceLow: '客户反馈一般，转介绍较少或无',
  },
  {
    key: 'work_quality',
    name: '工作质量',
    weight: 10,
    desc12: '质量缺陷多',
    desc3: '质量达标',
    desc45: '质量优秀',
    evidenceHigh: '工作质量优秀，流程规范，交付结果可靠，无明显差错',
    evidenceMid: '基本符合工作规范，无重大质量问题',
    evidenceLow: '存在质量缺陷或工作差错',
  },
  {
    key: 'work_standardization',
    name: '工作规范度',
    weight: 10,
    desc12: '工作规范性差',
    desc3: '工作基本规范',
    desc45: '工作规范优秀',
    evidenceHigh: '工作流程完整规范，可作为示范案例',
    evidenceMid: '工作基本符合规范，偶有瑕疵',
    evidenceLow: '工作不完整、不规范，需要整改',
  },
];

const SERVICE_DIMENSIONS: PerformanceDimensionMeta[] = [
  {
    key: 'collaboration',
    name: '协作配合',
    weight: 12,
    desc12: '协作配合差',
    desc3: '协作配合合格',
    desc45: '协作配合优秀',
    evidenceHigh: '跨岗位协作规范流畅，主动预判团队需求，配合质量高、节奏稳',
    evidenceMid: '能完成常规配合工作，基本符合协作要求',
    evidenceLow: '配合不熟练，经常需要提醒，协作有疏漏',
  },
  {
    key: 'scheduling_attendance',
    name: '排班出勤',
    weight: 10,
    desc12: '出勤差',
    desc3: '出勤正常',
    desc45: '出勤率高',
    evidenceHigh: '全勤无迟到早退，主动配合排班调整，责任心强',
    evidenceMid: '基本按时出勤，请假较少，不影响工作',
    evidenceLow: '缺勤或迟到较多，排班配合度差，影响团队运转',
  },
  {
    key: 'service_attitude',
    name: '服务态度',
    weight: 8,
    desc12: '态度差',
    desc3: '态度合格',
    desc45: '态度优秀',
    evidenceHigh: '主动热情，耐心细致，客户评价好，无投诉',
    evidenceMid: '服务态度合格，基本满足客户需求',
    evidenceLow: '服务态度冷淡，有客户投诉或反馈差',
  },
  {
    key: 'resource_management',
    name: '资源管理',
    weight: 5,
    desc12: '管理混乱',
    desc3: '基本规范',
    desc45: '管理优秀',
    evidenceHigh: '资源清点及时、使用节约，无浪费，主动优化资源管理',
    evidenceMid: '资源管理基本规范，无明显浪费或丢失',
    evidenceLow: '资源管理混乱，浪费严重或账目不清',
  },
  {
    key: 'service_tier',
    name: '服务能力梯队',
    weight: 35,
    desc12: '第三梯队',
    desc3: '第二梯队',
    desc45: '第一梯队',
    evidenceHigh: '第一梯队：服务能力精湛，能带教新人，处理复杂情况',
    evidenceMid: '第二梯队：能力熟练，能独立完成常规服务工作',
    evidenceLow: '第三梯队：能力基础阶段，需带教指导',
    hasTiers: true,
    tier1Label: '第一梯队',
    tier2Label: '第二梯队',
    tier3Label: '第三梯队',
  },
];

const OPERATIONS_DIMENSIONS: PerformanceDimensionMeta[] = [
  {
    key: 'service_attitude',
    name: '服务态度',
    weight: 20,
    desc12: '态度差',
    desc3: '态度合格',
    desc45: '态度优秀',
    evidenceHigh: '主动热情，耐心细致，客户评价好，无投诉',
    evidenceMid: '服务态度合格，基本满足客户需求',
    evidenceLow: '服务态度冷淡，有客户投诉或反馈差',
  },
  {
    key: 'responsibility',
    name: '责任心',
    weight: 20,
    desc12: '责任心弱',
    desc3: '基本尽责',
    desc45: '责任心强',
    evidenceHigh: '工作认真负责，主动跟进，做事让人放心',
    evidenceMid: '能完成本职工作，不出差错',
    evidenceLow: '工作敷衍，经常需要提醒或返工',
  },
  {
    key: 'system_proficiency',
    name: '系统操作熟练度',
    weight: 20,
    desc12: '不熟练',
    desc3: '基本熟练',
    desc45: '非常熟练',
    evidenceHigh: '操作系统熟练，效率高，能处理各种复杂情况',
    evidenceMid: '能独立操作，基本满足工作需要',
    evidenceLow: '操作不熟练，经常出错或需他人协助',
  },
  {
    key: 'communication',
    name: '沟通对接',
    weight: 20,
    desc12: '沟通差',
    desc3: '沟通合格',
    desc45: '沟通优秀',
    evidenceHigh: '沟通能力强，善于协调，客户满意度高',
    evidenceMid: '沟通基本顺畅，能完成对接工作',
    evidenceLow: '沟通方式不当，易引起误解或投诉',
  },
  {
    key: 'appearance',
    name: '仪容仪表',
    weight: 20,
    desc12: '不达标',
    desc3: '基本达标',
    desc45: '标准规范',
    evidenceHigh: '仪容仪表标准规范，职业形象好',
    evidenceMid: '仪容仪表基本符合要求',
    evidenceLow: '仪容仪表不规范，不符合职业要求',
  },
];

const CONSULTANT_DIMENSIONS: PerformanceDimensionMeta[] = [
  {
    key: 'consult_conversion',
    name: '咨询转化',
    weight: 70,
    desc12: '转化率低',
    desc3: '转化率达标',
    desc45: '转化率优秀',
    evidenceHigh: '咨询转化率高，谈单能力强，业绩突出',
    evidenceMid: '转化率达标，能完成基本业绩指标',
    evidenceLow: '转化率低，业绩未达标',
  },
  {
    key: 'service_attitude',
    name: '服务态度',
    weight: 6,
    desc12: '态度差',
    desc3: '态度合格',
    desc45: '态度优秀',
    evidenceHigh: '主动热情，耐心细致，客户评价好，无投诉',
    evidenceMid: '服务态度合格，基本满足客户需求',
    evidenceLow: '服务态度冷淡，有客户投诉或反馈差',
  },
  {
    key: 'responsibility',
    name: '责任心',
    weight: 6,
    desc12: '责任心弱',
    desc3: '基本尽责',
    desc45: '责任心强',
    evidenceHigh: '工作认真负责，主动跟进，做事让人放心',
    evidenceMid: '能完成本职工作，不出差错',
    evidenceLow: '工作敷衍，经常需要提醒或返工',
  },
  {
    key: 'system_proficiency',
    name: '系统操作熟练度',
    weight: 6,
    desc12: '不熟练',
    desc3: '基本熟练',
    desc45: '非常熟练',
    evidenceHigh: '操作系统熟练，效率高，能处理各种复杂情况',
    evidenceMid: '能独立操作，基本满足工作需要',
    evidenceLow: '操作不熟练，经常出错或需他人协助',
  },
  {
    key: 'communication',
    name: '沟通对接',
    weight: 6,
    desc12: '沟通差',
    desc3: '沟通合格',
    desc45: '沟通优秀',
    evidenceHigh: '沟通能力强，善于协调，客户满意度高',
    evidenceMid: '沟通基本顺畅，能完成对接工作',
    evidenceLow: '沟通方式不当，易引起误解或投诉',
  },
  {
    key: 'appearance',
    name: '仪容仪表',
    weight: 6,
    desc12: '不达标',
    desc3: '基本达标',
    desc45: '标准规范',
    evidenceHigh: '仪容仪表标准规范，职业形象好',
    evidenceMid: '仪容仪表基本符合要求',
    evidenceLow: '仪容仪表不规范，不符合职业要求',
  },
];

const MARKETING_DIMENSIONS: PerformanceDimensionMeta[] = [
  {
    key: 'performance_goal',
    name: '每月业绩目标达成',
    weight: 40,
    desc12: '远未达成',
    desc3: '基本达成',
    desc45: '超额达成',
    evidenceHigh: '月度业绩目标超额完成，业绩突出',
    evidenceMid: '业绩目标基本达成，符合预期',
    evidenceLow: '业绩目标远未达成，成效不佳',
  },
  {
    key: 'customer_acquisition',
    name: '获客量',
    weight: 25,
    desc12: '远未达成',
    desc3: '基本达成',
    desc45: '超额达成',
    evidenceHigh: '获客量超额完成目标，渠道拓展成效显著',
    evidenceMid: '获客量基本达成目标，符合预期',
    evidenceLow: '获客量远未达成目标，成效不佳',
  },
  {
    key: 'activity_execution',
    name: '活动执行',
    weight: 20,
    desc12: '执行差',
    desc3: '执行合格',
    desc45: '执行优秀',
    evidenceHigh: '活动策划执行到位，效果超预期，能独立操盘',
    evidenceMid: '活动能按计划执行，效果基本达标',
    evidenceLow: '活动执行混乱，效果差，经常出错',
  },
  {
    key: 'channel_development',
    name: '渠道开发',
    weight: 15,
    desc12: '开发成效差',
    desc3: '基本达成',
    desc45: '超额达成',
    evidenceHigh: '新渠道开拓能力强，合作资源丰富，超额完成开发目标',
    evidenceMid: '渠道开发基本达成目标',
    evidenceLow: '渠道开发成效差，未达成目标',
  },
];

const TEAM_LEAD_DIMENSIONS: PerformanceDimensionMeta[] = [
  {
    key: 'goal_achievement',
    name: '目标达成',
    weight: 25,
    desc12: '远未达成',
    desc3: '基本达成',
    desc45: '超额达成',
    evidenceHigh: '部门/团队目标超额完成，业绩突出',
    evidenceMid: '目标基本达成，符合预期',
    evidenceLow: '目标远未达成，业绩不佳',
  },
  {
    key: 'team_collaboration',
    name: '团队协作',
    weight: 25,
    desc12: '协作差',
    desc3: '协作合格',
    desc45: '协作优秀',
    evidenceHigh: '善于团队建设，跨部门协作顺畅，团队凝聚力强',
    evidenceMid: '团队协作基本顺畅，能完成工作配合',
    evidenceLow: '团队协作差，内耗严重，工作推进困难',
  },
  {
    key: 'team_management',
    name: '团队管理',
    weight: 25,
    desc12: '管理混乱',
    desc3: '管理合格',
    desc45: '管理优秀',
    evidenceHigh: '团队管理井井有条，善于发现和解决问题',
    evidenceMid: '团队管理基本到位，无重大问题',
    evidenceLow: '团队管理混乱，问题频发',
  },
  {
    key: 'service_awareness',
    name: '服务意识',
    weight: 25,
    desc12: '服务意识弱',
    desc3: '服务意识合格',
    desc45: '服务意识强',
    evidenceHigh: '服务意识强，主动提升客户体验，客户满意度高',
    evidenceMid: '服务意识基本到位，能满足客户基本需求',
    evidenceLow: '服务意识弱，对客户需求不敏感',
  },
];

export function getPerformanceDimensions(
  positionType: PositionType,
): PerformanceDimensionMeta[] {
  switch (positionType) {
    case 'professional':
      return PROFESSIONAL_DIMENSIONS;
    case 'service':
      return SERVICE_DIMENSIONS;
    case 'operations':
      return OPERATIONS_DIMENSIONS;
    case 'operations_lead':
      return OPERATIONS_DIMENSIONS;
    case 'consultant':
      return CONSULTANT_DIMENSIONS;
    case 'marketing':
      return MARKETING_DIMENSIONS;
    case 'team_lead':
      return TEAM_LEAD_DIMENSIONS;
    default:
      return OPERATIONS_DIMENSIONS;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computePositionMetrics(
  positionType: PositionType,
  performanceItems: Record<string, PerformanceItem>,
  comprehensive: ComprehensiveScores,
): ComputedMetrics {
  const dims = getPerformanceDimensions(positionType);
  const totalWeight = dims.reduce((sum: number, d: PerformanceDimensionMeta) => sum + d.weight, 0);

  let perfScore = 0;
  for (const d of dims) {
    const item = performanceItems[d.key];
    if (item && typeof item.score === 'number') {
      perfScore += (item.score * d.weight) / totalWeight;
    }
  }
  const performanceScore = round2(perfScore);

  const valueScores = [
    comprehensive.valueCoCreate?.score ?? 0,
    comprehensive.valueCost?.score ?? 0,
    comprehensive.valueOwnership?.score ?? 0,
  ];
  const willScores = [
    comprehensive.willInitiative?.score ?? 0,
    comprehensive.willGrowth?.score ?? 0,
    comprehensive.willStability?.score ?? 0,
  ];

  const valueAvg = round2(
    valueScores.reduce((a: number, b: number) => a + b, 0) / 3,
  );
  const willAvg = round2(
    willScores.reduce((a: number, b: number) => a + b, 0) / 3,
  );

  const comprehensiveScore = round2((valueAvg + willAvg) / 2);
  const totalScore = round2(performanceScore * 0.7 + comprehensiveScore * 0.3);

  const isRedLine = valueScores.some((s: number) => s > 0 && s <= 1);

  const gridCategory = computePositionGridCategory(isRedLine, performanceScore, comprehensiveScore);

  return {
    performanceScore,
    valueAvg,
    willAvg,
    comprehensiveScore,
    totalScore,
    gridCategory,
    isRedLine,
  };
}

export function validateScoreEvidenceAlignment(
  score: number,
  evidenceLevel: 'high' | 'mid' | 'low' | '',
): { valid: boolean; message: string } {
  if (!evidenceLevel || score === 0) return { valid: true, message: '' };
  if (evidenceLevel === 'high' && score !== 5) {
    return { valid: false, message: '事实依据为"高"时，分数限5分' };
  }
  if (evidenceLevel === 'mid' && (score < 3 || score > 4)) {
    return { valid: false, message: '事实依据为"中"时，分数限3-4分' };
  }
  if (evidenceLevel === 'low' && (score < 1 || score > 2)) {
    return { valid: false, message: '事实依据为"低"时，分数限1-2分' };
  }
  return { valid: true, message: '' };
}

export function computePositionGridCategory(
  isRedLine: boolean,
  performanceScore: number,
  comprehensiveScore: number,
): GridCategory {
  if (isRedLine) return 'red_line';
  if (performanceScore >= 4.0 && comprehensiveScore >= 4.0) return 'super_star';
  if (performanceScore >= 4.0 && comprehensiveScore >= 2.5) return 'performance_star';
  if (performanceScore >= 4.0 && comprehensiveScore < 2.5) return 'skilled_employee';
  if (performanceScore >= 2.5 && performanceScore < 4.0 && comprehensiveScore >= 4.0) return 'potential_star';
  if (
    performanceScore >= 2.5 &&
    performanceScore < 4.0 &&
    comprehensiveScore >= 2.5 &&
    comprehensiveScore < 4.0
  )
    return 'backbone';
  if (performanceScore >= 2.5 && performanceScore < 4.0 && comprehensiveScore < 2.5) return 'regular_employee';
  if (performanceScore < 2.5 && comprehensiveScore >= 4.0) return 'to_develop';
  if (performanceScore < 2.5 && comprehensiveScore >= 2.5) return 'gap_employee';
  return 'problem_employee';
}

// ============ 规则集辅助函数 ============

export interface RuleBasedPerformanceItem {
  code: string;
  name: string;
  maxScore: number;
  weight: number;
}

export interface RuleBasedDimensionItem {
  code: string;
  name: string;
  maxScore: number;
  sortOrder: number;
  // 所属维度组：value=价值观（红线），will=意愿
  group: 'value' | 'will';
  dimensionCode: string;
  dimensionName: string;
}

/**
 * 从规则集获取指定岗位类型的绩效项配置
 * 未找到时返回 null，调用方应 fallback 到硬编码
 */
export function getRuleSetPositionType(
  config: RuleSetConfig,
  positionType: string,
): PositionTypeConfig | null {
  if (!config.positionTypes || config.positionTypes.length === 0) return null;
  const found = config.positionTypes.find((pt) => pt.code === positionType);
  return found ?? null;
}

/**
 * 从规则集获取绩效项列表（按 sortOrder / 原顺序）
 */
export function getRuleSetPerformanceItems(
  config: RuleSetConfig,
  positionType: string,
): RuleBasedPerformanceItem[] {
  const pt = getRuleSetPositionType(config, positionType);
  if (!pt) return [];
  return pt.performanceItems.map((item) => ({
    code: item.code,
    name: item.name,
    maxScore: item.maxScore,
    weight: item.weight,
  }));
}

/**
 * 获取红线维度（价值观）
 */
export function getRedLineDimension(config: RuleSetConfig): RuleDimension | null {
  const dim = config.dimensions.find((d) => d.isRedLine);
  return dim ?? null;
}

/**
 * 获取意愿维度
 * 策略：取第一个非红线维度作为意愿维度
 */
export function getWillDimension(config: RuleSetConfig): RuleDimension | null {
  const dim = config.dimensions.find((d) => d.code === 'will');
  if (dim) return dim;
  const fallback = config.dimensions.find((d) => !d.isRedLine && d.items && d.items.length > 0);
  return fallback ?? null;
}

/**
 * 将规则集维度子项拍平为综合评分项列表
 * 每个子项携带 group（value/will）和所属维度信息
 */
export function getRuleSetComprehensiveItems(
  config: RuleSetConfig,
): RuleBasedDimensionItem[] {
  const items: RuleBasedDimensionItem[] = [];
  const redLineDim = getRedLineDimension(config);
  const willDim = getWillDimension(config);

  if (redLineDim) {
    for (const item of redLineDim.items) {
      items.push({
        code: item.code,
        name: item.name,
        maxScore: item.maxScore,
        sortOrder: item.sortOrder,
        group: 'value',
        dimensionCode: redLineDim.code,
        dimensionName: redLineDim.name,
      });
    }
  }

  if (willDim) {
    for (const item of willDim.items) {
      items.push({
        code: item.code,
        name: item.name,
        maxScore: item.maxScore,
        sortOrder: item.sortOrder,
        group: 'will',
        dimensionCode: willDim.code,
        dimensionName: willDim.name,
      });
    }
  }

  return items;
}

// itemCode → 主表字段名映射（价值观 3 项 + 意愿 3 项）
// 规则集子项 code 与主表字段名可能不一致，在此建立映射
const VALUE_FIELD_KEYS: Array<keyof ComprehensiveScores> = [
  'valueCoCreate',
  'valueCost',
  'valueOwnership',
];
const WILL_FIELD_KEYS: Array<keyof ComprehensiveScores> = [
  'willInitiative',
  'willGrowth',
  'willStability',
];

/**
 * 将规则集维度子项映射到 ComprehensiveScores 的字段名
 * 优先按 code 精确匹配；匹配不到时按顺序一一对应
 */
export function mapDimensionItemsToCompKeys(
  config: RuleSetConfig,
): Record<string, keyof ComprehensiveScores> {
  const mapping: Record<string, keyof ComprehensiveScores> = {};
  const redLineDim = getRedLineDimension(config);
  const willDim = getWillDimension(config);

  const allCompKeys: Array<keyof ComprehensiveScores> = [
    ...VALUE_FIELD_KEYS,
    ...WILL_FIELD_KEYS,
  ];

  if (redLineDim) {
    const valueItems = [...redLineDim.items].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    valueItems.forEach((item, idx) => {
      // 先尝试精确匹配 code
      const exactMatch = allCompKeys.find((k) => k === item.code);
      if (exactMatch) {
        mapping[item.code] = exactMatch;
      } else if (idx < VALUE_FIELD_KEYS.length) {
        // 按顺序对应
        mapping[item.code] = VALUE_FIELD_KEYS[idx];
      }
    });
  }

  if (willDim) {
    const willItems = [...willDim.items].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    willItems.forEach((item, idx) => {
      const exactMatch = allCompKeys.find((k) => k === item.code);
      if (exactMatch) {
        mapping[item.code] = exactMatch;
      } else if (idx < WILL_FIELD_KEYS.length) {
        mapping[item.code] = WILL_FIELD_KEYS[idx];
      }
    });
  }

  return mapping;
}

/**
 * 反向映射：主表字段名 → 规则集 item code
 */
export function mapCompKeysToItemCodes(
  config: RuleSetConfig,
): Record<string, string> {
  const forward = mapDimensionItemsToCompKeys(config);
  const reverse: Record<string, string> = {};
  for (const [itemCode, fieldKey] of Object.entries(forward)) {
    reverse[fieldKey] = itemCode;
  }
  return reverse;
}

/**
 * 将规则集绩效项 + 综合维度子项 转换为提交用的数据结构
 */
export function buildComprehensiveScoresFromRuleSet(
  config: RuleSetConfig,
  compItemScores: Record<string, ScoreDimension>,
): ComprehensiveScores {
  const mapping = mapDimensionItemsToCompKeys(config);
  const result = createRuleSetDefaultComprehensive();
  for (const [itemCode, fieldKey] of Object.entries(mapping)) {
    const item = compItemScores[itemCode];
    if (item) {
      result[fieldKey] = { score: item.score, evidence: item.evidence };
    }
  }
  return result;
}

function createRuleSetDefaultComprehensive(): ComprehensiveScores {
  return {
    valueCoCreate: { score: DEFAULT_SCORE, evidence: '' },
    valueCost: { score: DEFAULT_SCORE, evidence: '' },
    valueOwnership: { score: DEFAULT_SCORE, evidence: '' },
    willInitiative: { score: DEFAULT_SCORE, evidence: '' },
    willGrowth: { score: DEFAULT_SCORE, evidence: '' },
    willStability: { score: DEFAULT_SCORE, evidence: '' },
  };
}

const DEFAULT_SCORE = 3;

/**
 * 基于规则集计算岗位盘点指标
 */
export function computePositionMetricsFromRuleSet(
  config: RuleSetConfig,
  positionType: string,
  performanceItems: Record<string, PerformanceItem>,
  compItemScores: Record<string, ScoreDimension>,
): ComputedMetrics {
  // 绩效加权分
  const perfItems = getRuleSetPerformanceItems(config, positionType);
  const totalWeight = perfItems.reduce(
    (sum: number, item: RuleBasedPerformanceItem) => sum + item.weight,
    0,
  );
  let perfScore = 0;
  if (totalWeight > 0) {
    for (const item of perfItems) {
      const pItem = performanceItems[item.code];
      if (pItem && typeof pItem.score === 'number') {
        perfScore += (pItem.score * item.weight) / totalWeight;
      }
    }
  }
  const performanceScore = round2(perfScore);

  // 价值观均分（红线维度子项平均）
  const redLineDim = getRedLineDimension(config);
  const valueScores: number[] = [];
  if (redLineDim) {
    for (const item of redLineDim.items) {
      const s = compItemScores[item.code]?.score ?? 0;
      if (s > 0) valueScores.push(s);
    }
  }
  const valueAvg =
    valueScores.length > 0
      ? round2(valueScores.reduce((a: number, b: number) => a + b, 0) / valueScores.length)
      : 0;

  // 意愿均分
  const willDim = getWillDimension(config);
  const willScores: number[] = [];
  if (willDim) {
    for (const item of willDim.items) {
      const s = compItemScores[item.code]?.score ?? 0;
      if (s > 0) willScores.push(s);
    }
  }
  const willAvg =
    willScores.length > 0
      ? round2(willScores.reduce((a: number, b: number) => a + b, 0) / willScores.length)
      : 0;

  // 综合分 = 维度加权平均（按维度 weight）
  let comprehensiveScore = 0;
  let dimTotalWeight = 0;
  if (redLineDim && valueAvg > 0) {
    comprehensiveScore += valueAvg * redLineDim.weight;
    dimTotalWeight += redLineDim.weight;
  }
  if (willDim && willAvg > 0) {
    comprehensiveScore += willAvg * willDim.weight;
    dimTotalWeight += willDim.weight;
  }
  comprehensiveScore =
    dimTotalWeight > 0 ? round2(comprehensiveScore / dimTotalWeight) : 0;

  // 总分 = 绩效 70% + 综合 30%
  const totalScore = round2(performanceScore * 0.7 + comprehensiveScore * 0.3);

  // 红线判定：红线维度任一项 ≤ 2
  const isRedLine = valueScores.some((s: number) => s > 0 && s <= 1);

  // 九宫格落位（按 gridThresholds）
  const { high, low } = config.gridThresholds;
  const gridCategory = computeGridCategoryByThresholds(
    isRedLine,
    performanceScore,
    comprehensiveScore,
    high,
    low,
  );

  return {
    performanceScore,
    valueAvg,
    willAvg,
    comprehensiveScore,
    totalScore,
    gridCategory,
    isRedLine,
  };
}

function computeGridCategoryByThresholds(
  isRedLine: boolean,
  xScore: number,
  yScore: number,
  high: number,
  low: number,
): GridCategory {
  if (isRedLine) return 'red_line';
  if (xScore >= high && yScore >= high) return 'super_star';
  if (xScore >= high && yScore >= low) return 'performance_star';
  if (xScore >= high && yScore < low) return 'skilled_employee';
  if (xScore >= low && xScore < high && yScore >= high) return 'potential_star';
  if (xScore >= low && xScore < high && yScore >= low && yScore < high)
    return 'backbone';
  if (xScore >= low && xScore < high && yScore < low) return 'regular_employee';
  if (xScore < low && yScore >= high) return 'to_develop';
  if (xScore < low && yScore >= low) return 'gap_employee';
  return 'problem_employee';
}

/**
 * 按证据档位的分数区间校验分数-依据一致性
 */
export function validateScoreEvidenceLevel(
  score: number,
  evidenceLevelCode: string | null,
  evidenceLevels: EvidenceLevel[],
): { valid: boolean; message: string } {
  if (!evidenceLevelCode || score === 0) return { valid: true, message: '' };
  const level = evidenceLevels.find((l) => l.code === evidenceLevelCode);
  if (!level) return { valid: true, message: '' };
  if (score < level.minScore || score > level.maxScore) {
    return {
      valid: false,
      message: `分数需在 ${level.minScore}-${level.maxScore} 分之间（${level.name}档）`,
    };
  }
  return { valid: true, message: '' };
}

/**
 * 根据分数推断证据档位（用于加载已有记录时回填）
 */
export function inferEvidenceLevelFromScore(
  score: number,
  evidenceLevels: EvidenceLevel[],
): string | null {
  if (score === 0 || evidenceLevels.length === 0) return null;
  // 找第一个分数落入区间的档位
  const level = evidenceLevels.find(
    (l) => score >= l.minScore && score <= l.maxScore,
  );
  return level?.code ?? null;
}

/**
 * 校验规则集是否可用于指定岗位（必须有 positionTypes 和红线维度）
 */
export function canUseRuleSetForPosition(
  config: RuleSetConfig | null,
  positionType: PositionType,
): boolean {
  if (!config) return false;
  const pt = getRuleSetPositionType(config, positionType);
  if (!pt) return false;
  const redLine = getRedLineDimension(config);
  if (!redLine) return false;
  return true;
}

export const POSITION_TYPE_LABELS: Record<PositionType, string> = {
  professional: '专业技术岗',
  service: '客户服务岗',
  operations: '运营支持岗',
  operations_lead: '运营主管岗',
  consultant: '咨询顾问岗',
  marketing: '市场营销岗',
  team_lead: '团队负责人岗',
};

export const DEPARTMENT_EXAMPLES = [
  '运营一部',
  '运营二部',
  '运营三部',
  '运营四部',
  '运营五部',
  '运营六部',
];

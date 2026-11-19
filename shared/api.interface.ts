export type GridCategory =
  | 'super_star'
  | 'performance_star'
  | 'skilled_employee'
  | 'potential_star'
  | 'backbone'
  | 'regular_employee'
  | 'to_develop'
  | 'gap_employee'
  | 'problem_employee'
  | 'red_line';

export interface RevieweeInfo {
  name: string;
  department: string;
}

export interface ReviewerInfo {
  key: string;
  name: string;
  role: string;
  reviewees: RevieweeInfo[];
}

export interface ScoreDimension {
  score: number;
  evidence: string;
}

export interface ReviewScoreItem {
  dimensionCode: string;
  itemCode: string;
  itemName: string;
  score: number;
  evidenceText: string;
  evidenceLevel?: string;
  sortOrder: number;
}

export interface TalentReviewScores {
  valueCoCreate: ScoreDimension;
  valueCost: ScoreDimension;
  valueOwnership: ScoreDimension;
  abilityProfessional: ScoreDimension;
  abilityDelivery: ScoreDimension;
  abilityProblemSolve: ScoreDimension;
  willInitiative: ScoreDimension;
  willGrowth: ScoreDimension;
  willStability: ScoreDimension;
}

export interface TalentReviewComputed {
  valueAvg: number;
  abilityAvg: number;
  willAvg: number;
  performanceScore: number;
  gridCategory: GridCategory;
  isRedLine: boolean;
}

/** @deprecated 旧总部人才盘点类型，保留兼容，请使用 UnifiedReviewRecordV2 */
export interface TalentReviewRecord extends TalentReviewScores, TalentReviewComputed {
  id: string;
  reviewerName: string;
  reviewerKey: string;
  revieweeName: string;
  department: string;
  reviewDate: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  /** 评分项明细（review_score_item 快照），仅详情接口返回 */
  items?: ReviewScoreItem[];
}

export interface CreateReviewRequest extends TalentReviewScores {
  reviewerKey?: string;
  revieweeName: string;
}

export interface UpdateReviewRequest extends Partial<TalentReviewScores> {
  id: string;
}

export interface ReviewListResponse {
  items: TalentReviewRecord[];
}

export interface AdminSummaryItem {
  id: string;
  revieweeName: string;
  department: string;
  reviewerName: string;
  reviewerKey: string;
  reviewDate: string;
  valueAvg: number;
  abilityAvg: number;
  willAvg: number;
  performanceScore: number;
  gridCategory: GridCategory;
  isRedLine: boolean;
}

export interface AdminSummaryResponse {
  items: AdminSummaryItem[];
}

export interface ReviewerListResponse {
  reviewers: ReviewerInfo[];
}

export interface HistoryQueryParams {
  revieweeName?: string;
  reviewerKey?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface HistoryQueryResponse {
  items: TalentReviewRecord[];
}

export interface LoginRequest {
  reviewerKey: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  reviewerKey: string;
  reviewerName: string;
  role: string;
}

export interface ChangePasswordRequest {
  reviewerKey?: string;
  oldPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  message: string;
}

// ---------- OpenAPI（对外接口）----------

export interface OpenApiTalentSummaryQuery {
  reviewerKey?: string;
  revieweeName?: string;
  gridCategory?: GridCategory;
  dateFrom?: string;
  dateTo?: string;
}

export interface OpenApiTalentSummaryResponse {
  items: AdminSummaryItem[];
  total: number;
}

export interface OpenApiTalentRecordQuery {
  reviewerKey?: string;
  revieweeName?: string;
  gridCategory?: GridCategory;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface OpenApiTalentRecordListResponse {
  items: TalentReviewRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OpenApiPositionSummaryQuery {
  reviewerKey?: string;
  revieweeName?: string;
  departmentName?: string;
  positionType?: PositionType;
  gridCategory?: GridCategory;
  dateFrom?: string;
  dateTo?: string;
}

export interface OpenApiPositionSummaryResponse {
  items: PositionAdminSummaryItem[];
  total: number;
}

export interface OpenApiPositionRecordQuery {
  reviewerKey?: string;
  revieweeName?: string;
  departmentName?: string;
  positionType?: PositionType;
  gridCategory?: GridCategory;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface OpenApiPositionRecordListResponse {
  items: PositionReviewRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export const GRID_CATEGORY_LABELS: Record<GridCategory, string> = {
  super_star: '超级明星', // 超级明星（原核心骨干）
  performance_star: '绩效之星',
  skilled_employee: '熟练骨干',
  potential_star: '潜力之星',
  backbone: '中坚力量',
  regular_employee: '稳定贡献',
  to_develop: '待成长',
  gap_employee: '待提升',
  problem_employee: '观察改善',
  red_line: '红线区',
};

export const isGridCategory = (value: string): value is GridCategory =>
  Object.prototype.hasOwnProperty.call(GRID_CATEGORY_LABELS, value);

export const GRID_CATEGORY_COLORS: Record<GridCategory, string> = {
  super_star: '#dc2626',
  performance_star: '#ea580c',
  skilled_employee: '#f59e0b',
  potential_star: '#8b5cf6',
  backbone: '#3b82f6',
  regular_employee: '#06b6d4',
  to_develop: '#10b981',
  gap_employee: '#64748b',
  problem_employee: '#475569',
  red_line: '#ef4444',
};

export const GRID_CATEGORY_STRATEGIES: Record<GridCategory, string> = {
  super_star: '承担更大责任、晋升加薪、激励领头、重点保留',
  performance_star: '给予历练机会、扩大职责、考虑晋升、合理激励',
  skilled_employee: '现任岗位发展、稳定激励、扩大职责、给予支持',
  potential_star: '设置业绩挑战目标、考虑晋升加薪、挖掘正确激励点',
  backbone: '给予挑战性任务、给予关注与辅导',
  regular_employee: '确保业绩稳定、调整或留任现岗、辅导与培训',
  to_develop: '分析原因、辅导提升、帮助业绩改善、资源支持、给予机会',
  gap_employee: '分析原因支持鼓励、绩效辅导、调整岗位继续观察',
  problem_employee: '明确改进任务、设定观察期、跟踪改善效果',
  red_line: '价值观红线，优先处理价值观问题',
};

// ---------- 规则配置（Rule Set / Batch / Participant / Display Setting）----------

export const RULE_SET_STATUSES = ['draft', 'active', 'archived'] as const;
export type RuleSetStatus = (typeof RULE_SET_STATUSES)[number];
export const isRuleSetStatus = (v: string): v is RuleSetStatus =>
  (RULE_SET_STATUSES as readonly string[]).includes(v);
export const RULE_SET_STATUS_LABELS: Record<RuleSetStatus, string> = {
  draft: '草稿',
  active: '启用中',
  archived: '已归档',
};

export const BATCH_STATUSES = ['active', 'closed', 'archived'] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];
export const isBatchStatus = (v: string): v is BatchStatus =>
  (BATCH_STATUSES as readonly string[]).includes(v);
export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  active: '进行中',
  closed: '已关闭',
  archived: '已归档',
};

export interface RuleDimensionItem {
  code: string;
  name: string;
  maxScore: number;
  sortOrder: number;
  evidenceRequired?: boolean;
}

export interface RuleDimension {
  code: string;
  name: string;
  weight: number;
  isRedLine: boolean;
  items: RuleDimensionItem[];
}

export interface CompositeDimension {
  code: string;
  name: string;
  weight: number;
  sourceDimensionCodes: string[];
  combineMethod: 'average';
}

export interface ScoreItemInput {
  dimensionCode: string;
  itemCode: string;
  score: number;
  weight?: number;
}

export interface ReviewCalcResult {
  dimensionAverages: Record<string, number>;
  totalScore: number;
  isRedLine: boolean;
  gridCategory: GridCategory;
  xAxisScore: number;
  yAxisScore: number;
}

export interface EvidenceLevel {
  code: string;
  name: string;
  minScore?: number;
  maxScore?: number;
  description: string;
}

export interface ScoreLevel {
  code: string;
  name: string;
  minScore: number;
  maxScore: number;
  description: string;
}

export interface PositionTypeConfig {
  code: string;
  name: string;
  performanceItems: Array<{ code: string; name: string; maxScore: number; weight: number; evidenceRequired?: boolean }>;
}

export interface RuleSetDisplayLabels {
  appName?: string;
  reviewName?: string;
  reviewerLabel?: string;
  revieweeLabel?: string;
  departmentLabel?: string;
  storeLabel?: string;
  gridDescription?: string;
}

export interface RuleSetConfig {
  dimensions: RuleDimension[];
  gridThresholds: { high: number; low: number };
  xAxisDimension: string;
  yAxisDimension: string;
  evidenceLevels: EvidenceLevel[];
  scoreLevels: ScoreLevel[];
  positionTypes?: PositionTypeConfig[];
  compositeDimensions?: CompositeDimension[];
  displayLabels?: RuleSetDisplayLabels;
}

export interface RuleSetRecord {
  id: string;
  name: string;
  description: string;
  status: RuleSetStatus;
  isDefault: boolean;
  config: RuleSetConfig;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRuleSetRequest {
  name: string;
  description?: string;
  config: RuleSetConfig;
  isDefault?: boolean;
}

export interface UpdateRuleSetRequest {
  name?: string;
  description?: string;
  status?: RuleSetStatus;
  config?: RuleSetConfig;
  isDefault?: boolean;
  changeNote?: string;
}

export interface RuleSetVersionRecord {
  id: string;
  ruleSetId: string;
  versionNo: number;
  config: RuleSetConfig;
  changeNote: string;
  createdAt: string;
  createdBy: string;
}

export interface RuleSetVersionListResponse {
  items: RuleSetVersionRecord[];
}

export interface RuleSetListResponse {
  items: RuleSetRecord[];
}

export interface ReviewBatchRecord {
  id: string;
  name: string;
  ruleSetId: string;
  startDate: string | null;
  endDate: string | null;
  status: BatchStatus;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBatchRequest {
  name: string;
  ruleSetId: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface UpdateBatchRequest {
  name?: string;
  status?: BatchStatus;
  ruleSetId?: string;
  startDate?: string | null;
  endDate?: string | null;
  description?: string;
}

export interface BatchListResponse {
  items: ReviewBatchRecord[];
}

export interface ReviewParticipantRecord {
  id: string;
  batchId: string;
  reviewerKey: string;
  reviewerName: string;
  revieweeName: string;
  department: string | null;
  positionType: string | null;
  employeeNo: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateParticipantRequest {
  batchId: string;
  reviewerKey: string;
  reviewerName: string;
  revieweeName: string;
  department?: string;
  positionType?: string;
  employeeNo?: string;
  sortOrder?: number;
}

export interface BatchImportParticipantsRequest {
  batchId: string;
  items: Omit<CreateParticipantRequest, 'batchId'>[];
}

export interface UpdateParticipantRequest {
  reviewerKey?: string;
  reviewerName?: string;
  revieweeName?: string;
  department?: string;
  positionType?: string;
  employeeNo?: string;
  sortOrder?: number;
}

export interface ParticipantListResponse {
  items: ReviewParticipantRecord[];
}

export interface DisplaySettingRecord {
  id: string;
  settingKey: string;
  settingValue: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDisplaySettingRequest {
  settingKey: string;
  settingValue: string;
  sortOrder?: number;
}

export interface UpdateDisplaySettingRequest {
  settingKey?: string;
  settingValue?: string;
  sortOrder?: number;
}

export interface DisplaySettingListResponse {
  items: DisplaySettingRecord[];
}

export type PositionType =
  | 'professional'
  | 'service'
  | 'operations'
  | 'operations_lead'
  | 'consultant'
  | 'marketing'
  | 'team_lead';

export const POSITION_TYPES: readonly PositionType[] = [
  'professional',
  'service',
  'operations',
  'operations_lead',
  'consultant',
  'marketing',
  'team_lead',
];

export const isPositionType = (value: string): value is PositionType =>
  (POSITION_TYPES as readonly string[]).includes(value);

export interface PositionRevieweeInfo {
  name: string;
  department: string;
  positionType: PositionType;
}

export interface PositionReviewerInfo {
  key: string;
  name: string;
  departmentName: string;
  role: string;
  reviewees: PositionRevieweeInfo[];
}

export interface PositionReviewerListResponse {
  reviewers: PositionReviewerInfo[];
}

export interface PerformanceItem {
  score: number;
  evidence: string;
}

export interface ComprehensiveScores {
  valueCoCreate: ScoreDimension;
  valueCost: ScoreDimension;
  valueOwnership: ScoreDimension;
  willInitiative: ScoreDimension;
  willGrowth: ScoreDimension;
  willStability: ScoreDimension;
}

export interface ComputedMetrics {
  performanceScore: number;
  valueAvg: number;
  willAvg: number;
  comprehensiveScore: number;
  totalScore: number;
  gridCategory: GridCategory;
  isRedLine: boolean;
}

/** @deprecated 旧分岗盘点类型，保留兼容，请使用 UnifiedReviewRecordV2 */
export interface PositionReviewRecord extends ComputedMetrics {
  id: string;
  reviewerKey: string;
  reviewerName: string;
  revieweeName: string;
  departmentName: string;
  department: string;
  positionType: PositionType;
  performanceItems: Record<string, PerformanceItem>;
  /** 评分项明细（review_score_item 快照），仅详情接口返回 */
  items?: ReviewScoreItem[];
  valueCoCreateScore: number;
  valueCoCreateEvidence: string;
  valueCostScore: number;
  valueCostEvidence: string;
  valueOwnershipScore: number;
  valueOwnershipEvidence: string;
  willInitiativeScore: number;
  willInitiativeEvidence: string;
  willGrowthScore: number;
  willGrowthEvidence: string;
  willStabilityScore: number;
  willStabilityEvidence: string;
  reviewDate: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export interface PositionCreateReviewRequest extends ComprehensiveScores {
  reviewerKey?: string;
  revieweeName: string;
  departmentName: string;
  department: string;
  positionType: PositionType;
  performanceItems: Record<string, PerformanceItem>;
}

export interface PositionUpdateReviewRequest {
  id: string;
  reviewerKey?: string;
  performanceItems?: Record<string, PerformanceItem>;
  valueCoCreate?: ScoreDimension;
  valueCost?: ScoreDimension;
  valueOwnership?: ScoreDimension;
  willInitiative?: ScoreDimension;
  willGrowth?: ScoreDimension;
  willStability?: ScoreDimension;
}

export interface PositionReviewListResponse {
  items: PositionReviewRecord[];
}

export interface PositionAdminSummaryItem {
  id: string;
  revieweeName: string;
  departmentName: string;
  department: string;
  positionType: PositionType;
  reviewerName: string;
  reviewerKey: string;
  reviewDate: string;
  performanceScore: number;
  valueAvg: number;
  willAvg: number;
  comprehensiveScore: number;
  totalScore: number;
  gridCategory: GridCategory;
  isRedLine: boolean;
}

export interface PositionAdminSummaryResponse {
  items: PositionAdminSummaryItem[];
}

export interface PositionHistoryQueryParams {
  revieweeName?: string;
  reviewerKey?: string;
  departmentName?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PositionHistoryQueryResponse {
  items: PositionReviewRecord[];
}

export interface PositionLoginRequest {
  reviewerKey: string;
  password: string;
}

export interface PositionLoginResponse {
  success: boolean;
  token: string;
  reviewerKey: string;
  reviewerName: string;
  departmentName: string;
  role: string;
  reviewType: 'position';
}

export interface PositionChangePasswordRequest {
  reviewerKey?: string;
  oldPassword: string;
  newPassword: string;
}

export interface PositionChangePasswordResponse {
  success: boolean;
  message: string;
}

// ==================== 统一接口类型（界面合并后对外唯一契约）====================

/** @deprecated 旧统一接口类型（基于两套底表的 union），新模块请使用 UnifiedReviewRecordV2 */
export const UNIFIED_REVIEW_TYPES = ['standard', 'position'] as const;
export type UnifiedReviewType = (typeof UNIFIED_REVIEW_TYPES)[number];
export const isUnifiedReviewType = (v: string): v is UnifiedReviewType =>
  (UNIFIED_REVIEW_TYPES as readonly string[]).includes(v);

export interface UnifiedReviewerReviewee {
  name: string;
  department: string;
  departmentName?: string;
  positionType?: string;
  reviewType: UnifiedReviewType;
}

export interface UnifiedReviewerInfo {
  key: string;
  name: string;
  role: string;
  department?: string;
  departmentName?: string;
  reviewType: UnifiedReviewType;
  reviewees: UnifiedReviewerReviewee[];
}

export interface UnifiedReviewerListResponse {
  reviewers: UnifiedReviewerInfo[];
}

export interface UnifiedLoginRequest {
  account: string;
  password: string;
}

export interface UnifiedLoginResponse {
  success: boolean;
  token: string;
  reviewerKey: string;
  reviewerName: string;
  role: string;
  reviewType: UnifiedReviewType;
  department?: string;
  departmentName?: string;
}

export interface UnifiedChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface UnifiedChangePasswordResponse {
  success: boolean;
  message: string;
}

/** 统一评分记录（列表/详情共用，维度字段为动态结构） */
export interface UnifiedReviewRecord {
  id: string;
  reviewType: UnifiedReviewType;
  reviewerKey: string;
  reviewerName: string;
  revieweeName: string;
  department: string;
  departmentName?: string;
  positionType?: string;
  /** 维度均分（价值观、能力、意愿等，按规则集不同而不同） */
  dimensionAverages: Record<string, number>;
  /** 横轴：当前表现分 */
  performanceScore: number;
  /** 纵轴：价值观 / 综合均分 */
  valueScore: number;
  /** 综合总分（如有） */
  totalScore?: number;
  gridCategory: GridCategory;
  isRedLine: boolean;
  reviewDate: string;
  createdAt: string;
  updatedAt: string;
  /** 评分项明细，仅详情返回 */
  items?: ReviewScoreItem[];
  /** 维度得分与依据快照，仅详情返回 */
  dimensionScores?: Record<string, ScoreDimension>;
  /** 岗位绩效项得分（岗位端用），仅详情返回 */
  performanceItems?: Record<string, PerformanceItem>;
}

export interface UnifiedReviewListResponse {
  items: UnifiedReviewRecord[];
}

export interface UnifiedReviewQueryParams {
  reviewerKey?: string;
  revieweeName?: string;
  department?: string;
  departmentName?: string;
  positionType?: string;
  gridCategory?: GridCategory;
  isRedLine?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface UnifiedSummaryItem {
  id: string;
  revieweeName: string;
  department: string;
  departmentName?: string;
  positionType?: string;
  reviewerName: string;
  reviewerKey: string;
  reviewType: UnifiedReviewType;
  reviewDate: string;
  /** 价值观均分（纵轴） */
  valueAvg: number;
  /** 能力均分 */
  abilityAvg?: number;
  /** 意愿均分 */
  willAvg?: number;
  /** 当前表现分（横轴） */
  performanceScore: number;
  /** 综合总分（分岗） */
  totalScore?: number;
  gridCategory: GridCategory;
  isRedLine: boolean;
}

export interface UnifiedSummaryResponse {
  items: UnifiedSummaryItem[];
  total: number;
}

export interface UnifiedCreateReviewRequest {
  reviewerKey?: string;
  revieweeName: string;
  department: string;
  departmentName?: string;
  positionType?: string;
  /** 维度得分，键为 dimensionCode */
  dimensionScores: Record<string, ScoreDimension>;
  /** 岗位绩效项（岗位类被盘人使用） */
  performanceItems?: Record<string, PerformanceItem>;
  /** 评分项明细 */
  items?: ReviewScoreItem[];
}

export interface UnifiedUpdateReviewRequest {
  id: string;
  dimensionScores?: Record<string, ScoreDimension>;
  performanceItems?: Record<string, PerformanceItem>;
  items?: ReviewScoreItem[];
}

export interface UnifiedRuleSetSummary {
  id: string;
  name: string;
  status: RuleSetStatus;
  /** 适用范围（前端展示用） */
  scopeLabel: string;
  isDefault: boolean;
  dimensionCount: number;
  createdAt: string;
}

export interface UnifiedRuleSetListResponse {
  items: UnifiedRuleSetSummary[];
}

// ==================== V2 统一类型（基于 review_record 主表 + 规则驱动）====================

/** 统一评分记录（基于 review_record 主表，规则驱动，任意维度） */
export interface UnifiedReviewRecordV2 {
  id: string;
  reviewerKey: string;
  reviewerName: string;
  revieweeName: string;
  employeeNo: string | null;
  department: string | null;
  positionType: string | null;
  ruleSetId: string | null;
  batchId: string | null;
  /** 各维度均分，key=维度code，对应规则集 dimensions */
  dimensionAvgs: Record<string, number>;
  /** 合成维度分数（如有），key=合成维度code */
  compositeScores: Record<string, number>;
  /** 绩效分（岗位绩效项加权平均，没有则0） */
  performanceScore: number;
  /** 综合总分 */
  totalScore: number;
  /** 九宫格落位编码 */
  gridCategory: GridCategory;
  /** 是否触发红线 */
  isRedLine: boolean;
  /** 触发红线的维度code列表 */
  redLineDimensions: string[];
  isDeleted: boolean;
  isTest: boolean;
  createdAt: string;
  updatedAt: string;
  /** 评分项明细，仅详情接口返回 */
  items?: ReviewScoreItem[];
}

export interface UnifiedReviewItemInput {
  dimensionCode: string;
  itemCode: string;
  itemName: string;
  score: number;
  maxScore?: number;
  evidenceText?: string;
  evidenceLevel?: string;
  sortOrder?: number;
}

export interface UnifiedCreateReviewRequestV2 {
  reviewerKey?: string;
  reviewerName?: string;
  revieweeName: string;
  employeeNo?: string;
  department?: string;
  positionType?: string;
  ruleSetId?: string;
  batchId?: string;
  /** 评分项明细列表 */
  items: UnifiedReviewItemInput[];
  /** 岗位绩效项得分（当规则集含 positionTypes 时使用） */
  performanceItems?: Record<string, { score: number; evidence?: string }>;
  isTest?: boolean;
}

export interface UnifiedUpdateReviewRequestV2 {
  reviewerName?: string;
  revieweeName?: string;
  employeeNo?: string;
  department?: string;
  positionType?: string;
  items?: UnifiedReviewItemInput[];
  performanceItems?: Record<string, { score: number; evidence?: string }>;
  isTest?: boolean;
}

export interface UnifiedReviewQueryParamsV2 {
  reviewerKey?: string;
  revieweeName?: string;
  department?: string;
  positionType?: string;
  gridCategory?: GridCategory;
  isRedLine?: boolean;
  ruleSetId?: string;
  batchId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface UnifiedReviewListResponseV2 {
  items: UnifiedReviewRecordV2[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UnifiedReviewSummaryItem {
  id: string;
  revieweeName: string;
  employeeNo: string | null;
  department: string | null;
  positionType: string | null;
  reviewerName: string;
  reviewerKey: string;
  totalScore: number;
  performanceScore: number;
  gridCategory: GridCategory;
  isRedLine: boolean;
  reviewDate: string;
}

export interface UnifiedReviewSummaryResponse {
  items: UnifiedReviewSummaryItem[];
  total: number;
}

// ==================== Reviewer Account ====================

export const REVIEWER_ACCOUNT_STATUS = ['active', 'disabled'] as const;
export type ReviewerAccountStatus = (typeof REVIEWER_ACCOUNT_STATUS)[number];
export const isReviewerAccountStatus = (v: string): v is ReviewerAccountStatus =>
  (REVIEWER_ACCOUNT_STATUS as readonly string[]).includes(v);
export const REVIEWER_ACCOUNT_STATUS_LABELS: Record<ReviewerAccountStatus, string> = {
  active: '正常',
  disabled: '已停用',
};

export interface ReviewerAccountItem {
  reviewerKey: string;
  reviewerName: string;
  role: string;
  department: string | null;
  status: ReviewerAccountStatus;
  initialPassword?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewerAccountListResponse {
  items: ReviewerAccountItem[];
  total: number;
}

export interface CreateReviewerAccountRequest {
  reviewerKey?: string;
  reviewerName: string;
  role?: string;
  department?: string;
  password?: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  newPassword: string;
}

// ==================== Evidence Level ====================

export const EVIDENCE_LEVELS = [
  { code: 'solid', label: '事实充分', scoreRange: [5, 5] },
  { code: 'basic', label: '基本符合', scoreRange: [3, 4] },
  { code: 'insufficient', label: '依据不足', scoreRange: [1, 2] },
] as const;

export type EvidenceLevelCode = (typeof EVIDENCE_LEVELS)[number]['code'];

export function getEvidenceLevelsForScore(score: number): Array<{ code: string; label: string }> {
  return EVIDENCE_LEVELS.filter(
    (lvl) => score >= lvl.scoreRange[0] && score <= lvl.scoreRange[1],
  ).map((lvl) => ({ code: lvl.code, label: lvl.label }));
}

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  Download,
  Filter,
  Grid3X3,
  List,
  Eye,
  Settings,
  Layers,
  Users,
  LayoutDashboard,
  Search,
  Key,
  Copy,
  RefreshCw,
  Palette,
  Upload,
  RotateCcw,
  Save,
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { toast } from 'sonner';
import { showConfirm } from '@lark-apaas/client-toolkit';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { getDataloom } from '@lark-apaas/client-toolkit/dataloom';
import { getDefaultBucketId } from '@lark-apaas/client-toolkit/tools/storage';
import { getErrorMsg } from '@client/src/utils/request';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

import { unifiedReview, review } from '@/api';
import {
  GRID_CATEGORY_LABELS,
  GRID_CATEGORY_COLORS,
  GRID_CATEGORY_STRATEGIES,
} from '@shared/api.interface';
import type {
  GridCategory,
  TalentReviewRecord,
  ScoreDimension,
  PositionReviewRecord,
  PositionType,
  RuleSetRecord,
  ReviewBatchRecord,
  ReviewParticipantRecord,
  DisplaySettingRecord,
  ReviewScoreItem,
  UnifiedSummaryItem,
  UnifiedReviewRecordV2,
  ReviewerAccountItem,
} from '@shared/api.interface';
import {
  POSITION_TYPE_LABELS,
  COMPREHENSIVE_DIMENSIONS,
  getPerformanceDimensions,
} from '@client/src/utils/position-review-calc';
import RuleSetsTab from './RuleSetsTab';
import BatchesTab from './BatchesTab';
import ParticipantsTab from './ParticipantsTab';
import AccountsTab from './AccountsTab';
import DisplaySettingsBlock from './DisplaySettingsBlock';
import { getGridThresholds } from './rule-set-display';
import { Image } from '@client/src/components/ui/image';
import { useSystemSettings } from '@client/src/contexts/SystemSettingsContext';
import logoUrl from '@client/src/assets/app-logo.png';

const CATEGORY_ORDER: GridCategory[] = [
  'super_star',
  'performance_star',
  'skilled_employee',
  'potential_star',
  'backbone',
  'regular_employee',
  'to_develop',
  'gap_employee',
  'problem_employee',
  'red_line',
];

// 9 项评分维度标签
const SCORE_DIMENSION_LABELS: Record<string, { label: string; group: string }> = {
  valueCoCreate: { label: '共创共享认同', group: '价值观' },
  valueCost: { label: '成本利润意识', group: '价值观' },
  valueOwnership: { label: '主人翁与协同', group: '价值观' },
  abilityProfessional: { label: '岗位专业胜任', group: '能力' },
  abilityDelivery: { label: '交付质量与效率', group: '能力' },
  abilityProblemSolve: { label: '问题解决', group: '能力' },
  willInitiative: { label: '主动性', group: '意愿' },
  willGrowth: { label: '成长意愿', group: '意愿' },
  willStability: { label: '稳定性与心态', group: '意愿' },
};

const SCORE_DIMENSION_KEYS: string[] = [
  'valueCoCreate',
  'valueCost',
  'valueOwnership',
  'abilityProfessional',
  'abilityDelivery',
  'abilityProblemSolve',
  'willInitiative',
  'willGrowth',
  'willStability',
];

// ===== 总部评分项显示辅助 =====

interface HqItemDisplay {
  itemCode: string;
  itemName: string;
  dimensionCode: string;
  dimensionName: string;
  groupLabel: string;
  sortOrder: number;
  fieldKey: keyof TalentReviewRecord;
}

const HQ_ITEM_CODE_TO_FIELD: Record<string, keyof TalentReviewRecord> = {
  value_co_create: 'valueCoCreate',
  value_cost: 'valueCost',
  value_ownership: 'valueOwnership',
  ability_professional: 'abilityProfessional',
  ability_delivery: 'abilityDelivery',
  ability_problem_solve: 'abilityProblemSolve',
  will_initiative: 'willInitiative',
  will_growth: 'willGrowth',
  will_stability: 'willStability',
};

const HQ_DIMENSION_GROUP_LABEL: Record<string, string> = {
  value: '价值观',
  ability: '能力',
  will: '意愿',
};

function buildHqItemsFromRuleSet(ruleSet: RuleSetRecord | null | undefined): HqItemDisplay[] {
  if (!ruleSet?.config?.dimensions) return [];
  const items: HqItemDisplay[] = [];
  let sortIdx = 0;
  for (const dim of ruleSet.config.dimensions) {
    for (const item of dim.items ?? []) {
      const fieldKey = HQ_ITEM_CODE_TO_FIELD[item.code];
      if (!fieldKey) continue;
      items.push({
        itemCode: item.code,
        itemName: item.name,
        dimensionCode: dim.code,
        dimensionName: dim.name,
        groupLabel: HQ_DIMENSION_GROUP_LABEL[dim.code] ?? dim.name,
        sortOrder: sortIdx++,
        fieldKey,
      });
    }
  }
  return items;
}

function buildHqItemsFromSnapshot(
  snapshotItems: ReviewScoreItem[],
  ruleSet: RuleSetRecord | null | undefined,
): HqItemDisplay[] {
  const dimNameMap = new Map<string, string>();
  if (ruleSet?.config?.dimensions) {
    for (const dim of ruleSet.config.dimensions) {
      dimNameMap.set(dim.code, dim.name);
    }
  }
  return snapshotItems
    .map((it) => {
      const fieldKey = HQ_ITEM_CODE_TO_FIELD[it.itemCode];
      const dimName = dimNameMap.get(it.dimensionCode) ?? it.dimensionCode;
      return {
        itemCode: it.itemCode,
        itemName: it.itemName,
        dimensionCode: it.dimensionCode,
        dimensionName: dimName,
        groupLabel: HQ_DIMENSION_GROUP_LABEL[it.dimensionCode] ?? dimName,
        sortOrder: it.sortOrder,
        fieldKey: fieldKey ?? ('valueCoCreate' as keyof TalentReviewRecord),
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function buildHqItemsFallback(): HqItemDisplay[] {
  return SCORE_DIMENSION_KEYS.map((key) => ({
    itemCode: key,
    itemName: SCORE_DIMENSION_LABELS[key]?.label ?? key,
    dimensionCode: SCORE_DIMENSION_LABELS[key]?.group ?? '',
    dimensionName: SCORE_DIMENSION_LABELS[key]?.group ?? '',
    groupLabel: SCORE_DIMENSION_LABELS[key]?.group ?? '',
    sortOrder: SCORE_DIMENSION_KEYS.indexOf(key),
    fieldKey: key as keyof TalentReviewRecord,
  }));
}

function getHqItemDisplayList(
  record: TalentReviewRecord | null | undefined,
  ruleSet: RuleSetRecord | null | undefined,
): HqItemDisplay[] {
  if (record?.items && record.items.length > 0) {
    return buildHqItemsFromSnapshot(record.items, ruleSet);
  }
  const fromRuleSet = buildHqItemsFromRuleSet(ruleSet);
  if (fromRuleSet.length > 0) return fromRuleSet;
  return buildHqItemsFallback();
}

// ===== 分岗综合 6 项：itemCode → 字段映射 =====
const COMPREHENSIVE_ITEM_CODE_TO_FIELD: Record<
  string,
  { scoreKey: keyof PositionReviewRecord; evidenceKey: keyof PositionReviewRecord }
> = {
  value_co_create: { scoreKey: 'valueCoCreateScore', evidenceKey: 'valueCoCreateEvidence' },
  value_cost: { scoreKey: 'valueCostScore', evidenceKey: 'valueCostEvidence' },
  value_ownership: { scoreKey: 'valueOwnershipScore', evidenceKey: 'valueOwnershipEvidence' },
  will_initiative: { scoreKey: 'willInitiativeScore', evidenceKey: 'willInitiativeEvidence' },
  will_growth: { scoreKey: 'willGrowthScore', evidenceKey: 'willGrowthEvidence' },
  will_stability: { scoreKey: 'willStabilityScore', evidenceKey: 'willStabilityEvidence' },
};

// ===== 分岗评分项显示辅助 =====

interface ReviewItemDisplay {
  itemCode: string;
  itemName: string;
  dimensionCode: string;
  dimensionName: string;
  groupLabel: string;
  sortOrder: number;
  scoreKey: keyof PositionReviewRecord;
  evidenceKey: keyof PositionReviewRecord;
  weight?: number;
}

const VALUE_GROUP = '价值观';
const WILL_GROUP = '意愿';
const PERF_GROUP = '绩效';

function buildReviewItemsFromRuleSet(
  positionType: PositionType,
  ruleSet: RuleSetRecord | null | undefined,
): ReviewItemDisplay[] {
  const items: ReviewItemDisplay[] = [];
  let sortIdx = 0;

  if (ruleSet?.config?.dimensions) {
    for (const dim of ruleSet.config.dimensions) {
      for (const item of dim.items ?? []) {
        const field = COMPREHENSIVE_ITEM_CODE_TO_FIELD[item.code];
        if (!field) continue;
        items.push({
          itemCode: item.code,
          itemName: item.name,
          dimensionCode: dim.code,
          dimensionName: dim.name,
          groupLabel:
            dim.code === 'value'
              ? VALUE_GROUP
              : dim.code === 'will'
                ? WILL_GROUP
                : dim.name,
          sortOrder: sortIdx++,
          scoreKey: field.scoreKey,
          evidenceKey: field.evidenceKey,
        });
      }
    }
  }

  const posConfig = ruleSet?.config?.positionTypes?.find((p) => p.code === positionType);
  if (posConfig?.performanceItems) {
    for (const perf of posConfig.performanceItems) {
      items.push({
        itemCode: perf.code,
        itemName: perf.name,
        dimensionCode: 'performance',
        dimensionName: '绩效',
        groupLabel: PERF_GROUP,
        sortOrder: sortIdx++,
        scoreKey: 'performanceItems',
        evidenceKey: 'performanceItems',
        weight: perf.weight,
      });
    }
  }

  return items;
}

function buildReviewItemsFromSnapshot(
  snapshotItems: ReviewScoreItem[],
  ruleSet: RuleSetRecord | null | undefined,
): ReviewItemDisplay[] {
  const dimNameMap = new Map<string, string>();
  if (ruleSet?.config?.dimensions) {
    for (const dim of ruleSet.config.dimensions) {
      dimNameMap.set(dim.code, dim.name);
    }
  }

  return snapshotItems
    .map((it) => {
      const field = COMPREHENSIVE_ITEM_CODE_TO_FIELD[it.itemCode];
      const dimName = dimNameMap.get(it.dimensionCode) ?? it.dimensionCode;
      const isPerformance = it.dimensionCode === 'performance';
      const groupLabel = isPerformance
        ? PERF_GROUP
        : it.dimensionCode === 'value'
          ? VALUE_GROUP
          : it.dimensionCode === 'will'
            ? WILL_GROUP
            : dimName;
      return {
        itemCode: it.itemCode,
        itemName: it.itemName,
        dimensionCode: it.dimensionCode,
        dimensionName: isPerformance ? '绩效' : dimName,
        groupLabel,
        sortOrder: it.sortOrder,
        scoreKey: isPerformance ? 'performanceItems' : (field?.scoreKey ?? 'valueCoCreateScore'),
        evidenceKey: isPerformance
          ? 'performanceItems'
          : (field?.evidenceKey ?? 'valueCoCreateEvidence'),
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function buildReviewItemsFallback(positionType: PositionType): ReviewItemDisplay[] {
  const items: ReviewItemDisplay[] = [];
  let sortIdx = 0;
  for (const dim of COMPREHENSIVE_DIMENSIONS) {
    const scoreKey = `${dim.key}Score` as keyof PositionReviewRecord;
    const evidenceKey = `${dim.key}Evidence` as keyof PositionReviewRecord;
    items.push({
      itemCode: dim.key,
      itemName: dim.name,
      dimensionCode: dim.group,
      dimensionName: dim.group === 'value' ? '价值观' : '意愿',
      groupLabel: dim.group === 'value' ? VALUE_GROUP : WILL_GROUP,
      sortOrder: sortIdx++,
      scoreKey,
      evidenceKey,
    });
  }
  for (const perf of getPerformanceDimensions(positionType)) {
    items.push({
      itemCode: perf.key,
      itemName: perf.name,
      dimensionCode: 'performance',
      dimensionName: '绩效',
      groupLabel: PERF_GROUP,
      sortOrder: sortIdx++,
      scoreKey: 'performanceItems',
      evidenceKey: 'performanceItems',
      weight: perf.weight,
    });
  }
  return items;
}

function getReviewItemDisplayList(
  record: PositionReviewRecord | null | undefined,
  positionType: PositionType,
  ruleSet: RuleSetRecord | null | undefined,
): ReviewItemDisplay[] {
  if (record?.items && record.items.length > 0) {
    return buildReviewItemsFromSnapshot(record.items, ruleSet);
  }
  const fromRuleSet = buildReviewItemsFromRuleSet(positionType, ruleSet);
  if (fromRuleSet.length > 0) return fromRuleSet;
  return buildReviewItemsFallback(positionType);
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<string>('overview');

  // 根据路由路径设置初始 tab
  useEffect(() => {
    const path = window.location.pathname;
    if (path.endsWith('/admin/reviews')) {
      setActiveTab('reviews');
    } else if (path.endsWith('/admin/rules')) {
      setActiveTab('rule-sets');
    } else {
      setActiveTab('overview');
    }
  }, []);

  // ===== 统一概览数据 =====
  const [overviewItems, setOverviewItems] = useState<UnifiedSummaryItem[]>([]);
  const [overviewStats, setOverviewStats] = useState<unifiedReview.AdminStats | null>(null);
  const [_redLineStat, _setRedLineStat] = useState<number>(0);
  const [overviewLoading, setOverviewLoading] = useState<boolean>(true);

  // ===== 统一盘点结果列表（reviews tab）=====
  const [reviewItems, setReviewItems] = useState<UnifiedSummaryItem[]>([]);
  const [reviewTotal, setReviewTotal] = useState<number>(0);
  const [reviewLoading, setReviewLoading] = useState<boolean>(false);
  const [reviewSearched, setReviewSearched] = useState<boolean>(false);

  // reviews 筛选条件
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [filterPositionType, setFilterPositionType] = useState<string>('');
  const [filterGridCategory, setFilterGridCategory] = useState<string>('');
  const [filterIsRedLine, setFilterIsRedLine] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterRevieweeName, setFilterRevieweeName] = useState<string>('');
  const [reviewPageSize] = useState<number>(50);

  // 详情弹窗（统一 V2）
  const [detailRecord, setDetailRecord] = useState<UnifiedReviewRecordV2 | null>(null);
  const [detailOpen, setDetailOpen] = useState<boolean>(false);

  // ===== 规则配置 =====
  const [ruleSets, setRuleSets] = useState<RuleSetRecord[] | null>(null);
  const [ruleSetsLoading, setRuleSetsLoading] = useState<boolean>(false);
  const [ruleSetsError, setRuleSetsError] = useState<unknown>(null);

  // ===== 批次管理 =====
  const [batches, setBatches] = useState<ReviewBatchRecord[] | null>(null);
  const [batchesLoading, setBatchesLoading] = useState<boolean>(false);
  const [batchesError, setBatchesError] = useState<unknown>(null);

  // ===== 参评名单 =====
  const [participants, setParticipants] = useState<ReviewParticipantRecord[] | null>(null);
  const [participantsLoading, setParticipantsLoading] = useState<boolean>(false);
  const [participantsError, setParticipantsError] = useState<unknown>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');

  // ===== 高级设置：API Key =====
  const [apiKey, setApiKey] = useState<string>('');
  const [apiKeyLoading, setApiKeyLoading] = useState<boolean>(false);
  const [apiKeyCopied, setApiKeyCopied] = useState<boolean>(false);

  // ===== 显示名称设置 =====
  const [displaySettings, setDisplaySettings] = useState<DisplaySettingRecord[] | null>(null);
  const [displaySettingsLoading, setDisplaySettingsLoading] = useState<boolean>(false);
  const [displaySettingsError, setDisplaySettingsError] = useState<unknown>(null);

  // Display setting lookup helper with defaults
  const getDisplayLabel = (key: string, fallback: string): string => {
    if (!displaySettings) return fallback;
    const item = displaySettings.find((s) => s.settingKey === key);
    return item?.settingValue || fallback;
  };

  // ===== 规则集 & 批次（用于地图/历史动态渲染）=====
  const [hqDefaultRuleSet, setHqDefaultRuleSet] = useState<RuleSetRecord | null>(null);

  // 加载规则集
  const loadRuleSets = async (): Promise<void> => {
    setRuleSetsLoading(true);
    setRuleSetsError(null);
    try {
      const res = await review.getRuleSets();
      setRuleSets(res.items);
    } catch (err) {
      logger.error('加载规则集列表失败', err);
      setRuleSetsError(err);
      setRuleSets(null);
    } finally {
      setRuleSetsLoading(false);
    }
  };

  // 加载批次
  const loadBatches = async (): Promise<ReviewBatchRecord[]> => {
    setBatchesLoading(true);
    setBatchesError(null);
    try {
      const res = await review.getBatches();
      setBatches(res.items);
      return res.items;
    } catch (err) {
      logger.error('加载批次列表失败', err);
      setBatchesError(err);
      setBatches(null);
      return [];
    } finally {
      setBatchesLoading(false);
    }
  };

  // 加载参评名单
  const loadParticipants = async (): Promise<void> => {
    if (!selectedBatchId) {
      setParticipants(null);
      return;
    }
    setParticipantsLoading(true);
    setParticipantsError(null);
    try {
      const res = await review.getParticipants(selectedBatchId);
      setParticipants(res.items);
    } catch (err) {
      logger.error('加载参评名单失败', err);
      setParticipantsError(err);
      setParticipants(null);
    } finally {
      setParticipantsLoading(false);
    }
  };

  // 加载显示设置
  const loadDisplaySettings = async (): Promise<void> => {
    setDisplaySettingsLoading(true);
    setDisplaySettingsError(null);
    try {
      const res = await review.getDisplaySettings();
      setDisplaySettings(res.items);
    } catch (err) {
      logger.error('加载显示名称设置失败', err);
      setDisplaySettingsError(err);
      setDisplaySettings(null);
    } finally {
      setDisplaySettingsLoading(false);
    }
  };

  // 切换规则类型时重新加载
  useEffect(() => {
    if (activeTab === 'rule-sets') {
      void loadRuleSets();
      void loadDisplaySettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // 初始加载：默认规则集 + 批次 + 规则集列表 + 显示设置
  useEffect(() => {
    async function loadDefaults(): Promise<void> {
      try {
        const [defaultRs, displaySettingsRes] = await Promise.all([
          review.getDefaultRuleSet(),
          review.getDisplaySettings(),
        ]);
        setHqDefaultRuleSet(defaultRs);
        setDisplaySettings(displaySettingsRes.items);
      } catch (err) {
        logger.error('加载默认规则集或批次列表失败', err);
      }
    }
    void loadDefaults();
  }, []);

  // 切换批次类型时重新加载
  useEffect(() => {
    if (activeTab === 'batches') {
      void loadBatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // 切换到参评名单 tab 时加载批次列表 + 重置选中批次
  useEffect(() => {
    if (activeTab === 'participants') {
      void loadBatches();
      setSelectedBatchId('');
      setParticipants(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ===== 评价人账号管理 =====
  const [accounts, setAccounts] = useState<ReviewerAccountItem[]>([]);
  const [accountsLoading, setAccountsLoading] = useState<boolean>(false);

  const loadAccounts = async (): Promise<void> => {
    setAccountsLoading(true);
    try {
      const res = await review.listReviewerAccounts();
      setAccounts(res.items);
    } catch (err) {
      logger.error('加载评价人账号列表失败', err);
      toast.error(getErrorMsg(err));
    } finally {
      setAccountsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'accounts') {
      void loadAccounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ===== 系统外观设置 =====
  const { refreshSettings: refreshSystemSettings, setSystemName, setSystemLogo: setContextSystemLogo } = useSystemSettings();
  const [systemNameValue, setSystemNameValue] = useState<string>('');
  const [systemNameSaving, setSystemNameSaving] = useState<boolean>(false);
  const [logoUploading, setLogoUploading] = useState<boolean>(false);
  const [logoResetting, setLogoResetting] = useState<boolean>(false);

  const systemLogoValue = displaySettings?.find(
    (s) => s.settingKey === 'system_logo',
  )?.settingValue ?? '';

  useEffect(() => {
    const nameItem = displaySettings?.find(
      (s) => s.settingKey === 'system_name',
    );
    if (nameItem?.settingValue) {
      setSystemNameValue(nameItem.settingValue);
    } else {
      setSystemNameValue('');
    }
  }, [displaySettings]);

  const handleSaveSystemName = async (): Promise<void> => {
    const trimmed = systemNameValue.trim();
    setSystemNameSaving(true);
    try {
      await review.updateDisplaySetting('system_name', trimmed);
      toast.success('系统名称已保存');
      if (trimmed) {
        setSystemName(trimmed);
      } else {
        setSystemName('人才盘点系统');
      }
      await loadDisplaySettings();
    } catch (err) {
      logger.error('保存系统名称失败', err);
      toast.error(getErrorMsg(err));
      await refreshSystemSettings();
    } finally {
      setSystemNameSaving(false);
    }
  };

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('请选择 PNG 或 JPG 图片');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('图片大小不能超过 2MB');
      return;
    }
    setLogoUploading(true);
    try {
      const dataloom = await getDataloom();
      const bucket = dataloom.storage.from(getDefaultBucketId());
      const result = await bucket.uploadFile(file);
      if (result.error) throw result.error;
      const downloadUrl = result.data.download_url;
      await review.updateDisplaySetting('system_logo', downloadUrl);
      toast.success('LOGO 上传成功');
      setContextSystemLogo(downloadUrl);
      await loadDisplaySettings();
    } catch (err) {
      logger.error('上传 LOGO 失败', err);
      toast.error(getErrorMsg(err));
    } finally {
      setLogoUploading(false);
      e.target.value = '';
    }
  };

  const handleResetLogo = async (): Promise<void> => {
    setLogoResetting(true);
    try {
      await review.updateDisplaySetting('system_logo', '');
      toast.success('已恢复默认 LOGO');
      setContextSystemLogo(null);
      await loadDisplaySettings();
    } catch (err) {
      logger.error('恢复默认 LOGO 失败', err);
      toast.error(getErrorMsg(err));
    } finally {
      setLogoResetting(false);
    }
  };

  // 切换到高级设置 tab 时加载 API Key
  const loadApiKey = async (): Promise<void> => {
    setApiKeyLoading(true);
    try {
      const res = await review.getApiKey();
      setApiKey(res.apiKey);
    } catch (err) {
      logger.error('加载接口密钥失败', err);
    } finally {
      setApiKeyLoading(false);
    }
  };

  const handleCopyKey = async (): Promise<void> => {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setApiKeyCopied(true);
      setTimeout(() => setApiKeyCopied(false), 2000);
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  const handleResetKey = async (): Promise<void> => {
    try {
      await showConfirm({
        message: '确认重置密钥？重置后旧密钥立即失效，所有使用旧密钥的外部系统需更新配置。',
        confirmText: '确认重置',
        cancelText: '取消',
      });
      const res = await review.resetApiKey();
      setApiKey(res.apiKey);
      toast.success('密钥已重置');
    } catch {
      // 用户取消或报错
    }
  };

  useEffect(() => {
    if (activeTab === 'advanced') {
      void loadApiKey();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // 批次变化时加载参评名单
  useEffect(() => {
    if (activeTab === 'participants' && selectedBatchId) {
      void loadParticipants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatchId, activeTab]);

  // ===== 加载概览数据（统一 review 接口 + 前端计算统计）=====
  useEffect(() => {
    if (activeTab !== 'overview') return;
    let cancelled = false;
    async function load(): Promise<void> {
      setOverviewLoading(true);
      try {
        const res = await review.getAdminRecords({
          pageSize: 500,
          includeTest: true,
        });
        // 用规则集配置确定 x/y 轴维度
        const xDim = hqDefaultRuleSet?.config?.xAxisDimension ?? 'comprehensive';
        const yDim = hqDefaultRuleSet?.config?.yAxisDimension ?? 'value';

        if (!cancelled) {
          setOverviewItems(res.items.map((r) => {
            const yScore = r.dimensionAvgs?.[yDim] ?? 0;
            // x 轴：先查合成维度，再查普通维度
            let xScore = r.dimensionAvgs?.[xDim] ?? 0;
            if (r.compositeScores && r.compositeScores[xDim] !== undefined) {
              xScore = r.compositeScores[xDim];
            }
            return {
              ...r,
              reviewType: 'standard' as const,
              reviewDate: new Date(r.createdAt).toISOString().slice(0, 10),
              valueAvg: yScore,
              performanceScore: xScore,
              departmentName: null as unknown as string,
            };
          }));
          // 前端计算统计
          const gridDistribution: Record<string, number> = {};
          const deptSet = new Set<string>();
          let redLine = 0;
          const deptMap = new Map<string, { count: number; totalScore: number }>();
          for (const item of res.items) {
            gridDistribution[item.gridCategory] = (gridDistribution[item.gridCategory] || 0) + 1;
            if (item.department) {
              deptSet.add(item.department);
              const prev = deptMap.get(item.department) ?? { count: 0, totalScore: 0 };
              deptMap.set(item.department, {
                count: prev.count + 1,
                totalScore: prev.totalScore + item.totalScore,
              });
            }
            if (item.isRedLine) redLine += 1;
          }
          const departmentStats = Array.from(deptMap.entries()).map(([d, v]) => ({
            department: d,
            count: v.count,
            avgScore: v.count > 0 ? v.totalScore / v.count : 0,
          }));
          setOverviewStats({
            totalCount: res.items.length,
            gridDistribution: gridDistribution as unifiedReview.AdminStats['gridDistribution'],
            departmentStats,
            departmentCount: deptSet.size,
          } as unknown as unifiedReview.AdminStats);
          // 红线人数单独存到一个 ref 样式的 state 里，这里存到 overviewStats 上
          // 借用 departmentCount 字段位置不足以存，直接另存
          _setRedLineStat(redLine);
        }
      } catch (error) {
        logger.error('加载概览数据失败', error);
        toast.error(getErrorMsg(error));
      } finally {
        if (!cancelled) setOverviewLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeTab, hqDefaultRuleSet]);

  // ===== 盘点结果列表查询（统一 review 接口）=====
  const handleReviewSearch = async (): Promise<void> => {
    setReviewLoading(true);
    try {
      const params: review.AdminRecordsQuery = {};
      if (filterDepartment) params.department = filterDepartment;
      if (filterPositionType) params.positionType = filterPositionType;
      if (filterGridCategory) params.gridCategory = filterGridCategory;
      if (filterIsRedLine === 'yes') params.isRedLine = true;
      if (filterIsRedLine === 'no') params.isRedLine = false;
      if (filterRevieweeName.trim()) params.keyword = filterRevieweeName.trim();
      params.page = 1;
      params.pageSize = reviewPageSize;
      params.includeTest = true;

      const res = await review.getAdminRecords(params);
      // 用规则集配置确定 x/y 轴维度
      const xDim = hqDefaultRuleSet?.config?.xAxisDimension ?? 'comprehensive';
      const yDim = hqDefaultRuleSet?.config?.yAxisDimension ?? 'value';
      setReviewItems(res.items.map((r) => {
        const yScore = r.dimensionAvgs?.[yDim] ?? 0;
        let xScore = r.dimensionAvgs?.[xDim] ?? 0;
        if (r.compositeScores && r.compositeScores[xDim] !== undefined) {
          xScore = r.compositeScores[xDim];
        }
        return {
          ...r,
          reviewType: 'standard' as const,
          reviewDate: new Date(r.createdAt).toISOString().slice(0, 10),
          valueAvg: yScore,
          performanceScore: xScore,
          departmentName: null as unknown as string,
        };
      }));
      setReviewTotal(res.total);
      setReviewSearched(true);
    } catch (error) {
      logger.error('查询盘点结果失败', error);
      toast.error(getErrorMsg(error));
    } finally {
      setReviewLoading(false);
    }
  };

  const handleReviewReset = (): void => {
    setFilterDepartment('');
    setFilterPositionType('');
    setFilterGridCategory('');
    setFilterIsRedLine('');
    setFilterRevieweeName('');
    setReviewItems([]);
    setReviewTotal(0);
    setReviewSearched(false);
  };

  // 从数据中提取去重的部门列表
  const allDepartments = useMemo(() => {
    const set = new Set<string>();
    for (const item of overviewItems) {
      if (item.department) set.add(item.department);
    }
    for (const item of reviewItems) {
      if (item.department) set.add(item.department);
    }
    return Array.from(set).sort();
  }, [overviewItems, reviewItems]);

  // （不再有门店/单位概念，保留空数组以兼容 UI）
  const allStores: string[] = [];

  // 从数据中提取去重的岗位类型列表
  const allPositionTypes = useMemo(() => {
    const set = new Set<string>();
    for (const item of overviewItems) {
      if (item.positionType) set.add(item.positionType);
    }
    for (const item of reviewItems) {
      if (item.positionType) set.add(item.positionType);
    }
    return Array.from(set).sort();
  }, [overviewItems, reviewItems]);

  // 红线人数（概览页）
  const redLineCount = useMemo(() => {
    if (_redLineStat > 0) return _redLineStat;
    return overviewItems.filter((i) => i.isRedLine).length;
  }, [_redLineStat, overviewItems]);

  // 各九宫格类别人数（概览页分类卡）
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of overviewItems) {
      counts[item.gridCategory] = (counts[item.gridCategory] || 0) + 1;
    }
    return counts;
  }, [overviewItems]);

  // 部门统计（按人数降序）
  const departmentStatsSorted = useMemo(() => {
    if (!overviewStats?.departmentStats) return [];
    return [...overviewStats.departmentStats].sort((a, b) => b.count - a.count);
  }, [overviewStats]);

  // 九宫格散点图（横轴=能力均分，纵轴=意愿均分，可在规则集中配置）
  const unifiedChartOption: EChartsOption = useMemo(() => {
    const thresholds = getGridThresholds(hqDefaultRuleSet);

    const grouped = new Map<GridCategory, UnifiedSummaryItem[]>();
    for (const item of overviewItems) {
      const arr = grouped.get(item.gridCategory) ?? [];
      arr.push(item);
      grouped.set(item.gridCategory, arr);
    }

    const series = CATEGORY_ORDER.filter(
      (cat) => (grouped.get(cat)?.length ?? 0) > 0,
    ).map((cat) => {
      const catItems = grouped.get(cat) ?? [];
      const color = GRID_CATEGORY_COLORS[cat];
      return {
        name: GRID_CATEGORY_LABELS[cat],
        type: 'scatter' as const,
        symbolSize: 18,
        itemStyle: {
          color,
          borderColor: '#ffffff',
          borderWidth: 2,
        },
        label: {
          show: true,
          position: 'top' as const,
          formatter: (params) =>
            (params as unknown as { data: UnifiedSummaryItem }).data.revieweeName,
          color: '#334155',
          fontSize: 11,
          fontWeight: 500,
        },
        labelLayout: {
          hideOverlap: true,
        },
        emphasis: {
          scale: 1.2,
          focus: 'series' as const,
        },
        data: catItems.map((item) => {
          const xVal = item.performanceScore ?? 0;
          const yVal = item.valueAvg ?? 0;
          return { value: [xVal, yVal], raw: item };
        }),
      };
    });

      const xAxisDim = hqDefaultRuleSet?.config?.dimensions?.find(
        (d) => d.code === (hqDefaultRuleSet?.config?.xAxisDimension ?? 'ability'),
      );
      const xAxisName = xAxisDim?.name ?? '能力均分';
      const yAxisDim = hqDefaultRuleSet?.config?.dimensions?.find(
        (d) => d.code === (hqDefaultRuleSet?.config?.yAxisDimension ?? 'will'),
      );
      const yAxisName = yAxisDim?.name ?? '意愿均分';

      return {
        tooltip: {
          trigger: 'item',
          formatter: (params) => {
            const p = params as unknown as { data: { raw: UnifiedSummaryItem } };
            const item = p.data.raw;
            const deptText = item.department ?? '-';
            const posText = item.positionType
              ? `岗位类型：${item.positionType}`
              : '';
            return `
            <div style="padding:4px 0;font-size:13px;line-height:1.6">
              <div style="font-weight:600;color:#0f172a;margin-bottom:4px">
                ${item.revieweeName}
              </div>
              <div>部门：${deptText}</div>
              ${posText ? `<div>${posText}</div>` : ''}
              <div>评价人：${item.reviewerName}</div>
              <div>纵轴均分：${item.valueAvg.toFixed(2)}</div>
              <div>横轴均分：${item.performanceScore.toFixed(2)}</div>
              <div>落位类别：${GRID_CATEGORY_LABELS[item.gridCategory]}</div>
              <div>管理策略：${GRID_CATEGORY_STRATEGIES[item.gridCategory]}</div>
              <div>是否红线：${item.isRedLine ? '是' : '否'}</div>
            </div>
          `;
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '16%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        min: 1,
        max: 5,
        name: xAxisName,
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: {
          color: '#64748b',
          fontSize: 12,
        },
        axisLine: {
          lineStyle: { color: '#e2e8f0' },
        },
        axisLabel: { color: '#64748b', fontSize: 11 },
        splitLine: {
          lineStyle: { color: '#f1f5f9', type: 'dashed' as const },
        },
      },
      yAxis: {
        type: 'value',
        min: 1,
        max: 5,
        name: yAxisName,
        nameLocation: 'middle',
        nameGap: 36,
        nameRotate: 90,
        nameTextStyle: {
          color: '#64748b',
          fontSize: 12,
        },
        axisLine: {
          lineStyle: { color: '#e2e8f0' },
        },
        axisLabel: { color: '#64748b', fontSize: 11 },
        splitLine: {
          lineStyle: { color: '#f1f5f9', type: 'dashed' as const },
        },
      },
      series: [
        ...series,
        {
          name: '九宫格分割线',
          type: 'scatter',
          data: [],
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              color: '#94a3b8',
              type: 'dashed',
              width: 1,
            },
            label: { show: false },
            data: [
              { xAxis: thresholds.low },
              { xAxis: thresholds.high },
              { yAxis: thresholds.low },
              { yAxis: thresholds.high },
            ],
          },
        },
      ],
      graphic: [
        {
          type: 'text',
          left: 56,
          top: 20,
          style: {
            text: '熟练骨干',
            fill: '#f59e0b',
            fontSize: 11,
            fontWeight: 500,
            opacity: 0.7,
          },
        },
        {
          type: 'text',
          left: 'center',
          top: 20,
          style: {
            text: '绩效之星',
            fill: '#ea580c',
            fontSize: 11,
            fontWeight: 500,
            opacity: 0.7,
          },
        },
        {
          type: 'text',
          right: 56,
          top: 20,
          style: {
            text: '超级明星',
            fill: '#dc2626',
            fontSize: 11,
            fontWeight: 500,
            opacity: 0.7,
          },
        },
        {
          type: 'text',
          left: 56,
          top: '46%',
          style: {
            text: '稳定贡献',
            fill: '#06b6d4',
            fontSize: 11,
            fontWeight: 500,
            opacity: 0.7,
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '46%',
          style: {
            text: '中坚力量',
            fill: '#3b82f6',
            fontSize: 11,
            fontWeight: 500,
            opacity: 0.7,
          },
        },
        {
          type: 'text',
          right: 56,
          top: '46%',
          style: {
            text: '潜力之星',
            fill: '#8b5cf6',
            fontSize: 11,
            fontWeight: 500,
            opacity: 0.7,
          },
        },
        {
          type: 'text',
          left: 56,
          bottom: 68,
          style: {
            text: '观察改善',
            fill: '#475569',
            fontSize: 11,
            fontWeight: 500,
            opacity: 0.7,
          },
        },
        {
          type: 'text',
          left: 'center',
          bottom: 68,
          style: {
            text: '待提升',
            fill: '#64748b',
            fontSize: 11,
            fontWeight: 500,
            opacity: 0.7,
          },
        },
        {
          type: 'text',
          right: 56,
          bottom: 68,
          style: {
            text: '待成长',
            fill: '#10b981',
            fontSize: 11,
            fontWeight: 500,
            opacity: 0.7,
          },
        },
      ],
    };
  }, [overviewItems, hqDefaultRuleSet]);

  const handleUnifiedChartClick = (params: unknown): void => {
    const p = params as { data?: { raw?: UnifiedSummaryItem } };
    const raw = p.data?.raw;
    if (!raw) return;
    void handleUnifiedViewDetail(raw);
  };

  const handleUnifiedViewDetail = async (item: UnifiedSummaryItem): Promise<void> => {
    try {
      const record = await review.getRecordDetail(item.id);
      setDetailRecord(record);
      setDetailOpen(true);
    } catch (error) {
      logger.error('加载评价详情失败', error);
      toast.error(getErrorMsg(error));
    }
  };

  const categoryColorStyle = (category: GridCategory): React.CSSProperties => {
    const color = GRID_CATEGORY_COLORS[category];
    return {
      backgroundColor: `${color}1A`,
      color,
      borderColor: `${color}4D`,
    };
  };

  // 统一导出 CSV（概览页）
  const handleOverviewExportCsv = (): void => {
    if (overviewItems.length === 0) {
      toast.info('暂无数据可导出');
      return;
    }
    const headers = [
      '被盘人',
      '部门',
      '岗位类型',
      '评价人',
      '纵轴均分',
      '横轴表现分',
      '落位类别',
      '是否红线',
      '评分日期',
    ];
    const rows = overviewItems.map((item) => [
      item.revieweeName,
      item.department ?? '',
      item.positionType ?? '-',
      item.reviewerName,
      item.valueAvg.toFixed(2),
      item.performanceScore.toFixed(2),
      GRID_CATEGORY_LABELS[item.gridCategory],
      item.isRedLine ? '是' : '否',
      item.reviewDate,
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    link.download = `人才盘点汇总_${yyyy}${mm}${dd}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('导出成功');
  };

  // 统一导出 CSV（盘点结果列表）
  const handleReviewsExportCsv = async (): Promise<void> => {
    try {
      const params: review.AdminRecordsQuery = {};
      if (filterDepartment) params.department = filterDepartment;
      if (filterPositionType) params.positionType = filterPositionType;
      if (filterGridCategory) params.gridCategory = filterGridCategory;
      if (filterIsRedLine === 'yes') params.isRedLine = true;
      if (filterIsRedLine === 'no') params.isRedLine = false;
      if (filterRevieweeName.trim()) params.keyword = filterRevieweeName.trim();
      params.page = 1;
      params.pageSize = 10000;
      params.includeTest = true;

      const res = await review.getAdminRecords(params);
      if (res.items.length === 0) {
        toast.info('暂无数据可导出');
        return;
      }

      const xDim = hqDefaultRuleSet?.config?.xAxisDimension ?? 'comprehensive';
      const yDim = hqDefaultRuleSet?.config?.yAxisDimension ?? 'value';
      const exportItems = res.items.map((r) => {
        const yScore = r.dimensionAvgs?.[yDim] ?? 0;
        let xScore = r.dimensionAvgs?.[xDim] ?? 0;
        if (r.compositeScores && r.compositeScores[xDim] !== undefined) {
          xScore = r.compositeScores[xDim];
        }
        return {
          revieweeName: r.revieweeName,
          department: r.department ?? '',
          positionType: r.positionType ?? '-',
          reviewerName: r.reviewerName,
          valueAvg: yScore,
          performanceScore: xScore,
          gridCategory: r.gridCategory,
          isRedLine: r.isRedLine,
          reviewDate: new Date(r.createdAt).toISOString().slice(0, 10),
        };
      });

      const headers2 = [
        '被盘人',
        '部门',
        '岗位类型',
        '评价人',
        '纵轴均分',
        '横轴表现分',
        '落位类别',
        '是否红线',
        '评分日期',
      ];
      const rows2 = exportItems.map((item) => [
        item.revieweeName,
        item.department,
        item.positionType,
        item.reviewerName,
        item.valueAvg.toFixed(2),
        item.performanceScore.toFixed(2),
        GRID_CATEGORY_LABELS[item.gridCategory],
        item.isRedLine ? '是' : '否',
        item.reviewDate,
      ]);
      const csvContent = [
        headers2.join(','),
        ...rows2.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
        ),
      ].join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      link.download = `盘点结果列表_${yyyy}${mm}${dd}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('导出成功');
    } catch (error) {
      logger.error('导出失败', error);
      toast.error(getErrorMsg(error));
    }
  };

  // 辅助：部门显示名
  const getDepartmentDisplay = (item: UnifiedSummaryItem): string => {
    return item.department ?? '';
  };

  // 辅助：岗位类型显示（有岗位类型则显示，否则显示"-"）
  const getPositionDisplay = (item: UnifiedSummaryItem): string => {
    if (item.positionType) {
      return POSITION_TYPE_LABELS[item.positionType as PositionType] ?? item.positionType;
    }
    return '-';
  };

  if (overviewLoading && activeTab === 'overview') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-[#64748b] text-sm">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-[1280px] mx-auto px-6 py-8">
        {/* 头部标题 + Tabs */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Grid3X3 className="w-6 h-6 text-[#1e6feb]" />
            <h1 className="text-[20px] font-semibold text-[#0f172a]">
              {getDisplayLabel('review_name', '人才盘点')}后台
            </h1>
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
            <TabsList className="bg-[#eef2f7] p-1">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:bg-white data-[state=active]:text-[#1e6feb] data-[state=active]:shadow-sm px-4 text-[14px]"
              >
                <LayoutDashboard className="w-4 h-4 mr-1.5" />
                概览
              </TabsTrigger>
              <TabsTrigger
                value="reviews"
                className="data-[state=active]:bg-white data-[state=active]:text-[#1e6feb] data-[state=active]:shadow-sm px-4 text-[14px]"
              >
                <List className="w-4 h-4 mr-1.5" />
                盘点结果
              </TabsTrigger>
              <TabsTrigger
                value="rule-sets"
                className="data-[state=active]:bg-white data-[state=active]:text-[#1e6feb] data-[state=active]:shadow-sm px-4 text-[14px]"
              >
                <Settings className="w-4 h-4 mr-1.5" />
                规则配置
              </TabsTrigger>
              <TabsTrigger
                value="batches"
                className="data-[state=active]:bg-white data-[state=active]:text-[#1e6feb] data-[state=active]:shadow-sm px-4 text-[14px]"
              >
                <Layers className="w-4 h-4 mr-1.5" />
                批次管理
              </TabsTrigger>
              <TabsTrigger
                value="participants"
                className="data-[state=active]:bg-white data-[state=active]:text-[#1e6feb] data-[state=active]:shadow-sm px-4 text-[14px]"
              >
                <Users className="w-4 h-4 mr-1.5" />
                参评名单
              </TabsTrigger>
              <TabsTrigger
                value="accounts"
                className="data-[state=active]:bg-white data-[state=active]:text-[#1e6feb] data-[state=active]:shadow-sm px-4 text-[14px]"
              >
                <Key className="w-4 h-4 mr-1.5" />
                账号管理
              </TabsTrigger>
              <TabsTrigger
                value="advanced"
                className="data-[state=active]:bg-white data-[state=active]:text-[#1e6feb] data-[state=active]:shadow-sm px-4 text-[14px]"
              >
                <Settings className="w-4 h-4 mr-1.5" />
                高级设置
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* ===== Tab: 概览 ===== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 九宫格分类卡 */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {CATEGORY_ORDER.map((cat) => {
                const count = categoryCounts[cat] ?? 0;
                const color = GRID_CATEGORY_COLORS[cat];
                const isRedLineCat = cat === 'red_line';
                return (
                  <div
                    key={cat}
                    className={`cursor-pointer rounded-[12px] shadow-[0_1px_3px_rgba(0_0_0_0.08)] p-4 transition-all hover:shadow-md hover:-translate-y-0.5 ${isRedLineCat ? 'bg-[#fef2f2] border border-[#ef4444]/30' : 'bg-white border border-transparent'}`}
                    style={{ borderLeft: `3px solid ${color}` }}
                    onClick={() => {
                      setActiveTab('reviews');
                      setFilterGridCategory(cat);
                    }}
                  >
                    <div className="text-[12px] text-[#64748b] mb-1">
                      {GRID_CATEGORY_LABELS[cat]}
                    </div>
                    <div
                      className="text-[24px] font-bold tabular-nums"
                      style={{ color }}
                    >
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 九宫格散点图 + 图例卡片 */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6">
              <Card className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0_0_0_0.08)] border-0">
                <CardHeader className="pb-2">
                  <h2 className="text-[16px] font-semibold text-[#0f172a]">
                    {getDisplayLabel('grid_description', '九宫格分布图')}
                  </h2>
                  <p className="text-[12px] text-[#64748b] mt-1">
                    横轴：能力均分  纵轴：意愿均分（默认配置，可在规则集中调整）
                  </p>
                </CardHeader>
                <CardContent>
                  {overviewItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Grid3X3 className="w-12 h-12 text-[#cbd5e1] mb-4" />
                      <p className="text-[14px] text-[#64748b]">暂无评分数据</p>
                    </div>
                  ) : (
                    <ReactECharts
                      option={unifiedChartOption}
                      style={{ height: 500, width: '100%' }}
                      opts={{ renderer: 'canvas' }}
                      onEvents={{ click: handleUnifiedChartClick }}
                    />
                  )}
                </CardContent>
              </Card>

              {/* 图例说明卡片 */}
              <Card className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0_0_0_0.08)] border-0 h-fit">
                <CardHeader className="pb-2">
                  <h3 className="text-[14px] font-semibold text-[#0f172a]">
                    九宫格类别说明
                  </h3>
                </CardHeader>
                <CardContent className="space-y-3">
                  {CATEGORY_ORDER.map((cat) => (
                    <div key={cat} className="flex items-start gap-3">
                      <div
                        className="w-3 h-3 rounded-full mt-1 shrink-0"
                        style={{ backgroundColor: GRID_CATEGORY_COLORS[cat] }}
                      />
                      <div>
                        <div className="text-[13px] font-medium text-[#0f172a]">
                          {GRID_CATEGORY_LABELS[cat]}
                        </div>
                        <div className="text-[11px] text-[#64748b] mt-0.5 leading-relaxed">
                          {GRID_CATEGORY_STRATEGIES[cat]}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* 部门统计 */}
            {departmentStatsSorted.length > 0 && (
              <Card className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0_0_0_0.08)] border-0">
                <CardHeader className="pb-2">
                  <h2 className="text-[16px] font-semibold text-[#0f172a]">部门统计</h2>
                  <p className="text-[12px] text-[#64748b] mt-1">
                    共 {departmentStatsSorted.length} 个部门
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                          <th className="text-left font-medium text-[#64748b] px-4 py-3 whitespace-nowrap">
                            部门
                          </th>
                          <th className="text-right font-medium text-[#64748b] px-4 py-3 whitespace-nowrap">
                            人数
                          </th>
                          <th className="text-right font-medium text-[#64748b] px-4 py-3 whitespace-nowrap">
                            平均分
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {departmentStatsSorted.map((dept) => (
                          <tr
                            key={dept.department}
                            className="border-b border-[#e2e8f0] last:border-0 hover:bg-[#f8fafc]"
                          >
                            <td className="px-4 py-3 text-[#0f172a] font-medium whitespace-nowrap">
                              {dept.department}
                            </td>
                            <td className="px-4 py-3 text-right text-[#334155] tabular-nums">
                              {dept.count}
                            </td>
                            <td className="px-4 py-3 text-right text-[#334155] tabular-nums">
                              {dept.avgScore.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 全部记录列表 */}
            <Card className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0_0_0_0.08)] border-0">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[16px] font-semibold text-[#0f172a]">全部记录</h2>
                    <p className="text-[12px] text-[#64748b] mt-1">
                      共 {overviewItems.length} 条记录
                    </p>
                  </div>
                  <Button
                    onClick={handleOverviewExportCsv}
                    className="bg-[#1e6feb] hover:bg-[#1a5fd4] text-white"
                  >
                    <Download className="w-4 h-4" />
                    导出汇总表
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-0 pt-0">
                {overviewItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Grid3X3 className="w-12 h-12 text-[#cbd5e1] mb-4" />
                    <p className="text-[14px] text-[#64748b]">暂无评分数据</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                          <th className="text-left font-medium text-[#64748b] px-4 py-3 whitespace-nowrap">
                            被盘人
                          </th>
                          <th className="text-left font-medium text-[#64748b] px-4 py-3 whitespace-nowrap">
                            部门
                          </th>
                          <th className="text-left font-medium text-[#64748b] px-4 py-3 whitespace-nowrap">
                            岗位类型
                          </th>
                          <th className="text-left font-medium text-[#64748b] px-4 py-3 whitespace-nowrap">
                            评价人
                          </th>
                          <th className="text-right font-medium text-[#64748b] px-4 py-3 whitespace-nowrap">
                            纵轴均分
                          </th>
                          <th className="text-right font-medium text-[#64748b] px-4 py-3 whitespace-nowrap">
                            横轴均分
                          </th>
                          <th className="text-left font-medium text-[#64748b] px-4 py-3 whitespace-nowrap">
                            落位类别
                          </th>
                          <th className="text-center font-medium text-[#64748b] px-4 py-3 whitespace-nowrap">
                            红线
                          </th>
                          <th className="text-left font-medium text-[#64748b] px-4 py-3 whitespace-nowrap">
                            评分时间
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {overviewItems.map((item, idx) => (
                          <tr
                            key={`${item.id}-${idx}`}
                            className={`border-b border-[#e2e8f0] last:border-0 cursor-pointer ${
                              item.isRedLine ? 'bg-[#fef2f2]' : 'hover:bg-[#f8fafc]'
                            }`}
                            onClick={() => {
                              void handleUnifiedViewDetail(item);
                            }}
                          >
                            <td className="px-4 py-3 text-[#0f172a] font-medium whitespace-nowrap">
                              {item.revieweeName}
                            </td>
                            <td className="px-4 py-3 text-[#334155] whitespace-nowrap">
                              {getDepartmentDisplay(item)}
                            </td>
                            <td className="px-4 py-3 text-[#334155] whitespace-nowrap">
                              {getPositionDisplay(item)}
                            </td>
                            <td className="px-4 py-3 text-[#334155] whitespace-nowrap">
                              {item.reviewerName}
                            </td>
                            <td className="px-4 py-3 text-right text-[#334155] tabular-nums">
                              {item.valueAvg.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right text-[#0f172a] font-semibold tabular-nums">
                              {item.performanceScore.toFixed(2)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="outline"
                                className="font-medium"
                                style={categoryColorStyle(item.gridCategory)}
                              >
                                {GRID_CATEGORY_LABELS[item.gridCategory]}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {item.isRedLine ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#ef4444] text-white text-[10px] font-bold">
                                  !
                                </span>
                              ) : (
                                <span className="text-[#cbd5e1]">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[#334155] whitespace-nowrap">
                              {item.reviewDate}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== Tab: 盘点结果 ===== */}
        {activeTab === 'reviews' && (
          <div className="space-y-6">
            {/* 筛选区 */}
            <Card className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0_0_0_0.08)] border-0">
              <CardContent className="py-4">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] text-[#64748b]">部门</label>
                    <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="全部部门" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">全部部门</SelectItem>
                        {allDepartments.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] text-[#64748b]">岗位类型</label>
                    <Select
                      value={filterPositionType}
                      onValueChange={setFilterPositionType}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="全部岗位" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">全部岗位</SelectItem>
                        {allPositionTypes.length > 0 ? (
                          allPositionTypes.map((pt) => (
                            <SelectItem key={pt} value={pt}>
                              {POSITION_TYPE_LABELS[pt as PositionType] ?? pt}
                            </SelectItem>
                          ))
                        ) : (
                          Object.entries(POSITION_TYPE_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] text-[#64748b]">落位类别</label>
                    <Select
                      value={filterGridCategory}
                      onValueChange={setFilterGridCategory}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="全部类别" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">全部类别</SelectItem>
                        {CATEGORY_ORDER.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {GRID_CATEGORY_LABELS[cat]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] text-[#64748b]">是否红线</label>
                    <Select value={filterIsRedLine} onValueChange={setFilterIsRedLine}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="全部" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">全部</SelectItem>
                        <SelectItem value="yes">是</SelectItem>
                        <SelectItem value="no">否</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] text-[#64748b]">评价日期（起）</label>
                    <Input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="w-[180px]"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] text-[#64748b]">评价日期（止）</label>
                    <Input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="w-[180px]"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] text-[#64748b]">被盘人姓名</label>
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                      <Input
                        placeholder="搜索姓名"
                        value={filterRevieweeName}
                        onChange={(e) => setFilterRevieweeName(e.target.value)}
                        className="w-[160px] pl-8"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <Button
                      onClick={handleReviewReset}
                      variant="outline"
                      className="text-[#64748b]"
                    >
                      重置
                    </Button>
                    <Button
                      onClick={() => void handleReviewSearch()}
                      disabled={reviewLoading}
                      className="bg-[#1e6feb] hover:bg-[#1a5fd4] text-white"
                    >
                      {reviewLoading ? '查询中...' : '查询'}
                    </Button>
                    <Button
                      onClick={handleReviewsExportCsv}
                      variant="outline"
                      className="border-[#1e6feb] text-[#1e6feb] hover:bg-[#1e6feb]/5"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      导出
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 结果列表 */}
            <Card className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0_0_0_0.08)] border-0">
              <CardHeader className="pb-2">
                <h2 className="text-[16px] font-semibold text-[#0f172a]">查询结果</h2>
                <p className="text-[12px] text-[#64748b] mt-1">
                  {reviewSearched
                    ? `共 ${reviewTotal} 条记录`
                    : '请设置筛选条件后点击查询'}
                </p>
              </CardHeader>
              <CardContent className="px-0 pt-0">
                {!reviewSearched ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Filter className="w-12 h-12 text-[#cbd5e1] mb-4" />
                    <p className="text-[14px] text-[#64748b]">
                      请设置筛选条件后点击查询
                    </p>
                  </div>
                ) : reviewItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <List className="w-12 h-12 text-[#cbd5e1] mb-4" />
                    <p className="text-[14px] text-[#64748b]">暂无匹配记录</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                          <th className="text-left font-medium text-[#64748b] px-4 py-3 whitespace-nowrap">
                            被盘人
                          </th>
                          <th className="text-left font-medium text-[#64748b] px-4 py-3 whitespace-nowrap">
                            部门
                          </th>
                          <th className="text-left font-medium text-[#64748b] px-4 py-3 whitespace-nowrap">
                            岗位类型
                          </th>
                          <th className="text-left font-medium text-[#64748b] px-4 py-3 whitespace-nowrap">
                            评价人
                          </th>
                          <th className="text-right font-medium text-[#64748b] px-4 py-3 whitespace-nowrap">
                            纵轴均分
                          </th>
                          <th className="text-right font-medium text-[#64748b] px-4 py-3 whitespace-nowrap">
                            横轴均分
                          </th>
                          <th className="text-left font-medium text-[#64748b] px-4 py-3 whitespace-nowrap">
                            落位类别
                          </th>
                          <th className="text-center font-medium text-[#64748b] px-4 py-3 whitespace-nowrap">
                            红线
                          </th>
                          <th className="text-left font-medium text-[#64748b] px-4 py-3 whitespace-nowrap">
                            评分时间
                          </th>
                          <th className="text-left font-medium text-[#64748b] px-4 py-3 whitespace-nowrap">
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewItems.map((item) => (
                          <tr
                            key={item.id}
                            className={`border-b border-[#e2e8f0] last:border-0 ${
                              item.isRedLine ? 'bg-[#fef2f2]' : 'hover:bg-[#f8fafc]'
                            }`}
                          >
                            <td className="px-4 py-3 text-[#0f172a] font-medium whitespace-nowrap">
                              {item.revieweeName}
                            </td>
                            <td className="px-4 py-3 text-[#334155] whitespace-nowrap">
                              {getDepartmentDisplay(item)}
                            </td>
                            <td className="px-4 py-3 text-[#334155] whitespace-nowrap">
                              {getPositionDisplay(item)}
                            </td>
                            <td className="px-4 py-3 text-[#334155] whitespace-nowrap">
                              {item.reviewerName}
                            </td>
                            <td className="px-4 py-3 text-right text-[#334155] tabular-nums">
                              {item.valueAvg.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right text-[#0f172a] font-semibold tabular-nums">
                              {item.performanceScore.toFixed(2)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="outline"
                                className="font-medium"
                                style={categoryColorStyle(item.gridCategory)}
                              >
                                {GRID_CATEGORY_LABELS[item.gridCategory]}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {item.isRedLine ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#ef4444] text-white text-[10px] font-bold">
                                  !
                                </span>
                              ) : (
                                <span className="text-[#cbd5e1]">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[#334155] whitespace-nowrap">
                              {item.reviewDate}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleUnifiedViewDetail(item)}
                                className="text-[#1e6feb] hover:text-[#1a5fd4] hover:bg-[#1e6feb]/5 h-7 px-2"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" />
                                查看详情
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== Tab: 规则配置 ===== */}
        {activeTab === 'rule-sets' && (
          <div className="space-y-6">
            <RuleSetsTab
              ruleSets={ruleSets}
              loading={ruleSetsLoading}
              error={ruleSetsError}
              onRefresh={() => {
                void loadRuleSets();
                void loadDisplaySettings();
              }}
            />

            <Card className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0_0_0_0.08)] border-0">
              <CardContent className="pt-4">
                <Accordion type="single" collapsible defaultValue="" className="w-full">
                  <DisplaySettingsBlock
                    settings={displaySettings}
                    loading={displaySettingsLoading}
                    error={displaySettingsError}
                    onRefresh={() => void loadDisplaySettings()}
                  />
                </Accordion>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== Tab: 批次管理 ===== */}
        {activeTab === 'batches' && (
          <div className="space-y-6">
            <BatchesTab
              batches={batches}
              ruleSets={ruleSets}
              loading={batchesLoading}
              error={batchesError}
              onRefresh={() => void loadBatches()}
            />
          </div>
        )}

        {/* ===== Tab: 参评名单 ===== */}
        {activeTab === 'participants' && (
          <div className="space-y-6">
            <ParticipantsTab
              batches={batches}
              participants={participants}
              loading={participantsLoading}
              error={participantsError}
              selectedBatchId={selectedBatchId}
              ruleSets={ruleSets}
              onBatchChange={(id) => setSelectedBatchId(id)}
              onRefresh={() => void loadParticipants()}
            />
          </div>
        )}

        {/* ===== Tab: 账号管理 ===== */}
        {activeTab === 'accounts' && (
          <div>
            <AccountsTab />
          </div>
        )}

        {/* ===== Tab: 高级设置 ===== */}
        {activeTab === 'advanced' && (
          <div className="space-y-6">
            <Card className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0_0_0_0.08)] border-0">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-[#1e6feb]" />
                  <h2 className="text-[16px] font-semibold text-[#0f172a]">
                    高级设置
                  </h2>
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="system-appearance" className="border-0">
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-[#1e6feb]" />
                        <span className="text-[14px] font-medium text-[#0f172a]">
                          系统外观设置
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-3 space-y-5">
                      {/* 系统名称 */}
                      <div className="space-y-2">
                        <div>
                          <Label className="text-[13px] font-medium text-[#0f172a]">
                            系统名称
                          </Label>
                          <p className="text-[12px] text-[#64748b] mt-0.5">
                            显示在导航栏与登录页的系统名称
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Input
                            value={systemNameValue}
                            onChange={(e) => setSystemNameValue(e.target.value)}
                            placeholder="例如：XX公司人才盘点系统"
                            className="flex-1 h-9"
                          />
                          <Button
                            size="sm"
                            onClick={() => void handleSaveSystemName()}
                            disabled={systemNameSaving}
                            className="bg-[#1e6feb] hover:bg-[#1a5fd4] text-white h-9"
                          >
                            <Save className="w-3.5 h-3.5 mr-1" />
                            {systemNameSaving ? '保存中...' : '保存'}
                          </Button>
                        </div>
                      </div>

                      {/* 系统 LOGO */}
                      <div className="space-y-2">
                        <div>
                          <Label className="text-[13px] font-medium text-[#0f172a]">
                            系统 LOGO
                          </Label>
                          <p className="text-[12px] text-[#64748b] mt-0.5">
                            建议尺寸 200×200px，支持 PNG/JPG，大小不超过 2MB
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-center overflow-hidden">
                            {systemLogoValue ? (
                              <Image
                                src={systemLogoValue}
                                alt="当前 LOGO"
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="flex flex-col items-center gap-1 text-[#94a3b8]">
                                <Image
                                  src={logoUrl}
                                  alt="默认 LOGO"
                                  className="w-9 h-auto"
                                />
                                <span className="text-[10px]">默认 LOGO</span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            <input
                              type="file"
                              accept="image/png,image/jpeg"
                              onChange={(e) => void handleLogoUpload(e)}
                              className="hidden"
                              id="system-logo-upload"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                document.getElementById('system-logo-upload')?.click();
                              }}
                              disabled={logoUploading}
                              className="h-9"
                            >
                              <Upload className="w-3.5 h-3.5 mr-1" />
                              {logoUploading ? '上传中...' : '上传 LOGO'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void handleResetLogo()}
                              disabled={logoResetting || !systemLogoValue}
                              className="h-9 text-[#64748b] hover:text-[#0f172a]"
                            >
                              <RotateCcw className="w-3.5 h-3.5 mr-1" />
                              {logoResetting ? '恢复中...' : '恢复默认'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="open-api" className="border-0">
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-[#1e6feb]" />
                        <span className="text-[14px] font-medium text-[#0f172a]">
                          开放接口
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-3 py-2 font-mono text-[13px] text-[#0f172a] break-all">
                          {apiKeyLoading ? (
                            <span className="text-[#94a3b8]">加载中...</span>
                          ) : apiKey ? (
                            apiKey
                          ) : (
                            <span className="text-[#94a3b8]">暂无密钥</span>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => void handleCopyKey()}
                          disabled={!apiKey}
                        >
                          <Copy className="w-4 h-4 mr-1" />
                          {apiKeyCopied ? '已复制' : '复制'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => void handleResetKey()}
                          className="text-[#ef4444] hover:text-[#dc2626] hover:bg-[#fef2f2]"
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          重置密钥
                        </Button>
                      </div>
                      <p className="mt-2 text-[12px] text-[#64748b]">
                        用于外部系统调用人员同步接口。
                        请求头：<code className="bg-[#f1f5f9] px-1.5 py-0.5 rounded text-[11px]">X-API-Key</code>
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 详情弹窗（统一 V2） */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            {detailRecord && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-[18px] font-semibold text-[#0f172a]">
                    评价详情 — {detailRecord.revieweeName}
                  </DialogTitle>
                </DialogHeader>

                {/* 基本信息 */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-3 border-b border-[#e2e8f0]">
                  <div>
                    <div className="text-[12px] text-[#64748b] mb-1">被盘人</div>
                    <div className="text-[14px] text-[#0f172a] font-medium">
                      {detailRecord.revieweeName}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] text-[#64748b] mb-1">部门</div>
                    <div className="text-[14px] text-[#334155]">
                      {detailRecord.department ?? '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] text-[#64748b] mb-1">岗位类型</div>
                    <div className="text-[14px] text-[#334155]">
                      {detailRecord.positionType
                        ? POSITION_TYPE_LABELS[detailRecord.positionType as PositionType]
                          ?? detailRecord.positionType
                        : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] text-[#64748b] mb-1">评价人</div>
                    <div className="text-[14px] text-[#334155]">
                      {detailRecord.reviewerName}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] text-[#64748b] mb-1">工号</div>
                    <div className="text-[14px] text-[#334155]">
                      {detailRecord.employeeNo ?? '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] text-[#64748b] mb-1">评价日期</div>
                    <div className="text-[14px] text-[#334155]">
                      {new Date(detailRecord.createdAt).toISOString().slice(0, 10)}
                    </div>
                  </div>
                </div>

                {/* 分数概览 */}
                <div className="py-3 border-b border-[#e2e8f0]">
                  <div className="text-[13px] font-semibold text-[#0f172a] mb-3">
                    维度均分
                  </div>
                  {Object.keys(detailRecord.dimensionAvgs).length === 0 ? (
                    <div className="text-[14px] text-[#94a3b8] mb-4">—</div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      {Object.entries(detailRecord.dimensionAvgs).map(([dimCode, avg]) => {
                        const dimName = hqDefaultRuleSet?.config?.dimensions?.find(
                          (d) => d.code === dimCode,
                        )?.name ?? dimCode;
                        return (
                          <div key={dimCode}>
                            <div className="text-[12px] text-[#64748b] mb-1">{dimName}</div>
                            <div className="text-[18px] font-semibold text-[#0f172a]">
                              {avg.toFixed(2)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-[12px] text-[#64748b] mb-1">绩效分</div>
                      <div className="text-[18px] font-semibold text-[#0f172a]">
                        {detailRecord.performanceScore.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[12px] text-[#64748b] mb-1">综合总分</div>
                      <div className="text-[18px] font-semibold text-[#1e6feb]">
                        {detailRecord.totalScore.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[12px] text-[#64748b] mb-1">落位分类</div>
                      <Badge
                        variant="outline"
                        className="font-medium"
                        style={categoryColorStyle(detailRecord.gridCategory)}
                      >
                        {GRID_CATEGORY_LABELS[detailRecord.gridCategory]}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* 红线标记 + 状态 */}
                <div className="flex items-center gap-6 py-2 border-b border-[#e2e8f0]">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[#64748b]">红线标记：</span>
                    {detailRecord.isRedLine ? (
                      <Badge className="bg-[#ef4444] text-white border-0">红线区</Badge>
                    ) : (
                      <span className="text-[14px] text-[#334155]">否</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[#64748b]">状态：</span>
                    {detailRecord.isDeleted ? (
                      <Badge
                        variant="outline"
                        className="text-[#94a3b8] border-[#cbd5e1] bg-[#f1f5f9]"
                      >
                        已撤销
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[#10b981] border-[#10b981]/30 bg-[#10b981]/10"
                      >
                        正常
                      </Badge>
                    )}
                  </div>
                </div>

                {/* 评分明细 */}
                <div className="space-y-4 pt-2">
                  {detailRecord.items && detailRecord.items.length > 0 ? (
                    (() => {
                      const dimGroups: Record<string, ReviewScoreItem[]> = {};
                      for (const item of detailRecord.items) {
                        const dimCode = item.dimensionCode || '其他';
                        if (!dimGroups[dimCode]) dimGroups[dimCode] = [];
                        dimGroups[dimCode].push(item);
                      }
                      const dims = hqDefaultRuleSet?.config?.dimensions ?? [];
                      const dimOrder = dims.map((d) => d.code);
                      const orderedDimCodes = [
                        ...dimOrder.filter((d) => dimGroups[d]),
                        ...Object.keys(dimGroups).filter((d) => !dimOrder.includes(d)),
                      ];
                      return orderedDimCodes.map((dimCode) => {
                        const dimName = dims.find((d) => d.code === dimCode)?.name ?? dimCode;
                        const itemsInDim = [...dimGroups[dimCode]].sort(
                          (a, b) => a.sortOrder - b.sortOrder,
                        );
                        return (
                          <div key={dimCode}>
                            <h3 className="text-[14px] font-semibold text-[#0f172a] mb-3">
                              {dimName}
                            </h3>
                            <div className="space-y-3">
                              {itemsInDim.map((item) => {
                                const score = item.score;
                                const maxScore = (item as unknown as { maxScore?: number }).maxScore;
                                const evidenceLevel = (item as unknown as { evidenceLevel?: string }).evidenceLevel;
                                return (
                                  <div
                                    key={item.itemCode}
                                    className="bg-[#f8fafc] rounded-lg p-3"
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-[13px] font-medium text-[#0f172a]">
                                        {item.itemName}
                                        {evidenceLevel && (
                                          <span className="text-[11px] text-[#94a3b8] ml-2 font-normal">
                                            {evidenceLevel}
                                          </span>
                                        )}
                                      </span>
                                      <span
                                        className={`text-[16px] font-bold ${
                                          score <= 2
                                            ? 'text-[#ef4444]'
                                            : score >= 4
                                              ? 'text-[#10b981]'
                                              : 'text-[#1e6feb]'
                                        }`}
                                      >
                                        {score}分{maxScore ? ` / ${maxScore}分` : ''}
                                      </span>
                                    </div>
                                    <div className="text-[12px] text-[#64748b] leading-relaxed">
                                      <span className="text-[#94a3b8]">事实依据：</span>
                                      {item.evidenceText || '无'}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()
                  ) : (
                    <div className="text-[14px] text-[#94a3b8] text-center py-8">
                      暂无评分明细
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

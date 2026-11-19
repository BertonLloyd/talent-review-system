import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { Label } from '@client/src/components/ui/label';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  AlertTriangle,
  User,
  Building2,
  Briefcase,
  Save,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { review } from '@client/src/api';
import { getCurrentUser } from '@client/src/utils/auth';
import { getErrorMsg } from '@client/src/utils/request';
import { computeReviewMetricsFromConfig } from '@client/src/utils/rule-set-calc';
import type {
  RuleSetConfig,
  RuleDimension,
  ReviewCalcResult,
  ReviewScoreItem,
  PositionTypeConfig,
  UnifiedReviewItemInput,
  UnifiedReviewRecordV2,
} from '@shared/api.interface';
import {
  GRID_CATEGORY_LABELS,
  GRID_CATEGORY_COLORS,
  getEvidenceLevelsForScore,
} from '@shared/api.interface';

const DEFAULT_SCORE = 3;

// ========== 评分项数据结构 ==========
interface ScoreItemState {
  score: number;
  evidenceText: string;
  evidenceLevel: string;
}

// ========== 组件 ==========

export default function ReviewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 当前用户
  const [currentUser, setCurrentUser] = useState<{
    key: string;
    name: string;
    role: string;
  } | null>(null);

  // 被盘人列表
  const [reviewerName, setReviewerName] = useState('');
  const [reviewees, setReviewees] = useState<
    Array<{
      name: string;
      department: string | null;
      positionType: string | null;
      employeeNo: string | null;
      hasSubmitted: boolean;
    }>
  >([]);
  const [selectedReviewee, setSelectedReviewee] = useState<string>('');

  // 规则集
  const [ruleSetConfig, setRuleSetConfig] = useState<RuleSetConfig | null>(null);
  const [ruleSetId, setRuleSetId] = useState<string>('');

  // 评分状态：key = `${dimensionCode}__${itemCode}`
  const [scores, setScores] = useState<Record<string, ScoreItemState>>({});

  // 岗位绩效项评分：key = itemCode
  const [perfScores, setPerfScores] = useState<Record<string, ScoreItemState>>({});

  // 编辑模式的详情记录
  const [editRecord, setEditRecord] = useState<UnifiedReviewRecordV2 | null>(
    null,
  );

  // 当前被盘人
  const currentReviewee = useMemo(() => {
    return reviewees.find((r) => r.name === selectedReviewee) ?? null;
  }, [reviewees, selectedReviewee]);

  // 当前岗位类型对应的绩效配置
  const currentPositionConfig = useMemo<PositionTypeConfig | undefined>(() => {
    if (
      !ruleSetConfig?.positionTypes ||
      !currentReviewee?.positionType
    ) {
      return undefined;
    }
    return ruleSetConfig.positionTypes.find(
      (p) => p.code === currentReviewee.positionType,
    );
  }, [ruleSetConfig, currentReviewee]);

  // 计算评分结果
  const metrics: ReviewCalcResult | null = useMemo(() => {
    if (!ruleSetConfig) return null;

    // 构建 itemScores map（用 item code 作为 key）
    const itemScores: Record<string, number> = {};
    for (const dim of ruleSetConfig.dimensions) {
      for (const item of dim.items) {
        const key = `${dim.code}__${item.code}`;
        const s = scores[key]?.score ?? 0;
        itemScores[item.code] = s;
      }
    }

    return computeReviewMetricsFromConfig(ruleSetConfig, itemScores);
  }, [ruleSetConfig, scores]);

  // 绩效均分（用于展示）
  const perfAvgScore = useMemo(() => {
    if (!currentPositionConfig) return 0;
    const perfItems = currentPositionConfig.performanceItems;
    const totalWeight = perfItems.reduce(
      (sum: number, p) => sum + (p.weight ?? 0),
      0,
    );
    if (totalWeight <= 0) return 0;
    let perfScore = 0;
    for (const pi of perfItems) {
      const s = perfScores[pi.code]?.score ?? 0;
      perfScore += s * (pi.weight ?? 0);
    }
    return perfScore / totalWeight;
  }, [currentPositionConfig, perfScores]);

  // ===== 加载初始数据 =====
  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      setPageLoading(false);
      return;
    }
    setCurrentUser(user);

    const load = async (): Promise<void> => {
      try {
        // 并行加载：被盘人列表 + 生效规则集
        const [revieweeRes, ruleSetRes] = await Promise.all([
          review.getReviewees(),
          review.getDefaultRuleSet(),
        ]);

        setReviewerName(revieweeRes.reviewerName);
        setReviewees(revieweeRes.reviewees);

        // 取默认生效规则集
        if (ruleSetRes) {
          setRuleSetConfig(ruleSetRes.config);
          setRuleSetId(ruleSetRes.id);
        }

        // 编辑模式：加载详情
        if (editId) {
          const detail = await review.getRecordDetail(editId);
          setEditRecord(detail);
          setSelectedReviewee(detail.revieweeName);

          // 回填评分
          const filled: Record<string, ScoreItemState> = {};
          const perfFilled: Record<string, ScoreItemState> = {};
          if (detail.items) {
            for (const it of detail.items) {
              if (it.dimensionCode === 'performance') {
                perfFilled[it.itemCode] = {
                  score: it.score,
                  evidenceText: it.evidenceText,
                  evidenceLevel: it.evidenceLevel ?? '',
                };
              } else {
                const key = `${it.dimensionCode}__${it.itemCode}`;
                filled[key] = {
                  score: it.score,
                  evidenceText: it.evidenceText,
                  evidenceLevel: it.evidenceLevel ?? '',
                };
              }
            }
          }
          setScores(filled);
          if (Object.keys(perfFilled).length > 0) {
            setPerfScores(perfFilled);
          }
        }
      } catch (error) {
        logger.error('加载盘点数据失败', error);
        toast.error('加载数据失败，请刷新重试');
      } finally {
        setPageLoading(false);
      }
    };

    void load();
  }, [editId]);

  // ===== 选中被盘人后初始化默认评分 =====
  useEffect(() => {
    if (!selectedReviewee || !ruleSetConfig) return;

    // 如果已有评分（编辑模式或已加载），不覆盖
    if (editId && editRecord) return;

    // 初始化默认分
    const defaultScores: Record<string, ScoreItemState> = {};
    for (const dim of ruleSetConfig.dimensions) {
      for (const item of dim.items) {
        const key = `${dim.code}__${item.code}`;
        defaultScores[key] = {
          score: DEFAULT_SCORE,
          evidenceText: '',
          evidenceLevel: '',
        };
      }
    }
    setScores(defaultScores);

    // 初始化岗位绩效项
    if (currentPositionConfig) {
      const perf: Record<string, ScoreItemState> = {};
      for (const pi of currentPositionConfig.performanceItems) {
        perf[pi.code] = {
          score: DEFAULT_SCORE,
          evidenceText: '',
          evidenceLevel: '',
        };
      }
      setPerfScores(perf);
    } else {
      setPerfScores({});
    }
  }, [
    selectedReviewee,
    ruleSetConfig,
    currentPositionConfig,
    editId,
    editRecord,
  ]);

  // ===== 维度分数变更 =====
  const handleScoreChange = useCallback(
    (dimCode: string, itemCode: string, value: string): void => {
      const score = parseInt(value, 10) || 0;
      const key = `${dimCode}__${itemCode}`;
      setScores((prev) => {
        const current = prev[key];
        const availableLevels = getEvidenceLevelsForScore(score);
        const currentLevelValid = availableLevels.some(
          (lvl) => lvl.code === current?.evidenceLevel,
        );
        return {
          ...prev,
          [key]: {
            ...current,
            score,
            evidenceLevel: currentLevelValid ? current.evidenceLevel : '',
          },
        };
      });
    },
    [],
  );

  const handleEvidenceChange = useCallback(
    (dimCode: string, itemCode: string, value: string): void => {
      const key = `${dimCode}__${itemCode}`;
      setScores((prev) => ({
        ...prev,
        [key]: { ...prev[key], evidenceText: value },
      }));
    },
    [],
  );

  const handleEvidenceLevelChange = useCallback(
    (dimCode: string, itemCode: string, value: string): void => {
      const key = `${dimCode}__${itemCode}`;
      setScores((prev) => ({
        ...prev,
        [key]: { ...prev[key], evidenceLevel: value },
      }));
    },
    [],
  );

  // ===== 岗位绩效项变更 =====
  const handlePerfScoreChange = useCallback(
    (itemCode: string, value: string): void => {
      const score = parseInt(value, 10) || 0;
      setPerfScores((prev) => {
        const current = prev[itemCode];
        const availableLevels = getEvidenceLevelsForScore(score);
        const currentLevelValid = availableLevels.some(
          (lvl) => lvl.code === current?.evidenceLevel,
        );
        return {
          ...prev,
          [itemCode]: {
            ...current,
            score,
            evidenceLevel: currentLevelValid ? current.evidenceLevel : '',
          },
        };
      });
    },
    [],
  );

  const handlePerfEvidenceChange = useCallback(
    (itemCode: string, value: string): void => {
      setPerfScores((prev) => ({
        ...prev,
        [itemCode]: { ...prev[itemCode], evidenceText: value },
      }));
    },
    [],
  );

  const handlePerfEvidenceLevelChange = useCallback(
    (itemCode: string, value: string): void => {
      setPerfScores((prev) => ({
        ...prev,
        [itemCode]: { ...prev[itemCode], evidenceLevel: value },
      }));
    },
    [],
  );

  // ===== 是否全部填完 =====
  const allFilled = useMemo(() => {
    if (!ruleSetConfig) return false;

    for (const dim of ruleSetConfig.dimensions) {
      for (const item of dim.items) {
        const key = `${dim.code}__${item.code}`;
        const s = scores[key];
        if (!s || s.score <= 0) {
          return false;
        }
        if (item.evidenceRequired) {
          if (!s || s.evidenceText.trim().length === 0) {
            return false;
          }
          if (!s.evidenceLevel) {
            return false;
          }
        }
      }
    }

    if (currentPositionConfig) {
      for (const pi of currentPositionConfig.performanceItems) {
        const s = perfScores[pi.code];
        if (!s || s.score <= 0) {
          return false;
        }
        if (pi.evidenceRequired) {
          if (!s || s.evidenceText.trim().length === 0) {
            return false;
          }
          if (!s.evidenceLevel) {
            return false;
          }
        }
      }
    }

    return true;
  }, [ruleSetConfig, scores, currentPositionConfig, perfScores]);

  // ===== 构建提交数据 =====
  const buildSubmitBody = (): {
    items: UnifiedReviewItemInput[];
    performanceItems?: Record<string, { score: number; evidence: string }>;
  } => {
    const items: UnifiedReviewItemInput[] = [];
    let sortOrder = 0;

    if (ruleSetConfig) {
      for (const dim of ruleSetConfig.dimensions) {
        for (const item of dim.items) {
          const key = `${dim.code}__${item.code}`;
          const s = scores[key];
          items.push({
            dimensionCode: dim.code,
            itemCode: item.code,
            itemName: item.name,
            score: s?.score ?? DEFAULT_SCORE,
            maxScore: item.maxScore,
            evidenceText: s?.evidenceText ?? '',
            evidenceLevel: s?.evidenceLevel || undefined,
            sortOrder,
          });
          sortOrder += 1;
        }
      }
    }

    const body: {
      items: UnifiedReviewItemInput[];
      performanceItems?: Record<string, { score: number; evidence: string; evidenceLevel?: string }>;
    } = { items };

    if (currentPositionConfig) {
      const perfItems: Record<string, { score: number; evidence: string; evidenceLevel?: string }> = {};
      for (const pi of currentPositionConfig.performanceItems) {
        const s = perfScores[pi.code];
        perfItems[pi.code] = {
          score: s?.score ?? DEFAULT_SCORE,
          evidence: s?.evidenceText ?? '',
          evidenceLevel: s?.evidenceLevel,
        };
      }
      body.performanceItems = perfItems;
    }

    return body;
  };

  // ===== 提交 =====
  const handleSubmit = async (): Promise<void> => {
    if (!currentUser) {
      toast.error('未登录，请先选择身份');
      return;
    }
    if (!selectedReviewee) {
      toast.error('请选择被盘人');
      return;
    }
    if (!ruleSetConfig || !ruleSetId) {
      toast.error('规则集未加载，请刷新重试');
      return;
    }
    if (!allFilled) {
      toast.error('请为所有维度打分并填写事实依据');
      return;
    }

    const body = buildSubmitBody();
    setSubmitting(true);
    try {
      if (editId && editRecord) {
        await review.updateRecord(editId, {
          items: body.items,
          performanceItems: body.performanceItems,
        });
        toast.success('评分更新成功');
      } else {
        await review.createRecord({
          reviewerKey: currentUser.key,
          reviewerName: reviewerName || currentUser.name,
          revieweeName: selectedReviewee,
          employeeNo: currentReviewee?.employeeNo ?? undefined,
          department: currentReviewee?.department ?? undefined,
          positionType: currentReviewee?.positionType ?? undefined,
          ruleSetId,
          items: body.items,
          performanceItems: body.performanceItems,
        });
        toast.success('评分提交成功');
      }
      navigate('/my-scores');
    } catch (error) {
      logger.error('提交评分失败', error);
      toast.error(getErrorMsg(error));
    } finally {
      setSubmitting(false);
    }
  };

  // ========== 渲染 ==========

  if (pageLoading) {
    return <PageSkeleton />;
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-[#64748b]">未选择身份，请先登录</div>
      </div>
    );
  }

  const gridCategory = metrics?.gridCategory ?? 'backbone';
  const isRedLine = metrics?.isRedLine ?? false;
  const totalScore = metrics?.totalScore ?? 0;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-[1280px] mx-auto px-6 py-8">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-[#64748b] hover:text-[#0f172a]"
              aria-label="返回"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-[20px] font-semibold text-[#0f172a]">
              {editId ? '编辑评分' : '人才盘点评分'}
            </h1>
            {reviewerName && (
              <Badge variant="secondary" className="bg-[#eff6ff] text-[#1e6feb]">
                <User className="w-3 h-3 mr-1" />
                {reviewerName}
              </Badge>
            )}
          </div>
          <Button
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="bg-[#1e6feb] hover:bg-[#1a5fd4] text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            {submitting ? '提交中...' : editId ? '保存修改' : '提交评分'}
          </Button>
        </div>

        {/* 被盘人选择 */}
        <Card className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0_0_0_0.08)] border-0 mb-6">
          <CardContent className="py-4">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                <Label className="text-[14px] text-[#64748b] whitespace-nowrap">
                  被盘人
                </Label>
                <Select
                  value={selectedReviewee}
                  onValueChange={setSelectedReviewee}
                  disabled={!!editId}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="请选择被盘人" />
                  </SelectTrigger>
                  <SelectContent>
                    {reviewees.map((r) => (
                      <SelectItem key={r.name} value={r.name}>
                        <div className="flex items-center gap-2">
                          <span>{r.name}</span>
                          {r.department && (
                            <span className="text-[#94a3b8] text-[12px]">
                              {r.department}
                            </span>
                          )}
                          {r.hasSubmitted && (
                            <Badge
                              variant="secondary"
                              className="bg-[#dcfce7] text-[#15803d] text-[10px] ml-1"
                            >
                              已评
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentReviewee && (
                <div className="flex items-center gap-4 text-[13px] text-[#64748b] flex-wrap">
                  {currentReviewee.department && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      {currentReviewee.department}
                    </span>
                  )}
                  {currentReviewee.positionType && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5" />
                      {currentPositionConfig?.name ??
                        currentReviewee.positionType}
                    </span>
                  )}
                  {currentReviewee.employeeNo && (
                    <span>工号：{currentReviewee.employeeNo}</span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedReviewee && ruleSetConfig && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* 左侧：评分区域 */}
            <div className="space-y-6">
              {/* 各维度评分区块 */}
              {ruleSetConfig.dimensions.map((dim: RuleDimension) => (
                <Card
                  key={dim.code}
                  className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0_0_0_0.08)] border-0"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-[16px] font-semibold text-[#0f172a]">
                        {dim.name}
                      </CardTitle>
                      {dim.isRedLine && (
                        <Badge
                          variant="secondary"
                          className="bg-[#fee2e2] text-[#dc2626]"
                        >
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          红线维度
                        </Badge>
                      )}
                      <div className="flex-1" />
                      <span className="text-[12px] text-[#64748b]">
                        权重 {(dim.weight * 100).toFixed(0)}% · 均分{' '}
                        {metrics?.dimensionAverages?.[dim.code]?.toFixed(2) ??
                          '0.00'}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {dim.items.map((item) => {
                      const key = `${dim.code}__${item.code}`;
                      const scoreState = scores[key];
                      const isRedLineItem =
                        dim.isRedLine && (scoreState?.score ?? 0) > 0 && (scoreState?.score ?? 0) <= 2;
                      const evidenceLevels = scoreState?.score
                        ? getEvidenceLevelsForScore(scoreState.score)
                        : [];
                      return (
                        <div
                          key={item.code}
                          className={`border rounded-lg p-4 ${
                            isRedLineItem
                              ? 'border-[#fecaca] bg-[#fef2f2]'
                              : 'border-[#e2e8f0]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-medium text-[#0f172a]">
                                {item.name}
                              </span>
                              {isRedLineItem && (
                                <Badge
                                  variant="destructive"
                                  className="text-[10px] h-5"
                                >
                                  触发红线
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-[12px] text-[#64748b]">
                                分数 (1-{item.maxScore})
                              </Label>
                              <Select
                                value={String(scoreState?.score ?? '')}
                                onValueChange={(v) =>
                                  handleScoreChange(dim.code, item.code, v)
                                }
                              >
                                <SelectTrigger className="w-20">
                                  <SelectValue placeholder="打分" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from(
                                    { length: item.maxScore },
                                    (_, i) => i + 1,
                                  ).map((n) => (
                                    <SelectItem key={n} value={String(n)}>
                                      {n} 分
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="mb-3">
                            <Label className="text-[12px] text-[#64748b] mb-1 block">
                              依据档位
                              {item.evidenceRequired && (
                                <span className="text-[#ef4444] ml-1">*</span>
                              )}
                            </Label>
                            <Select
                              value={scoreState?.evidenceLevel ?? ''}
                              onValueChange={(v) =>
                                handleEvidenceLevelChange(dim.code, item.code, v)
                              }
                              disabled={evidenceLevels.length === 0}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="请选择依据档位" />
                              </SelectTrigger>
                              <SelectContent>
                                {evidenceLevels.map((lvl) => (
                                  <SelectItem key={lvl.code} value={lvl.code}>
                                    {lvl.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Textarea
                              placeholder="请填写事实依据，描述具体行为和案例..."
                              value={scoreState?.evidenceText ?? ''}
                              onChange={(e) =>
                                handleEvidenceChange(
                                  dim.code,
                                  item.code,
                                  e.target.value,
                                )
                              }
                              className="min-h-[80px] resize-y text-[13px]"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}

              {/* 岗位绩效区块（有配置时显示） */}
              {currentPositionConfig &&
                currentPositionConfig.performanceItems.length > 0 && (
                  <Card className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0_0_0_0.08)] border-0">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-[16px] font-semibold text-[#0f172a]">
                        岗位绩效（{currentPositionConfig.name}）
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {currentPositionConfig.performanceItems.map((pi) => {
                        const s = perfScores[pi.code];
                        const evidenceLevels = s?.score
                          ? getEvidenceLevelsForScore(s.score)
                          : [];
                        return (
                          <div
                            key={pi.code}
                            className="border border-[#e2e8f0] rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-[14px] font-medium text-[#0f172a]">
                                  {pi.name}
                                </span>
                                <span className="text-[12px] text-[#64748b]">
                                  权重 {((pi.weight ?? 0) * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Label className="text-[12px] text-[#64748b]">
                                  分数 (1-{pi.maxScore})
                                </Label>
                                <Select
                                  value={String(s?.score ?? '')}
                                  onValueChange={(v) =>
                                    handlePerfScoreChange(pi.code, v)
                                  }
                                >
                                  <SelectTrigger className="w-20">
                                    <SelectValue placeholder="打分" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from(
                                      { length: pi.maxScore },
                                      (_, i) => i + 1,
                                    ).map((n) => (
                                      <SelectItem key={n} value={String(n)}>
                                        {n} 分
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="mb-3">
                              <Label className="text-[12px] text-[#64748b] mb-1 block">
                                依据档位
                                {pi.evidenceRequired && (
                                  <span className="text-[#ef4444] ml-1">*</span>
                                )}
                              </Label>
                              <Select
                                value={s?.evidenceLevel ?? ''}
                                onValueChange={(v) =>
                                  handlePerfEvidenceLevelChange(pi.code, v)
                                }
                                disabled={evidenceLevels.length === 0}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="请选择依据档位" />
                                </SelectTrigger>
                                <SelectContent>
                                  {evidenceLevels.map((lvl) => (
                                    <SelectItem key={lvl.code} value={lvl.code}>
                                      {lvl.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Textarea
                                placeholder="请填写绩效事实依据..."
                                value={s?.evidenceText ?? ''}
                                onChange={(e) =>
                                  handlePerfEvidenceChange(
                                    pi.code,
                                    e.target.value,
                                  )
                                }
                                className="min-h-[80px] resize-y text-[13px]"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}
            </div>

            {/* 右侧：实时计算结果 */}
            <div className="space-y-4">
              <Card className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0_0_0_0.08)] border-0 sticky top-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-[16px] font-semibold text-[#0f172a]">
                    评分结果
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 总分 */}
                  <div className="bg-[#eff6ff] rounded-lg p-4 text-center">
                    <div className="text-[12px] text-[#1e6feb] mb-1">
                      综合总分
                    </div>
                    <div className="text-[32px] font-bold text-[#1e6feb]">
                      {totalScore.toFixed(2)}
                    </div>
                  </div>

                  {/* 各维度均分 */}
                  {ruleSetConfig.dimensions.map((dim) => (
                    <div
                      key={dim.code}
                      className="flex items-center justify-between text-[13px]"
                    >
                      <span className="text-[#64748b]">{dim.name}</span>
                      <span className="font-medium text-[#0f172a]">
                        {metrics?.dimensionAverages?.[dim.code]?.toFixed(2) ??
                          '0.00'}
                      </span>
                    </div>
                  ))}
                  {currentPositionConfig && (
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[#64748b]">岗位绩效</span>
                      <span className="font-medium text-[#0f172a]">
                        {perfAvgScore.toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-[#e2e8f0] pt-3" />

                  {/* 九宫格落位 */}
                  <div>
                    <div className="text-[12px] text-[#64748b] mb-2">
                      九宫格落位
                    </div>
                    <Badge
                      variant="outline"
                      className="font-medium text-[14px] py-1.5 px-3"
                      style={{
                        backgroundColor: `${GRID_CATEGORY_COLORS[gridCategory]}1A`,
                        color: GRID_CATEGORY_COLORS[gridCategory],
                        borderColor: `${GRID_CATEGORY_COLORS[gridCategory]}4D`,
                      }}
                    >
                      {GRID_CATEGORY_LABELS[gridCategory]}
                    </Badge>
                  </div>

                  {/* 红线标识 */}
                  {isRedLine && (
                    <div className="bg-[#fef2f2] border border-[#fecaca] rounded-lg p-3">
                      <div className="flex items-center gap-2 text-[#dc2626] text-[13px] font-medium">
                        <AlertTriangle className="w-4 h-4" />
                        触发红线
                      </div>
                      <p className="text-[12px] text-[#f87171] mt-1">
                        红线维度中存在 ≤2 分的子项，请重点关注
                      </p>
                    </div>
                  )}

                  {/* 坐标轴分数 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#f8fafc] rounded-lg p-3 text-center">
                      <div className="text-[11px] text-[#64748b] mb-1">
                        横轴分
                      </div>
                      <div className="text-[18px] font-semibold text-[#0f172a]">
                        {metrics?.xAxisScore?.toFixed(2) ?? '0.00'}
                      </div>
                    </div>
                    <div className="bg-[#f8fafc] rounded-lg p-3 text-center">
                      <div className="text-[11px] text-[#64748b] mb-1">
                        纵轴分
                      </div>
                      <div className="text-[18px] font-semibold text-[#0f172a]">
                        {metrics?.yAxisScore?.toFixed(2) ?? '0.00'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {!selectedReviewee && !pageLoading && (
          <Card className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0_0_0_0.08)] border-0">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <User className="w-12 h-12 text-[#cbd5e1] mb-4" />
              <p className="text-[14px] text-[#64748b]">
                请先选择被盘人开始评分
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ========== 骨架屏 ==========

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-[1280px] mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-6 h-6 rounded" />
          <Skeleton className="w-40 h-6 rounded" />
        </div>
        <Skeleton className="h-20 rounded-xl mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl sticky top-6" />
        </div>
      </div>
    </div>
  );
}

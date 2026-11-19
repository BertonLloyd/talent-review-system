import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  GripVertical,
  Save,
  Power,
  ChevronUp,
  ChevronDown,
  Copy,
  History,
  RotateCcw,
  Clock,
  User,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { getErrorMsg } from '@client/src/utils/request';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

import { review } from '@/api';
import {
  RULE_SET_STATUS_LABELS,
} from '@shared/api.interface';
import type {
  RuleSetRecord,
  RuleDimension,
  RuleDimensionItem,
  RuleSetConfig,
  PositionTypeConfig,
  RuleSetDisplayLabels,
  RuleSetVersionRecord,
} from '@shared/api.interface';
import { showConfirm } from '@lark-apaas/client-toolkit';

interface RuleSetsTabProps {
  ruleSets: RuleSetRecord[] | null;
  loading: boolean;
  error: unknown;
  onRefresh: () => void;
}

function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const defaultConfig = (): RuleSetConfig => {
  return {
    dimensions: [
      {
        code: 'value',
        name: '价值观匹配度',
        weight: 0.4,
        isRedLine: true,
        items: [
          { code: 'value_1', name: '共创共享认同', maxScore: 5, sortOrder: 1 },
          { code: 'value_2', name: '成本利润意识', maxScore: 5, sortOrder: 2 },
          { code: 'value_3', name: '主人翁与协同', maxScore: 5, sortOrder: 3 },
        ],
      },
      {
        code: 'ability',
        name: '能力',
        weight: 0.36,
        isRedLine: false,
        items: [
          { code: 'ability_1', name: '岗位专业胜任', maxScore: 5, sortOrder: 1 },
          { code: 'ability_2', name: '交付质量与效率', maxScore: 5, sortOrder: 2 },
          { code: 'ability_3', name: '问题解决', maxScore: 5, sortOrder: 3 },
        ],
      },
      {
        code: 'will',
        name: '意愿',
        weight: 0.24,
        isRedLine: false,
        items: [
          { code: 'will_1', name: '主动性', maxScore: 5, sortOrder: 1 },
          { code: 'will_2', name: '成长意愿', maxScore: 5, sortOrder: 2 },
          { code: 'will_3', name: '稳定性与心态', maxScore: 5, sortOrder: 3 },
        ],
      },
    ],
    gridThresholds: { high: 4.0, low: 2.5 },
    xAxisDimension: 'ability',
    yAxisDimension: 'value',
    evidenceLevels: [
      { code: 'high', name: '高', minScore: 4, maxScore: 5, description: '表现卓越，远超岗位要求' },
      { code: 'medium', name: '中', minScore: 3, maxScore: 3.9, description: '符合岗位要求，稳定产出' },
      { code: 'low', name: '低', minScore: 1, maxScore: 2.9, description: '未达岗位要求，需改善' },
    ],
    scoreLevels: [
      { code: 'core', name: '超级明星', minScore: 4, maxScore: 5, description: '高价值观×高表现' },
      { code: 'focus', name: '重点培养', minScore: 3, maxScore: 3.9, description: '有潜力可重点发展' },
      { code: 'stable', name: '稳定贡献', minScore: 2.5, maxScore: 2.9, description: '中价值观×中表现' },
      { code: 'observe', name: '观察改善', minScore: 2, maxScore: 2.4, description: '需关注与改善' },
    ],
    positionTypes: [],
    displayLabels: {},
  };
};

export default function RuleSetsTab({
  ruleSets,
  loading,
  error,
  onRefresh,
}: RuleSetsTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async (): Promise<void> => {
    if (!newName.trim()) {
      toast.error('请输入规则集名称');
      return;
    }
    setSaving(true);
    try {
      await review.createRuleSet({
        name: newName.trim(),
        description: newDesc.trim(),
        config: defaultConfig(),
      } as any);
      toast.success('创建成功');
      setCreateDialogOpen(false);
      setNewName('');
      setNewDesc('');
      onRefresh();
    } catch (err) {
      logger.error('创建规则集失败', err);
      toast.error(getErrorMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    if (!await showConfirm('确定删除该规则集？删除后无法恢复')) return;
    try {
      await review.deleteRuleSet(id);
      toast.success('删除成功');
      if (expandedId === id) setExpandedId(null);
      onRefresh();
    } catch (err) {
      logger.error('删除规则集失败', err);
      toast.error(getErrorMsg(err));
    }
  };

  const handleActivate = async (id: string): Promise<void> => {
    if (!await showConfirm('确定将此规则集设为生效版本？同类型下其它生效版本将被替换')) return;
    try {
      await review.activateRuleSet(id);
      toast.success('已设为生效版本');
      onRefresh();
    } catch (err) {
      logger.error('启用规则集失败', err);
      toast.error(getErrorMsg(err));
    }
  };

  const handleCopy = async (id: string, name: string): Promise<void> => {
    try {
      const copied = await review.copyRuleSet(id);
      toast.success(`已创建副本「${copied.name}」，可在此基础上修改，改好后设为生效`);
      setExpandedId(copied.id);
      onRefresh();
    } catch (err) {
      logger.error('复制规则集失败', err);
      toast.error(getErrorMsg(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* 规则集列表 */}
      <Card className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0_0_0_0.08)] border-0">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <h2 className="text-[16px] font-semibold text-[#0f172a]">
            规则集列表
          </h2>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="bg-[#1e6feb] hover:bg-[#1a5fd4] text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            新建规则集
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <RuleSetListSkeleton />
          ) : error ? (
            <div className="text-center py-12 text-[#64748b] text-sm">
              加载失败，请稍后重试
            </div>
          ) : !ruleSets || ruleSets.length === 0 ? (
            <div className="text-center py-12 text-[#64748b] text-sm">
              暂无规则集，点击「新建规则集」创建
            </div>
          ) : (
            <Accordion
              type="single"
              collapsible
              value={expandedId ?? ''}
              onValueChange={(v) => setExpandedId(v || null)}
              className="w-full"
            >
              {ruleSets.map((rs) => (
                <AccordionItem
                  key={rs.id}
                  value={rs.id}
                  className="border border-[#e2e8f0] rounded-lg mb-3 px-4 data-[state=open]:bg-[#f8fafc]"
                >
                  <AccordionTrigger className="py-3 hover:no-underline">
                    <div className="flex items-center gap-3 flex-1 pr-4">
                      <GripVertical className="w-4 h-4 text-[#94a3b8]" />
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-medium text-[#0f172a]">
                          {rs.name}
                        </span>
                        <Badge
                          variant="secondary"
                          className={
                            rs.status === 'active'
                              ? 'bg-[#dcfce7] text-[#15803d] hover:bg-[#dcfce7]'
                              : rs.status === 'draft'
                                ? 'bg-[#fef3c7] text-[#92400e] hover:bg-[#fef3c7]'
                                : 'bg-[#f1f5f9] text-[#475569] hover:bg-[#f1f5f9]'
                          }
                        >
                          {RULE_SET_STATUS_LABELS[rs.status]}
                        </Badge>
                      </div>
                      <div className="flex-1" />
                      <div className="text-[12px] text-[#64748b]">
                        {rs.config.dimensions.length} 个维度 ·{' '}
                        {rs.config.dimensions.reduce(
                          (acc: number, d: RuleDimension) =>
                            acc + d.items.length,
                          0,
                        )}{' '}
                        个子项
                      </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-[#1e6feb] hover:text-[#1a5fd4] hover:bg-[#eff6ff]"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleCopy(rs.id, rs.name);
                            }}
                          >
                            <Copy className="w-3.5 h-3.5 mr-1" />
                            复制
                          </Button>
                          {rs.status !== 'active' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleActivate(rs.id);
                            }}
                          >
                            <Power className="w-3.5 h-3.5 mr-1" />
                            设为生效
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[#ef4444] hover:text-[#dc2626] hover:bg-[#fef2f2]"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDelete(rs.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <RuleSetEditor
                      ruleSet={rs}
                      onSaved={onRefresh}
                    />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* 新建规则集对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建规则集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>规则集名称</Label>
              <Input
                placeholder="请输入规则集名称"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>描述（可选）</Label>
              <Input
                placeholder="简要描述"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={saving}
            >
              取消
            </Button>
            <Button
              onClick={() => void handleCreate()}
              disabled={saving}
              className="bg-[#1e6feb] hover:bg-[#1a5fd4] text-white"
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ 版本历史 ============

function RuleSetVersionHistory({
  ruleSetId,
  onRollback,
}: {
  ruleSetId: string;
  onRollback: () => void;
}) {
  const [versions, setVersions] = useState<RuleSetVersionRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<RuleSetVersionRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [rollbackVersion, setRollbackVersion] = useState<RuleSetVersionRecord | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  const loadVersions = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await review.getRuleSetVersions(ruleSetId);
      setVersions(res.items);
    } catch (err) {
      logger.error('加载版本历史失败', err);
      toast.error('加载版本历史失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时加载
  useEffect(() => {
    void loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleSetId]);

  const handleViewDetail = (version: RuleSetVersionRecord): void => {
    setSelectedVersion(version);
    setDetailOpen(true);
  };

  const handleRollback = async (): Promise<void> => {
    if (!rollbackVersion) return;
    setRollingBack(true);
    try {
      await review.rollbackRuleSetVersion(
        ruleSetId,
        rollbackVersion.versionNo,
      );
      toast.success('回滚成功，已生成新版本');
      setRollbackVersion(null);
      void loadVersions();
      onRollback();
    } catch (err) {
      logger.error('回滚失败', err);
      toast.error(getErrorMsg(err));
    } finally {
      setRollingBack(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-[#0f172a] flex items-center gap-2">
          <History className="w-4 h-4 text-[#1e6feb]" />
          版本历史
          {versions && (
            <span className="text-[12px] font-normal text-[#64748b]">
              共 {versions.length} 个版本
            </span>
          )}
        </h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void loadVersions()}
          className="text-[12px] h-7"
        >
          刷新
        </Button>
      </div>

      <Card className="bg-white rounded-lg shadow-none border border-[#e2e8f0]">
        <CardContent className="pt-4">
          {loading ? (
            <VersionListSkeleton />
          ) : !versions || versions.length === 0 ? (
            <div className="text-center py-8 text-[12px] text-[#94a3b8]">
              暂无版本记录
            </div>
          ) : (
            <div className="space-y-1">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#f8fafc] transition-colors"
                >
                  <div className="flex-shrink-0 w-14 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-[#eff6ff] text-[#1e6feb] text-[12px] font-medium">
                      v{version.versionNo}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-[#0f172a] font-medium truncate">
                      {version.changeNote || '未填写变更说明'}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[12px] text-[#64748b]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(version.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {version.createdBy || '未知用户'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleViewDetail(version)}
                      className="h-7 text-[12px] text-[#1e6feb] hover:text-[#1a5fd4] hover:bg-[#eff6ff]"
                    >
                      查看配置
                      <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRollbackVersion(version)}
                      className="h-7 text-[12px] text-[#f59e0b] hover:text-[#d97706] hover:bg-[#fffbeb]"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      回滚到此版本
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 版本详情对话框 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              版本详情 — v{selectedVersion?.versionNo}
            </DialogTitle>
          </DialogHeader>
          {selectedVersion && (
            <VersionConfigDetail version={selectedVersion} />
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDetailOpen(false)}
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 回滚确认对话框 */}
      <Dialog
        open={rollbackVersion !== null}
        onOpenChange={(open) => {
          if (!open) setRollbackVersion(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认回滚</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-[14px] text-[#334155]">
              确定要回滚到 <span className="font-semibold text-[#1e6feb]">v{rollbackVersion?.versionNo}</span> 版本吗？
            </p>
            <div className="bg-[#fffbeb] border border-[#fcd34d] rounded-lg p-3 text-[12px] text-[#92400e]">
              ⚠️ 回滚会替换当前配置，历史评分不受影响。
              回滚后将自动生成一条新版本记录。
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRollbackVersion(null)}
              disabled={rollingBack}
            >
              取消
            </Button>
            <Button
              onClick={() => void handleRollback()}
              disabled={rollingBack}
              className="bg-[#f59e0b] hover:bg-[#d97706] text-white"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              确认回滚
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  } catch {
    return iso;
  }
}

function VersionListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3"
        >
          <Skeleton className="h-5 w-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-6 w-20 rounded" />
        </div>
      ))}
    </div>
  );
}

function VersionConfigDetail({
  version,
}: {
  version: RuleSetVersionRecord;
}) {
  const { config } = version;
  const totalItems = config.dimensions.reduce(
    (acc: number, d: RuleDimension) => acc + d.items.length,
    0,
  );
  const totalWeight = config.dimensions.reduce(
    (sum: number, d: RuleDimension) =>
      sum + ((d.weight ?? 0) > 0 ? d.weight : 0),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#f8fafc] rounded-lg p-3">
          <div className="text-[12px] text-[#64748b] mb-1">维度数量</div>
          <div className="text-[20px] font-semibold text-[#0f172a]">
            {config.dimensions.length}
          </div>
        </div>
        <div className="bg-[#f8fafc] rounded-lg p-3">
          <div className="text-[12px] text-[#64748b] mb-1">子项总数</div>
          <div className="text-[20px] font-semibold text-[#0f172a]">
            {totalItems}
          </div>
        </div>
        <div className="bg-[#f8fafc] rounded-lg p-3">
          <div className="text-[12px] text-[#64748b] mb-1">九宫格高分线</div>
          <div className="text-[20px] font-semibold text-[#10b981]">
            ≥ {config.gridThresholds.high}
          </div>
        </div>
        <div className="bg-[#f8fafc] rounded-lg p-3">
          <div className="text-[12px] text-[#64748b] mb-1">九宫格低分线</div>
          <div className="text-[20px] font-semibold text-[#f59e0b]">
            &lt; {config.gridThresholds.low}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-[13px] font-medium text-[#0f172a]">
          维度明细
        </h4>
        <div className="space-y-2">
          {config.dimensions.map((dim: RuleDimension) => {
            const xDim = config.xAxisDimension === dim.code;
            const yDim = config.yAxisDimension === dim.code;
            return (
              <div
                key={dim.code}
                className="border border-[#e2e8f0] rounded-lg p-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[13px] font-medium text-[#0f172a]">
                    {dim.name}
                  </span>
                  <span className="text-[12px] text-[#64748b]">
                    ({dim.code})
                  </span>
                  {dim.isRedLine && (
                    <Badge
                      variant="secondary"
                      className="bg-[#fee2e2] text-[#dc2626] hover:bg-[#fee2e2] text-[11px] h-5"
                    >
                      红线
                    </Badge>
                  )}
                  {xDim && (
                    <Badge
                      variant="secondary"
                      className="bg-[#dbeafe] text-[#1d4ed8] hover:bg-[#dbeafe] text-[11px] h-5"
                    >
                      横轴
                    </Badge>
                  )}
                  {yDim && (
                    <Badge
                      variant="secondary"
                      className="bg-[#dcfce7] text-[#15803d] hover:bg-[#dcfce7] text-[11px] h-5"
                    >
                      纵轴
                    </Badge>
                  )}
                  <div className="flex-1" />
                  <span className="text-[12px] text-[#64748b]">
                    权重 {(dim.weight * 100).toFixed(0)}%
                  </span>
                </div>
                {dim.items.length > 0 && (
                  <div className="pl-2 text-[12px] text-[#64748b] space-y-0.5">
                    {dim.items.map((item: RuleDimensionItem) => (
                      <div key={item.code} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#cbd5e1]" />
                        <span>{item.name}</span>
                        <span className="text-[#94a3b8]">（满分 {item.maxScore}）</span>
                      </div>
                    ))}
                  </div>
                )}
                {dim.items.length === 0 && (
                  <div className="pl-2 text-[12px] text-[#94a3b8]">
                    子项来自岗位类型配置
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {config.positionTypes && config.positionTypes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[13px] font-medium text-[#0f172a]">
            岗位类型（{config.positionTypes.length} 个）
          </h4>
          <div className="flex flex-wrap gap-2">
            {config.positionTypes.map((pt: PositionTypeConfig) => (
              <Badge
                key={pt.code}
                variant="secondary"
                className="bg-[#f1f5f9] text-[#475569] hover:bg-[#f1f5f9]"
              >
                {pt.name}（{pt.performanceItems.length} 项）
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-[13px] font-medium text-[#0f172a]">
          评分档位
        </h4>
        <div className="flex flex-wrap gap-2">
          {config.scoreLevels.map((sl) => (
            <Badge
              key={sl.code}
              variant="secondary"
              className="bg-[#f8fafc] text-[#334155] hover:bg-[#f8fafc]"
            >
              {sl.name}：{sl.minScore}-{sl.maxScore} 分
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function RuleSetListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 border border-[#e2e8f0] rounded-lg"
        >
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <div className="flex-1" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

// ============ 规则集编辑器 ============

function RuleSetEditor({
  ruleSet,
  onSaved,
}: {
  ruleSet: RuleSetRecord;
  onSaved: () => void;
}) {
  const [config, setConfig] = useState<RuleSetConfig>(ruleSet.config);
  const [saving, setSaving] = useState(false);

  // 根据配置判断是否为扩展模式（有 positionTypes 或 performance 维度）
  const hasPositionTypes = (config.positionTypes?.length ?? 0) > 0;
  const hasPerformanceDim = config.dimensions.some((d) => d.code === 'performance');
  const isExtendedMode = hasPositionTypes || hasPerformanceDim;

  const renumberItemSortOrder = (items: RuleDimensionItem[]): RuleDimensionItem[] =>
    items.map((it, i) => ({ ...it, sortOrder: i + 1 }));

  const updateDimensions = (next: RuleDimension[]): void => {
    setConfig((prev) => ({ ...prev, dimensions: next }));
  };

  const addDimension = (): void => {
    const code = genId('dim');
    const newDims = [
      ...config.dimensions,
      {
        code,
        name: '新维度',
        weight: 1,
        isRedLine: false,
        items: [{ code: genId('item'), name: '新子项', maxScore: 5, sortOrder: 1 }],
      },
    ];
    updateDimensions(newDims);
    if (!config.xAxisDimension) {
      setConfig((prev) => ({ ...prev, xAxisDimension: code }));
    }
    if (!config.yAxisDimension) {
      setConfig((prev) => ({ ...prev, yAxisDimension: code }));
    }
  };

  const updateDimension = (code: string, patch: Partial<RuleDimension>): void => {
    updateDimensions(
      config.dimensions.map((d) => (d.code === code ? { ...d, ...patch } : d)),
    );
  };

  const removeDimension = (code: string): void => {
    const next = config.dimensions.filter((d) => d.code !== code);
    updateDimensions(next);
    if (config.xAxisDimension === code) {
      setConfig((prev) => ({ ...prev, xAxisDimension: next[0]?.code ?? '' }));
    }
    if (config.yAxisDimension === code) {
      setConfig((prev) => ({ ...prev, yAxisDimension: next[0]?.code ?? '' }));
    }
  };

  const moveDimension = (code: string, direction: 'up' | 'down'): void => {
    const idx = config.dimensions.findIndex((d) => d.code === code);
    if (idx < 0) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === config.dimensions.length - 1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const next = [...config.dimensions];
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    updateDimensions(next);
  };

  const addItem = (dimCode: string): void => {
    const dim = config.dimensions.find((d) => d.code === dimCode);
    if (!dim) return;
    const newItems: RuleDimensionItem[] = [
      ...dim.items,
      {
        code: genId('item'),
        name: '新子项',
        maxScore: 5,
        sortOrder: dim.items.length + 1,
      },
    ];
    updateDimension(dimCode, { items: renumberItemSortOrder(newItems) });
  };

  const updateItem = (
    dimCode: string,
    itemCode: string,
    patch: Partial<RuleDimensionItem>,
  ): void => {
    const dim = config.dimensions.find((d) => d.code === dimCode);
    if (!dim) return;
    updateDimension(dimCode, {
      items: dim.items.map((it) =>
        it.code === itemCode ? { ...it, ...patch } : it,
      ),
    });
  };

  const removeItem = (dimCode: string, itemCode: string): void => {
    const dim = config.dimensions.find((d) => d.code === dimCode);
    if (!dim) return;
    updateDimension(dimCode, {
      items: renumberItemSortOrder(
        dim.items.filter((it) => it.code !== itemCode),
      ),
    });
  };

  const moveItem = (
    dimCode: string,
    itemCode: string,
    direction: 'up' | 'down',
  ): void => {
    const dim = config.dimensions.find((d) => d.code === dimCode);
    if (!dim) return;
    const idx = dim.items.findIndex((it) => it.code === itemCode);
    if (idx < 0) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === dim.items.length - 1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const next = [...dim.items];
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    updateDimension(dimCode, { items: renumberItemSortOrder(next) });
  };

  // ============ 岗位类型 ============

  const positionTypes = config.positionTypes ?? [];

  const updatePositionTypes = (next: PositionTypeConfig[]): void => {
    setConfig((prev) => ({ ...prev, positionTypes: next }));
  };

  const addPositionType = (): void => {
    updatePositionTypes([
      ...positionTypes,
      {
        code: genId('pos'),
        name: '新岗位类型',
        performanceItems: [],
      },
    ]);
  };

  const updatePositionType = (
    code: string,
    patch: Partial<PositionTypeConfig>,
  ): void => {
    updatePositionTypes(
      positionTypes.map((p) =>
        p.code === code ? { ...p, ...patch } : p,
      ),
    );
  };

  const removePositionType = (code: string): void => {
    updatePositionTypes(positionTypes.filter((p) => p.code !== code));
  };

  const movePositionType = (code: string, direction: 'up' | 'down'): void => {
    const idx = positionTypes.findIndex((p) => p.code === code);
    if (idx < 0) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === positionTypes.length - 1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const next = [...positionTypes];
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    updatePositionTypes(next);
  };

  const addPerformanceItem = (posCode: string): void => {
    const pos = positionTypes.find((p) => p.code === posCode);
    if (!pos) return;
    updatePositionType(posCode, {
      performanceItems: [
        ...pos.performanceItems,
        {
          code: genId('pi'),
          name: '新绩效项',
          maxScore: 5,
          weight: 1,
        },
      ],
    });
  };

  const updatePerformanceItem = (
    posCode: string,
    itemCode: string,
    patch: Partial<{ code: string; name: string; maxScore: number; weight: number }>,
  ): void => {
    const pos = positionTypes.find((p) => p.code === posCode);
    if (!pos) return;
    updatePositionType(posCode, {
      performanceItems: pos.performanceItems.map((it) =>
        it.code === itemCode ? { ...it, ...patch } : it,
      ),
    });
  };

  const removePerformanceItem = (posCode: string, itemCode: string): void => {
    const pos = positionTypes.find((p) => p.code === posCode);
    if (!pos) return;
    updatePositionType(posCode, {
      performanceItems: pos.performanceItems.filter((it) => it.code !== itemCode),
    });
  };

  const movePerformanceItem = (
    posCode: string,
    itemCode: string,
    direction: 'up' | 'down',
  ): void => {
    const pos = positionTypes.find((p) => p.code === posCode);
    if (!pos) return;
    const idx = pos.performanceItems.findIndex((it) => it.code === itemCode);
    if (idx < 0) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === pos.performanceItems.length - 1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const next = [...pos.performanceItems];
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    updatePositionType(posCode, { performanceItems: next });
  };

  // ============ 显示名称 ============

  const displayLabels: RuleSetDisplayLabels = config.displayLabels ?? {};

  const updateDisplayLabel = (
    key: keyof RuleSetDisplayLabels,
    value: string,
  ): void => {
    setConfig((prev) => ({
      ...prev,
      displayLabels: {
        ...prev.displayLabels,
        [key]: value || undefined,
      },
    }));
  };

  // ============ 校验 ============

  const validateConfig = (cfg: RuleSetConfig): string[] => {
    const errors: string[] = [];
    const { dimensions, gridThresholds, xAxisDimension, yAxisDimension, compositeDimensions } = cfg;

    // 1. 权重合计 ≈ 1.0（基础维度 + 合成维度中 weight > 0 的都计入）
    let totalWeight = dimensions.reduce((sum, d) => sum + ((d.weight ?? 0) > 0 ? d.weight! : 0), 0);
    if (compositeDimensions && compositeDimensions.length > 0) {
      totalWeight += compositeDimensions.reduce(
        (sum, cd) => sum + ((cd.weight ?? 0) > 0 ? cd.weight! : 0),
        0,
      );
    }
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      errors.push(`维度权重合计为 ${(totalWeight * 100).toFixed(1)}%，必须等于 100%`);
    }

    // 2. 九宫格高分线 > 低分线，且都在 1~5 之间
    const { high, low } = gridThresholds;
    if (high <= low) {
      errors.push('九宫格高分线必须大于低分线');
    }
    if (high < 1 || high > 5) {
      errors.push('九宫格高分线必须在 1~5 之间');
    }
    if (low < 1 || low > 5) {
      errors.push('九宫格低分线必须在 1~5 之间');
    }

    // 3. 每个子项 maxScore >= 1
    for (const dim of dimensions) {
      for (const item of dim.items) {
        if (item.maxScore < 1) {
          errors.push(`维度「${dim.name}」子项「${item.name}」满分必须 ≥ 1`);
        }
      }
    }

    // 4. 维度 code 不重复、不为空；子项 code 同一维度内不重复、不为空
    const dimCodes: string[] = [];
    for (const dim of dimensions) {
      if (!dim.code.trim()) {
        errors.push(`维度「${dim.name}」编码不能为空`);
      } else if (dimCodes.includes(dim.code)) {
        errors.push(`维度编码重复：${dim.code}`);
      } else {
        dimCodes.push(dim.code);
      }

      const itemCodes: string[] = [];
      for (const item of dim.items) {
        if (!item.code.trim()) {
          errors.push(`维度「${dim.name}」子项「${item.name}」编码不能为空`);
        } else if (itemCodes.includes(item.code)) {
          errors.push(`维度「${dim.name}」子项编码重复：${item.code}`);
        } else {
          itemCodes.push(item.code);
        }
      }
    }

    // 5. 横轴纵轴各指定一个存在的维度（基础维度 + 合成维度 + 综合总分 total），且不相同
    const baseDimCodes = new Set(dimensions.map((d) => d.code));
    const compositeCodes = new Set((compositeDimensions ?? []).map((cd) => cd.code));
    const allDimCodes = new Set([...baseDimCodes, ...compositeCodes, 'total']);
    if (!xAxisDimension || !allDimCodes.has(xAxisDimension)) {
      errors.push('横轴维度不存在，请重新选择');
    }
    if (!yAxisDimension || !allDimCodes.has(yAxisDimension)) {
      errors.push('纵轴维度不存在，请重新选择');
    }
    if (xAxisDimension && yAxisDimension && xAxisDimension === yAxisDimension) {
      errors.push('横轴和纵轴不能指定同一个维度');
    }

    // 6. 至少一个红线维度
    if (!dimensions.some((d) => d.isRedLine)) {
      errors.push('至少需要一个红线维度');
    }

    // 7. 每个维度至少一个子项（performance 维度除外，其子项来自岗位类型配置）
    for (const dim of dimensions) {
      if (dim.items.length === 0) {
        if (dim.code === 'performance') continue;
        errors.push(`维度「${dim.name}」至少需要一个子项`);
      }
    }

    // 8. 岗位类型校验（有 positionTypes 才校验）
    const posTypes = cfg.positionTypes ?? [];
      const posCodes: string[] = [];
      for (const pos of posTypes) {
        if (!pos.code.trim()) {
          errors.push(`岗位「${pos.name}」编码不能为空`);
        } else if (posCodes.includes(pos.code)) {
          errors.push(`岗位编码重复：${pos.code}`);
        } else {
          posCodes.push(pos.code);
        }

        if (pos.performanceItems.length === 0) {
          errors.push(`岗位「${pos.name}」至少需要一个绩效项`);
          continue;
        }

        const totalWeight = pos.performanceItems.reduce(
          (s: number, pi: { weight?: number }) => s + (pi.weight ?? 0),
          0,
        );
        if (Math.abs(totalWeight - 100) > 0.1) {
          errors.push(
            `岗位「${pos.name}」绩效项权重合计为 ${totalWeight.toFixed(1)}%，必须等于 100%`,
          );
        }

        const piCodes: string[] = [];
        for (const pi of pos.performanceItems) {
          if (!pi.code.trim()) {
            errors.push(`岗位「${pos.name}」绩效项「${pi.name}」编码不能为空`);
          } else if (piCodes.includes(pi.code)) {
            errors.push(`岗位「${pos.name}」绩效项编码重复：${pi.code}`);
          } else {
            piCodes.push(pi.code);
          }
          if (pi.maxScore < 1) {
            errors.push(`岗位「${pos.name}」绩效项「${pi.name}」满分必须 ≥ 1`);
          }
        }
      }
    return errors;
  };

  const handleSave = async (asDraft: boolean): Promise<void> => {
    // 前端校验
    const errors = validateConfig(config);
    if (errors.length > 0) {
      toast.error(errors.join('\n'));
      return;
    }

    setSaving(true);
    try {
      await review.updateRuleSet(ruleSet.id, {
        config,
        status: asDraft ? 'draft' : undefined,
      });
      toast.success(asDraft ? '已保存为草稿' : '保存成功');
      onSaved();
    } catch (err) {
      logger.error('保存规则集失败', err);
      toast.error(getErrorMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pt-2">
      {/* 配置说明 */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem
          value="config-help"
          className="border border-[#e2e8f0] rounded-lg bg-white data-[state=open]:bg-white"
        >
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#1e6feb]" />
              <span className="text-[14px] font-semibold text-[#0f172a]">
                配置说明
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4 text-[13px] text-[#334155]">
              <div className="space-y-1.5">
                <p className="font-medium text-[#0f172a]">1. 什么是维度 / 子项</p>
                <p className="pl-5 text-[12px] text-[#64748b] leading-relaxed">
                  维度是大的评价方向（如价值观、能力、意愿），子项是维度下的具体评分点（如共创共享认同、岗位专业胜任）。
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="font-medium text-[#0f172a]">2. 维度权重怎么填</p>
                <p className="pl-5 text-[12px] text-[#64748b] leading-relaxed">
                  0~1 之间的小数（如 0.3 表示 30%），所有维度权重合计必须等于 1（即 100%）。
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="font-medium text-[#0f172a]">3. 岗位绩效权重怎么填</p>
                <p className="pl-5 text-[12px] text-[#64748b] leading-relaxed">
                  百分数（如 30 表示 30%），同一岗位类型下所有绩效项权重合计必须等于 100。
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="font-medium text-[#0f172a]">4. 横纵轴怎么选</p>
                <p className="pl-5 text-[12px] text-[#64748b] leading-relaxed">
                  横轴和纵轴各指定一个维度（基础维度或合成维度），九宫格据此落位（横轴×纵轴交叉点即为员工所在格子）。默认横轴为「能力」、纵轴为「意愿」。
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="font-medium text-[#0f172a]">5. 阈值 4.0 / 2.5 的含义</p>
                <p className="pl-5 text-[12px] text-[#64748b] leading-relaxed">
                  ≥4.0 为高分档、2.5~4.0 为中分档、&lt;2.5 为低分档，这两条线将九宫格划分为高中低三档。
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="font-medium text-[#0f172a]">6. 红线规则</p>
                <p className="pl-5 text-[12px] text-[#64748b] leading-relaxed">
                  红线维度内任一子项得分 ≤ 设定的红线分数，该员工直接进入红线区，优先处理价值观问题。
                </p>
              </div>

              {/* 完整示例 */}
              <div className="bg-[#f1f5f9] border border-[#e2e8f0] rounded-lg p-4 space-y-2">
                <p className="text-[13px] font-medium text-[#0f172a]">
                  📌 完整示例
                </p>
                <div className="text-[12px] text-[#475569] space-y-1 leading-relaxed">
                  <p>• 三维度：价值观（红线）+ 能力 + 意愿，价值观维度参与红线判定</p>
                  <p>• 横轴：能力维度（代表岗位胜任与交付能力）</p>
                  <p>• 纵轴：意愿维度（代表主动性与成长意愿）</p>
                  <p>• 阈值：高分线 4.0、低分线 2.5</p>
                  <p>• 红线：价值观维度，任一项 ≤ 2 分即进入红线区</p>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* 维度管理 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[#0f172a]">
            维度管理
          </h3>
          <Button size="sm" variant="outline" onClick={addDimension}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              新增维度
            </Button>
        </div>

        {config.dimensions.map((dim, idx) => (
          <div
            key={dim.code}
            className="border border-[#e2e8f0] rounded-lg p-4 bg-white"
          >
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <GripVertical className="w-4 h-4 text-[#94a3b8]" />
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-[#64748b] hover:text-[#0f172a]"
                  onClick={() => moveDimension(dim.code, 'up')}
                  disabled={idx === 0}
                  aria-label="上移维度"
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-[#64748b] hover:text-[#0f172a]"
                  onClick={() => moveDimension(dim.code, 'down')}
                  disabled={idx === config.dimensions.length - 1}
                  aria-label="下移维度"
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Label className="text-[12px] text-[#64748b] whitespace-nowrap">
                  维度名称
                </Label>
                <Input
                  value={dim.name}
                  onChange={(e) =>
                    updateDimension(dim.code, { name: e.target.value })
                  }
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[12px] text-[#64748b] whitespace-nowrap">
                  编码
                </Label>
                <Input
                  value={dim.code}
                  onChange={(e) =>
                    updateDimension(dim.code, { code: e.target.value })
                  }
                  className="w-28"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[12px] text-[#64748b] whitespace-nowrap">
                  权重
                </Label>
                <Input
                  type="number"
                  value={dim.weight}
                  onChange={(e) =>
                    updateDimension(dim.code, {
                      weight: Number(e.target.value) || 0,
                    })
                  }
                  className="w-20"
                  step="0.1"
                  min="0"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id={`redline-${dim.code}`}
                  checked={dim.isRedLine}
                  onCheckedChange={(v) =>
                    updateDimension(dim.code, { isRedLine: !!v })
                  }
                />
                <Label
                  htmlFor={`redline-${dim.code}`}
                  className="text-[12px] text-[#334155]"
                >
                  红线维度
                </Label>
              </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-[#ef4444] hover:text-[#dc2626] hover:bg-[#fef2f2]"
                  onClick={() => removeDimension(dim.code)}
                  aria-label="删除维度"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
            </div>

            {/* 子项管理 */}
            <div className="ml-7 space-y-2">
              {dim.code === 'performance' ? (
                <div className="text-[12px] text-[#64748b] bg-[#f8fafc] rounded-lg p-3 border border-[#e2e8f0]">
                  绩效维度子项由下方「岗位类型设置」配置驱动，不同岗位有不同的绩效项。
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#64748b]">子项列表</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => addItem(dim.code)}
                      className="h-7 text-[12px]"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      新增子项
                    </Button>
                  </div>
                  <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-20 text-[12px] text-[#64748b] font-normal">
                      排序
                    </TableHead>
                    <TableHead className="w-28 text-[12px] text-[#64748b] font-normal">
                      编码
                    </TableHead>
                    <TableHead className="text-[12px] text-[#64748b] font-normal">
                      子项名称
                    </TableHead>
                    <TableHead className="w-32 text-[12px] text-[#64748b] font-normal">
                      满分
                    </TableHead>
                    <TableHead className="w-24 text-[12px] text-[#64748b] font-normal text-right">
                      操作
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dim.items.map((item, itemIdx) => (
                    <TableRow key={item.code}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={item.sortOrder}
                            onChange={(e) =>
                              updateItem(dim.code, item.code, {
                                sortOrder: Number(e.target.value) || 0,
                              })
                            }
                            className="w-12 h-8 text-sm"
                            min="1"
                          />
                          <div className="flex flex-col">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5 text-[#64748b] hover:text-[#0f172a]"
                              onClick={() => moveItem(dim.code, item.code, 'up')}
                              disabled={itemIdx === 0}
                              aria-label="上移子项"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5 text-[#64748b] hover:text-[#0f172a]"
                              onClick={() => moveItem(dim.code, item.code, 'down')}
                              disabled={itemIdx === dim.items.length - 1}
                              aria-label="下移子项"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.code}
                          onChange={(e) =>
                            updateItem(dim.code, item.code, {
                              code: e.target.value,
                            })
                          }
                          className="h-8 text-sm w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.name}
                          onChange={(e) =>
                            updateItem(dim.code, item.code, {
                              name: e.target.value,
                            })
                          }
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.maxScore}
                          onChange={(e) =>
                            updateItem(dim.code, item.code, {
                              maxScore: Number(e.target.value) || 5,
                            })
                          }
                          className="w-20 h-8 text-sm"
                          min="1"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-[#ef4444] hover:text-[#dc2626] hover:bg-[#fef2f2]"
                          onClick={() => removeItem(dim.code, item.code)}
                          aria-label="删除子项"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {dim.items.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-4 text-[12px] text-[#94a3b8]"
                      >
                        暂无子项
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
                </>
              )}
            </div>
            {idx < config.dimensions.length - 1 && <div className="mt-3" />}
          </div>
        ))}
      </div>

      {/* 九宫格阈值 & 坐标轴 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white rounded-lg shadow-none border border-[#e2e8f0]">
          <CardContent className="pt-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-[#0f172a]">
              九宫格阈值
            </h3>
            <div className="flex items-center gap-3">
              <Label className="text-[12px] text-[#64748b] w-14">高分线</Label>
              <Input
                type="number"
                value={config.gridThresholds.high}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    gridThresholds: {
                      ...prev.gridThresholds,
                      high: Number(e.target.value) || 0,
                    },
                  }))
                }
                step="0.1"
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-[12px] text-[#64748b] w-14">低分线</Label>
              <Input
                type="number"
                value={config.gridThresholds.low}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    gridThresholds: {
                      ...prev.gridThresholds,
                      low: Number(e.target.value) || 0,
                    },
                  }))
                }
                step="0.1"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-lg shadow-none border border-[#e2e8f0]">
          <CardContent className="pt-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-[#0f172a]">
              坐标轴指定
            </h3>
            <div className="flex items-center gap-3">
              <Label className="text-[12px] text-[#64748b] w-14">横轴</Label>
              <Select
                value={config.xAxisDimension}
                onValueChange={(v) =>
                  setConfig((prev) => ({ ...prev, xAxisDimension: v }))
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="选择维度" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">综合总分</SelectItem>
                  {config.dimensions.map((d) => (
                    <SelectItem key={d.code} value={d.code}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-[12px] text-[#64748b] w-14">纵轴</Label>
              <Select
                value={config.yAxisDimension}
                onValueChange={(v) =>
                  setConfig((prev) => ({ ...prev, yAxisDimension: v }))
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="选择维度" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">综合总分</SelectItem>
                  {config.dimensions.map((d) => (
                    <SelectItem key={d.code} value={d.code}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-lg shadow-none border border-[#e2e8f0]">
          <CardContent className="pt-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-[#0f172a]">
              事实依据预设
            </h3>
            {config.evidenceLevels.map((el) => (
              <div
                key={el.code}
                className="border border-[#e2e8f0] rounded-lg p-3 space-y-2 bg-[#fafbfc]"
              >
                <div className="flex items-center gap-2">
                  <Label className="text-[12px] text-[#64748b] whitespace-nowrap w-14">
                    档位名称
                  </Label>
                  <Input
                    value={el.name}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        evidenceLevels: prev.evidenceLevels.map((x) =>
                          x.code === el.code ? { ...x, name: e.target.value } : x,
                        ),
                      }))
                    }
                    className="flex-1 h-8 text-sm"
                  />
                </div>
                <div className="flex items-start gap-2">
                  <Label className="text-[12px] text-[#64748b] whitespace-nowrap w-14 pt-1.5">
                    描述
                  </Label>
                  <Input
                    value={el.description}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        evidenceLevels: prev.evidenceLevels.map((x) =>
                          x.code === el.code
                            ? { ...x, description: e.target.value }
                            : x,
                        ),
                      }))
                    }
                    placeholder="该档位描述说明"
                    className="flex-1 h-8 text-sm"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 评分档位 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[#0f172a]">
            评分档位
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const code = genId('level');
              setConfig((prev) => ({
                ...prev,
                scoreLevels: [
                  ...prev.scoreLevels,
                  { code, name: '新档位', minScore: 3, maxScore: 4, description: '' },
                ],
              }));
            }}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            新增档位
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[12px] text-[#64748b] font-normal">
                档位名称
              </TableHead>
              <TableHead className="w-40 text-[12px] text-[#64748b] font-normal">
                最低分
              </TableHead>
              <TableHead className="w-40 text-[12px] text-[#64748b] font-normal">
                最高分
              </TableHead>
              <TableHead className="text-[12px] text-[#64748b] font-normal">
                描述
              </TableHead>
              <TableHead className="w-16 text-[12px] text-[#64748b] font-normal text-right">
                操作
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {config.scoreLevels.map((sl) => (
              <TableRow key={sl.code}>
                <TableCell>
                  <Input
                    value={sl.name}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        scoreLevels: prev.scoreLevels.map((x) =>
                          x.code === sl.code ? { ...x, name: e.target.value } : x,
                        ),
                      }))
                    }
                    className="h-8 text-sm w-32"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={sl.minScore}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        scoreLevels: prev.scoreLevels.map((x) =>
                          x.code === sl.code
                            ? { ...x, minScore: Number(e.target.value) || 0 }
                            : x,
                        ),
                      }))
                    }
                    className="h-8 text-sm w-24"
                    step="0.1"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={sl.maxScore}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        scoreLevels: prev.scoreLevels.map((x) =>
                          x.code === sl.code
                            ? { ...x, maxScore: Number(e.target.value) || 0 }
                            : x,
                        ),
                      }))
                    }
                    className="h-8 text-sm w-24"
                    step="0.1"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={sl.description}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        scoreLevels: prev.scoreLevels.map((x) =>
                          x.code === sl.code
                            ? { ...x, description: e.target.value }
                            : x,
                        ),
                      }))
                    }
                    placeholder="档位描述"
                    className="h-8 text-sm"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-[#ef4444] hover:text-[#dc2626] hover:bg-[#fef2f2]"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        scoreLevels: prev.scoreLevels.filter(
                          (x) => x.code !== sl.code,
                        ),
                      }))
                    }
                    aria-label="删除档位"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 岗位类型设置 */}
      {isExtendedMode && (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[#0f172a]">
            岗位类型设置
          </h3>
          <Button size="sm" variant="outline" onClick={addPositionType}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            新增岗位类型
          </Button>
        </div>

        {positionTypes.length === 0 && (
          <div className="border border-dashed border-[#e2e8f0] rounded-lg py-8 text-center text-[12px] text-[#94a3b8]">
            暂无岗位类型，点击「新增岗位类型」创建
          </div>
        )}

        {positionTypes.map((pos, posIdx) => (
          <div
            key={pos.code}
            className="border border-[#e2e8f0] rounded-lg p-4 bg-white space-y-3"
          >
            <div className="flex items-center gap-3 flex-wrap">
              <GripVertical className="w-4 h-4 text-[#94a3b8]" />
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-[#64748b] hover:text-[#0f172a]"
                  onClick={() => movePositionType(pos.code, 'up')}
                  disabled={posIdx === 0}
                  aria-label="上移岗位类型"
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-[#64748b] hover:text-[#0f172a]"
                  onClick={() => movePositionType(pos.code, 'down')}
                  disabled={posIdx === positionTypes.length - 1}
                  aria-label="下移岗位类型"
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Label className="text-[12px] text-[#64748b] whitespace-nowrap">
                  岗位名称
                </Label>
                <Input
                  value={pos.name}
                  onChange={(e) =>
                    updatePositionType(pos.code, { name: e.target.value })
                  }
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[12px] text-[#64748b] whitespace-nowrap">
                  编码
                </Label>
                <Input
                  value={pos.code}
                  onChange={(e) =>
                    updatePositionType(pos.code, { code: e.target.value })
                  }
                  className="w-28"
                />
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="text-[#ef4444] hover:text-[#dc2626] hover:bg-[#fef2f2]"
                onClick={() => removePositionType(pos.code)}
                aria-label="删除岗位类型"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            {/* 绩效项列表 */}
            <div className="ml-7 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#64748b]">绩效项列表</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => addPerformanceItem(pos.code)}
                  className="h-7 text-[12px]"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  新增绩效项
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-20 text-[12px] text-[#64748b] font-normal">
                      排序
                    </TableHead>
                    <TableHead className="w-28 text-[12px] text-[#64748b] font-normal">
                      编码
                    </TableHead>
                    <TableHead className="text-[12px] text-[#64748b] font-normal">
                      绩效项名称
                    </TableHead>
                    <TableHead className="w-28 text-[12px] text-[#64748b] font-normal">
                      满分
                    </TableHead>
                    <TableHead className="w-24 text-[12px] text-[#64748b] font-normal">
                      权重
                    </TableHead>
                    <TableHead className="w-24 text-[12px] text-[#64748b] font-normal text-right">
                      操作
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pos.performanceItems.map((pi, piIdx) => (
                    <TableRow key={pi.code}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-[12px] text-[#64748b] w-5 text-center">
                            {piIdx + 1}
                          </span>
                          <div className="flex flex-col">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5 text-[#64748b] hover:text-[#0f172a]"
                              onClick={() => movePerformanceItem(pos.code, pi.code, 'up')}
                              disabled={piIdx === 0}
                              aria-label="上移绩效项"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5 text-[#64748b] hover:text-[#0f172a]"
                              onClick={() => movePerformanceItem(pos.code, pi.code, 'down')}
                              disabled={piIdx === pos.performanceItems.length - 1}
                              aria-label="下移绩效项"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={pi.code}
                          onChange={(e) =>
                            updatePerformanceItem(pos.code, pi.code, {
                              code: e.target.value,
                            })
                          }
                          className="h-8 text-sm w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={pi.name}
                          onChange={(e) =>
                            updatePerformanceItem(pos.code, pi.code, {
                              name: e.target.value,
                            })
                          }
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={pi.maxScore}
                          onChange={(e) =>
                            updatePerformanceItem(pos.code, pi.code, {
                              maxScore: Number(e.target.value) || 5,
                            })
                          }
                          className="w-20 h-8 text-sm"
                          min="1"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={pi.weight}
                          onChange={(e) =>
                            updatePerformanceItem(pos.code, pi.code, {
                              weight: Number(e.target.value) || 0,
                            })
                          }
                          className="w-20 h-8 text-sm"
                          step="0.1"
                          min="0"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-[#ef4444] hover:text-[#dc2626] hover:bg-[#fef2f2]"
                          onClick={() => removePerformanceItem(pos.code, pi.code)}
                          aria-label="删除绩效项"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pos.performanceItems.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-4 text-[12px] text-[#94a3b8]"
                      >
                        暂无绩效项
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
      </div>
      )}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[#0f172a]">
            显示名称设置
          </h3>
        </div>
        <Card className="bg-white rounded-lg shadow-none border border-[#e2e8f0]">
          <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-[12px] text-[#64748b]">应用名称</Label>
              <Input
                value={displayLabels.appName ?? ''}
                onChange={(e) => updateDisplayLabel('appName', e.target.value)}
                placeholder="人才评估系统"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[12px] text-[#64748b]">评估名称</Label>
              <Input
                value={displayLabels.reviewName ?? ''}
                onChange={(e) => updateDisplayLabel('reviewName', e.target.value)}
                placeholder="人才盘点"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[12px] text-[#64748b]">评估人称谓</Label>
              <Input
                value={displayLabels.reviewerLabel ?? ''}
                onChange={(e) => updateDisplayLabel('reviewerLabel', e.target.value)}
                placeholder="评价人"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[12px] text-[#64748b]">被评估人称谓</Label>
              <Input
                value={displayLabels.revieweeLabel ?? ''}
                onChange={(e) => updateDisplayLabel('revieweeLabel', e.target.value)}
                placeholder="被盘人"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[12px] text-[#64748b]">部门称谓</Label>
              <Input
                value={displayLabels.departmentLabel ?? ''}
                onChange={(e) => updateDisplayLabel('departmentLabel', e.target.value)}
                placeholder="部门"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[12px] text-[#64748b]">单位称谓</Label>
              <Input
                value={displayLabels.storeLabel ?? ''}
                onChange={(e) => updateDisplayLabel('storeLabel', e.target.value)}
                placeholder="单位（如：分院/中心等）"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-[12px] text-[#64748b]">九宫格描述</Label>
              <Input
                value={displayLabels.gridDescription ?? ''}
                onChange={(e) => updateDisplayLabel('gridDescription', e.target.value)}
                placeholder="人才盘点九宫格地图"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 版本历史 */}
      <RuleSetVersionHistory ruleSetId={ruleSet.id} onRollback={onSaved} />

      {/* 操作按钮 */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#e2e8f0]">
        <Button
          variant="outline"
          onClick={() => void handleSave(true)}
          disabled={saving}
        >
          <Save className="w-4 h-4 mr-1" />
          保存为草稿
        </Button>
        <Button
          onClick={() => void handleSave(false)}
          disabled={saving}
          className="bg-[#1e6feb] hover:bg-[#1a5fd4] text-white"
        >
          <Save className="w-4 h-4 mr-1" />
          保存
        </Button>
      </div>
    </div>
  );
}

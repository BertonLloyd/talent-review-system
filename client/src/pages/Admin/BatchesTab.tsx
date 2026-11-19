import { useState } from 'react';
import { Plus, Trash2, Power, PowerOff, Edit2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
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
  BATCH_STATUS_LABELS,
  RULE_SET_STATUS_LABELS,
} from '@shared/api.interface';
import type {
  ReviewBatchRecord,
  RuleSetRecord,
  CreateBatchRequest,
} from '@shared/api.interface';
import { showConfirm } from '@lark-apaas/client-toolkit';

interface BatchesTabProps {
  batches: ReviewBatchRecord[] | null;
  ruleSets: RuleSetRecord[] | null;
  loading: boolean;
  error: unknown;
  onRefresh: () => void;
}

interface BatchFormData {
  name: string;
  ruleSetId: string;
  startDate: string;
  endDate: string;
  description: string;
}

const emptyForm: BatchFormData = {
  name: '',
  ruleSetId: '',
  startDate: '',
  endDate: '',
  description: '',
};

export default function BatchesTab({
  batches,
  ruleSets,
  loading,
  error,
  onRefresh,
}: BatchesTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ReviewBatchRecord | null>(null);
  const [form, setForm] = useState<BatchFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const handleOpenCreate = (): void => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (batch: ReviewBatchRecord): void => {
    setEditing(batch);
    setForm({
      name: batch.name,
      ruleSetId: batch.ruleSetId,
      startDate: batch.startDate ?? '',
      endDate: batch.endDate ?? '',
      description: batch.description || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async (): Promise<void> => {
    if (!form.name.trim()) {
      toast.error('请输入批次名称');
      return;
    }
    if (!form.ruleSetId) {
      toast.error('请选择关联规则集');
      return;
    }
    setSaving(true);
    try {
      const payload: CreateBatchRequest = {
        name: form.name.trim(),
        ruleSetId: form.ruleSetId,
        description: form.description.trim() || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      };
      if (editing) {
        await review.updateBatch(editing.id, payload);
        toast.success('更新成功');
      } else {
        await review.createBatch(payload);
        toast.success('创建成功');
      }
      setDialogOpen(false);
      onRefresh();
    } catch (err) {
      logger.error(editing ? '更新批次失败' : '创建批次失败', err);
      toast.error(getErrorMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (batch: ReviewBatchRecord): Promise<void> => {
    const target = batch.status === 'active' ? 'closed' : 'active';
    const msg =
      target === 'active'
        ? '确定启用该批次？'
        : '确定关闭该批次？关闭后评价人无法继续评分';
    if (!await showConfirm(msg)) return;
    try {
      await review.updateBatch(batch.id, { status: target });
      toast.success(target === 'active' ? '已启用' : '已关闭');
      onRefresh();
    } catch (err) {
      logger.error('更新批次状态失败', err);
      toast.error(getErrorMsg(err));
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    if (!await showConfirm('确定删除该批次？删除后无法恢复')) return;
    try {
      await review.deleteBatch(id);
      toast.success('删除成功');
      onRefresh();
    } catch (err) {
      logger.error('删除批次失败', err);
      toast.error(getErrorMsg(err));
    }
  };

  const getRuleSetName = (ruleSetId: string): string => {
    return ruleSets?.find((r) => r.id === ruleSetId)?.name ?? '-';
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0_0_0_0.08)] border-0">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <h2 className="text-[16px] font-semibold text-[#0f172a]">
            批次列表
          </h2>
          <Button
            onClick={handleOpenCreate}
            className="bg-[#1e6feb] hover:bg-[#1a5fd4] text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            新建批次
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <BatchSkeleton />
          ) : error ? (
            <div className="text-center py-12 text-[#64748b] text-sm">
              加载失败，请稍后重试
            </div>
          ) : !batches || batches.length === 0 ? (
            <div className="text-center py-12 text-[#64748b] text-sm">
              暂无批次，点击「新建批次」创建
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[12px] text-[#64748b] font-normal">
                    批次名称
                  </TableHead>
                  <TableHead className="text-[12px] text-[#64748b] font-normal">
                    关联规则集
                  </TableHead>
                  <TableHead className="text-[12px] text-[#64748b] font-normal">
                    开始日期
                  </TableHead>
                  <TableHead className="text-[12px] text-[#64748b] font-normal">
                    结束日期
                  </TableHead>
                  <TableHead className="text-[12px] text-[#64748b] font-normal">
                    状态
                  </TableHead>
                  <TableHead className="text-[12px] text-[#64748b] font-normal text-right">
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium text-[#0f172a]">
                      {batch.name}
                    </TableCell>
                    <TableCell>{getRuleSetName(batch.ruleSetId)}</TableCell>
                    <TableCell>{batch.startDate || '-'}</TableCell>
                    <TableCell>{batch.endDate || '-'}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          batch.status === 'active'
                            ? 'bg-[#dcfce7] text-[#15803d] hover:bg-[#dcfce7]'
                            : batch.status === 'closed'
                              ? 'bg-[#fee2e2] text-[#b91c1c] hover:bg-[#fee2e2]'
                              : 'bg-[#f1f5f9] text-[#475569] hover:bg-[#f1f5f9]'
                        }
                      >
                        {BATCH_STATUS_LABELS[batch.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenEdit(batch)}
                          aria-label="编辑"
                          className="h-8 w-8"
                        >
                          <Edit2 className="w-4 h-4 text-[#64748b]" />
                        </Button>
                        {batch.status === 'active' ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => void handleToggleStatus(batch)}
                            aria-label="关闭"
                            className="h-8 w-8 text-[#f97316]"
                            title="关闭批次"
                          >
                            <PowerOff className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => void handleToggleStatus(batch)}
                            aria-label="启用"
                            className="h-8 w-8 text-[#10b981]"
                            title="启用批次"
                          >
                            <Power className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => void handleDelete(batch.id)}
                          aria-label="删除"
                          className="h-8 w-8 text-[#ef4444] hover:bg-[#fef2f2]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 新建/编辑批次对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '编辑批次' : '新建批次'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>批次名称</Label>
              <Input
                placeholder="请输入批次名称"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>关联规则集</Label>
              <Select
                value={form.ruleSetId}
                onValueChange={(v) => setForm({ ...form, ruleSetId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择规则集" />
                </SelectTrigger>
                <SelectContent>
                  {ruleSets && ruleSets.length > 0 ? (
                    ruleSets.map((rs) => (
                      <SelectItem key={rs.id} value={rs.id}>
                        {rs.name}
                        <span className="text-[11px] text-[#94a3b8] ml-2">
                          {RULE_SET_STATUS_LABELS[rs.status]}
                        </span>
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-[12px] text-[#94a3b8] text-center">
                      暂无可用规则集
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>开始日期</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>结束日期</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>描述（可选）</Label>
              <Input
                placeholder="简要描述"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              取消
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={saving}
              className="bg-[#1e6feb] hover:bg-[#1a5fd4] text-white"
            >
              {editing ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BatchSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-3 border border-[#e2e8f0] rounded-lg"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <div className="flex-1" />
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
        </div>
      ))}
    </div>
  );
}

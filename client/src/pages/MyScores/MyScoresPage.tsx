import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Edit,
  Plus,
  FileText,
  AlertTriangle,
  Trash2,
  KeyRound,
  Search,
  Filter,
  Briefcase,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { getErrorMsg } from '@client/src/utils/request';
import { toast } from 'sonner';

import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

import { review } from '@/api';
import { getCurrentUser } from '@/utils/auth';
import {
  GRID_CATEGORY_LABELS,
  GRID_CATEGORY_COLORS,
} from '@shared/api.interface';
import type {
  UnifiedReviewRecordV2,
  GridCategory,
} from '@shared/api.interface';

const GRID_CATEGORY_OPTIONS: GridCategory[] = [
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

export default function MyScoresPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<UnifiedReviewRecordV2[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const res = await review.getMyScores();
        if (!cancelled) {
          setRecords(res.items || []);
        }
      } catch (error) {
        logger.error('加载我的评分列表失败', error);
        toast.error(getErrorMsg(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRecords = useMemo(() => {
    let list = records;
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim();
      list = list.filter((r: UnifiedReviewRecordV2) =>
        r.revieweeName.includes(kw),
      );
    }
    if (filterCategory) {
      list = list.filter(
        (r: UnifiedReviewRecordV2) => r.gridCategory === filterCategory,
      );
    }
    return list;
  }, [records, searchKeyword, filterCategory]);

  const handleCreate = (): void => {
    navigate('/review');
  };

  const handleEdit = (id: string): void => {
    navigate(`/review?id=${id}`);
  };

  const [deleteTarget, setDeleteTarget] = useState<UnifiedReviewRecordV2 | null>(
    null,
  );
  const [deleting, setDeleting] = useState<boolean>(false);

  // 修改密码
  const [changePwdOpen, setChangePwdOpen] = useState<boolean>(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePwdLoading, setChangePwdLoading] = useState<boolean>(false);
  const [pwdError, setPwdError] = useState<{
    oldPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const resetChangePwdForm = (): void => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwdError({});
  };

  const handleChangePassword = async (): Promise<void> => {
    const user = getCurrentUser();
    if (!user) return;

    const errors: typeof pwdError = {};
    if (!oldPassword) errors.oldPassword = '请输入原密码';
    if (!newPassword) {
      errors.newPassword = '请输入新密码';
    } else if (newPassword.length < 6) {
      errors.newPassword = '新密码不能少于6位';
    }
    if (!confirmPassword) {
      errors.confirmPassword = '请确认新密码';
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = '两次输入的新密码不一致';
    }

    if (Object.keys(errors).length > 0) {
      setPwdError(errors);
      return;
    }

    setChangePwdLoading(true);
    try {
      const res = await review.changePassword({
        reviewerKey: user.key,
        oldPassword,
        newPassword,
      });
      if (res.success) {
        toast.success('密码修改成功');
        setChangePwdOpen(false);
        resetChangePwdForm();
      } else {
        setPwdError({ oldPassword: res.message || '原密码错误' });
      }
    } catch (error) {
      logger.error('修改密码失败', error);
      setPwdError({ oldPassword: '原密码错误，请重试' });
    } finally {
      setChangePwdLoading(false);
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await review.deleteRecord(deleteTarget.id);
      setRecords((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      toast.success('评分已删除，可前往盘点页重新评分');
      setDeleteTarget(null);
    } catch (error) {
      logger.error('删除评分失败', error);
      toast.error(getErrorMsg(error));
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (iso: string): string => {
    const d = new Date(iso);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const categoryColorStyle = (category: GridCategory): React.CSSProperties => {
    const color = GRID_CATEGORY_COLORS[category];
    return {
      backgroundColor: `${color}1A`,
      color,
      borderColor: `${color}4D`,
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        <div className="max-w-[1280px] mx-auto px-6 py-8">
          {/* 头部骨架 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Skeleton className="w-6 h-6 rounded" />
              <Skeleton className="w-24 h-6 rounded" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="w-24 h-9 rounded-md" />
              <Skeleton className="w-24 h-9 rounded-md" />
            </div>
          </div>
          {/* 搜索筛选骨架 */}
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="flex-1 h-10 rounded-md" />
            <Skeleton className="w-40 h-10 rounded-md" />
          </div>
          {/* 卡片列表骨架 */}
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            }}
          >
            {Array.from({ length: 6 }).map((_, i: number) => (
              <Card
                key={i}
                className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0_0_0_0.08)] border-0 flex flex-col"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Skeleton className="w-24 h-5 rounded mb-2" />
                      <Skeleton className="w-32 h-3 rounded" />
                    </div>
                    <Skeleton className="w-10 h-5 rounded-full" />
                  </div>
                </CardHeader>
                <CardContent className="py-3">
                  <div className="grid grid-cols-3 gap-2">
                    <Skeleton className="h-16 rounded-lg" />
                    <Skeleton className="h-16 rounded-lg" />
                    <Skeleton className="h-16 rounded-lg" />
                  </div>
                </CardContent>
                <CardFooter className="pt-3 flex items-center justify-between">
                  <div className="flex flex-col gap-2">
                    <Skeleton className="w-16 h-5 rounded-full" />
                    <Skeleton className="w-20 h-3 rounded" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Skeleton className="w-12 h-8 rounded" />
                    <Skeleton className="w-12 h-8 rounded" />
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-[1280px] mx-auto px-6 py-8">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-[#1e6feb]" />
            <h1 className="text-[20px] font-semibold text-[#0f172a]">
              我的评分
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                resetChangePwdForm();
                setChangePwdOpen(true);
              }}
              className="border-[#e2e8f0] text-[#334155] hover:bg-[#f1f5f9]"
            >
              <KeyRound className="w-4 h-4 mr-2" />
              修改密码
            </Button>
            <Button
              onClick={handleCreate}
              className="bg-[#1e6feb] hover:bg-[#1a5fd4] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              新建评分
            </Button>
          </div>
        </div>

        {/* 搜索 + 筛选 */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
            <Input
              placeholder="搜索被盘人姓名"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="pl-9 bg-white border-[#e2e8f0] focus-visible:ring-[#1e6feb]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#64748b]" />
            <Select
              value={filterCategory}
              onValueChange={(val) => setFilterCategory(val)}
            >
              <SelectTrigger className="w-40 bg-white border-[#e2e8f0]">
                <SelectValue placeholder="全部落位" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部落位</SelectItem>
                {GRID_CATEGORY_OPTIONS.map((cat: GridCategory) => (
                  <SelectItem key={cat} value={cat}>
                    {GRID_CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 列表 */}
        {filteredRecords.length === 0 ? (
          <Card className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0_0_0_0.08)] border-0">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="w-12 h-12 text-[#cbd5e1] mb-4" />
              <p className="text-[14px] text-[#64748b] mb-4">
                {records.length === 0
                  ? '暂无评分记录，前往盘点页开始评分'
                  : '没有匹配的评分记录'}
              </p>
              {records.length === 0 ? (
                <Button
                  onClick={handleCreate}
                  className="bg-[#1e6feb] hover:bg-[#1a5fd4] text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  开始评分
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchKeyword('');
                    setFilterCategory('');
                  }}
                  className="border-[#e2e8f0]"
                >
                  清除筛选
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            }}
          >
            {filteredRecords.map((record: UnifiedReviewRecordV2) => (
              <Card
                key={record.id}
                className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0_0_0_0.08)] border-0 flex flex-col hover:shadow-[0_4px_12px_rgba(0_0_0_0.08)] transition-shadow"
              >
                {/* 顶部：姓名 + 部门 */}
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-[16px] font-semibold text-[#0f172a] truncate">
                        {record.revieweeName}
                      </div>
                      <div className="flex items-center gap-1.5 text-[12px] text-[#64748b] mt-1 flex-wrap">
                        {record.department && <span>{record.department}</span>}
                        {record.positionType && (
                          <>
                            {record.department && (
                              <span className="text-[#e2e8f0]">·</span>
                            )}
                            <span className="flex items-center gap-1">
                              <Briefcase className="w-3 h-3" />
                              {record.positionType}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {record.isRedLine && (
                      <div className="flex items-center gap-1 text-[#ef4444] flex-shrink-0 ml-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-[12px] font-medium">红线</span>
                      </div>
                    )}
                  </div>
                </CardHeader>

                {/* 中部：分值展示 */}
                <CardContent className="py-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-[#eff6ff] rounded-lg p-3 text-center">
                      <div className="text-[12px] text-[#1e6feb] mb-1">
                        总分
                      </div>
                      <div className="text-[18px] font-semibold text-[#1e6feb]">
                        {record.totalScore.toFixed(1)}
                      </div>
                    </div>
                    <div className="bg-[#f1f5f9] rounded-lg p-3 text-center">
                      <div className="text-[12px] text-[#64748b] mb-1">
                        绩效分
                      </div>
                      <div className="text-[18px] font-semibold text-[#0f172a]">
                        {record.performanceScore.toFixed(1)}
                      </div>
                    </div>
                    <div className="bg-[#f1f5f9] rounded-lg p-3 text-center">
                      <div className="text-[12px] text-[#64748b] mb-1">
                        维度数
                      </div>
                      <div className="text-[18px] font-semibold text-[#0f172a]">
                        {Object.keys(record.dimensionAvgs || {}).length}
                      </div>
                    </div>
                  </div>
                </CardContent>

                {/* 底部：分类标签 + 时间 + 编辑 */}
                <CardFooter className="pt-3 flex items-center justify-between mt-auto">
                  <div className="flex flex-col gap-1">
                    <Badge
                      variant="outline"
                      className="font-medium w-fit"
                      style={categoryColorStyle(record.gridCategory)}
                    >
                      {GRID_CATEGORY_LABELS[record.gridCategory]}
                    </Badge>
                    <span className="text-[12px] text-[#64748b]">
                      提交时间 {formatDate(record.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(record.id)}
                      className="text-[#1e6feb] hover:text-[#1a5fd4] hover:bg-[#eff6ff] px-2 h-8"
                      aria-label={`编辑 ${record.revieweeName} 的评分`}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(record)}
                      className="text-[#ef4444] hover:text-[#dc2626] hover:bg-[#fef2f2] px-2 h-8"
                      aria-label={`删除 ${record.revieweeName} 的评分`}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      删除
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-semibold">
              确认删除评分
            </DialogTitle>
            <DialogDescription className="text-[14px] text-[#64748b]">
              {deleteTarget && (
                <>
                  确定要删除对{' '}
                  <span className="font-medium text-[#0f172a]">
                    {deleteTarget.revieweeName}
                  </span>{' '}
                  的评分记录吗？
                  <br />
                  删除后该被盘人将恢复为"未评分"状态，您可在盘点页重新评分。
                  <br />
                  <span className="text-[#f97316]">此操作不可撤销。</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose disabled={deleting}>取消</DialogClose>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 修改密码弹窗 */}
      <Dialog
        open={changePwdOpen}
        onOpenChange={(open) => {
          if (!open) resetChangePwdForm();
          setChangePwdOpen(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-semibold">
              修改密码
            </DialogTitle>
            <DialogDescription className="text-[14px] text-[#64748b]">
              修改您的登录密码，新密码至少6位
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="old-password">
                原密码 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="old-password"
                type="password"
                placeholder="请输入原密码"
                value={oldPassword}
                onChange={(e) => {
                  setOldPassword(e.target.value);
                  if (pwdError.oldPassword)
                    setPwdError((prev) => ({ ...prev, oldPassword: undefined }));
                }}
              />
              {pwdError.oldPassword && (
                <p className="text-[12px] text-destructive">
                  {pwdError.oldPassword}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">
                新密码 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-password"
                type="password"
                placeholder="请输入新密码（至少6位）"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (pwdError.newPassword)
                    setPwdError((prev) => ({ ...prev, newPassword: undefined }));
                }}
              />
              {pwdError.newPassword && (
                <p className="text-[12px] text-destructive">
                  {pwdError.newPassword}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">
                确认新密码 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="请再次输入新密码"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (pwdError.confirmPassword)
                    setPwdError((prev) => ({
                      ...prev,
                      confirmPassword: undefined,
                    }));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleChangePassword();
                }}
              />
              {pwdError.confirmPassword && (
                <p className="text-[12px] text-destructive">
                  {pwdError.confirmPassword}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose disabled={changePwdLoading}>取消</DialogClose>
            <Button
              onClick={handleChangePassword}
              disabled={changePwdLoading}
              className="bg-[#1e6feb] hover:bg-[#1a5fd4] text-white"
            >
              {changePwdLoading ? '提交中...' : '确认修改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

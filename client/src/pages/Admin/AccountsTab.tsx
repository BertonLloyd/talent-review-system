import { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Key, UserCheck, UserX, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { showConfirm } from '@lark-apaas/client-toolkit';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { getErrorMsg } from '@client/src/utils/request';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

import { review } from '@/api';
import {
  REVIEWER_ACCOUNT_STATUS_LABELS,
} from '@shared/api.interface';
import type { ReviewerAccountItem } from '@shared/api.interface';

interface AccountsTabProps {
  onRefresh?: () => void;
}

export default function AccountsTab({ onRefresh }: AccountsTabProps) {
  const [accounts, setAccounts] = useState<ReviewerAccountItem[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchText, setSearchText] = useState<string>('');

  // 重置密码弹窗
  const [resetPwdDialogOpen, setResetPwdDialogOpen] = useState(false);
  const [resettingAccount, setResettingAccount] = useState<ReviewerAccountItem | null>(null);
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState<string>('');
  const [newPwdResultOpen, setNewPwdResultOpen] = useState(false);

  // 加载账号列表
  const loadAccounts = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await review.listReviewerAccounts();
      setAccounts(res.items);
    } catch (err) {
      logger.error('加载评价人账号列表失败', err);
      toast.error(getErrorMsg(err));
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 首次加载
  useEffect(() => {
    void loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 前端过滤
  const filteredAccounts = useMemo(() => {
    if (!accounts) return [];
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return accounts;
    return accounts.filter(
      (a) =>
        a.reviewerKey.toLowerCase().includes(keyword) ||
        a.reviewerName.toLowerCase().includes(keyword),
    );
  }, [accounts, searchText]);

  // 打开重置密码确认
  const handleOpenResetPassword = (account: ReviewerAccountItem): void => {
    setResettingAccount(account);
    setResetPwdDialogOpen(true);
  };

  // 执行重置密码
  const handleResetPassword = async (): Promise<void> => {
    if (!resettingAccount) return;
    setResetting(true);
    try {
      const res = await review.resetReviewerPassword(resettingAccount.reviewerKey);
      if (res.success) {
        setNewPassword(res.newPassword);
        setResetPwdDialogOpen(false);
        setNewPwdResultOpen(true);
        void loadAccounts();
        onRefresh?.();
      }
    } catch (err) {
      logger.error('重置密码失败', err);
      toast.error(getErrorMsg(err));
    } finally {
      setResetting(false);
    }
  };

  // 复制密码
  const handleCopyPassword = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(newPassword);
      toast.success('密码已复制到剪贴板');
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  // 停用账号
  const handleDisable = async (account: ReviewerAccountItem): Promise<void> => {
    const confirmed = await showConfirm({
      message: `确定要停用「${account.reviewerName}」的账号吗？停用后该评价人将无法登录系统。`,
      confirmText: '确认停用',
      cancelText: '取消',
    });
    if (!confirmed) return;
    try {
      const res = await review.disableReviewerAccount(account.reviewerKey);
      if (res.success) {
        toast.success('账号已停用');
        void loadAccounts();
        onRefresh?.();
      }
    } catch (err) {
      logger.error('停用账号失败', err);
      toast.error(getErrorMsg(err));
    }
  };

  // 启用账号
  const handleEnable = async (account: ReviewerAccountItem): Promise<void> => {
    const confirmed = await showConfirm({
      message: `确定要启用「${account.reviewerName}」的账号吗？`,
      confirmText: '确认启用',
      cancelText: '取消',
    });
    if (!confirmed) return;
    try {
      const res = await review.enableReviewerAccount(account.reviewerKey);
      if (res.success) {
        toast.success('账号已启用');
        void loadAccounts();
        onRefresh?.();
      }
    } catch (err) {
      logger.error('启用账号失败', err);
      toast.error(getErrorMsg(err));
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0_0_0_0.08)] border-0">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-[#1e6feb]" />
            <h2 className="text-[16px] font-semibold text-[#0f172a]">
              评价人账号管理
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
              <Input
                placeholder="搜索姓名 / 登录名"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-9 h-9 text-[13px]"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadAccounts()}
              className="h-9"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <AccountsSkeleton />
          ) : (
            <div className="rounded-md border border-[#e2e8f0] overflow-hidden">
              <Table>
                <TableHeader className="bg-[#f8fafc]">
                  <TableRow className="hover:bg-transparent h-10">
                    <TableHead className="text-[13px] font-medium text-[#64748b] py-2">
                      登录名
                    </TableHead>
                    <TableHead className="text-[13px] font-medium text-[#64748b] py-2">
                      姓名
                    </TableHead>
                    <TableHead className="text-[13px] font-medium text-[#64748b] py-2">
                      角色
                    </TableHead>
                    <TableHead className="text-[13px] font-medium text-[#64748b] py-2">
                      部门
                    </TableHead>
                    <TableHead className="text-[13px] font-medium text-[#64748b] py-2">
                      状态
                    </TableHead>
                    <TableHead className="text-[13px] font-medium text-[#64748b] py-2 text-right">
                      操作
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-12 text-[#94a3b8] text-[13px]"
                      >
                        {searchText ? '未找到匹配的账号' : '暂无账号数据'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAccounts.map((account) => (
                      <TableRow key={account.reviewerKey} className="h-12">
                        <TableCell className="text-[14px] text-[#334155] font-mono">
                          {account.reviewerKey}
                        </TableCell>
                        <TableCell className="text-[14px] text-[#0f172a] font-medium">
                          {account.reviewerName}
                        </TableCell>
                        <TableCell className="text-[14px] text-[#334155]">
                          {account.role || '-'}
                        </TableCell>
                        <TableCell className="text-[14px] text-[#334155]">
                          {account.department || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              account.status === 'active'
                                ? 'bg-[#dcfce7] text-[#166534] hover:bg-[#dcfce7]'
                                : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#f1f5f9]'
                            }
                          >
                            {REVIEWER_ACCOUNT_STATUS_LABELS[account.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenResetPassword(account)}
                              className="h-7 text-[12px] px-2"
                            >
                              <Key className="w-3 h-3 mr-1" />
                              重置密码
                            </Button>
                            {account.status === 'active' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleDisable(account)}
                                className="h-7 text-[12px] px-2 text-[#dc2626] border-[#fecaca] hover:bg-[#fef2f2] hover:text-[#dc2626]"
                              >
                                <UserX className="w-3 h-3 mr-1" />
                                停用
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleEnable(account)}
                                className="h-7 text-[12px] px-2 text-[#16a34a] border-[#bbf7d0] hover:bg-[#f0fdf4] hover:text-[#16a34a]"
                              >
                                <UserCheck className="w-3 h-3 mr-1" />
                                启用
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 重置密码确认 Dialog */}
      <Dialog open={resetPwdDialogOpen} onOpenChange={setResetPwdDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-semibold text-[#0f172a]">
              重置密码
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#64748b]">
              确定要为「{resettingAccount?.reviewerName}」重置密码吗？
              重置后系统将生成一个新的初始密码。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setResetPwdDialogOpen(false)}
              disabled={resetting}
            >
              取消
            </Button>
            <Button
              className="bg-[#1e6feb] hover:bg-[#1a5fd4]"
              onClick={() => void handleResetPassword()}
              disabled={resetting}
            >
              {resetting ? '重置中...' : '确认重置'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新密码结果 Dialog */}
      <Dialog open={newPwdResultOpen} onOpenChange={setNewPwdResultOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-semibold text-[#0f172a]">
              密码重置成功
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#64748b]">
              请将以下新密码告知「{resettingAccount?.reviewerName}」：
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 p-4 bg-[#f8fafc] rounded-lg border border-[#e2e8f0] mt-2">
            <div className="flex-1 text-center font-mono text-[18px] font-semibold text-[#0f172a] tracking-wider">
              {newPassword}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleCopyPassword()}
              className="h-8"
            >
              <Copy className="w-3.5 h-3.5 mr-1" />
              复制
            </Button>
          </div>
          <p className="text-[12px] text-[#94a3b8] mt-2">
            提示：该密码为初始密码，建议评价人首次登录后及时修改。
          </p>
          <DialogFooter className="mt-4">
            <Button
              className="bg-[#1e6feb] hover:bg-[#1a5fd4]"
              onClick={() => setNewPwdResultOpen(false)}
            >
              知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3 px-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-12 rounded-full" />
          <div className="flex-1" />
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-7 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}

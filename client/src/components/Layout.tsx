import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LogOut, KeyRound } from 'lucide-react';
import logoUrl from '@client/src/assets/app-logo.png';
import { getCurrentUser, clearToken, setLogoutHandler, type CurrentUser } from '@client/src/utils/auth';
import { Button } from '@client/src/components/ui/button';
import { Image } from '@client/src/components/ui/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { useSystemSettings } from '@client/src/contexts/SystemSettingsContext';
import { review } from '@client/src/api';
import { toast } from 'sonner';
import { getErrorMsg } from '@client/src/utils/request';
import { logger } from '@lark-apaas/client-toolkit/logger';

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const { systemName, systemLogo, loading: settingsLoading } = useSystemSettings();

  useEffect(() => {
    const u = getCurrentUser();
    setUser(u);
    if (!u && location.pathname !== '/') {
      navigate('/');
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    setLogoutHandler(() => {
      clearToken();
      setUser(null);
      navigate('/');
    });
    return () => {
      setLogoutHandler(() => {});
    };
  }, [navigate]);

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);

  const handleLogout = () => {
    clearToken();
    setUser(null);
    navigate('/');
  };

  const handleChangePassword = async (): Promise<void> => {
    if (!oldPassword) {
      toast.error('请输入旧密码');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('新密码至少 6 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }

    setChangingPwd(true);
    try {
      await review.changePassword({
        oldPassword,
        newPassword,
      });
      toast.success('密码修改成功');
      setChangePasswordOpen(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      logger.error('修改密码失败', error);
      toast.error(getErrorMsg(error));
    } finally {
      setChangingPwd(false);
    }
  };

  if (!user || location.pathname === '/') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-rose-50">
        <Outlet />
      </div>
    );
  }

  const getTitle = () => {
    if (!settingsLoading && systemName) {
      if (user.isAdmin) return `${systemName}·管理后台`;
      return systemName;
    }
    if (user.isAdmin) return '人才盘点管理后台';
    return '人才盘点';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src={systemLogo || logoUrl} alt="系统 LOGO" className="h-9 w-auto" />
            <h1 className="text-lg font-semibold text-slate-900">
              {getTitle()}
            </h1>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setChangePasswordOpen(true)}
              className="gap-2 text-slate-600"
            >
              <KeyRound size={14} />
              修改密码
            </Button>
            <span className="text-sm text-slate-600">
              {user.name}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut size={14} />
              退出
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6">
        <Outlet />
      </main>

      {/* 修改密码弹窗 */}
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent>
          DialogHeader
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="old-password">旧密码</Label>
              <Input
                id="old-password"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="请输入旧密码"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">新密码</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少 6 位"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">确认新密码</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入新密码"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setChangePasswordOpen(false)}
              disabled={changingPwd}
            >
              取消
            </Button>
            <Button
              onClick={() => void handleChangePassword()}
              disabled={changingPwd}
              className="bg-[#1e6feb] hover:bg-[#1a5fd4] text-white"
            >
              {changingPwd ? '修改中...' : '确定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Layout;

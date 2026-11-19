import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { User, Shield, LogIn, Search } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import logoUrl from '@client/src/assets/app-logo.png';
import { review } from '@client/src/api';
import { setToken, getCurrentUser } from '@client/src/utils/auth';
import { Button } from '@client/src/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Skeleton } from '@client/src/components/ui/skeleton';
import type {
  DisplaySettingRecord,
  UnifiedReviewerInfo,
} from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';
import { useSystemSettings } from '@client/src/contexts/SystemSettingsContext';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [allReviewers, setAllReviewers] = useState<UnifiedReviewerInfo[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedReviewer, setSelectedReviewer] = useState<string>('');
  const [reviewerPassword, setReviewerPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [reviewerLoading, setReviewerLoading] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [displaySettings, setDisplaySettings] = useState<
    DisplaySettingRecord[] | null
  >(null);
  const [displaySettingsLoading, setDisplaySettingsLoading] = useState(true);

  const { systemName, systemLogo } = useSystemSettings();

  const displayLabels = useMemo(() => {
    const map: Record<string, string> = {
      app_name: '人才盘点系统',
      review_name: '人才评估',
      reviewer_label: '评价人',
      reviewee_label: '被盘人',
      department_label: '部门',
      store_label: '所在单位',
      grid_description: '九宫格人才地图',
    };
    if (displaySettings) {
      for (const item of displaySettings) {
        if (item.settingValue) {
          map[item.settingKey] = item.settingValue;
        }
      }
    }
    return map;
  }, [displaySettings]);

  const filteredReviewers = useMemo(() => {
    if (!searchKeyword.trim()) return allReviewers;
    const kw = searchKeyword.toLowerCase();
    return allReviewers.filter((r: UnifiedReviewerInfo) =>
      r.name.toLowerCase().includes(kw),
    );
  }, [allReviewers, searchKeyword]);

  useEffect(() => {
    const u = getCurrentUser();
    if (u) {
      if (u.isAdmin) navigate('/admin');
      else navigate('/review');
      return;
    }
    review.getReviewers().then((res) => {
      setAllReviewers(res.reviewers);
    });
    review.getDisplaySettings().then((res) => {
      setDisplaySettings(res.items);
      setDisplaySettingsLoading(false);
    }).catch(() => {
      setDisplaySettingsLoading(false);
    });
  }, [navigate]);

  const handleReviewerLogin = async () => {
    if (!selectedReviewer) {
      toast.error('请选择您的身份');
      return;
    }
    if (!reviewerPassword) {
      toast.error('请输入登录密码');
      return;
    }
    setReviewerLoading(true);
    try {
      const res = await review.login({
        reviewerKey: selectedReviewer,
        password: reviewerPassword,
      });
      if (res.token) {
        setToken(res.token);
        toast.success(`欢迎，${res.reviewerName}`);
        navigate('/review');
      } else {
        toast.error('账号不存在或密码错误');
      }
    } catch (error) {
      logger.error('登录失败', error);
      toast.error('账号不存在或密码错误');
    } finally {
      setReviewerLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    if (!adminPassword) {
      toast.error('请输入管理员口令');
      return;
    }
    setAdminLoading(true);
    try {
      const res = await review.login({
        reviewerKey: 'admin',
        password: adminPassword,
      });
      if (res.token && res.role === 'admin') {
        setToken(res.token);
        toast.success('管理员登录成功');
        navigate('/admin');
      } else {
        toast.error('管理员口令错误');
      }
    } catch (error) {
      logger.error('管理员登录失败', error);
      toast.error('管理员口令错误');
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-rose-50 p-6">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src={systemLogo || logoUrl} alt="系统 LOGO" className="h-16 w-auto" />
          </div>
          {displaySettingsLoading ? (
            <Skeleton className="h-8 w-64 mx-auto mb-2" />
          ) : (
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              {systemName || displayLabels.app_name}
            </h1>
          )}
          <p className="text-slate-500 text-sm">
            请登录后进入人才盘点
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <User className="text-amber-700" size={20} />
                </div>
                <div>
                  <CardTitle className="text-base">
                    {displaySettingsLoading
                      ? <Skeleton className="h-5 w-24" />
                      : `${displayLabels.reviewer_label}登录`}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    部门负责人 / 团队负责人
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reviewer-search">
                  搜索姓名 <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    id="reviewer-search"
                    placeholder="输入姓名快速查找"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reviewer-select">
                  选择身份 <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedReviewer}
                  onValueChange={setSelectedReviewer}
                >
                  <SelectTrigger id="reviewer-select">
                    <SelectValue placeholder="请选择您的姓名" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredReviewers.map((r: UnifiedReviewerInfo) => (
                      <SelectItem key={r.key} value={r.key}>
                        {r.name}
                        {r.department ? ` · ${r.department}` : ''}
                      </SelectItem>
                    ))}
                    {filteredReviewers.length === 0 && (
                      <SelectItem value="__none__" disabled>
                        未找到匹配人员
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reviewer-pwd">
                  登录密码 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="reviewer-pwd"
                  type="password"
                  placeholder="请输入登录密码"
                  value={reviewerPassword}
                  onChange={(e) => setReviewerPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleReviewerLogin();
                  }}
                />
              </div>
              <Button
                className="w-full gap-2"
                onClick={handleReviewerLogin}
                disabled={
                  reviewerLoading || !selectedReviewer || !reviewerPassword
                }
              >
                <LogIn size={16} />
                {reviewerLoading ? '登录中...' : '进入人才盘点'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center">
                  <Shield className="text-rose-700" size={20} />
                </div>
                <div>
                  <CardTitle className="text-base">管理员</CardTitle>
                  <CardDescription className="text-xs">
                    人才盘点地图 · 历史查询 · 规则配置
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-pwd">
                  管理员口令 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="admin-pwd"
                  type="password"
                  placeholder="请输入管理员口令"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdminLogin();
                  }}
                />
              </div>
              <p className="text-xs text-slate-400">
                管理员后台可查看全部部门盘点数据与配置规则
              </p>
              <Button
                variant="secondary"
                className="w-full gap-2"
                onClick={handleAdminLogin}
                disabled={adminLoading || !adminPassword}
              >
                <Shield size={16} />
                {adminLoading ? '验证中...' : '进入管理后台'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          评分结果仅用于人才盘点讨论，请严格保密
        </p>
      </div>
    </div>
  );
};

export default LoginPage;

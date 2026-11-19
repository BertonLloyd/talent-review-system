import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { getToken, triggerLogout } from '@client/src/utils/auth';
import type {
  UnifiedReviewerListResponse,
  UnifiedLoginRequest,
  UnifiedLoginResponse,
  UnifiedChangePasswordRequest,
  UnifiedChangePasswordResponse,
  UnifiedReviewListResponse,
  UnifiedReviewRecord,
  UnifiedSummaryResponse,
  UnifiedSummaryItem,
  UnifiedCreateReviewRequest,
  UnifiedUpdateReviewRequest,
  DisplaySettingListResponse,
  RuleSetRecord,
} from '@shared/api.interface';

let _interceptorsInstalled = false;

function installInterceptors(): void {
  if (_interceptorsInstalled) return;
  _interceptorsInstalled = true;

  axiosForBackend.interceptors.request.use(
    (config) => {
      const token = getToken();
      if (token) {
        // eslint-disable-next-line no-param-reassign
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error),
  );

  axiosForBackend.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error?.response?.status === 401) {
        triggerLogout('登录已过期，请重新登录');
      }
      return Promise.reject(error);
    },
  );
}

installInterceptors();

const BASE = '/api/unified-review';

export async function getReviewers(): Promise<UnifiedReviewerListResponse> {
  const res = await axiosForBackend.get(`${BASE}/reviewers`);
  return res.data;
}

export async function getDisplaySettings(): Promise<DisplaySettingListResponse> {
  const res = await axiosForBackend.get(`${BASE}/display-settings`);
  return res.data;
}

export async function getDefaultRuleSet(
  reviewType: 'standard' | 'position',
): Promise<RuleSetRecord> {
  const res = await axiosForBackend.get(`${BASE}/rule-sets/default`, {
    params: { reviewType },
  });
  return res.data;
}

export async function login(
  body: UnifiedLoginRequest,
): Promise<UnifiedLoginResponse> {
  const res = await axiosForBackend.post(`${BASE}/login`, body);
  return res.data;
}

export async function changePassword(
  body: UnifiedChangePasswordRequest,
): Promise<UnifiedChangePasswordResponse> {
  const res = await axiosForBackend.post(`${BASE}/change-password`, body);
  return res.data;
}

export async function getMyReviews(): Promise<UnifiedReviewListResponse> {
  const res = await axiosForBackend.get(`${BASE}/my-reviews`);
  return res.data;
}

export async function getReview(id: string): Promise<UnifiedReviewRecord> {
  const res = await axiosForBackend.get(`${BASE}/reviews/${id}`);
  return res.data;
}

export async function createReview(
  body: UnifiedCreateReviewRequest,
): Promise<UnifiedReviewRecord> {
  const res = await axiosForBackend.post(`${BASE}/reviews`, body);
  return res.data;
}

export async function updateReview(
  id: string,
  body: UnifiedUpdateReviewRequest,
): Promise<UnifiedReviewRecord> {
  const res = await axiosForBackend.patch(`${BASE}/reviews/${id}`, body);
  return res.data;
}

export async function deleteReview(id: string): Promise<void> {
  await axiosForBackend.delete(`${BASE}/reviews/${id}`);
}

export interface AdminSummaryQuery {
  revieweeName?: string;
  department?: string;
  departmentName?: string;
  positionType?: string;
  gridCategory?: string;
  isRedLine?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export async function getAdminSummary(
  params: AdminSummaryQuery,
): Promise<UnifiedSummaryResponse> {
  const res = await axiosForBackend.get(`${BASE}/admin/summary`, { params });
  return res.data;
}

export interface AdminStats {
  gridDistribution: Record<string, number>;
  totalCount: number;
  standardCount: number;
  positionCount: number;
  departmentStats: Array<{ department: string; count: number; avgScore: number }>;
}

export async function getAdminStats(): Promise<AdminStats> {
  const res = await axiosForBackend.get(`${BASE}/admin/stats`);
  return res.data;
}

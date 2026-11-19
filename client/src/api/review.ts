import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { getToken, triggerLogout } from '@client/src/utils/auth';
import type {
  UnifiedReviewListResponseV2,
  UnifiedReviewRecordV2,
  UnifiedCreateReviewRequestV2,
  UnifiedUpdateReviewRequestV2,
  UnifiedReviewSummaryResponse,
  RuleSetListResponse,
  RuleSetRecord,
  CreateRuleSetRequest,
  UpdateRuleSetRequest,
  RuleSetVersionListResponse,
  RuleSetVersionRecord,
  LoginRequest,
  LoginResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
  DisplaySettingListResponse,
  UnifiedReviewerListResponse,
  ReviewerAccountListResponse,
  ResetPasswordResponse,
} from '@shared/api.interface';

// ===== 拦截器：自动注入 Authorization 头 & 401 处理 =====
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
      const status = error?.response?.status;
      if (status === 401) {
        const url = error.config?.url ?? '';
        if (!url.includes('/login')) {
          triggerLogout('登录已过期，请重新登录');
        }
      }
      return Promise.reject(error);
    },
  );
}

installInterceptors();

const BASE = '/api/review';
const CONFIG_BASE = '/api/review/config';

// ===== 登录 =====

export async function login(data: LoginRequest): Promise<LoginResponse> {
  try {
    const res = await axiosForBackend.post(`${BASE}/login`, data);
    return res.data;
  } catch (error) {
    logger.error('登录失败', error);
    throw error;
  }
}

export async function changePassword(
  data: ChangePasswordRequest,
): Promise<ChangePasswordResponse> {
  try {
    const res = await axiosForBackend.post(`${BASE}/change-password`, data);
    return res.data;
  } catch (error) {
    logger.error('修改密码失败', error);
    throw error;
  }
}

// ===== 评价人列表 =====

export async function getReviewers(): Promise<UnifiedReviewerListResponse> {
  const res = await axiosForBackend.get(`${BASE}/reviewers`);
  return res.data;
}

// ===== 显示设置 =====

export async function getDisplaySettings(): Promise<DisplaySettingListResponse> {
  const res = await axiosForBackend.get(`${CONFIG_BASE}/display-settings`);
  return res.data;
}

// ===== 被盘人列表 =====

export interface RevieweeListItem {
  name: string;
  department: string | null;
  positionType: string | null;
  employeeNo: string | null;
  hasSubmitted: boolean;
}

export interface RevieweeListResponse {
  reviewerName: string;
  reviewees: RevieweeListItem[];
}

export async function getReviewees(): Promise<RevieweeListResponse> {
  const res = await axiosForBackend.get(`${BASE}/reviewees`);
  return res.data;
}

// ===== 我的评分 =====

export interface MyScoresResponse {
  items: UnifiedReviewRecordV2[];
}

export async function getMyScores(): Promise<MyScoresResponse> {
  const res = await axiosForBackend.get(`${BASE}/mine`);
  return res.data;
}

// ===== 评分记录详情 =====

export async function getRecordDetail(id: string): Promise<
  UnifiedReviewRecordV2 & { items: import('@shared/api.interface').ReviewScoreItem[] }
> {
  const res = await axiosForBackend.get(`${BASE}/records/${id}`);
  return res.data;
}

// ===== 提交评分 =====

export async function createRecord(
  body: UnifiedCreateReviewRequestV2,
): Promise<UnifiedReviewRecordV2> {
  try {
    const res = await axiosForBackend.post(`${BASE}/records`, body);
    return res.data;
  } catch (error) {
    logger.error('创建评分失败', error);
    throw error;
  }
}

// ===== 更新评分 =====

export async function updateRecord(
  id: string,
  body: UnifiedUpdateReviewRequestV2,
): Promise<UnifiedReviewRecordV2> {
  try {
    const res = await axiosForBackend.patch(`${BASE}/records/${id}`, body);
    return res.data;
  } catch (error) {
    logger.error('更新评分失败', error);
    throw error;
  }
}

// ===== 删除评分 =====

export async function deleteRecord(id: string): Promise<void> {
  try {
    await axiosForBackend.delete(`${BASE}/records/${id}`);
  } catch (error) {
    logger.error('删除评分失败', error);
    throw error;
  }
}

// ===== 管理员：评分记录列表 =====

export interface AdminRecordsQuery {
  page?: number;
  pageSize?: number;
  department?: string;
  positionType?: string;
  gridCategory?: string;
  isRedLine?: boolean;
  keyword?: string;
  includeTest?: boolean;
}

export async function getAdminRecords(
  params: AdminRecordsQuery,
): Promise<UnifiedReviewListResponseV2> {
  const res = await axiosForBackend.get(`${BASE}/records`, { params });
  return res.data;
}

// ===== 规则集 =====

export async function getDefaultRuleSet(): Promise<RuleSetRecord> {
  const res = await axiosForBackend.get(`${CONFIG_BASE}/rule-sets/default`);
  return res.data;
}

export async function getRuleSets(params?: {
  status?: string;
}): Promise<RuleSetListResponse> {
  const res = await axiosForBackend.get(`${CONFIG_BASE}/rule-sets`, {
    params,
  });
  return res.data;
}

export async function getRuleSetDetail(id: string): Promise<RuleSetRecord> {
  const res = await axiosForBackend.get(`${CONFIG_BASE}/rule-sets/${id}`);
  return res.data;
}

export async function createRuleSet(
  data: CreateRuleSetRequest,
): Promise<RuleSetRecord> {
  try {
    const res = await axiosForBackend.post(`${CONFIG_BASE}/rule-sets`, data);
    return res.data;
  } catch (error) {
    logger.error('创建规则集失败', error);
    throw error;
  }
}

export async function updateRuleSet(
  id: string,
  data: UpdateRuleSetRequest,
): Promise<RuleSetRecord> {
  try {
    const res = await axiosForBackend.put(
      `${CONFIG_BASE}/rule-sets/${id}`,
      data,
    );
    return res.data;
  } catch (error) {
    logger.error('更新规则集失败', error);
    throw error;
  }
}

export async function deleteRuleSet(id: string): Promise<{ success: true }> {
  try {
    const res = await axiosForBackend.delete(`${CONFIG_BASE}/rule-sets/${id}`);
    return res.data;
  } catch (error) {
    logger.error('删除规则集失败', error);
    throw error;
  }
}

export async function copyRuleSet(id: string): Promise<RuleSetRecord> {
  try {
    const res = await axiosForBackend.post(`${CONFIG_BASE}/rule-sets/${id}/copy`);
    return res.data;
  } catch (error) {
    logger.error('复制规则集失败', error);
    throw error;
  }
}

export async function activateRuleSet(id: string): Promise<RuleSetRecord> {
  try {
    const res = await axiosForBackend.post(
      `${CONFIG_BASE}/rule-sets/${id}/activate`,
    );
    return res.data;
  } catch (error) {
    logger.error('启用规则集失败', error);
    throw error;
  }
}

// ===== 规则集版本历史 =====

export async function getRuleSetVersions(
  ruleSetId: string,
): Promise<RuleSetVersionListResponse> {
  const res = await axiosForBackend.get(
    `${CONFIG_BASE}/rule-sets/${ruleSetId}/versions`,
  );
  return res.data;
}

export async function getRuleSetVersion(
  ruleSetId: string,
  versionNo: number,
): Promise<RuleSetVersionRecord> {
  const res = await axiosForBackend.get(
    `${CONFIG_BASE}/rule-sets/${ruleSetId}/versions/${versionNo}`,
  );
  return res.data;
}

export async function rollbackRuleSetVersion(
  ruleSetId: string,
  versionNo: number,
): Promise<RuleSetVersionRecord> {
  try {
    const res = await axiosForBackend.post(
      `${CONFIG_BASE}/rule-sets/${ruleSetId}/versions/${versionNo}/rollback`,
    );
    return res.data;
  } catch (error) {
    logger.error('回滚版本失败', error);
    throw error;
  }
}

// ===== 批次管理 =====

export interface BatchListResponse {
  items: any[];
  total?: number;
}

export async function getBatches(): Promise<BatchListResponse> {
  const res = await axiosForBackend.get(`${CONFIG_BASE}/batches`);
  return res.data;
}

export async function getBatch(id: string): Promise<any> {
  const res = await axiosForBackend.get(`${CONFIG_BASE}/batches/${id}`);
  return res.data;
}

export async function createBatch(data: any): Promise<any> {
  try {
    const res = await axiosForBackend.post(`${CONFIG_BASE}/batches`, data);
    return res.data;
  } catch (error) {
    logger.error('创建批次失败', error);
    throw error;
  }
}

export async function updateBatch(id: string, data: any): Promise<any> {
  try {
    const res = await axiosForBackend.patch(`${CONFIG_BASE}/batches/${id}`, data);
    return res.data;
  } catch (error) {
    logger.error('更新批次失败', error);
    throw error;
  }
}

export async function deleteBatch(id: string): Promise<{ success: true }> {
  try {
    const res = await axiosForBackend.delete(`${CONFIG_BASE}/batches/${id}`);
    return res.data;
  } catch (error) {
    logger.error('删除批次失败', error);
    throw error;
  }
}

export async function setBatchStatus(id: string, status: string): Promise<any> {
  try {
    const res = await axiosForBackend.patch(`${CONFIG_BASE}/batches/${id}/status`, {
      status,
    });
    return res.data;
  } catch (error) {
    logger.error('更新批次状态失败', error);
    throw error;
  }
}

// ===== 参评名单 =====

export interface ParticipantListResponse {
  items: any[];
  total?: number;
}

export async function getParticipants(batchId: string): Promise<ParticipantListResponse> {
  const res = await axiosForBackend.get(
    `${CONFIG_BASE}/batches/${batchId}/participants`,
  );
  return res.data;
}

export async function createParticipant(data: any): Promise<any> {
  try {
    const res = await axiosForBackend.post(`${CONFIG_BASE}/participants`, data);
    return res.data;
  } catch (error) {
    logger.error('新增参评人员失败', error);
    throw error;
  }
}

export async function updateParticipant(id: string, data: any): Promise<any> {
  try {
    const res = await axiosForBackend.patch(
      `${CONFIG_BASE}/participants/${id}`,
      data,
    );
    return res.data;
  } catch (error) {
    logger.error('更新参评人员失败', error);
    throw error;
  }
}

export async function deleteParticipant(id: string): Promise<{ success: true }> {
  try {
    const res = await axiosForBackend.delete(`${CONFIG_BASE}/participants/${id}`);
    return res.data;
  } catch (error) {
    logger.error('删除参评人员失败', error);
    throw error;
  }
}

export async function batchImportParticipants(data: any): Promise<{ success: number; failed: number }> {
  try {
    const res = await axiosForBackend.post(
      `${CONFIG_BASE}/participants/batch-import`,
      data,
    );
    return res.data;
  } catch (error) {
    logger.error('批量导入参评人员失败', error);
    throw error;
  }
}

export async function downloadParticipantTemplate(): Promise<Blob> {
  try {
    const res = await axiosForBackend.get(
      `${CONFIG_BASE}/participants/template`,
      { responseType: 'blob' },
    );
    return res.data;
  } catch (error) {
    logger.error('下载名单模板失败', error);
    throw error;
  }
}

// ===== 显示设置更新 =====

export async function updateDisplaySetting(
  key: string,
  value: string,
  sortOrder?: number,
): Promise<any> {
  try {
    const res = await axiosForBackend.patch(
      `${CONFIG_BASE}/display-settings/key/${encodeURIComponent(key)}`,
      { settingValue: value, sortOrder },
    );
    return res.data;
  } catch (error) {
    logger.error('更新显示设置失败', error);
    throw error;
  }
}

export async function updateDisplaySettings(
  items: Array<{ settingKey: string; settingValue: string; sortOrder?: number }>,
): Promise<DisplaySettingListResponse> {
  try {
    const res = await axiosForBackend.put(`${CONFIG_BASE}/display-settings`, {
      items,
    });
    return res.data;
  } catch (error) {
    logger.error('更新显示名称设置失败', error);
    throw error;
  }
}

// ===== API Key =====

export async function getApiKey(): Promise<{ apiKey: string }> {
  const res = await axiosForBackend.get(`${CONFIG_BASE}/api-key`);
  return res.data;
}

export async function resetApiKey(): Promise<{ success: true }> {
  try {
    const res = await axiosForBackend.post(`${CONFIG_BASE}/api-key/reset`);
    return res.data;
  } catch (error) {
    logger.error('重置接口密钥失败', error);
    throw error;
  }
}

// ===== 导出 CSV =====

export async function exportRecords(params?: Record<string, any>): Promise<Blob> {
  const res = await axiosForBackend.get(`${BASE}/records/export`, {
    params,
    responseType: 'blob',
  });
  return res.data;
}

// ===== 评价人账号管理 =====

export async function listReviewerAccounts(): Promise<ReviewerAccountListResponse> {
  const res = await axiosForBackend.get(`${CONFIG_BASE}/reviewer-accounts`);
  return res.data;
}

export async function resetReviewerPassword(
  reviewerKey: string,
): Promise<ResetPasswordResponse> {
  try {
    const res = await axiosForBackend.post(
      `${CONFIG_BASE}/reviewer-accounts/${encodeURIComponent(reviewerKey)}/reset-password`,
    );
    return res.data;
  } catch (error) {
    logger.error('重置密码失败', error);
    throw error;
  }
}

export async function disableReviewerAccount(
  reviewerKey: string,
): Promise<{ success: boolean }> {
  try {
    const res = await axiosForBackend.post(
      `${CONFIG_BASE}/reviewer-accounts/${encodeURIComponent(reviewerKey)}/disable`,
    );
    return res.data;
  } catch (error) {
    logger.error('停用账号失败', error);
    throw error;
  }
}

export async function enableReviewerAccount(
  reviewerKey: string,
): Promise<{ success: boolean }> {
  try {
    const res = await axiosForBackend.post(
      `${CONFIG_BASE}/reviewer-accounts/${encodeURIComponent(reviewerKey)}/enable`,
    );
    return res.data;
  } catch (error) {
    logger.error('启用账号失败', error);
    throw error;
  }
}

// ===== 九宫格统计 =====

export async function getGridStats(params?: Record<string, any>): Promise<any> {
  const res = await axiosForBackend.get(`${BASE}/stats/grid`, { params });
  return res.data;
}

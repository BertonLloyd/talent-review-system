import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

function isRetryable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as {
    response?: { status?: number };
    code?: string;
    message?: string;
  };
  const status = err.response?.status;
  if (status && status >= 500) return true;
  if (err.code === 'ECONNABORTED') return true;
  if (err.code === 'ERR_NETWORK') return true;
  const msg = err.message || '';
  if (
    msg.includes('timeout') ||
    msg.includes('Network Error') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504')
  ) {
    return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function requestWithRetry<T>(
  fn: () => Promise<T>,
  label: string,
): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const result = await fn();
      if (attempt > 0) {
        logger.info(`${label} 第${attempt + 1}次重试成功`);
      }
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES && isRetryable(error)) {
        const delay = RETRY_DELAY_MS * (attempt + 1);
        logger.warn(`${label} 第${attempt + 1}次请求失败，${delay}ms 后重试`, error);
        await sleep(delay);
      } else {
        break;
      }
    }
  }
  throw lastError;
}

export function getErrorMsg(error: unknown): string {
  if (!error || typeof error !== 'object') return '网络异常，请重试';
  const err = error as {
    response?: { data?: { error?: { message?: string; code?: string } }; status?: number };
    message?: string;
    code?: string;
  };
  const serverMsg = err.response?.data?.error?.message;
  const status = err.response?.status;
  if (serverMsg) return serverMsg;
  if (status === 401) return '登录已过期，请重新登录';
  if (status === 403) return '没有操作权限';
  if (status === 404) return '请求的资源不存在';
  if (status && status >= 500) return '服务器繁忙，请稍后重试';
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
    return '请求超时，请检查网络后重试';
  }
  if (err.message?.includes('Network Error') || err.code === 'ERR_NETWORK') {
    return '网络连接异常，请检查网络后重试';
  }
  return '提交失败，请重试';
}

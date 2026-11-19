import { toast } from 'sonner';

const TOKEN_KEY = 'talent_review_token';

export type UserSide = 'standard' | 'position';

export interface CurrentUser {
  key: string;
  name: string;
  role: string;
  isAdmin: boolean;
  side: UserSide;
  departmentName?: string;
}

// ===== Token 基础操作 =====

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ===== JWT 解析 =====

export interface JwtPayload {
  reviewerKey: string;
  reviewerName: string;
  role: string;
  reviewType: string;
  departmentName?: string;
  exp?: number;
  iat?: number;
}

function base64UrlDecode(str: string): string {
  // JWT 使用 base64url，先转成标准 base64
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // 补 padding
  const pad = base64.length % 4;
  const padded = pad === 0 ? base64 : base64 + '='.repeat(4 - pad);
  try {
    return decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
  } catch {
    return '';
  }
}

export function parseToken(token: string): JwtPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

// ===== 派生用户信息 =====

export function getCurrentUser(): CurrentUser | null {
  const token = getToken();
  if (!token) return null;
  const payload = parseToken(token);
  if (!payload) return null;
  // 检查过期
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    clearToken();
    return null;
  }
  const isAdmin = payload.role === 'admin';
  const side: UserSide = payload.reviewType === 'position' ? 'position' : 'standard';
  return {
    key: payload.reviewerKey,
    name: payload.reviewerName,
    role: payload.role,
    isAdmin,
    side,
    departmentName: payload.departmentName,
  };
}

export function isAdmin(): boolean {
  const user = getCurrentUser();
  return user?.isAdmin === true;
}

// ===== 登出（供拦截器调用） =====

let _logoutHandler: (() => void) | null = null;

export function setLogoutHandler(handler: () => void): void {
  _logoutHandler = handler;
}

export function triggerLogout(message?: string): void {
  clearToken();
  if (message) {
    toast.error(message);
  }
  if (_logoutHandler) {
    _logoutHandler();
  }
}

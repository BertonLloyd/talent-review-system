import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { JwtPayload } from './auth.service';

/**
 * 从 req.user 获取当前用户信息
 * 需配合 AuthGuard 使用
 */
export const CurrentUser = createParamDecorator(
  (
    data: keyof JwtPayload | undefined,
    ctx: ExecutionContext,
  ): JwtPayload | JwtPayload[keyof JwtPayload] | undefined => {
    const request = ctx.switchToHttp().getRequest<
      Request & { user?: JwtPayload }
    >();
    const user = request.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);

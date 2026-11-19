import {
  CanActivate,
  ExecutionContext,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from "@lark-apaas/fullstack-nestjs-core";
import { eq } from 'drizzle-orm';
import { reviewerAccount } from '@server/database/schema';
import { AuthService } from './auth.service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User {
      reviewerKey: string;
      reviewerName: string;
      role: string;
    }
    interface Request {
      user?: User;
    }
  }
}

export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: Request = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers.authorization;
    try {
      const token = this.authService.extractTokenFromHeader(authHeader);
      const user = this.authService.verifyToken(token);

      if (user.role !== 'admin') {
        const rows = await this.db
          .select({ status: reviewerAccount.status })
          .from(reviewerAccount)
          .where(eq(reviewerAccount.reviewerKey, user.reviewerKey));
        if (rows.length === 0 || rows[0].status !== 'active') {
          throw new UnauthorizedException('账号已停用，请联系管理员');
        }
      }

      req.user = user;
      req.userContext = {
        userId: user.reviewerKey,
        userName: user.reviewerName,
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('未授权或登录已过期');
    }
  }
}

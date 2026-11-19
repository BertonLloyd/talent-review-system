import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AUTH_JWT_SECRET } from '@server/common/constants';

export interface JwtPayload {
  reviewerKey: string;
  reviewerName: string;
  role: string;
}

export interface AuthUser extends JwtPayload {
  // req.user shape
}

const JWT_EXPIRES_IN = '8h';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  generateToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }

  verifyToken(token: string): AuthUser {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      return payload;
    } catch {
      throw new UnauthorizedException('未授权或登录已过期');
    }
  }

  extractTokenFromHeader(authHeader: string | undefined): string {
    if (!authHeader) {
      throw new UnauthorizedException('未授权或登录已过期');
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException('未授权或登录已过期');
    }
    return parts[1];
  }
}

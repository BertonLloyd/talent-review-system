import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import { ReviewConfigService } from '@server/modules/review/review-config/review-config.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly reviewConfigService: ReviewConfigService) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'] as string | undefined;

    if (!apiKey) {
      throw new UnauthorizedException('缺少 API Key，请在请求头中提供 X-API-Key');
    }

    return this.validateKey(apiKey);
  }

  private async validateKey(apiKey: string): Promise<boolean> {
    const valid = await this.reviewConfigService.validateApiKey(apiKey);
    if (!valid) {
      throw new ForbiddenException('无效的 API Key');
    }
    return true;
  }
}

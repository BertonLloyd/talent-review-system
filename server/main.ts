import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { static as expressStatic, type Request, type Response } from 'express';
import { configureApp } from '@lark-apaas/fullstack-nestjs-core';
import { join } from 'path';
import { __express as hbsExpressEngine } from 'hbs';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    abortOnError: process.env.NODE_ENV !== 'development',
  });
  await configureApp(app, { 
    disableSwagger: true,
  });

  // 自建部署：平台 ViewContextMiddleware 在没有平台 Host 头时，会把 basename
  // 固定解析为 /app/<id>，导致根路径访问路由不匹配而白屏。这里包装 res.render，
  // 在真正渲染的最后一刻按 CLIENT_BASE_PATH（默认 /）覆盖，避免与平台中间件的
  // 注册顺序竞争；平台环境（带平台 Host 头）保持原行为不变。
  app.use((req: Request, res: Response, next: () => void) => {
    const isPlatformHost =
      req.headers['x-miaoda-tenant-host'] !== undefined ||
      req.headers['x-miaoda-custom-host'] !== undefined;
    if (!isPlatformHost) {
      const base = process.env.CLIENT_BASE_PATH || '/';
      const originalRender = res.render.bind(res);
      res.render = ((view: string, options?: unknown, callback?: unknown) => {
        res.locals.basename = base;
        const platformData = (req as unknown as { __platform_data__?: { basename?: string } })
          .__platform_data__;
        if (platformData) platformData.basename = base;
        return (originalRender as (v: string, o?: unknown, c?: unknown) => unknown)(
          view,
          options,
          callback,
        );
      }) as Response['render'];
    }
    next();
  });

  // 自建部署：平台静态中间件默认跳过 hashed 产物（assets/ 设计上走 CDN），
  // 无 CDN 时补同源静态服务，否则 JS/CSS 会被 SPA 回退成 HTML，前端白屏。
  // index:false 关键：根路径不直出静态 index.html，仍交给 hbs 渲染注入平台变量。
  app.use(expressStatic(join(process.cwd(), 'dist/client'), { index: false }));

  const logger = new Logger('Bootstrap');
  const host = process.env.SERVER_HOST || 'localhost';
  const port = Number(process.env.SERVER_PORT || '3000');

  // 注册视图引擎, 渲染 client 目录下的 html 文件
  app.setBaseViewsDir(join(process.cwd(), 'dist/client'));
  app.setViewEngine('html');
  app.engine('html', hbsExpressEngine);

  await app.listen(port, host);
  logger.log(`Server running on ${host}:${port}`);
  logger.log(`API endpoints ready at http://${host}:${port}/api`);
}

bootstrap();

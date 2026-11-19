import { Module } from '@nestjs/common';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import { ReviewOpenApiController } from './review.openapi.controller';
import { AuthModule } from '../auth/auth.module';
import { ReviewConfigModule } from './review-config/review-config.module';

@Module({
  imports: [AuthModule, ReviewConfigModule],
  controllers: [ReviewController, ReviewOpenApiController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { ReviewConfigService } from './review-config.service';
import { ReviewConfigController } from './review-config.controller';

@Module({
  imports: [AuthModule],
  controllers: [ReviewConfigController],
  providers: [ReviewConfigService],
  exports: [ReviewConfigService],
})
export class ReviewConfigModule {}

import { Module } from '@nestjs/common';
import { DynamicAdjustmentsService } from './dynamic-adjustments.service';
import { DynamicAdjustmentsController } from './dynamic-adjustments.controller';
import { ApiIntegrationsModule } from '../api-integrations/api-integrations.module';
import { EnvConfigModule } from '../envConfig/envConfig.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [ApiIntegrationsModule, EnvConfigModule, AnalyticsModule],
  controllers: [DynamicAdjustmentsController],
  providers: [DynamicAdjustmentsService],
  exports: [DynamicAdjustmentsService],
})
export class DynamicAdjustmentsModule {} 
import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { ApiIntegrationsModule } from '../api-integrations/api-integrations.module';
import { EnvConfigModule } from '../envConfig/envConfig.module';

@Module({
  imports: [ApiIntegrationsModule, EnvConfigModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService]
})
export class AnalyticsModule {} 
import { Module } from '@nestjs/common';
import { ManageTweetService } from './manage-tweet.service';
import { ManageTweetController } from './manage-tweet.controller';
import { ApiIntegrationsModule } from '../api-integrations/api-integrations.module';
import { EnvConfigModule } from '../envConfig/envConfig.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [ApiIntegrationsModule, EnvConfigModule, AnalyticsModule],
  controllers: [ManageTweetController],
  providers: [ManageTweetService],
})
export class ManageTweetModule {}

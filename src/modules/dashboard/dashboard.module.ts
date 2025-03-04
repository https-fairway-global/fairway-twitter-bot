import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { DynamicAdjustmentsModule } from '../dynamic-adjustments/dynamic-adjustments.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    AnalyticsModule,
    DynamicAdjustmentsModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', '..', 'public'),
      serveRoot: '/',
      exclude: ['/api*'],
    }),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {} 
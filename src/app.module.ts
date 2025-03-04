import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ApiIntegrationsModule } from './modules/api-integrations/api-integrations.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ManageTweetModule } from './modules/manage-tweet/manage-tweet.module';
import { MailerModule } from './modules/mailer/mailer.module';
import { UserInteractionsModule } from './modules/user-interactions/user-interactions.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { DynamicAdjustmentsModule } from './modules/dynamic-adjustments/dynamic-adjustments.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ApiIntegrationsModule,
    ManageTweetModule,
    MailerModule,
    UserInteractionsModule,
    AnalyticsModule,
    DynamicAdjustmentsModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

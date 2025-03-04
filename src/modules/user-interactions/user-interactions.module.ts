import { Module } from '@nestjs/common';
import { UserInteractionsService } from './user-interactions.service';
import { UserInteractionsController } from './user-interactions.controller';
import { ApiIntegrationsModule } from '../api-integrations/api-integrations.module';
import { EnvConfigModule } from '../envConfig/envConfig.module';
import { OpenAiService } from '../api-integrations/openAi.service';

@Module({
  imports: [ApiIntegrationsModule, EnvConfigModule],
  controllers: [UserInteractionsController],
  providers: [UserInteractionsService],
  exports: [UserInteractionsService],
})
export class UserInteractionsModule {} 
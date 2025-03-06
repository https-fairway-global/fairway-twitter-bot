import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TwitterApiService } from './twitterApi.service';
import { OpenAiService } from './openAi.service';
import { EnvConfigModule } from '../envConfig/envConfig.module';
import { RunwareService } from './runware.service';
import { ApiIntegrationsController } from './api-integrations.controller';
import { LocalImageService } from './local-image.service';

@Module({
  imports: [HttpModule, EnvConfigModule],
  controllers: [ApiIntegrationsController],
  providers: [TwitterApiService, OpenAiService, RunwareService, LocalImageService],
  exports: [TwitterApiService, OpenAiService, RunwareService, LocalImageService],
})
export class ApiIntegrationsModule {}

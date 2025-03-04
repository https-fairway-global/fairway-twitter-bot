import { Controller, Get } from '@nestjs/common';
import { UserInteractionsService } from './user-interactions.service';

@Controller('user-interactions')
export class UserInteractionsController {
  constructor(private readonly userInteractionsService: UserInteractionsService) {}

  @Get('check-mentions')
  async triggerMentionCheck() {
    await this.userInteractionsService.checkAndRespondToMentions();
    return { message: 'Mention check triggered successfully' };
  }

  @Get('check-dms')
  async triggerDmCheck() {
    await this.userInteractionsService.checkAndProcessDirectMessages();
    return { message: 'Direct message check triggered successfully' };
  }
} 
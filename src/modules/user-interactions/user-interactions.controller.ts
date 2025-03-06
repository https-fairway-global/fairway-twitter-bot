import { Controller, Get } from '@nestjs/common';
import { UserInteractionsService } from './user-interactions.service';

@Controller('api/user-interactions')
export class UserInteractionsController {
  constructor(private readonly userInteractionsService: UserInteractionsService) {}

  @Get('check-mentions')
  async checkMentions() {
    await this.userInteractionsService.checkAndRespondToMentions();
    return { 
      success: true,
      message: 'Mention check triggered successfully' 
    };
  }

  @Get('check-dms')
  async checkDirectMessages() {
    await this.userInteractionsService.checkAndProcessDirectMessages();
    return { 
      success: true,
      message: 'Direct message check triggered successfully' 
    };
  }
} 
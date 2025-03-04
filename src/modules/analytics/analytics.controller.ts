import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('performance-by-topic')
  getPerformanceByTopic() {
    return this.analyticsService.getPerformanceByTopic();
  }

  @Get('recent-tweets')
  getRecentTweets(@Query('limit', ParseIntPipe) limit: number = 10) {
    return this.analyticsService.getRecentTweetMetrics(limit);
  }

  @Get('top-performing')
  getTopPerforming(@Query('limit', ParseIntPipe) limit: number = 5) {
    return this.analyticsService.getTopPerformingTweets(limit);
  }

  @Get('best-posting-times')
  getBestPostingTimes() {
    return this.analyticsService.getBestPostingTimes();
  }

  @Get('trigger-collection')
  async triggerMetricsCollection() {
    await this.analyticsService.collectMetrics();
    return { message: 'Metrics collection triggered successfully' };
  }
} 
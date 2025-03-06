import { Controller, Get, Post, Param, ParseIntPipe, Query, Logger } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('api/analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);
  
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

  @Post('collect')
  async collectMetrics() {
    try {
      this.logger.log('Manually triggering metrics collection...');
      await this.analyticsService.forceCollectWithBackoff();
      this.logger.log('Metrics collection process completed');
      return { 
        success: true,
        message: 'Metrics collection initiated successfully' 
      };
    } catch (error) {
      this.logger.error(`Metrics collection failed: ${error.message}`);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  @Post('collect-with-backoff')
  async collectMetricsWithBackoff() {
    try {
      this.logger.log('Manually triggering metrics collection with backoff handling...');
      await this.analyticsService.forceCollectWithBackoff();
      this.logger.log('Metrics collection with backoff completed successfully');
      return { 
        success: true, 
        message: 'Metrics collection with backoff completed successfully' 
      };
    } catch (error) {
      this.logger.error(`Metrics collection with backoff failed: ${error.message}`);
      return { 
        success: false, 
        error: error.message,
        message: 'Metrics collection failed - see logs for details'
      };
    }
  }
} 
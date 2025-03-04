import { Injectable } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { DynamicAdjustmentsService } from '../dynamic-adjustments/dynamic-adjustments.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly dynamicAdjustmentsService: DynamicAdjustmentsService,
  ) {}

  async getDashboardData() {
    // Get data from different services for the dashboard
    const topicPerformance = this.analyticsService.getPerformanceByTopic();
    const recentTweets = this.analyticsService.getRecentTweetMetrics(10);
    const topTweets = this.analyticsService.getTopPerformingTweets(5);
    const bestPostingTimes = this.analyticsService.getBestPostingTimes();
    const schedules = this.dynamicAdjustmentsService.getSchedules();
    
    // Calculate summary statistics
    const totalTweets = recentTweets.length;
    const totalEngagements = recentTweets.reduce((sum, tweet) => 
      sum + tweet.likes + tweet.retweets + tweet.replies, 0);
    const avgEngagementRate = recentTweets.reduce((sum, tweet) => 
      sum + tweet.engagement_rate, 0) / (totalTweets || 1);
    
    // Get best performing topic
    let bestTopic = 'N/A';
    let bestTopicEngagement = 0;
    
    for (const topic of topicPerformance) {
      if (topic.avgEngagement > bestTopicEngagement) {
        bestTopicEngagement = topic.avgEngagement;
        bestTopic = topic.topic;
      }
    }
    
    return {
      summary: {
        totalTweets,
        totalEngagements,
        avgEngagementRate,
        bestTopic,
      },
      topicPerformance,
      recentTweets,
      topTweets,
      bestPostingTimes,
      schedules,
    };
  }
} 
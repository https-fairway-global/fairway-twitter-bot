import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TwitterApiService } from '../api-integrations/twitterApi.service';
import { EnvConfigService } from '../envConfig/envConfig.service';
import * as fs from 'fs';
import * as path from 'path';

type TweetMetrics = {
  tweetId: string;
  text: string;
  topic: string;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  timestamp: string;
  engagement_rate: number;
};

type PerformanceByTopic = {
  topic: string;
  avgEngagement: number;
  totalTweets: number;
  totalImpressions: number;
  totalLikes: number;
  totalRetweets: number;
  totalReplies: number;
  bestTime: string;
};

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private tweetsData: TweetMetrics[] = [];
  private readonly dataFilePath: string;
  
  constructor(
    private readonly twitterApiService: TwitterApiService,
    private readonly envConfigService: EnvConfigService,
  ) {
    // Create a data directory if it doesn't exist
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir);
    }
    
    this.dataFilePath = path.join(dataDir, 'tweet_metrics.json');
    this.loadTweetsData();
    this.logger.log('AnalyticsService initialized');
  }

  private loadTweetsData() {
    try {
      if (fs.existsSync(this.dataFilePath)) {
        const data = fs.readFileSync(this.dataFilePath, 'utf-8');
        this.tweetsData = JSON.parse(data);
        this.logger.log(`Loaded ${this.tweetsData.length} tweet records from storage`);
      } else {
        this.tweetsData = [];
        this.logger.log('No existing data found, starting with empty dataset');
      }
    } catch (error) {
      this.logger.error(`Error loading tweets data: ${error.message}`);
      this.tweetsData = [];
    }
  }

  private saveTweetsData() {
    try {
      fs.writeFileSync(this.dataFilePath, JSON.stringify(this.tweetsData, null, 2));
      this.logger.log(`Saved ${this.tweetsData.length} tweet records to storage`);
    } catch (error) {
      this.logger.error(`Error saving tweets data: ${error.message}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async collectMetrics() {
    this.logger.log('Collecting tweet metrics...');
    
    // Check if we've already collected metrics in the last 24 hours
    const lastCollection = this._lastMetricsCollection || 0;
    const now = Date.now();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    
    if (now - lastCollection < twentyFourHoursMs) {
      this.logger.log(`Skipping metrics collection - last collection was ${Math.round((now - lastCollection) / (60 * 60 * 1000))} hours ago`);
      return;
    }
    
    try {
      // Get user's recent tweets with exponential backoff
      await this._collectMetricsWithBackoff();
      this._lastMetricsCollection = now;
    } catch (error) {
      this.logger.error(`Error collecting metrics: ${error.message}`);
    }
  }
  
  // New property to track last collection time
  private _lastMetricsCollection: number = 0;
  // Track backoff attempts
  private _backoffAttempts: number = 0;
  // Maximum backoff delay (5 minutes)
  private readonly _maxBackoffDelayMs: number = 5 * 60 * 1000;
  
  // Helper method to implement exponential backoff
  private async _collectMetricsWithBackoff(delay: number = 1000): Promise<void> {
    try {
      // Get user's recent tweets (last 7 days instead of 1 to reduce frequency)
      const twitterClientV2 = this.twitterApiService.getTwitterClientV2();
      const me = await twitterClientV2.me();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const tweets = await twitterClientV2.userTimeline(me.data.id, {
        start_time: sevenDaysAgo.toISOString(),
        "tweet.fields": ["created_at", "public_metrics", "text"],
        max_results: 50, // Reduce from 100 to 50 to help with rate limits
      });
      
      if (!tweets.data?.data) {
        this.logger.log('No recent tweets found to collect metrics for');
        return;
      }
      
      this._backoffAttempts = 0; // Reset attempts on success
      
      let processedCount = 0;
      for (const tweet of tweets.data.data) {
        // Skip if we already have metrics for this tweet
        if (this.tweetsData.some(t => t.tweetId === tweet.id)) {
          continue;
        }
        
        const metrics = tweet.public_metrics;
        if (!metrics) continue;
        
        // Determine topic from tweet content
        let topic = 'Unknown';
        for (const possibleTopic of ['Backend Engineering', 'Database Administration', 'SQL', 'API Security', 'Data Structures', 'Algorithms']) {
          if (tweet.text.includes(possibleTopic)) {
            topic = possibleTopic;
            break;
          }
        }
        
        // Calculate engagement rate
        const impressions = metrics.impression_count || 0;
        const engagements = (metrics.like_count || 0) + (metrics.reply_count || 0) + (metrics.retweet_count || 0) + (metrics.quote_count || 0);
        const engagementRate = impressions > 0 ? (engagements / impressions) * 100 : 0;
        
        // Add to our dataset
        this.tweetsData.push({
          tweetId: tweet.id,
          text: tweet.text,
          topic,
          impressions: metrics.impression_count || 0,
          likes: metrics.like_count || 0,
          retweets: metrics.retweet_count || 0,
          replies: metrics.reply_count || 0,
          timestamp: tweet.created_at || new Date().toISOString(),
          engagement_rate: engagementRate,
        });
        
        processedCount++;
      }
      
      // Save the updated data
      this.saveTweetsData();
      this.logger.log(`Successfully collected metrics for ${processedCount} new tweets`);
      
    } catch (error) {
      // Check if this is a rate limit error
      if (error.message.includes('429') || error.message.includes('rate limit') || error.message.includes('Too Many Requests')) {
        this._backoffAttempts++;
        
        // Calculate backoff delay with exponential increase and jitter
        const jitter = Math.random() * 0.3 + 0.85; // Random factor between 0.85 and 1.15
        let backoffDelay = Math.min(delay * 2 * jitter, this._maxBackoffDelayMs);
        
        // If we've retried too many times, give up for now
        if (this._backoffAttempts > 5) {
          this.logger.warn(`Rate limit persists after ${this._backoffAttempts} attempts, giving up for now.`);
          throw new Error(`Rate limit exceeded after ${this._backoffAttempts} attempts`);
        }
        
        this.logger.log(`Rate limit encountered, backing off for ${Math.round(backoffDelay / 1000)} seconds (attempt ${this._backoffAttempts})`);
        
        // Wait for the backoff period then retry
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        return this._collectMetricsWithBackoff(backoffDelay);
      }
      
      // If it's another error, just rethrow
      throw error;
    }
  }

  /**
   * Force collection of metrics with backoff, can be called manually via API
   * @returns Promise that resolves when collection is complete
   */
  async forceCollectWithBackoff(): Promise<void> {
    this.logger.log('Manually triggered metrics collection with backoff...');
    return this._collectMetricsWithBackoff();
  }

  getPerformanceByTopic(): PerformanceByTopic[] {
    const topicStats = new Map<string, PerformanceByTopic>();
    
    for (const tweet of this.tweetsData) {
      if (!topicStats.has(tweet.topic)) {
        topicStats.set(tweet.topic, {
          topic: tweet.topic,
          avgEngagement: 0,
          totalTweets: 0,
          totalImpressions: 0,
          totalLikes: 0,
          totalRetweets: 0,
          totalReplies: 0,
          bestTime: '',
        });
      }
      
      const stats = topicStats.get(tweet.topic);
      stats.totalTweets += 1;
      stats.totalImpressions += tweet.impressions;
      stats.totalLikes += tweet.likes;
      stats.totalRetweets += tweet.retweets;
      stats.totalReplies += tweet.replies;
      
      // Update best time if this tweet has better engagement
      if (!stats.bestTime || tweet.engagement_rate > stats.avgEngagement) {
        const tweetTime = new Date(tweet.timestamp);
        stats.bestTime = `${tweetTime.getHours()}:00`;
      }
    }
    
    // Calculate average engagement for each topic
    for (const stats of topicStats.values()) {
      if (stats.totalTweets > 0) {
        stats.avgEngagement = (stats.totalLikes + stats.totalRetweets + stats.totalReplies) / stats.totalTweets;
      }
    }
    
    return Array.from(topicStats.values());
  }

  getRecentTweetMetrics(limit: number = 10): TweetMetrics[] {
    return [...this.tweetsData]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  getTopPerformingTweets(limit: number = 5): TweetMetrics[] {
    return [...this.tweetsData]
      .sort((a, b) => b.engagement_rate - a.engagement_rate)
      .slice(0, limit);
  }

  getBestPostingTimes(): { hour: number; engagementRate: number }[] {
    const hourlyStats = new Map<number, { count: number; totalEngagement: number }>();
    
    for (const tweet of this.tweetsData) {
      const hour = new Date(tweet.timestamp).getHours();
      
      if (!hourlyStats.has(hour)) {
        hourlyStats.set(hour, { count: 0, totalEngagement: 0 });
      }
      
      const stats = hourlyStats.get(hour);
      stats.count += 1;
      stats.totalEngagement += tweet.engagement_rate;
    }
    
    const result = [];
    for (const [hour, stats] of hourlyStats.entries()) {
      if (stats.count > 0) {
        result.push({
          hour,
          engagementRate: stats.totalEngagement / stats.count,
        });
      }
    }
    
    return result.sort((a, b) => b.engagementRate - a.engagementRate);
  }

  /**
   * Collect metrics for specific data point (can be called manually)
   * @param data The data to collect metrics for
   */
  collectMetricsForEvent(data: any): void {
    try {
      this.logger.log(`Collecting manual metrics: ${JSON.stringify(data)}`);
      // Implementation would go here - for now just log
    } catch (error) {
      this.logger.error(`Error collecting manual metrics: ${error.message}`);
    }
  }
  
  /**
   * Get current analytics data
   */
  getAnalytics(): any {
    return {
      tweets: this.tweetsData.length,
      impressions: this.tweetsData.reduce((total, tweet) => total + tweet.impressions, 0),
      engagement: this.tweetsData.reduce((total, tweet) => total + tweet.engagement_rate, 0),
      followers: 0
    };
  }
} 
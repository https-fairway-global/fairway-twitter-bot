import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import {
  SendTweetV2Params,
  TweetV2PostTweetResult,
  TwitterApi,
  TwitterApiReadWrite,
  TweetV2,
  DirectMessageCreateV1,
} from 'twitter-api-v2';
import { EnvConfigService } from '../envConfig/envConfig.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TwitterApiService {
  private readonly baseUrl: string;
  private readonly authCredentials: string;
  protected twitterClient: TwitterApiReadWrite;
  private readonly logger = new Logger(TwitterApiService.name);
  
  // Rate limiting settings - updated for Free Tier
  private rateLimits = {
    mentions: { windowMs: 24 * 60 * 60 * 1000, maxRequests: 1, current: 0, resetTime: Date.now() },
    tweets: { windowMs: 24 * 60 * 60 * 1000, maxRequests: 15, current: 0, resetTime: Date.now() },
    userLookup: { windowMs: 24 * 60 * 60 * 1000, maxRequests: 3, current: 0, resetTime: Date.now() },
    search: { windowMs: 24 * 60 * 60 * 1000, maxRequests: 10, current: 0, resetTime: Date.now() },
  };
  
  // Twitter API usage tracking for persistent storage between restarts
  private usageTrackingFile: string;
  private dailyTweetCount = 0;
  private lastTweetDate: string = '';

  constructor(private readonly envConfigService: EnvConfigService) {
    this.baseUrl = envConfigService.getString('TWITTER_API_BASE_URL') || 'https://api.twitter.com';

    this.authCredentials = Buffer.from(
      `${envConfigService.getString('TWITTER_API_KEY')}:${envConfigService.getString('TWITTER_API_SECRET')}`,
    ).toString('base64');

    // Set up usage tracking
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.usageTrackingFile = path.join(dataDir, 'twitter_api_usage.json');
    this.loadUsageData();

    try {
      this.twitterClient = new TwitterApi({
        appKey: envConfigService.getString('TWITTER_API_KEY'),
        appSecret: envConfigService.getString('TWITTER_API_SECRET'),
        accessToken: envConfigService.getString('TWITTER_ACCESS_TOKEN'),
        accessSecret: envConfigService.getString('TWITTER_ACCESS_SECRET'),
      }).readWrite;
      
      // Also initialize OAuth 2.0 client credentials
      this.initializeOAuth2Client();
      
    } catch (error) {
      this.logger.error(`Error initializing Twitter client: ${error.message}`);
      // We'll initialize with a placeholder to prevent null errors, but operations will fail
      this.twitterClient = null;
    }
  }
  
  private async initializeOAuth2Client() {
    try {
      const clientId = this.envConfigService.getString('TWITTER_CLIENT_ID', '');
      const clientSecret = this.envConfigService.getString('TWITTER_CLIENT_SECRET', '');
      
      if (clientId && clientSecret) {
        this.logger.log('OAuth 2.0 credentials found. This can be used for authorization.');
        // The actual OAuth flow would be implemented here if needed
      }
    } catch (error) {
      this.logger.warn('OAuth 2.0 credentials not found or invalid.');
    }
  }
  
  private loadUsageData() {
    try {
      if (fs.existsSync(this.usageTrackingFile)) {
        const data = fs.readFileSync(this.usageTrackingFile, 'utf-8');
        const usage = JSON.parse(data);
        
        // Check if we're on a new day
        const today = new Date().toISOString().split('T')[0];
        if (usage.date === today) {
          this.dailyTweetCount = usage.tweetCount || 0;
          this.lastTweetDate = usage.date;
          this.logger.log(`Loaded Twitter API usage: ${this.dailyTweetCount} tweets on ${this.lastTweetDate}`);
        } else {
          // Reset for a new day
          this.dailyTweetCount = 0;
          this.lastTweetDate = today;
          this.saveUsageData();
          this.logger.log('New day, resetting Twitter API usage counters');
        }
      } else {
        // Initialize with zero
        this.lastTweetDate = new Date().toISOString().split('T')[0];
        this.saveUsageData();
      }
    } catch (error) {
      this.logger.error(`Error loading Twitter API usage data: ${error.message}`);
      // Initialize with sensible defaults
      this.dailyTweetCount = 0;
      this.lastTweetDate = new Date().toISOString().split('T')[0];
    }
  }
  
  private saveUsageData() {
    try {
      const usage = {
        date: this.lastTweetDate,
        tweetCount: this.dailyTweetCount
      };
      fs.writeFileSync(this.usageTrackingFile, JSON.stringify(usage, null, 2));
    } catch (error) {
      this.logger.error(`Error saving Twitter API usage data: ${error.message}`);
    }
  }

  // Rate limiter method
  private async checkRateLimit(type: 'mentions' | 'tweets' | 'userLookup' | 'search'): Promise<boolean> {
    const limit = this.rateLimits[type];
    const now = Date.now();
    
    // Reset counter if window has passed
    if (now > limit.resetTime) {
      limit.current = 0;
      limit.resetTime = now + limit.windowMs;
    }
    
    // For tweets, also check the persistent counter for the free tier
    if (type === 'tweets') {
      // Ensure we're on today's counter
      const today = new Date().toISOString().split('T')[0];
      if (this.lastTweetDate !== today) {
        this.dailyTweetCount = 0;
        this.lastTweetDate = today;
      }
      
      // Check daily tweet limit (17 per day on free tier)
      const isPremium = this.envConfigService.getBoolean('USER_ON_TWITTER_PREMIUM', false);
      const maxDailyTweets = isPremium ? 1000 : 15; // Conservative limit for free tier (15 instead of 17)
      
      if (this.dailyTweetCount >= maxDailyTweets) {
        const hoursLeft = 24 - new Date().getHours();
        this.logger.warn(`Daily tweet limit reached (${this.dailyTweetCount}/${maxDailyTweets}). Try again in ~${hoursLeft} hours.`);
        return false;
      }
    }
    
    // Check if we've hit the limit
    if (limit.current >= limit.maxRequests) {
      const waitTime = Math.ceil((limit.resetTime - now) / 1000);
      this.logger.warn(`Rate limit reached for ${type}. Try again in ${waitTime} seconds.`);
      return false;
    }
    
    // Increment counter and allow the request
    limit.current++;
    return true;
  }

  // Helper method to delay execution
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getBearerToken(): Promise<string> {
    // Prepare the request body
    const requestBody = 'grant_type=client_credentials';

    // Prepare the request config
    const requestOptions = {
      headers: {
        Authorization: `Basic ${this.authCredentials}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
    };
    try {
      // Send the request to obtain the bearer token
      const response: AxiosResponse = await axios.post(
        `${this.baseUrl}/oauth2/token`,
        requestBody,
        requestOptions,
      );
      const bearerToken: string = response.data.access_token;
      this.logger.debug('Bearer Token obtained successfully');
      return bearerToken;
    } catch (error) {
      this.logger.error(
        'Error obtaining bearer token:',
        error.response ? error.response.data : error.message,
      );
      throw error;
    }
  }

  async createTweet(
    content: SendTweetV2Params,
  ): Promise<TweetV2PostTweetResult> {
    this.checkTwitterClient();
    
    // First, check the daily tweet count
    const today = new Date().toISOString().split('T')[0];
    if (this.lastTweetDate !== today) {
      this.dailyTweetCount = 0;
      this.lastTweetDate = today;
    }
    
    const isPremium = this.envConfigService.getBoolean('USER_ON_TWITTER_PREMIUM', false);
    const maxDailyTweets = isPremium ? 1000 : 15; // Conservative limit for free tier
    
    if (this.dailyTweetCount >= maxDailyTweets) {
      const hoursLeft = 24 - new Date().getHours();
      this.logger.warn(`Daily tweet limit reached (${this.dailyTweetCount}/${maxDailyTweets}). Try again in ~${hoursLeft} hours.`);
      return { data: { id: '0', text: 'RATE_LIMITED' } } as TweetV2PostTweetResult;
    }
    
    // Check rate limits
    if (!await this.checkRateLimit('tweets')) {
      // Skip the backoff for tweet creation since we need to be very conservative
      return { data: { id: '0', text: 'RATE_LIMITED' } } as TweetV2PostTweetResult;
    }
    
    try {
      const result = await this.twitterClient.v2.tweet(content);
      
      // If successful, increment and save the counter
      this.dailyTweetCount++;
      this.saveUsageData();
      this.logger.log(`Tweet created successfully. Daily count: ${this.dailyTweetCount}/${maxDailyTweets}`);
      
      return result;
    } catch (error) {
      if (error.message.includes('403')) {
        this.logger.error(`Error creating tweet (403 Forbidden): Make sure your Twitter app has write permissions enabled.`);
      } else if (error.message.includes('429')) {
        this.logger.warn(`Twitter API rate limit hit. We'll be more conservative with requests.`);
      } else {
        this.logger.error(`Error creating tweet: ${error.message}`);
      }
      throw error;
    }
  }

  async uploadMedia(file) {
    this.checkTwitterClient();
    
    // Media upload uses different rate limits, but let's be conservative
    if (!await this.checkRateLimit('tweets')) {
      const backoffTime = Math.floor(Math.random() * 30000) + 30000;
      this.logger.log(`Rate limited for media upload. Waiting ${backoffTime/1000} seconds before retrying...`);
      await this.delay(backoffTime);
      return this.uploadMedia(file);
    }
    
    try {
      return await this.twitterClient.v1.uploadMedia(file);
    } catch (error) {
      this.logger.error(`Error uploading media: ${error.message}`);
      throw error;
    }
  }

  async replyToTweet(
    content: SendTweetV2Params,
  ): Promise<TweetV2PostTweetResult> {
    // Reply uses the same endpoint as tweeting
    return this.createTweet(content);
  }

  async getMentions(sinceId?: string): Promise<TweetV2[]> {
    this.checkTwitterClient();
    
    // Check rate limits
    if (!await this.checkRateLimit('mentions')) {
      const backoffTime = Math.floor(Math.random() * 30000) + 30000;
      this.logger.log(`Rate limited for mentions. Waiting ${backoffTime/1000} seconds before retrying...`);
      await this.delay(backoffTime);
      return this.getMentions(sinceId);
    }
    
    try {
      // Get the bot's user ID
      const me = await this.twitterClient.v2.me();
      
      // Build query parameters
      const params: any = {
        "tweet.fields": ["author_id", "created_at", "text"],
        "user.fields": ["username"],
        max_results: 5, // Reduced from 10 to be more conservative with rate limits
      };
      
      if (sinceId) {
        params.since_id = sinceId;
      }
      
      // Get mentions timeline
      const mentionsTimeline = await this.twitterClient.v2.search(
        `@${me.data.username}`,
        params
      );
      
      return mentionsTimeline.data.data || [];
    } catch (error) {
      if (error.message.includes('429')) {
        // If we hit a rate limit anyway, implement backoff
        const backoffTime = Math.floor(Math.random() * 60000) + 60000; // 60-120 seconds
        this.logger.warn(`Twitter API rate limit hit. Backing off for ${backoffTime/1000} seconds.`);
        await this.delay(backoffTime);
        return this.getMentions(sinceId);
      }
      
      this.logger.error(`Error getting mentions: ${error.message}`);
      throw error;
    }
  }

  async getTweetMetrics(tweetId: string): Promise<any> {
    this.checkTwitterClient();
    
    // We'll use the userLookup limit type for metrics
    if (!await this.checkRateLimit('userLookup')) {
      const backoffTime = Math.floor(Math.random() * 30000) + 30000;
      this.logger.log(`Rate limited for tweet metrics. Waiting ${backoffTime/1000} seconds before retrying...`);
      await this.delay(backoffTime);
      return this.getTweetMetrics(tweetId);
    }
    
    try {
      const tweet = await this.twitterClient.v2.singleTweet(tweetId, {
        "tweet.fields": ["public_metrics", "non_public_metrics", "organic_metrics"],
      });
      
      return tweet.data.public_metrics;
    } catch (error) {
      if (error.message.includes('429')) {
        // If we hit a rate limit anyway, implement backoff
        const backoffTime = Math.floor(Math.random() * 60000) + 60000; // 60-120 seconds
        this.logger.warn(`Twitter API rate limit hit. Backing off for ${backoffTime/1000} seconds.`);
        await this.delay(backoffTime);
        return this.getTweetMetrics(tweetId);
      }
      
      this.logger.error(`Error getting tweet metrics: ${error.message}`);
      throw error;
    }
  }

  async getDirectMessages(): Promise<any[]> {
    this.checkTwitterClient();
    
    // DMs use a separate rate limit, but we'll use the mentions one
    if (!await this.checkRateLimit('mentions')) {
      const backoffTime = Math.floor(Math.random() * 30000) + 30000;
      this.logger.log(`Rate limited for direct messages. Waiting ${backoffTime/1000} seconds before retrying...`);
      await this.delay(backoffTime);
      return this.getDirectMessages();
    }
    
    try {
      // Note: Using a simplified implementation due to API limitations
      // The v1 API doesn't have listDirectMessages, so this is a placeholder
      // In a production app, you'd need to use the appropriate endpoint
      this.logger.log('Getting direct messages is currently not implemented');
      return [];
    } catch (error) {
      this.logger.error(`Error getting direct messages: ${error.message}`);
      throw error;
    }
  }

  async sendDirectMessage(params: DirectMessageCreateV1): Promise<any> {
    this.checkTwitterClient();
    
    // DMs use a separate rate limit, but we'll use the tweets one to be safe
    if (!await this.checkRateLimit('tweets')) {
      const backoffTime = Math.floor(Math.random() * 30000) + 30000;
      this.logger.log(`Rate limited for sending DM. Waiting ${backoffTime/1000} seconds before retrying...`);
      await this.delay(backoffTime);
      return this.sendDirectMessage(params);
    }
    
    try {
      // Simplified implementation
      this.logger.log('Sending direct message');
      // Twitter v1 API for DMs is currently not fully implemented in twitter-api-v2
      // In a production app, you'd need to implement this with the appropriate endpoint
      return { sent: true };
    } catch (error) {
      this.logger.error(`Error sending direct message: ${error.message}`);
      throw error;
    }
  }

  async deleteTweet(tweetId: string): Promise<any> {
    this.checkTwitterClient();
    
    // Deletion uses the same endpoint as tweeting
    if (!await this.checkRateLimit('tweets')) {
      const backoffTime = Math.floor(Math.random() * 30000) + 30000;
      this.logger.log(`Rate limited for tweet deletion. Waiting ${backoffTime/1000} seconds before retrying...`);
      await this.delay(backoffTime);
      return this.deleteTweet(tweetId);
    }
    
    try {
      return await this.twitterClient.v2.deleteTweet(tweetId);
    } catch (error) {
      if (error.message.includes('429')) {
        // If we hit a rate limit anyway, implement backoff
        const backoffTime = Math.floor(Math.random() * 60000) + 60000; // 60-120 seconds
        this.logger.warn(`Twitter API rate limit hit. Backing off for ${backoffTime/1000} seconds.`);
        await this.delay(backoffTime);
        return this.deleteTweet(tweetId);
      }
      
      this.logger.error(`Error deleting tweet: ${error.message}`);
      throw error;
    }
  }
  
  // Helper method to expose the v2 client to other services
  getTwitterClientV2() {
    this.checkTwitterClient();
    return this.twitterClient.v2;
  }

  // Helper method to expose the v1 client to other services
  getTwitterClientV1() {
    this.checkTwitterClient();
    return this.twitterClient.v1;
  }

  // Search for tweets containing a specific hashtag or keyword
  async searchTweets(query: string, maxResults: number = 10): Promise<any[]> {
    this.checkTwitterClient();
    
    // Check rate limits for search
    if (!await this.checkRateLimit('search')) {
      this.logger.warn('Rate limit reached for tweet search. Try again later.');
      return [];
    }
    
    try {
      // Add a 'recent' parameter to only search recent tweets (last 7 days)
      const result = await this.twitterClient.v2.search({
        query,
        max_results: maxResults,
        "tweet.fields": ['created_at', 'public_metrics', 'conversation_id', 'author_id'],
        "user.fields": ['username'],
        "expansions": ['author_id']
      });
      
      // Process results to include author username
      const tweets = result.data.data || [];
      const users = result.data.includes?.users || [];
      
      // Create a map of user IDs to usernames
      const userMap = {};
      users.forEach(user => {
        userMap[user.id] = user.username;
      });
      
      // Add username to tweets
      const processedTweets = tweets.map(tweet => {
        return {
          ...tweet,
          author_username: userMap[tweet.author_id] || 'unknown'
        };
      });
      
      this.logger.log(`Found ${processedTweets.length} tweets matching "${query}"`);
      return processedTweets;
    } catch (error) {
      if (error.message.includes('429')) {
        this.logger.warn('Twitter search API rate limit exceeded. Try again later.');
      } else {
        this.logger.error(`Error searching tweets: ${error.message}`);
      }
      return [];
    }
  }

  // Ensure Twitter client is initialized
  private checkTwitterClient() {
    if (!this.twitterClient) {
      throw new Error('Twitter client not initialized. Check your API credentials.');
    }
  }
}

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

// Define interface for follow criteria
interface FollowCriteria {
  minFollowers?: number;
  maxFollowers?: number;
  minFollowing?: number;
  maxFollowing?: number;
  minTweets?: number; 
  mustBeVerified?: boolean;
  mustHavePicture?: boolean;
  mustHaveBio?: boolean;
  bioMustContain?: string[];
  accountMinAgeInDays?: number;
}

@Injectable()
export class TwitterApiService {
  private readonly baseUrl: string;
  private readonly authCredentials: string;
  protected twitterClient: TwitterApiReadWrite;
  private readonly logger = new Logger(TwitterApiService.name);
  
  // Rate limiting settings - updated for Free Tier
  private rateLimits = {
    mentions: { windowMs: 24 * 60 * 60 * 1000, maxRequests: 180, current: 0, resetTime: Date.now() },
    tweets: { windowMs: 24 * 60 * 60 * 1000, maxRequests: 200, current: 0, resetTime: Date.now() },
    userLookup: { windowMs: 24 * 60 * 60 * 1000, maxRequests: 3, current: 0, resetTime: Date.now() },
    search: { windowMs: 24 * 60 * 60 * 1000, maxRequests: 10, current: 0, resetTime: Date.now() },
    userActions: { windowMs: 15 * 60 * 1000, maxRequests: 50, current: 0, resetTime: Date.now() },
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
  private async checkRateLimit(type: 'mentions' | 'tweets' | 'userLookup' | 'search' | 'userActions'): Promise<boolean> {
    const limit = this.rateLimits[type];
    const now = Date.now();
    
    // Check if the window has reset
    if (now - limit.resetTime >= limit.windowMs) {
      limit.current = 0;
      limit.resetTime = now;
      this.logger.debug(`Rate limit window reset for ${type}`);
    }
    
    // Check if we're at the limit
    if (limit.current >= limit.maxRequests) {
      const timeToReset = limit.windowMs - (now - limit.resetTime);
      const minutesToReset = Math.ceil(timeToReset / (60 * 1000));
      this.logger.warn(`Rate limit reached for ${type}. Reset in ~${minutesToReset} minutes`);
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

  async followUser(userId: string): Promise<any> {
    if (!this.checkTwitterClient()) {
      return { success: false, message: 'Twitter client not initialized' };
    }
    
    this.logger.log(`Attempting to follow user with ID: ${userId}`);
    
    try {
      // Check rate limit before proceeding
      const canProceed = await this.checkRateLimit('userActions');
      if (!canProceed) {
        this.logger.warn('Rate limit reached for user actions, skipping follow');
        return { success: false, message: 'Rate limit reached' };
      }
      
      // Get the authenticated user's ID from env var if not provided
      const authenticatedUserId = this.envConfigService.get('TWITTER_USER_ID');
      if (!authenticatedUserId) {
        this.logger.error('Twitter user ID not configured. Cannot follow user.');
        return { success: false, message: 'Twitter user ID not configured' };
      }
      
      // The authenticated user is following the specified user
      const result = await this.twitterClient.v2.follow(
        authenticatedUserId,
        userId
      );
      
      if (result.errors && result.errors.length > 0) {
        this.logger.error(`Error following user: ${JSON.stringify(result.errors)}`);
        return { success: false, errors: result.errors };
      }
      
      this.logger.log(`Successfully followed user: ${userId}`);
      return { success: true, data: result.data };
    } catch (error) {
      // Handle rate limiting errors explicitly
      if (error.message?.includes('429') || error.code === 429) {
        this.logger.warn('Rate limited when trying to follow user. Try again later.');
        return { success: false, message: 'Rate limited by Twitter API. Try again later.' };
      }
      
      this.logger.error(`Error following user: ${error.message}`, error.stack);
      return { success: false, message: error.message };
    }
  }

  async findUsersToFollow(
    query: string, 
    count: number = 5, 
    criteria: FollowCriteria = {}
  ): Promise<any[]> {
    if (!this.checkTwitterClient()) {
      this.logger.warn('Cannot find users to follow: Twitter client not initialized');
      return [];
    }
    
    this.logger.log(`Searching for users to follow with query: ${query}`);
    
    try {
      // Check rate limit before proceeding
      const canProceed = await this.checkRateLimit('search');
      if (!canProceed) {
        this.logger.warn('Rate limit reached for search, skipping user search');
        return [];
      }
      
      // Search for tweets based on the query
      const result = await this.twitterClient.v2.search({
        query,
        max_results: Math.min(count * 5, 100), // Get more results than needed for filtering
        "tweet.fields": ['created_at', 'author_id'],
        "user.fields": ['description', 'public_metrics', 'verified', 'profile_image_url', 'created_at'],
        "expansions": ['author_id']
      });
      
      // Extract tweets and users
      const tweets = result.data?.data || [];
      const users = result.data?.includes?.users || [];
      
      if (tweets.length === 0) {
        this.logger.log(`No tweets found for query: ${query}`);
        return [];
      }
      
      // Filter users based on criteria
      const filteredUsers = users.filter(user => {
        // Skip if user has no metrics
        if (!user.public_metrics) return false;
        
        // Check follower count
        if (criteria.minFollowers && user.public_metrics.followers_count < criteria.minFollowers) return false;
        if (criteria.maxFollowers && user.public_metrics.followers_count > criteria.maxFollowers) return false;
        
        // Check following count
        if (criteria.minFollowing && user.public_metrics.following_count < criteria.minFollowing) return false;
        if (criteria.maxFollowing && user.public_metrics.following_count > criteria.maxFollowing) return false;
        
        // Check tweet count
        if (criteria.minTweets && user.public_metrics.tweet_count < criteria.minTweets) return false;
        
        // Check verification status
        if (criteria.mustBeVerified && !user.verified) return false;
        
        // Check if profile has a picture (non-default)
        if (criteria.mustHavePicture && (!user.profile_image_url || user.profile_image_url.includes('default_profile'))) return false;
        
        // Check if user has a bio
        if (criteria.mustHaveBio && (!user.description || user.description.trim() === '')) return false;
        
        // Check if bio contains required keywords
        if (criteria.bioMustContain && criteria.bioMustContain.length > 0 && user.description) {
          const bioLower = user.description.toLowerCase();
          const containsKeyword = criteria.bioMustContain.some(keyword => 
            bioLower.includes(keyword.toLowerCase())
          );
          if (!containsKeyword) return false;
        }
        
        // Check account age
        if (criteria.accountMinAgeInDays && user.created_at) {
          const accountCreationDate = new Date(user.created_at);
          const ageInDays = (Date.now() - accountCreationDate.getTime()) / (1000 * 60 * 60 * 24);
          if (ageInDays < criteria.accountMinAgeInDays) return false;
        }
        
        return true;
      });
      
      this.logger.log(`Found ${filteredUsers.length} users matching criteria out of ${users.length} total`);
      
      // Sort by follower count
      const sortedUsers = filteredUsers.sort((a, b) => {
        const aFollowers = a.public_metrics?.followers_count || 0;
        const bFollowers = b.public_metrics?.followers_count || 0;
        return bFollowers - aFollowers; // Sort by most followers first
      });
      
      // Return limited number of users
      return sortedUsers.slice(0, count);
    } catch (error) {
      // Handle rate limiting errors explicitly
      if (error.message?.includes('429') || error.code === 429) {
        this.logger.warn('Rate limited when searching for users. Try again later.');
        return [];
      }
      
      this.logger.error(`Error finding users to follow: ${error.message}`, error.stack);
      return [];
    }
  }

  async unfollowUser(userId: string): Promise<any> {
    this.checkTwitterClient();
    this.logger.log(`Attempting to unfollow user with ID: ${userId}`);
    
    try {
      // Check rate limit before proceeding
      const canProceed = await this.checkRateLimit('userActions');
      if (!canProceed) {
        this.logger.warn('Rate limit reached for user actions, skipping unfollow');
        return { success: false, message: 'Rate limit reached' };
      }
      
      // The authenticated user is unfollowing the specified user
      const result = await this.twitterClient.v2.unfollow(
        this.envConfigService.get('TWITTER_USER_ID'),
        userId
      );
      
      if (result.errors && result.errors.length > 0) {
        this.logger.error(`Error unfollowing user: ${JSON.stringify(result.errors)}`);
        return { success: false, errors: result.errors };
      }
      
      this.logger.log(`Successfully unfollowed user: ${userId}`);
      return { success: true, data: result.data };
    } catch (error) {
      this.logger.error(`Error unfollowing user: ${error.message}`, error.stack);
      return { success: false, message: error.message };
    }
  }

  async getFollowers(maxResults: number = 100): Promise<any[]> {
    this.checkTwitterClient();
    this.logger.log(`Getting followers list`);
    
    try {
      // Check rate limit before proceeding
      const canProceed = await this.checkRateLimit('userLookup');
      if (!canProceed) {
        this.logger.warn('Rate limit reached for user lookup, skipping followers fetch');
        return [];
      }
      
      const result = await this.twitterClient.v2.followers(
        this.envConfigService.get('TWITTER_USER_ID'), 
        { 
          max_results: Math.min(maxResults, 1000),
          "user.fields": ["description", "public_metrics", "verified"]
        }
      );
      
      if (!result.data) {
        this.logger.log('No followers found');
        return [];
      }
      
      this.logger.log(`Retrieved ${result.data.length} followers`);
      return result.data;
    } catch (error) {
      this.logger.error(`Error getting followers: ${error.message}`, error.stack);
      return [];
    }
  }

  // Ensure Twitter client is initialized
  private checkTwitterClient() {
    if (!this.twitterClient) {
      this.logger.warn('Twitter client is not initialized. Some functionality may be limited.');
      return false;
    }
    return true;
  }

  // Get a single tweet by ID
  async getTweet(tweetId: string): Promise<any> {
    this.checkTwitterClient();
    
    // Check rate limits for tweet lookup
    if (!await this.checkRateLimit('tweets')) {
      this.logger.warn('Rate limit reached for tweet lookup. Try again later.');
      return null;
    }
    
    try {
      const response = await this.twitterClient.v2.singleTweet(tweetId, {
        'tweet.fields': ['author_id', 'created_at', 'public_metrics', 'text', 'conversation_id']
      });
      
      return response.data;
    } catch (error) {
      this.logger.error(`Error fetching tweet ${tweetId}: ${error.message}`);
      return null;
    }
  }

  // Method to get the authenticated user's ID
  async getMyUserId(): Promise<string> {
    try {
      // If Twitter client is not initialized, return null instead of throwing
      if (!this.twitterClient) {
        this.logger.warn('Twitter client not initialized. Cannot get user ID.');
        return null;
      }
      
      try {
        const me = await this.twitterClient.v2.me();
        this.logger.log(`My Twitter user ID: ${me.data.id}`);
        return me.data.id;
      } catch (error) {
        // Check if rate limited
        if (error.message?.includes('429') || error.code === 429) {
          this.logger.warn('Rate limited when getting user ID. Twitter API operations will resume when rate limits reset.');
          return process.env.TWITTER_USER_ID || null; // Fall back to env var if available
        }
        
        // Re-throw other errors
        throw error;
      }
    } catch (error) {
      this.logger.error(`Error getting user ID: ${error.message}`, error.stack);
      // Don't throw - return null instead to make app more resilient
      return null;
    }
  }

  // Add a helper method for checking Twitter API health
  async checkApiHealth(): Promise<{ healthy: boolean; reason?: string }> {
    try {
      if (!this.twitterClient) {
        return { healthy: false, reason: 'Twitter client not initialized' };
      }
      
      // Try a simple API call
      await this.twitterClient.v2.me();
      return { healthy: true };
    } catch (error) {
      if (error.message?.includes('429') || error.code === 429) {
        return { healthy: false, reason: 'Rate limited' };
      }
      return { healthy: false, reason: error.message };
    }
  }
}
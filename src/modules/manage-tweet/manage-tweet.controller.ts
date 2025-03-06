import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { ManageTweetService } from './manage-tweet.service';
import { TwitterApiService } from '../api-integrations/twitterApi.service';
import { CONTENT_TYPES, POST_CONTENT_RATIO } from '../../constants/content-strategy.constant';

@Controller('api/tweet')
export class ManageTweetController {
  constructor(
    private readonly manageTweetService: ManageTweetService,
    private readonly twitterApiService: TwitterApiService
  ) {}

  @Post('create')
  async createTweet(@Body() body: { type?: string }) {
    // If a specific type is requested, use that
    if (body.type) {
      let result = false;
      
      switch (body.type) {
        case 'text':
          result = await this.manageTweetService.createTextTweet();
          break;
        case 'code':
          result = await this.manageTweetService.createCodeSnippetTweet();
          break;
        case 'image':
          result = await this.manageTweetService.createImageTweet();
          break;
        case 'industry_insights':
          result = await this.manageTweetService.createIndustryInsightsTweet();
          break;
        case 'fairway_focused':
          result = await this.manageTweetService.createFairwayFocusedTweet();
          break;
        case 'engagement':
          result = await this.manageTweetService.createEngagementTweet();
          break;
        default:
          // Use the random approach for unknown types
          return this.createRandomTweet();
      }
      
      return {
        success: result,
        message: result ? `Tweet of type ${body.type} created successfully` : `Failed to create tweet of type ${body.type}`
      };
    } else {
      // No type specified, use random approach
      return this.createRandomTweet();
    }
  }
  
  // Helper method for random tweet creation
  private async createRandomTweet() {
    // Determine which type of tweet to create based on our content strategy ratios
    const random = Math.random() * 100;
    let result = false;
    let tweetType = '';
    
    // Industry insights (30%)
    if (random < POST_CONTENT_RATIO.INDUSTRY_INSIGHTS.percentage) {
      result = await this.manageTweetService.createIndustryInsightsTweet();
      tweetType = 'industry_insights';
    } 
    // Fairway focused (30%)
    else if (random < (POST_CONTENT_RATIO.INDUSTRY_INSIGHTS.percentage + POST_CONTENT_RATIO.FAIRWAY_FOCUSED.percentage)) {
      result = await this.manageTweetService.createFairwayFocusedTweet();
      tweetType = 'fairway_focused';
    } 
    // Engagement content (40%)
    else {
      // For engagement, randomly choose between text, code, image, or engagement tweet
      const engagementRandom = Math.random();
      
      if (engagementRandom < 0.25) {
        result = await this.manageTweetService.createTextTweet();
        tweetType = 'text';
      } else if (engagementRandom < 0.5) {
        result = await this.manageTweetService.createCodeSnippetTweet();
        tweetType = 'code';
      } else if (engagementRandom < 0.75) {
        result = await this.manageTweetService.createImageTweet();
        tweetType = 'image';
      } else {
        result = await this.manageTweetService.createEngagementTweet();
        tweetType = 'engagement';
      }
    }
    
    return {
      success: result,
      message: result ? `Tweet of type ${tweetType} created successfully` : `Failed to create tweet of type ${tweetType}`
    };
  }

  @Post('follow')
  async followUser(@Body() body: { userId: string }) {
    if (!body.userId) {
      return { success: false, message: 'User ID is required' };
    }
    
    const result = await this.twitterApiService.followUser(body.userId);
    return {
      success: result.success,
      message: result.success ? 'Successfully followed user' : 'Failed to follow user',
      data: result.data,
      errors: result.errors
    };
  }

  @Post('unfollow')
  async unfollowUser(@Body() body: { userId: string }) {
    if (!body.userId) {
      return { success: false, message: 'User ID is required' };
    }
    
    const result = await this.twitterApiService.unfollowUser(body.userId);
    return {
      success: result.success,
      message: result.success ? 'Successfully unfollowed user' : 'Failed to unfollow user',
      data: result.data,
      errors: result.errors
    };
  }

  @Get('find-users')
  async findUsersToFollow(
    @Query('query') query: string, 
    @Query('count') countParam: string,
    @Query('minFollowers') minFollowersParam: string,
    @Query('maxFollowers') maxFollowersParam: string,
    @Query('minFollowing') minFollowingParam: string,
    @Query('maxFollowing') maxFollowingParam: string,
    @Query('minTweets') minTweetsParam: string,
    @Query('verified') verifiedParam: string,
    @Query('hasPicture') hasPictureParam: string,
    @Query('hasBio') hasBioParam: string,
    @Query('bioKeywords') bioKeywordsParam: string,
    @Query('minAccountAge') minAccountAgeParam: string
  ) {
    if (!query) {
      return { success: false, message: 'Query is required' };
    }
    
    const count = countParam ? parseInt(countParam, 10) : 5;
    
    // Build criteria object
    const criteria: any = {};
    
    // Parse numeric criteria
    if (minFollowersParam) criteria.minFollowers = parseInt(minFollowersParam, 10);
    if (maxFollowersParam) criteria.maxFollowers = parseInt(maxFollowersParam, 10);
    if (minFollowingParam) criteria.minFollowing = parseInt(minFollowingParam, 10);
    if (maxFollowingParam) criteria.maxFollowing = parseInt(maxFollowingParam, 10);
    if (minTweetsParam) criteria.minTweets = parseInt(minTweetsParam, 10);
    if (minAccountAgeParam) criteria.accountMinAgeInDays = parseInt(minAccountAgeParam, 10);
    
    // Parse boolean criteria
    if (verifiedParam) criteria.mustBeVerified = verifiedParam.toLowerCase() === 'true';
    if (hasPictureParam) criteria.mustHavePicture = hasPictureParam.toLowerCase() === 'true';
    if (hasBioParam) criteria.mustHaveBio = hasBioParam.toLowerCase() === 'true';
    
    // Parse bio keywords
    if (bioKeywordsParam) {
      criteria.bioMustContain = bioKeywordsParam.split(',').map(k => k.trim()).filter(k => k);
    }
    
    const users = await this.twitterApiService.findUsersToFollow(query, count, criteria);
    
    return {
      success: true,
      message: `Found ${users.length} users matching the query and criteria`,
      data: users
    };
  }

  @Get('followers')
  async getFollowers(@Query('count') countParam: string) {
    const count = countParam ? parseInt(countParam, 10) : 100;
    const followers = await this.twitterApiService.getFollowers(count);
    
    return {
      success: true,
      message: `Retrieved ${followers.length} followers`,
      data: followers
    };
  }

  @Get('content-strategy')
  getContentStrategy() {
    return {
      success: true,
      message: 'Content strategy retrieved successfully',
      data: {
        contentTypes: CONTENT_TYPES,
        contentRatios: POST_CONTENT_RATIO
      }
    };
  }
  
  @Post('engage')
  async engageWithTweet(@Body() body: { tweetId: string, type?: 'fun' | 'fairway' | 'parody' }) {
    if (!body.tweetId) {
      return { success: false, message: 'Tweet ID is required' };
    }
    
    try {
      // Get the tweet to engage with
      const tweet = await this.twitterApiService.getTweet(body.tweetId);
      
      if (!tweet) {
        return { success: false, message: 'Tweet not found' };
      }
      
      // Determine engagement type
      let engagementType = body.type || 'fun';
      let prompt = '';
      
      switch (engagementType) {
        case 'fairway':
          prompt = `Generate a reply to this tweet that offers insights on why existing solutions are broken and explains how Fairway improves them. Use memes or analogies to make technical topics accessible. The tweet says: "${tweet.text}"`;
          break;
        case 'parody':
          prompt = `Generate a reply to this tweet that frames it as parody instead of taking a strong stance. Relate it to Web3 regulation, financial freedom, or bureaucracy. Stick to sarcasm & satire, never get combative. The tweet says: "${tweet.text}"`;
          break;
        case 'fun':
        default:
          prompt = `Generate a witty reply to this tweet that adds a comment, meme, or joke. Keep it organic & engaging and avoid overexplaining. The tweet says: "${tweet.text}"`;
          break;
      }
      
      // Generate the reply
      const replyContent = await this.manageTweetService.generateReply(tweet.text, engagementType);
      
      // Post the reply
      const replyResult = await this.twitterApiService.replyToTweet({
        text: replyContent,
        reply: {
          in_reply_to_tweet_id: body.tweetId
        }
      });
      
      return {
        success: true,
        message: 'Successfully engaged with tweet',
        data: {
          originalTweet: tweet,
          reply: replyContent,
          result: replyResult
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to engage with tweet: ${error.message}`,
        error: error.message
      };
    }
  }

  @Post('collect-metrics')
  async collectMetrics() {
    return this.manageTweetService.collectMetrics();
  }

  @Get('twitter-user-id')
  async getTwitterUserId() {
    try {
      const userId = await this.twitterApiService.getMyUserId();
      return {
        success: true,
        userId,
        message: 'Add this to your .env file: TWITTER_USER_ID=' + userId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TwitterApiService } from '../api-integrations/twitterApi.service';
import {
  textAndSnippetTopicPrompts,
  textOnlyTopicPrompts,
} from '../../constants/topic-prompts.constant';
import { extractCodeSnippetData, getRandomItem } from '../../commons/utils';
import { OpenAiService } from '../api-integrations/openAi.service';
import { EnvConfigService } from '../envConfig/envConfig.service';
import { RunwareService, ImageGenerationOptions } from '../api-integrations/runware.service';
import { LocalImageService, ImageCategory } from '../api-integrations/local-image.service';
import CodeSnap from 'codesnap';
import { 
  CONTENT_TYPES,
  POST_CONTENT_RATIO,
  REPLY_STRATEGY,
  POSTING_FREQUENCY,
  HARD_LIMITS
} from '../../constants/content-strategy.constant';
import { HASHTAG_CATEGORIES, TARGET_KEYWORDS, DISCUSSION_TOPICS } from '../../constants/hashtags.constant';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class ManageTweetService {
  private readonly logger = new Logger(ManageTweetService.name);
  private lastTweetType: 'text' | 'snippet' | 'image' | 'industry_insights' | 'fairway_focused' | 'engagement_content' = 'text';
  private todaysTweetCount = 0;
  private todaysReplyCount = 0;
  private lastTweetDate: string = new Date().toISOString().split('T')[0];
  private repliedToAccounts: Map<string, number> = new Map(); // Map to track accounts replied to today
  
  constructor(
    private readonly twitterApiService: TwitterApiService,
    private readonly openAiService: OpenAiService,
    private readonly envConfigService: EnvConfigService,
    private readonly runwareService: RunwareService,
    private readonly localImageService: LocalImageService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  // Runs every 3-4 hours (distributed throughout the day)
  @Cron('0 */3 * * *')  
  async scheduleTweet() {
    this.logger.debug('Scheduled Tweet Task Running...');
    
    // Check if we're on a new day
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastTweetDate) {
      this.todaysTweetCount = 0;
      this.todaysReplyCount = 0;
      this.repliedToAccounts.clear();
      this.lastTweetDate = today;
    }
    
    // Determine max tweets per day based on our content strategy
    const maxTweetsPerDay = POSTING_FREQUENCY.TWEETS_PER_DAY.MAX;
    
    // Check if we've reached our daily limit
    if (this.todaysTweetCount >= maxTweetsPerDay) {
      this.logger.log(`Daily tweet limit reached (${this.todaysTweetCount}/${maxTweetsPerDay}). No more tweets will be scheduled today.`);
      return;
    }
    
    // Content type selection based on ratios defined in strategy
    const contentSelection = this.selectContentTypeBasedOnRatio();
    let success = false;
    
    switch (contentSelection) {
      case 'industry_insights':
        success = await this.createIndustryInsightsTweet();
        if (success) {
          this.lastTweetType = 'industry_insights';
          this.todaysTweetCount++;
        } else {
          // Fallback to engagement content if insights fails
          success = await this.createEngagementTweet();
          if (success) {
            this.lastTweetType = 'engagement_content';
            this.todaysTweetCount++;
          }
        }
        break;
        
      case 'fairway_focused':
        success = await this.createFairwayFocusedTweet();
        if (success) {
          this.lastTweetType = 'fairway_focused';
          this.todaysTweetCount++;
        } else {
          // Fallback to industry insights if fairway focused fails
          success = await this.createIndustryInsightsTweet();
          if (success) {
            this.lastTweetType = 'industry_insights';
            this.todaysTweetCount++;
          }
        }
        break;
        
      case 'engagement_content':
      default:
        // For engagement content, sometimes use image tweets
        if (Math.random() > 0.5) {
          success = await this.createTweetWithImage();
          if (success) {
            this.lastTweetType = 'engagement_content';
            this.todaysTweetCount++;
          } else {
            success = await this.createEngagementTweet();
            if (success) {
              this.lastTweetType = 'engagement_content';
              this.todaysTweetCount++;
            }
          }
        } else {
          success = await this.createEngagementTweet();
          if (success) {
            this.lastTweetType = 'engagement_content';
            this.todaysTweetCount++;
          }
        }
        break;
    }
    
    this.logger.log(`Tweet posted. Daily count: ${this.todaysTweetCount}/${maxTweetsPerDay}`);
  }

  // Auto-follow and engage with targeted accounts (multiple times per day)
  @Cron('0 */4 * * *')  // Every 4 hours
  async scheduleEngagement() {
    this.logger.debug('Scheduled Engagement Task Running...');
    
    // Check if we're on a new day
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastTweetDate) {
      this.todaysReplyCount = 0;
      this.repliedToAccounts.clear();
      this.lastTweetDate = today;
    }
    
    // Check if we've reached our daily reply limit
    if (this.todaysReplyCount >= REPLY_STRATEGY.ENGAGEMENT_LIMITS.DAILY_REPLY_TARGET.MAX) {
      this.logger.log(`Daily reply limit reached (${this.todaysReplyCount}/${REPLY_STRATEGY.ENGAGEMENT_LIMITS.DAILY_REPLY_TARGET.MAX}). No more replies will be scheduled today.`);
      return;
    }
    
    // Search for tweets to engage with based on our target discussions
    try {
      // Choose a random discussion topic
      const discussionTopic = getRandomItem(Object.values(DISCUSSION_TOPICS));
      
      // Get keywords associated with this topic
      const keywords = discussionTopic.keywords;
      const searchQuery = getRandomItem(keywords);
      
      this.logger.debug(`Searching for tweets about ${discussionTopic.title} using keyword: ${searchQuery}`);
      
      // Search for tweets using the selected keyword
      const tweets = await this.twitterApiService.searchTweets(searchQuery);
      
      if (tweets.length === 0) {
        this.logger.debug(`No tweets found for keyword: ${searchQuery}`);
        return;
      }
      
      // Filter tweets to avoid replying to accounts we've already engaged with today
      const eligibleTweets = tweets.filter(tweet => 
        !this.repliedToAccounts.has(tweet.author_id) && 
        tweet.conversation_id !== undefined
      );
      
      if (eligibleTweets.length === 0) {
        this.logger.debug('No eligible tweets found after filtering already engaged accounts');
        return;
      }
      
      // Pick a random tweet to reply to
      const selectedTweet = getRandomItem(eligibleTweets);
      
      // Determine if the topic is related to Fairway's mission
      const isRelatedToFairway = discussionTopic.title.toLowerCase().includes('identity') || 
                                discussionTopic.title.toLowerCase().includes('compliance') ||
                                discussionTopic.title.toLowerCase().includes('cardano');
      
      // Determine if the topic is potentially controversial
      const isPotentiallyControversial = discussionTopic.title.toLowerCase().includes('regulation') ||
                                        discussionTopic.title.toLowerCase().includes('government');
      
      // Generate reply using OpenAI
      let replyPrompt = '';
      let replyTopic = '';
      
      if (isRelatedToFairway) {
        // Use DIRECTLY_RELATED strategy
        replyPrompt = `Generate a reply to this tweet that offers insights on why existing solutions are broken and explains how Fairway improves them. Use memes or analogies to make technical topics accessible. The tweet is about ${discussionTopic.title} and says: "${selectedTweet.text}"`;
        replyTopic = 'Tweet Engagement';
      } else if (isPotentiallyControversial) {
        // Use POLITICAL_CONTROVERSIAL strategy
        replyPrompt = `Generate a reply to this tweet that frames it as parody instead of taking a strong stance. Relate it to Web3 regulation, financial freedom, or bureaucracy. Stick to sarcasm & satire, never get combative. The tweet is about ${discussionTopic.title} and says: "${selectedTweet.text}"`;
        replyTopic = 'Tweet Engagement';
      } else {
        // Use UNRELATED_FUN strategy
        replyPrompt = `Generate a witty reply to this tweet that adds a comment, meme, or joke. Keep it organic & engaging and avoid overexplaining. The tweet is about ${discussionTopic.title} and says: "${selectedTweet.text}"`;
        replyTopic = 'Tweet Engagement';
      }
      
      const replyContent = await this.openAiService.generateResponse({
        topic: replyTopic,
        prompt: replyPrompt,
        userProfession: 'blockchain identity expert'
      });
      
      // Post the reply
      const replySuccess = await this.twitterApiService.replyToTweet({
        text: replyContent,
        reply: {
          in_reply_to_tweet_id: selectedTweet.id
        }
      });
      
      if (replySuccess) {
        // Track that we've replied to this account today
        this.repliedToAccounts.set(selectedTweet.author_id, Date.now());
        this.todaysReplyCount++;
        
        this.logger.log(`Successfully replied to tweet about "${discussionTopic.title}". Daily reply count: ${this.todaysReplyCount}/${REPLY_STRATEGY.ENGAGEMENT_LIMITS.DAILY_REPLY_TARGET.MAX}`);
      }
    } catch (error) {
      this.logger.error(`Error in scheduled engagement: ${error.message}`, error.stack);
    }
  }

  // Auto-follow related accounts daily
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async scheduleAutoFollow() {
    this.logger.debug('Scheduled Auto-Follow Task Running...');
    
    try {
      // Check if auto-follow is enabled
      const autoFollowEnabled = this.envConfigService.getBoolean('TWITTER_AUTO_FOLLOW_ENABLED', false);
      if (!autoFollowEnabled) {
        this.logger.debug('Auto-follow is disabled. Skipping.');
        return;
      }
      
      // Get keywords for auto-follow (from env var or use defaults)
      const followKeywordsConfig = this.envConfigService.get('TWITTER_FOLLOW_KEYWORDS') || 'programming,javascript,tech';
      const followKeywords = followKeywordsConfig
        .split(',')
        .map(k => k.trim())
        .filter(k => k);
      
      if (followKeywords.length === 0) {
        this.logger.warn('No follow keywords configured. Skipping auto-follow.');
        return;
      }
      
      // Build follow criteria from environment variables
      const followCriteria = {
        minFollowers: this.parseEnvNumber('TWITTER_FOLLOW_MIN_FOLLOWERS', 100),
        maxFollowers: this.parseEnvNumber('TWITTER_FOLLOW_MAX_FOLLOWERS', 100000),
        minFollowing: this.parseEnvNumber('TWITTER_FOLLOW_MIN_FOLLOWING', 10),
        maxFollowing: this.parseEnvNumber('TWITTER_FOLLOW_MAX_FOLLOWING', 5000),
        minTweets: this.parseEnvNumber('TWITTER_FOLLOW_MIN_TWEETS', 50),
        mustBeVerified: this.envConfigService.getBoolean('TWITTER_FOLLOW_MUST_BE_VERIFIED', false),
        mustHavePicture: this.envConfigService.getBoolean('TWITTER_FOLLOW_MUST_HAVE_PICTURE', true),
        mustHaveBio: this.envConfigService.getBoolean('TWITTER_FOLLOW_MUST_HAVE_BIO', true),
        accountMinAgeInDays: this.parseEnvNumber('TWITTER_FOLLOW_MIN_ACCOUNT_AGE', 30),
      };
      
      // Get bio keywords if specified
      const bioKeywordsConfig = this.envConfigService.get('TWITTER_FOLLOW_BIO_KEYWORDS');
      if (bioKeywordsConfig) {
        followCriteria['bioMustContain'] = bioKeywordsConfig
          .split(',')
          .map(k => k.trim())
          .filter(k => k);
      }
      
      // Pick a random keyword
      const keyword = getRandomItem(followKeywords);
      this.logger.log(`Searching for users to follow with keyword: ${keyword}`);
      
      // Find users to follow based on the keyword
      let maxToFollow = 2; // Default value
      try {
        const configValue = this.envConfigService.get('TWITTER_MAX_FOLLOWS_PER_DAY');
        if (configValue) {
          const parsedValue = parseInt(configValue, 10);
          if (!isNaN(parsedValue)) {
            maxToFollow = parsedValue;
          }
        }
      } catch (error) {
        this.logger.warn(`Error parsing TWITTER_MAX_FOLLOWS_PER_DAY: ${error.message}`);
      }
      
      this.logger.log(`Using follow criteria: ${JSON.stringify(followCriteria)}`);
      const usersToFollow = await this.twitterApiService.findUsersToFollow(keyword, maxToFollow * 2, followCriteria);
      
      if (usersToFollow.length === 0) {
        this.logger.warn(`No users found matching criteria for keyword: ${keyword}`);
        return;
      }
      
      // Set a maximum number of users to follow at once
      const usersToActuallyFollow = usersToFollow.slice(0, maxToFollow);
      
      // Follow each user
      let followCount = 0;
      for (const user of usersToActuallyFollow) {
        this.logger.log(`Attempting to follow user: ${user.username} (${user.id})`);
        const result = await this.twitterApiService.followUser(user.id);
        
        if (result.success) {
          followCount++;
          this.logger.log(`Successfully followed user: ${user.username}`);
          
          // Add a delay between follow requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          this.logger.warn(`Failed to follow user ${user.username}: ${JSON.stringify(result.errors || result.message)}`);
        }
      }
      
      this.logger.log(`Auto-follow complete. Followed ${followCount} out of ${usersToActuallyFollow.length} users.`);
    } catch (error) {
      this.logger.error(`Error in auto-follow task: ${error.message}`, error.stack);
    }
  }

  // Helper method to parse environment variables as numbers
  private parseEnvNumber(key: string, defaultValue: number): number {
    try {
      const value = this.envConfigService.get(key);
      if (!value) return defaultValue;
      
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? defaultValue : parsed;
    } catch (error) {
      return defaultValue;
    }
  }

  // Public methods that can be called from the controller
  async createTextTweet(): Promise<boolean> {
    return this.createTweet();
  }

  async createImageTweet(): Promise<boolean> {
    return this.createTweetWithImage();
  }

  async createCodeSnippetTweet(): Promise<boolean> {
    return this.createTweetWithCodeSnippet();
  }

  private async createTweet(): Promise<boolean> {
    this.logger.debug('Creating Text-Only Tweet...');

    // Select a topic with weighted randomization favoring important topics
    const topic = this.getWeightedRandomTopic(textOnlyTopicPrompts);

    const generatedContent = await this.openAiService.generateResponse(topic);

    // Free Twitter users can only post up to 280 character-long tweet
    if (
      !this.envConfigService.getBoolean('USER_ON_TWITTER_PREMIUM') &&
      generatedContent.length > 275
    ) {
      this.logger.warn("Content Text Longer Than User's Limit");
      return false;
    }

    try {
      const tweetResponse = await this.twitterApiService.createTweet({
        text: generatedContent,
      });
      
      if (tweetResponse.data.id === '0' && tweetResponse.data.text === 'RATE_LIMITED') {
        this.logger.warn('Tweet creation skipped due to rate limiting');
        return false;
      }
      
      this.logger.log(`Tweet created successfully: ${tweetResponse.data.id}`);
      
      // Update metrics
      if (this.analyticsService) {
        try {
          await this.analyticsService.collectMetricsForEvent({
            searchTerm: topic.topic,
            retweets: 0,
            likes: 0,
            replies: 0,
            timestamp: new Date().toISOString()
          });
        } catch (e) {
          this.logger.warn(`Failed to collect metrics: ${e.message}`);
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to create tweet: ${error.message}`);
      return false;
    }
  }

  private async createTweetWithCodeSnippet(): Promise<boolean> {
    this.logger.debug('Creating Tweet With Code Snippet...');

    // Select a topic with weighted randomization
    const topic = this.getWeightedRandomTopic(textAndSnippetTopicPrompts);

    const generatedContent = await this.openAiService.generateResponse(topic);

    const contentText = generatedContent.split('```')[0].trim();
    const snippets = extractCodeSnippetData(generatedContent);

    // Free Twitter users can only post up to 280 character-long tweet
    if (
      !this.envConfigService.getBoolean('USER_ON_TWITTER_PREMIUM') &&
      contentText.length > 275
    ) {
      this.logger.warn("Content Text Longer Than User's Limit");
      return false;
    }

    if (snippets.length > 0) {
      this.logger.debug(`Generated snippet: ${snippets[0].substring(0, 50)}...`);
      try {
        // Create code snippet image
        const codeSnap = new CodeSnap({
          theme: 'Monokai',
          backgroundColor: 'Cyan',
          numberLines: true,
        });

        await codeSnap.snap(snippets[0]);
        
        // Upload image to Twitter
        const mediaId = await this.twitterApiService.uploadMedia('codeSnapshot.png');

        this.logger.debug(`Media uploaded with ID: ${mediaId}`);

        const tweetResponse = await this.twitterApiService.createTweet({
          text: contentText,
          media: { media_ids: [mediaId] },
        });
        
        if (tweetResponse.data.id === '0' && tweetResponse.data.text === 'RATE_LIMITED') {
          this.logger.warn('Tweet with image creation skipped due to rate limiting');
          return false;
        }
        
        this.logger.log(`Tweet with image created successfully: ${tweetResponse.data.id}`);
        
        // Update metrics
        if (this.analyticsService) {
          try {
            await this.analyticsService.collectMetricsForEvent({
              searchTerm: topic.topic,
              retweets: 0,
              likes: 0,
              replies: 0,
              timestamp: new Date().toISOString()
            });
          } catch (e) {
            this.logger.warn(`Failed to collect metrics: ${e.message}`);
          }
        }
        
        return true;
      } catch (error) {
        this.logger.error(`Failed to create tweet with image: ${error.message}`);
        return false;
      }
    } else {
      this.logger.warn('No code snippets found in generated content');
      return false;
    }
  }
  
  /**
   * Creates a tweet with an AI-generated image based on a topic-related prompt
   * @returns Success status
   */
  private async createTweetWithImage(): Promise<boolean> {
    this.logger.debug('Creating tweet with image...');
    try {
      // Select a random topic for the image
      const topic = getRandomItem(Object.keys(textOnlyTopicPrompts));
      
      // Create a prompt for the image generation
      const baseTopic = textOnlyTopicPrompts[topic];
      const imagePrompt = await this.openAiService.generateResponse({
        topic: 'Image Generation',
        prompt: `Create a detailed image generation prompt for a tweet about ${baseTopic}. The prompt should be visually descriptive, professional, and appropriate for Twitter.`,
        userProfession: 'social media manager'
      });
      
      this.logger.debug(`Generated image prompt: ${imagePrompt}`);
      
      let imagePath: string;
      
      try {
        // First try to get an image from the local image service
        if (this.localImageService.getImageCount(ImageCategory.GENERAL) > 0) {
          // Use a locally stored image
          imagePath = this.localImageService.selectImageForContent(ImageCategory.GENERAL, baseTopic);
          this.logger.log(`Using locally stored image: ${imagePath}`);
        } else {
          // If no local images are available, fall back to mock image generation
          this.logger.warn('No local images available. Creating a mock image instead.');
          imagePath = this.localImageService.createMockImage(imagePrompt);
        }
      } catch (imageError) {
        // If local image selection fails, create a mock image
        this.logger.error(`Failed to get local image: ${imageError.message}`);
        this.logger.log('Creating mock image as fallback...');
        imagePath = this.localImageService.createMockImage(imagePrompt);
      }
      
      // Generate tweet text based on the topic
      const tweetText = await this.openAiService.generateResponse({
        topic: baseTopic,
        prompt: 'Write a concise, engaging tweet about this topic. Include 2-3 relevant hashtags. Keep it under 280 characters. This will be posted with an image, so focus on text that complements a visual.',
        userProfession: 'social media manager'
      });
      
      // Upload the image to Twitter
      const mediaId = await this.twitterApiService.uploadMedia(imagePath);
      
      // Post the tweet with the image
      const result = await this.twitterApiService.createTweet({
        text: tweetText,
        media: { media_ids: [mediaId] }
      });
      
      this.logger.log(`Tweet with image created successfully: ${result.data.id}`);
      this.lastTweetType = 'image';
      this.todaysTweetCount++;
      
      // Update metrics
      if (this.analyticsService) {
        try {
          await this.analyticsService.collectMetricsForEvent({
            searchTerm: topic,
            retweets: 0,
            likes: 0,
            replies: 0,
            timestamp: new Date().toISOString()
          });
        } catch (e) {
          this.logger.warn(`Failed to collect metrics: ${e.message}`);
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to create image tweet: ${error.message}`);
      return false;
    }
  }
  
  // Helper method to get weighted random topic with priority to important topics
  private getWeightedRandomTopic(topics: any[]): any {
    // Define topic weights - higher weight means more frequent selection
    const topicWeights = {
      'Identity Verification': 4,
      'Compliance & KYC': 4,
      'Web3 Hiring': 3,
      'DeFi & Payments': 3,
      'Cardano & Midnight': 5,
      'Ethiopia & Emerging Markets': 2,
      'Crypto Critique': 3,
      'Enterprise & Government Adoption': 2,
      'ZK Proofs & Privacy': 4,
      'Digital Identity Implementation': 3,
      'Smart Contracts for Identity': 3
    };
    
    // Create weighted list
    let weightedList = [];
    topics.forEach(topic => {
      const weight = topicWeights[topic.topic] || 1;
      for (let i = 0; i < weight; i++) {
        weightedList.push(topic);
      }
    });
    
    // Select random item from weighted list
    return getRandomItem(weightedList);
  }

  // Helper method to select content type based on defined ratios
  private selectContentTypeBasedOnRatio(): string {
    const random = Math.random() * 100; // Random number between 0-100
    
    let cumulativePercentage = 0;
    
    // Industry insights (30%)
    cumulativePercentage += POST_CONTENT_RATIO.INDUSTRY_INSIGHTS.percentage;
    if (random <= cumulativePercentage) {
      return 'industry_insights';
    }
    
    // Fairway focused (30%)
    cumulativePercentage += POST_CONTENT_RATIO.FAIRWAY_FOCUSED.percentage;
    if (random <= cumulativePercentage) {
      return 'fairway_focused';
    }
    
    // Engagement content (40%)
    return 'engagement_content';
  }
  
  /**
   * Creates a tweet focused on industry insights about KYC, DeFi, digital identity trends & regulations
   */
  async createIndustryInsightsTweet(): Promise<boolean> {
    this.logger.debug('Creating Industry Insights Tweet...');
    
    // Select relevant topics for industry insights
    const relevantTopics = textOnlyTopicPrompts.filter(topic => {
      const topicName = topic.topic.toLowerCase();
      return topicName.includes('identity') || 
             topicName.includes('compliance') || 
             topicName.includes('kyc') ||
             topicName.includes('defi') ||
             topicName.includes('regulation');
    });
    
    if (relevantTopics.length === 0) {
      this.logger.warn('No relevant industry topics found');
      return false;
    }
    
    // Get a weighted random topic
    const topic = this.getWeightedRandomTopic(relevantTopics);
    
    // Generate content with Glootie-style intern personality
    const prompt = `Generate an insightful tweet about ${topic.topic} as if you're a slightly panicked but knowledgeable intern at Fairway.
    
    Use the Glootie-inspired personality where you:
    1. Start with something like "Do not develop [a problematic solution]..." but then explain a better way
    2. OR use phrases like "I'm just an intern, but..." followed by surprisingly insightful analysis
    3. OR include "The mothership is coming!" when discussing regulations or compliance issues
    
    Despite your overwhelmed tone, include genuinely thoughtful perspective on current trends, challenges, or regulatory developments in ${topic.topic}.
    
    Make it slightly provocative but still professional enough that industry experts would appreciate the insight.`;
    
    const generatedContent = await this.openAiService.generateResponse({
      topic: topic.topic,
      prompt: prompt,
      userProfession: 'blockchain identity expert'
    });
    
    // Add relevant hashtags from our strategy
    const industryHashtags = this.getRelevantHashtags(topic.topic, 2);
    let tweetText = generatedContent;
    
    // Ensure text is within Twitter limits
    const hashtagSuffix = ' ' + industryHashtags.join(' ');
    if (!this.envConfigService.getBoolean('USER_ON_TWITTER_PREMIUM') && 
        (tweetText.length + hashtagSuffix.length) > 275) {
      tweetText = tweetText.substring(0, 275 - hashtagSuffix.length);
    }
    
    const finalTweetText = tweetText + hashtagSuffix;
    
    try {
      const tweetResponse = await this.twitterApiService.createTweet({
        text: finalTweetText,
      });
      
      if (tweetResponse.data.id === '0' && tweetResponse.data.text === 'RATE_LIMITED') {
        this.logger.warn('Industry insights tweet creation skipped due to rate limiting');
        return false;
      }
      
      this.logger.log(`Industry insights tweet created successfully: ${tweetResponse.data.id}`);
      this.lastTweetType = 'industry_insights';
      this.todaysTweetCount++;
      
      // Update metrics
      if (this.analyticsService) {
        try {
          await this.analyticsService.collectMetricsForEvent({
            searchTerm: topic.topic,
            retweets: 0,
            likes: 0,
            replies: 0,
            timestamp: new Date().toISOString()
          });
        } catch (e) {
          this.logger.warn(`Failed to collect metrics: ${e.message}`);
        }
      }
      
      return true;
      
    } catch (error) {
      this.logger.error(`Failed to create industry insights tweet: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Creates a tweet focused on Fairway's offerings/solutions
   * @returns Success status
   */
  public async createFairwayFocusedTweet(): Promise<boolean> {
    this.logger.debug('Creating Fairway-Focused Tweet...');
    try {
      // Get keywords specifically for Fairway-related topics
      const fairwayKeywords = TARGET_KEYWORDS.filter(keyword => 
        keyword.includes('identity') || 
        keyword.includes('verification') || 
        keyword.includes('credentials') ||
        keyword.includes('DID')
      );
      const keywordPrompt = getRandomItem(fairwayKeywords) || 'blockchain identity verification';
      
      // Generate a prompt for image creation
      const imagePrompt = `Professional visualization of Fairway's ${keywordPrompt}, showing secure digital identity systems, privacy-focused verification, corporate style, high quality, photorealistic`;
      
      let imagePath: string;
      
      try {
        // First try to get an image from the local image service
        if (this.localImageService.getImageCount(ImageCategory.FAIRWAY) > 0) {
          // Use a locally stored Fairway image
          imagePath = this.localImageService.selectImageForContent(ImageCategory.FAIRWAY, keywordPrompt);
          this.logger.log(`Using locally stored Fairway image: ${imagePath}`);
        } else {
          // If no local images are available, fall back to mock image generation
          this.logger.warn('No local Fairway images available. Creating a mock image instead.');
          imagePath = this.localImageService.createMockImage(imagePrompt);
        }
      } catch (imageError) {
        // If local image selection fails, create a mock image
        this.logger.error(`Failed to get local Fairway image: ${imageError.message}`);
        this.logger.log('Creating mock image as fallback...');
        imagePath = this.localImageService.createMockImage(imagePrompt);
      }
      
      // Generate enhanced tweet text with Glootie personality for Fairway-focused content
      const tweetText = await this.openAiService.generateResponse({
        topic: 'Fairway Technology',
        prompt: `Write a tweet highlighting Fairway's ${keywordPrompt} with a "panicked intern" Glootie-style personality. 
        Include a warning like "Do not develop..." but then explain the benefits anyway. 
        Focus on explaining how Fairway's technology is better than existing solutions for blockchain identity, enhanced security, or user privacy.
        Include 1-2 relevant hashtags. This will accompany a branded image.`,
        userProfession: 'blockchain identity expert'
      });
      
      // Get appropriate hashtags for this tweet type
      const fairwayHashtags = this.getRelevantHashtags('fairway', 2);
      
      // Upload the image to Twitter
      const mediaId = await this.twitterApiService.uploadMedia(imagePath);
      
      // Post the tweet with the image
      const result = await this.twitterApiService.createTweet({
        text: tweetText + ' ' + fairwayHashtags.join(' '),
        media: { media_ids: [mediaId] }
      });
      
      this.logger.log(`Fairway-focused tweet created successfully: ${result.data.id}`);
      this.lastTweetType = 'fairway_focused';
      this.todaysTweetCount++;
      
      // Update metrics
      if (this.analyticsService) {
        try {
          await this.analyticsService.collectMetricsForEvent({
            searchTerm: keywordPrompt,
            retweets: 0,
            likes: 0,
            replies: 0,
            timestamp: new Date().toISOString()
          });
        } catch (e) {
          this.logger.warn(`Failed to collect metrics: ${e.message}`);
        }
      }
      
      return true; // Successfully posted
    } catch (error) {
      this.logger.error(`Failed to create Fairway-focused tweet: ${error.message}`);
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        this.logger.warn('Rate limit hit for Twitter API, will try again later');
      }
      return false;
    }
  }
  
  /**
   * Creates an engagement-focused tweet with memes, jokes, & engagement-driven content
   */
  async createEngagementTweet(): Promise<boolean> {
    this.logger.debug('Creating Engagement Tweet...');
    
    // Generate witty, engaging content with Glootie personality
    const prompt = `Generate a witty, engaging tweet with a "panicked intern" Glootie-style personality.
    This should be slightly provocative or use memes that crypto and blockchain folks would enjoy.
    Occasionally include lines like "I'm just an intern" or "The mothership is coming" (when discussing regulations).
    Make it fun, slightly chaotic, but still insightful about crypto, blockchain, or digital identity.`;
    
    const generatedContent = await this.openAiService.generateResponse({
      topic: 'Tweet Engagement',
      prompt: prompt,
      userProfession: 'blockchain identity expert'
    });
    
    // Add trending or engagement hashtags
    const engagementHashtags = this.getRelevantHashtags('engagement', 1);
    let tweetText = generatedContent;
    
    // Ensure text is within Twitter limits
    const hashtagSuffix = ' ' + engagementHashtags.join(' ');
    if (!this.envConfigService.getBoolean('USER_ON_TWITTER_PREMIUM') && 
        (tweetText.length + hashtagSuffix.length) > 275) {
      tweetText = tweetText.substring(0, 275 - hashtagSuffix.length);
    }
    
    const finalTweetText = tweetText + hashtagSuffix;
    
    try {
      const tweetResponse = await this.twitterApiService.createTweet({
        text: finalTweetText,
      });
      
      if (tweetResponse.data.id === '0' && tweetResponse.data.text === 'RATE_LIMITED') {
        this.logger.warn('Engagement tweet creation skipped due to rate limiting');
        return false;
      }
      
      this.logger.log(`Engagement tweet created successfully: ${tweetResponse.data.id}`);
      this.lastTweetType = 'engagement_content';
      this.todaysTweetCount++;
      
      // Update metrics
      if (this.analyticsService) {
        try {
          await this.analyticsService.collectMetricsForEvent({
            searchTerm: 'Tweet Engagement',
            retweets: 0,
            likes: 0,
            replies: 0,
            timestamp: new Date().toISOString()
          });
        } catch (e) {
          this.logger.warn(`Failed to collect metrics: ${e.message}`);
        }
      }
      
      return true;
      
    } catch (error) {
      this.logger.error(`Failed to create engagement tweet: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get relevant hashtags based on the topic
   */
  private getRelevantHashtags(topic: string, count: number = 2): string[] {
    let relevantHashtags: string[] = [];
    const topicLower = topic.toLowerCase();
    
    // Select appropriate hashtag category based on topic
    if (topicLower.includes('identity') || topicLower.includes('verification')) {
      relevantHashtags = [...HASHTAG_CATEGORIES.CORE_BLOCKCHAIN];
    } 
    else if (topicLower.includes('compliance') || topicLower.includes('kyc')) {
      relevantHashtags = [...HASHTAG_CATEGORIES.DEFI_COMPLIANCE];
    }
    else if (topicLower.includes('defi') || topicLower.includes('payment')) {
      relevantHashtags = [...HASHTAG_CATEGORIES.DEFI_COMPLIANCE];
    }
    else if (topicLower.includes('cardano') || topicLower.includes('midnight')) {
      relevantHashtags = [...HASHTAG_CATEGORIES.CORE_BLOCKCHAIN];
    }
    else if (topicLower.includes('ethiopia') || topicLower.includes('emerging')) {
      relevantHashtags = [...HASHTAG_CATEGORIES.ETHIOPIA_MARKETS];
    }
    else if (topicLower.includes('fairway')) {
      // For Fairway-specific content, mix core blockchain and compliance hashtags
      relevantHashtags = [
        ...HASHTAG_CATEGORIES.CORE_BLOCKCHAIN,
        ...HASHTAG_CATEGORIES.DEFI_COMPLIANCE
      ];
    }
    else if (topicLower.includes('engagement')) {
      // For engagement content, use a mix of all categories
      relevantHashtags = [
        ...HASHTAG_CATEGORIES.CORE_BLOCKCHAIN,
        ...HASHTAG_CATEGORIES.DEFI_COMPLIANCE,
        ...HASHTAG_CATEGORIES.REGULATORY
      ];
    }
    else {
      // Default to core blockchain hashtags
      relevantHashtags = [...HASHTAG_CATEGORIES.CORE_BLOCKCHAIN];
    }
    
    // Shuffle and select random hashtags
    const shuffled = [...relevantHashtags].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  /**
   * Generates a reply to a tweet based on the specified engagement type
   */
  async generateReply(tweetText: string, engagementType: string): Promise<string> {
    let prompt = '';
    let replyTopic = 'Tweet Engagement';
    
    switch (engagementType) {
      case 'fairway':
        prompt = `Generate a Glootie-style intern reply to this tweet that offers insights on why existing solutions are broken and explains how Fairway improves them. Include a warning like "Do not develop my app!" or "I'm just an intern!" somewhere. The tweet says: "${tweetText}"`;
        break;
      case 'parody':
        prompt = `Generate a panicked intern reply to this tweet that frames it as parody. Use the phrase "The mothership is coming!" somewhere and relate it to crypto regulation or bureaucracy. Be chaotic but still knowledgeable. The tweet says: "${tweetText}"`;
        break;
      case 'fun':
      default:
        prompt = `Generate a reply as if you're a slightly overwhelmed AI intern. Make a joke or share an "AI intern struggle" while still being witty. Include a Glootie-style phrase like "I'm just an intern!" or "This is not how making things work works." The tweet says: "${tweetText}"`;
        break;
    }
    
    const replyContent = await this.openAiService.generateResponse({
      topic: replyTopic,
      prompt: prompt,
      userProfession: 'blockchain identity expert'
    });
    
    return replyContent;
  }

  // Add the collectMetrics method
  public async collectMetrics() {
    try {
      this.logger.log('Manually collecting metrics...');
      await this.analyticsService.forceCollectWithBackoff();
      return { success: true, message: 'Metrics collection initiated' };
    } catch (error) {
      this.logger.error(`Error collecting metrics: ${error.message}`);
      return { success: false, message: `Failed to collect metrics: ${error.message}` };
    }
  }
}

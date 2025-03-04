import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TwitterApiService } from '../api-integrations/twitterApi.service';
import { OpenAiService } from '../api-integrations/openAi.service';
import { EnvConfigService } from '../envConfig/envConfig.service';
import { replyPrompts } from '../../constants/topic-prompts.constant';

@Injectable()
export class UserInteractionsService {
  private readonly logger = new Logger(UserInteractionsService.name);
  private lastCheckedMentionId: string = null;
  private engagedAccounts: Map<string, number> = new Map(); // Track accounts we've engaged with
  private engagedThreads: Map<string, number> = new Map(); // Track threads we've engaged with
  private lastDailyReset: number = Date.now();
  private dailyEngagementCount: number = 0;
  private maxDailyEngagements: number = 50; // Maximum replies per day
  
  // Define hashtags and keywords to prioritize for engagement
  private readonly priorityHashtags: string[] = [
    '#cardano', '#midnight', '#blockchain', '#cip113', '#decentralizedid', 
    '#web3identity', '#verifiablecredentials', '#ssi', '#defi', '#deficompliance', 
    '#regtech', '#kycaml', '#ethiopia'
  ];
  
  private readonly priorityKeywords: string[] = [
    'identity verification', 'compliance', 'kyc', 'aml', 'defi', 'cardano', 
    'self-sovereign identity', 'ssi', 'verifiable credentials', 'blockchain hiring',
    'digital identity', 'credentials', 'privacy', 'zk proofs', 'zero knowledge'
  ];

  constructor(
    private readonly twitterApiService: TwitterApiService,
    private readonly openAiService: OpenAiService,
    private readonly envConfigService: EnvConfigService,
  ) {}

  @Cron('0 */6 * * *') // Check mentions every 6 hours
  async checkAndRespondToMentions() {
    this.logger.debug('Checking for new mentions...');
    
    // Reset daily counters if necessary
    this.resetDailyCountersIfNeeded();
    
    const isPremium = this.envConfigService.getBoolean('USER_ON_TWITTER_PREMIUM', false);
    if (!isPremium) {
      this.logger.log('Free tier detected. Limiting API calls to stay within rate limits.');
    }
    
    try {
      const mentions = await this.twitterApiService.getMentions(this.lastCheckedMentionId);
      
      if (!mentions || mentions.length === 0) {
        this.logger.debug('No new mentions found');
        return;
      }
      
      this.lastCheckedMentionId = mentions[0].id;
      
      // Sort mentions by priority (based on hashtags, keywords, and engagement)
      const sortedMentions = this.sortMentionsByPriority(mentions);
      
      // Process mentions, limited by our daily engagement cap
      const mentionsToProcess = isPremium ? 
        sortedMentions : 
        sortedMentions.slice(0, Math.min(2, sortedMentions.length)); // Free tier: process at most 2 mentions per check
      
      for (const mention of mentionsToProcess) {
        // Check if we've exceeded daily engagement limit
        if (this.dailyEngagementCount >= this.maxDailyEngagements) {
          this.logger.log('Daily engagement limit reached. Stopping mention processing.');
          break;
        }
        
        // Check if we've already replied to this user today
        if (this.hasReachedEngagementLimit(mention.author_id)) {
          this.logger.debug(`Already reached engagement limit for user ${mention.author_username}`);
          continue;
        }
        
        // Check if we've already replied to this thread too many times
        const threadId = mention.conversation_id || mention.id;
        if (this.hasReachedThreadEngagementLimit(threadId)) {
          this.logger.debug(`Already reached engagement limit for thread ${threadId}`);
          continue;
        }
        
        await this.processMention(mention);
        
        // Update engagement tracking
        this.trackEngagement(mention.author_id, threadId);
      }
      
    } catch (error) {
      this.logger.error(`Error checking mentions: ${error.message}`);
    }
  }
  
  private sortMentionsByPriority(mentions: any[]): any[] {
    return [...mentions].sort((a, b) => {
      const aScore = this.calculateMentionPriority(a);
      const bScore = this.calculateMentionPriority(b);
      return bScore - aScore; // Higher scores first
    });
  }
  
  private calculateMentionPriority(mention: any): number {
    let score = 0;
    const text = mention.text.toLowerCase();
    
    // Check for priority hashtags
    this.priorityHashtags.forEach(hashtag => {
      if (text.includes(hashtag.toLowerCase())) score += 5;
    });
    
    // Check for priority keywords
    this.priorityKeywords.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) score += 3;
    });
    
    // Boost for mentions with questions
    if (text.includes('?')) score += 2;
    
    // Boost for mentions with higher engagement
    score += (mention.public_metrics?.reply_count || 0) * 0.5;
    score += (mention.public_metrics?.retweet_count || 0) * 0.3;
    score += (mention.public_metrics?.like_count || 0) * 0.2;
    
    return score;
  }
  
  private hasReachedEngagementLimit(userId: string): boolean {
    return (this.engagedAccounts.get(userId) || 0) >= 1; // Max 1 reply per user per day
  }
  
  private hasReachedThreadEngagementLimit(threadId: string): boolean {
    return (this.engagedThreads.get(threadId) || 0) >= 2; // Max 2 replies per thread per day
  }
  
  private trackEngagement(userId: string, threadId: string): void {
    this.engagedAccounts.set(userId, (this.engagedAccounts.get(userId) || 0) + 1);
    this.engagedThreads.set(threadId, (this.engagedThreads.get(threadId) || 0) + 1);
    this.dailyEngagementCount++;
  }
  
  private resetDailyCountersIfNeeded(): void {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    if (now - this.lastDailyReset > oneDayMs) {
      this.logger.log('Resetting daily engagement counters');
      this.engagedAccounts.clear();
      this.engagedThreads.clear();
      this.dailyEngagementCount = 0;
      this.lastDailyReset = now;
    }
  }
  
  private async processMention(mention: any) {
    this.logger.debug(`Processing mention: ${mention.id}`);
    
    try {
      const mentionText = mention.text.replace(/@[a-zA-Z0-9_]+/g, '').trim();
      
      // Determine the appropriate response template
      let promptTemplate = replyPrompts.genericQuestion;
      const lowerText = mentionText.toLowerCase();
      
      if (this.containsIdentityTerms(lowerText)) {
        promptTemplate = replyPrompts.identityQuestion;
      } else if (this.containsComplianceTerms(lowerText)) {
        promptTemplate = replyPrompts.complianceQuestion;
      } else if (this.containsCardanoTerms(lowerText)) {
        promptTemplate = replyPrompts.cardanoQuestion;
      }
      
      // Replace placeholder with actual question
      const prompt = promptTemplate.replace('$QUESTION', mentionText);
      
      // Generate response
      const responsePrompt = {
        topic: 'User Interaction',
        userProfession: 'Blockchain Identity Specialist',
        prompt
      };
      
      const generatedResponse = await this.openAiService.generateResponse(responsePrompt);
      
      // Ensure response is under Twitter's character limit
      const finalResponse = this.formatResponseForTwitter(generatedResponse, mention.author_username);
      
      await this.twitterApiService.replyToTweet({
        text: finalResponse,
        reply: { in_reply_to_tweet_id: mention.id }
      });
      
      this.logger.debug(`Successfully replied to mention ${mention.id}`);
    } catch (error) {
      this.logger.error(`Error processing mention ${mention.id}: ${error.message}`);
    }
  }
  
  private containsIdentityTerms(text: string): boolean {
    const terms = ['identity', 'did', 'ssi', 'self-sovereign', 'verifiable', 'credential', 'verification'];
    return terms.some(term => text.includes(term));
  }
  
  private containsComplianceTerms(text: string): boolean {
    const terms = ['compliance', 'kyc', 'aml', 'regulation', 'regulatory', 'regtech', 'privacy'];
    return terms.some(term => text.includes(term));
  }
  
  private containsCardanoTerms(text: string): boolean {
    const terms = ['cardano', 'ada', 'midnight', 'cip113', 'plutus'];
    return terms.some(term => text.includes(term));
  }
  
  private formatResponseForTwitter(response: string, username: string): string {
    // Ensure the response starts with @username
    const usernameMention = `@${username} `;
    
    // Check if response already starts with the username
    if (response.startsWith(usernameMention)) {
      return response.length <= 280 ? response : response.substring(0, 277) + '...';
    } else {
      const combinedResponse = usernameMention + response;
      return combinedResponse.length <= 280 ? combinedResponse : combinedResponse.substring(0, 277) + '...';
    }
  }
  
  @Cron('0 */12 * * *') // Check DMs twice a day
  async checkAndProcessDirectMessages() {
    this.logger.debug('Checking for new direct messages...');
    
    try {
      const messages = await this.twitterApiService.getDirectMessages();
      
      if (messages && messages.length > 0) {
        this.logger.debug(`Found ${messages.length} direct messages`);
        // Process DMs here if needed in the future
      } else {
        this.logger.debug('No new direct messages found');
      }
    } catch (error) {
      this.logger.error(`Error checking direct messages: ${error.message}`);
    }
  }
  
  @Cron('0 */4 * * *') // Search for relevant topics to engage with every 4 hours
  async findAndEngageRelevantTopics() {
    this.logger.debug('Searching for relevant topics to engage with...');
    
    // Reset daily counters if needed
    this.resetDailyCountersIfNeeded();
    
    // Check if we've reached our daily engagement limit
    if (this.dailyEngagementCount >= this.maxDailyEngagements) {
      this.logger.log('Daily engagement limit reached. Skipping topic search.');
      return;
    }
    
    try {
      // Search for high-engagement tweets with our priority hashtags (rotating through the list)
      const currentHour = new Date().getHours();
      const hashtagIndex = currentHour % this.priorityHashtags.length;
      const searchHashtag = this.priorityHashtags[hashtagIndex];
      
      const searchResults = await this.twitterApiService.searchTweets(searchHashtag);
      
      if (!searchResults || searchResults.length === 0) {
        this.logger.debug(`No tweets found for hashtag ${searchHashtag}`);
        return;
      }
      
      // Sort by engagement and filter out tweets we've already replied to
      const sortedResults = this.sortTweetsByEngagement(searchResults)
        .filter(tweet => !this.hasReachedEngagementLimit(tweet.author_id));
      
      // Select top tweets to engage with (limit to 3 per search)
      const tweetsToEngage = sortedResults.slice(0, 3);
      
      for (const tweet of tweetsToEngage) {
        // Stop if we've hit our daily limit
        if (this.dailyEngagementCount >= this.maxDailyEngagements) {
          break;
        }
        
        await this.engageWithTweet(tweet);
        
        // Update engagement tracking
        this.trackEngagement(tweet.author_id, tweet.conversation_id || tweet.id);
      }
      
    } catch (error) {
      this.logger.error(`Error searching for topics: ${error.message}`);
    }
  }
  
  private sortTweetsByEngagement(tweets: any[]): any[] {
    return [...tweets].sort((a, b) => {
      const aEngagement = (a.public_metrics?.reply_count || 0) + 
                         (a.public_metrics?.retweet_count || 0) * 2 + 
                         (a.public_metrics?.like_count || 0);
                         
      const bEngagement = (b.public_metrics?.reply_count || 0) + 
                         (b.public_metrics?.retweet_count || 0) * 2 + 
                         (b.public_metrics?.like_count || 0);
                         
      return bEngagement - aEngagement; // Higher engagement first
    });
  }
  
  private async engageWithTweet(tweet: any) {
    this.logger.debug(`Engaging with tweet: ${tweet.id}`);
    
    try {
      // Determine if tweet contains our priority terms
      let responseType = 'generic';
      const tweetText = tweet.text.toLowerCase();
      
      if (this.containsIdentityTerms(tweetText)) {
        responseType = 'identity';
      } else if (this.containsComplianceTerms(tweetText)) {
        responseType = 'compliance';
      } else if (this.containsCardanoTerms(tweetText)) {
        responseType = 'cardano';
      }
      
      // Generate engagement prompt
      let engagementPrompt = {
        topic: 'Tweet Engagement',
        userProfession: 'Blockchain Identity Specialist',
        prompt: ''
      };
      
      // Determine if this should be a promotional or generic engagement (50/50 split)
      const shouldIncludeFairway = Math.random() < 0.5;
      
      if (shouldIncludeFairway) {
        // 50% chance: Include Fairway in the response
        switch (responseType) {
          case 'identity':
            engagementPrompt.prompt = `Create a witty reply to this tweet about identity: "${tweet.text}". Include @fairway_global in your response and focus on decentralized ID solutions. Keep it under 240 characters and maintain a confident, slightly provocative tone.`;
            break;
          case 'compliance':
            engagementPrompt.prompt = `Create a witty reply to this tweet about compliance: "${tweet.text}". Include @fairway_global in your response and focus on privacy-preserving solutions. Keep it under 240 characters and maintain a confident, slightly provocative tone.`;
            break;
          case 'cardano':
            engagementPrompt.prompt = `Create a witty reply to this tweet about Cardano: "${tweet.text}". Include @fairway_global in your response and focus on blockchain identity capabilities. Keep it under 240 characters and maintain a confident, slightly provocative tone.`;
            break;
          default:
            engagementPrompt.prompt = `Create a witty reply to this tweet: "${tweet.text}". If it makes sense naturally, include @fairway_global in your response. Keep it under 240 characters and maintain a confident, slightly irreverent tone.`;
        }
      } else {
        // 50% chance: Generic engagement without mentioning Fairway
        engagementPrompt.prompt = `Create a witty, insightful reply to this tweet: "${tweet.text}". DON'T mention Fairway or identity verification unless the tweet directly asks about it. Keep it under 240 characters with a confident, slightly irreverent tone. Focus on adding value to the conversation.`;
      }
      
      const generatedResponse = await this.openAiService.generateResponse(engagementPrompt);
      
      // Ensure response is under Twitter's character limit
      const finalResponse = this.formatResponseForTwitter(generatedResponse, tweet.author_username);
      
      await this.twitterApiService.replyToTweet({
        text: finalResponse,
        reply: { in_reply_to_tweet_id: tweet.id }
      });
      
      this.logger.debug(`Successfully engaged with tweet ${tweet.id}`);
    } catch (error) {
      this.logger.error(`Error engaging with tweet ${tweet.id}: ${error.message}`);
    }
  }
} 
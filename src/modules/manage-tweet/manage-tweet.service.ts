import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TwitterApiService } from '../api-integrations/twitterApi.service';
import {
  textAndSnippetTopicPrompts,
  textOnlyTopicPrompts,
} from '../../constants/topic-prompts.constant';
import { extractCodeSnippetData, getRandomItem } from '../../commons/utils';
import { OpenAiService } from '../api-integrations/openAi.service';
import { MailerService } from '../mailer/mailer.service';
import { EnvConfigService } from '../envConfig/envConfig.service';
import CodeSnap from 'codesnap';

@Injectable()
export class ManageTweetService {
  private readonly logger = new Logger(ManageTweetService.name);
  private lastTweetType: 'text' | 'snippet' = 'text';
  private todaysTweetCount = 0;
  private lastTweetDate: string = new Date().toISOString().split('T')[0];
  
  constructor(
    private readonly twitterApiService: TwitterApiService,
    private readonly openAiService: OpenAiService,
    private readonly mailerService: MailerService,
    private readonly envConfigService: EnvConfigService,
  ) {}

  @Cron('0 */2 * * *')  // Every 2 hours
  async scheduleTweet() {
    this.logger.debug('Scheduled Tweet Task Running...');
    
    // Check if we're on a new day
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastTweetDate) {
      this.todaysTweetCount = 0;
      this.lastTweetDate = today;
    }
    
    // Determine max tweets per day based on tier
    const isPremium = this.envConfigService.getBoolean('USER_ON_TWITTER_PREMIUM', false);
    const maxTweetsPerDay = isPremium ? 12 : 3;  // Conservative limit for free tier
    
    // Check if we've reached our daily limit
    if (this.todaysTweetCount >= maxTweetsPerDay) {
      this.logger.log(`Daily tweet limit reached (${this.todaysTweetCount}/${maxTweetsPerDay}). No more tweets will be scheduled today.`);
      return;
    }
    
    // Alternate between text-only and text+snippet tweets
    if (this.lastTweetType === 'text') {
      const success = await this.createTweetWithImage();
      if (success) {
        this.lastTweetType = 'snippet';
        this.todaysTweetCount++;
      }
    } else {
      const success = await this.createTweet();
      if (success) {
        this.lastTweetType = 'text';
        this.todaysTweetCount++;
      }
    }
    
    this.logger.log(`Tweet posted. Daily count: ${this.todaysTweetCount}/${maxTweetsPerDay}`);
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

      await this.mailerService.sendMail(
        'New Tweet Posted By Your Fairway Bot',
        'new-tweet',
        {
          topic: topic.topic,
          content: generatedContent
        },
      );
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to create tweet: ${error.message}`);
      return false;
    }
  }

  private async createTweetWithImage(): Promise<boolean> {
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

        await this.mailerService.sendMail(
          'New Technical Tweet Posted By Your Fairway Bot',
          'new-tweet',
          {
            topic: topic.topic,
            content: contentText,
            hasSnippet: true
          },
        );
        
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
}

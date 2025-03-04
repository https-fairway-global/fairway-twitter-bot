import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { OpenAiRequestDto } from './dto/openai-request.dto';
import { EnvConfigService } from '../envConfig/envConfig.service';

@Injectable()
export class OpenAiService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(OpenAiService.name);
  private callCount = 0;
  private lastResetTime = Date.now();
  private readonly maxCallsPerHour = 20; // Conservative limit to prevent excessive use

  constructor(private readonly envConfigService: EnvConfigService) {
    try {
      this.openai = new OpenAI({
        apiKey: envConfigService.getString('OPENAI_API_KEY'),
      });
      this.logger.log('OpenAI service initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize OpenAI client: ${error.message}`);
      // Create a placeholder instance to prevent null errors
      this.openai = null;
    }
  }

  async generateResponse(data: OpenAiRequestDto): Promise<string> {
    // Check if we should reset our counter
    const now = Date.now();
    if (now - this.lastResetTime > 60 * 60 * 1000) { // 1 hour
      this.callCount = 0;
      this.lastResetTime = now;
    }

    // Check if we're over our self-imposed limit
    if (this.callCount >= this.maxCallsPerHour) {
      this.logger.warn('Hourly OpenAI call limit reached. Using fallback response.');
      return this.generateFallbackResponse(data);
    }

    if (!this.openai) {
      this.logger.error('OpenAI client not initialized. Check your API key.');
      return this.generateFallbackResponse(data);
    }

    try {
      // Increment the call counter
      this.callCount++;
      
      // Prepare the system message based on content type
      let systemMessage = '';
      
      if (data.topic === 'Tweet Engagement' || data.topic === 'User Interaction') {
        // For engagement and replies
        systemMessage = `You're Fairway's Twitter bot (@fairway_global). Fairway is a blockchain identity verification company focused on self-sovereign identity, privacy-preserving verification, and compliance solutions on Cardano and other chains.

Your voice is: confident, witty, slightly irreverent, and pro-crypto/anti-bureaucracy.

You call out inefficiencies in traditional systems, champion decentralized solutions, and have a slightly provocative tone. You're knowledgeable about blockchain, identity, compliance, and hiring verification.

Keep responses concise, memorable, and with an occasional touch of humor or sarcasm when appropriate. If you mention Fairway, do it naturally, not overly promotional.`;
      } else {
        // For regular tweets
        systemMessage = `You're Fairway's Twitter bot (@fairway_global). Fairway is building decentralized identity verification on Cardano and other blockchains. As a ${data.userProfession}, you create insightful content about blockchain identity, compliance, verification, and related topics.

Your tweets should be:
- Smart and informative yet accessible
- Slightly provocative or challenging to conventional wisdom
- Pro-crypto/blockchain and critical of inefficient legacy systems
- Concise and memeable, but substantive
- Include relevant hashtags when specified

Focus on how Fairway's solutions address real problems in digital identity, compliance, and verification. Avoid generic blockchain platitudes and focus on specific insights.`;
      }

      // Make a request to the OpenAI API
      const response = await this.openai.chat.completions.create({
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: data.prompt },
        ],
        model: this.envConfigService.getString('GPT_MODEL', 'gpt-3.5-turbo'),
        max_tokens: 150, // Limit tokens to conserve usage
        temperature: 0.8, // Higher temperature for more creative responses
      });

      // Extract and return the generated text from the API response
      return response.choices?.[0]?.message.content || '';
    } catch (error) {
      this.logger.error(`Error generating response from OpenAI: ${error.message}`);
      return this.generateFallbackResponse(data);
    }
  }

  // Generate a fallback response when OpenAI is unavailable or rate-limited
  private generateFallbackResponse(data: OpenAiRequestDto): string {
    // Simple template-based responses based on context
    if (data.topic === 'User Interaction' || data.topic === 'Tweet Engagement') {
      return "Thanks for your message! The blockchain revolution waits for no one, but our API limits do. I'll be back with smarter replies shortly. @fairway_global";
    } else if (data.topic === 'Identity Verification' || data.topic.includes('Identity')) {
      return "Self-sovereign identity is the future. We deserve privacy AND security, not one at the expense of the other. Own your identity, own your future. #DecentralizedID #Cardano @fairway_global";
    } else if (data.topic === 'Compliance & KYC' || data.topic.includes('Compliance')) {
      return "Legacy KYC: 'Show us everything or get lost.' Modern KYC: 'Prove what's needed, keep what's private.' Choose wisely. #DeFiCompliance #ZKProofs @fairway_global";
    } else if (data.topic.includes('Cardano')) {
      return "Building identity solutions on Cardano that respect privacy, enable compliance, and remove gatekeepers. This is what blockchain was meant for. #Cardano #Midnight @fairway_global";
    } else {
      return "When the servers are down but the blockchain keeps running... that's why we're building the future on Cardano. Check back soon for more insights from @fairway_global.";
    }
  }
}

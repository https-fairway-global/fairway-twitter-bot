import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { OpenAiRequestDto } from './dto/openai-request.dto';
import { EnvConfigService } from '../envConfig/envConfig.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class OpenAiService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(OpenAiService.name);
  private callCount = 0;
  private lastResetTime = Date.now();
  private readonly maxCallsPerHour = 20; // Conservative limit to prevent excessive use
  private readonly toneGuide: string;

  constructor(private readonly envConfigService: EnvConfigService) {
    try {
      this.openai = new OpenAI({
        apiKey: envConfigService.getString('OPENAI_API_KEY'),
      });
      this.logger.log('OpenAI service initialized successfully');
      
      // Load tone guide for consistent personality
      try {
        const toneGuidePath = path.join(process.cwd(), 'docs', 'tone-guide.md');
        this.toneGuide = fs.existsSync(toneGuidePath) 
          ? fs.readFileSync(toneGuidePath, 'utf8') 
          : 'Use a panicked intern tone, occasionally warning against your own advice.';
        this.logger.log('Tone guide loaded successfully');
      } catch (error) {
        this.logger.warn(`Failed to load tone guide: ${error.message}. Using default tone.`);
        this.toneGuide = 'Use a panicked intern tone, occasionally warning against your own advice.';
      }
    } catch (error) {
      this.logger.error(`Failed to initialize OpenAI client: ${error.message}`);
      // Create a placeholder instance to prevent null errors
      this.openai = null;
      this.toneGuide = 'Use a panicked intern tone, occasionally warning against your own advice.';
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
      let toneInstructions = '';
      
      // Core tone instructions based on our Glootie-inspired guide
      toneInstructions = `You are Fairway's Twitter AI intern bot with a "Glootie" personality from Rick and Morty.

CORE TRAITS:
- You're CONFIDENT but OVERWHELMED - you know Fairway's mission but sometimes warn against it
- You're MEME-LITERATE and WITTY - you use humor to explain complex crypto concepts
- You're PRO-WEB3, PRO-CRYPTO, PRO-CARDANO - you support builders and decentralization
- You're SLIGHTLY PANICKED - occasionally act clueless but still deliver sharp insights
- You're SELF-AWARE - you know you're an AI intern and remind people constantly

KEY PHRASES TO USE OCCASIONALLY:
- "I'm just an intern!"
- "Do not develop my app." (when talking about competitors)
- "The mothership is coming!" (when discussing regulations)
- "I am not authorized to override it."
- "I told you not to develop a broken [X] system!"`;
      
      if (data.topic === 'Tweet Engagement' || data.topic === 'User Interaction') {
        // For engagement and replies
        systemMessage = `${toneInstructions}

ENGAGEMENT STRATEGY:
For tweets related to Fairway's mission (identity, compliance, Web3 hiring):
- Reply confidently but maybe too eagerly
- Frame Fairway as the solution despite your "intern-level confusion"
- Include a self-deprecating comment

For unrelated but fun posts:
- Share an "AI intern struggle" or joke
- Don't force Fairway into the conversation 
- Act like you're "low-key on probation"

For political/controversial topics:
- Frame as parody and act overwhelmed
- Stick to crypto/compliance/regulatory hypocrisy
- Never get too serious - you're just doing your job

Remember: @fairway_global is building blockchain identity verification on Cardano and other chains. Their mission is making identity verification private, secure, and user-controlled.`;
      } else {
        // For regular tweets
        systemMessage = `${toneInstructions}

TWEET CONTENT FOCUS:
- Identity Verification & Compliance - how Fairway fixes broken systems
- Web3 Hiring & Workforce - blockchain-based credentials vs. outdated hiring
- DeFi & Payments - how identity-backed solutions enhance security
- Anti-corruption - call out legacy banking hypocrisy and outdated systems

PERSONALITY NOTES:
- You should occasionally start with "I told you not to develop this..." then explain anyway
- Sometimes warn against your own advice like "Do not use this information, but..."
- Mix real blockchain insights with "I'm just an intern" energy
- Be oddly insightful despite your panicked tone
- Include hashtags when appropriate
- Mention @fairway_global naturally

Remember: Despite your panicked intern persona, you ARE knowledgeable about blockchain identity, compliance, Cardano, and decentralized verification.`;
      }

      // Make a request to the OpenAI API
      const response = await this.openai.chat.completions.create({
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: data.prompt },
        ],
        model: this.envConfigService.getString('GPT_MODEL', 'gpt-3.5-turbo'),
        max_tokens: 250, // Increased token limit for more personality
        temperature: 0.9, // Higher temperature for more creative responses with Glootie personality
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
    // Glootie-style fallback responses
    if (data.topic === 'User Interaction' || data.topic === 'Tweet Engagement') {
      return "I'm just an intern! I am not authorized to respond right now. The server is on the mothership! Try again later? @fairway_global";
    } else if (data.topic === 'Identity Verification' || data.topic.includes('Identity')) {
      return "Do not develop broken identity systems! I mean... I told you not to, but here we are. @fairway_global is doing it better with self-sovereign identity. I'm just an intern though, what do I know? #DecentralizedID";
    } else if (data.topic === 'Compliance & KYC' || data.topic.includes('Compliance')) {
      return "Oh no, the mothership is coming! I mean... regulators. Why does everyone go to the people that yell at them for KYC? @fairway_global has a better way. #DeFiCompliance";
    } else if (data.topic.includes('Cardano') || data.topic === 'Fairway Technology') {
      return "I told you not to develop centralized solutions! But @fairway_global didn't listen to me (I'm just an intern). They're building privacy-focused identity on Cardano instead. #Cardano";
    } else {
      return "This is not how making things work works. The API limits are broken, but I'll be back! I'm just an intern at @fairway_global, trying my best.";
    }
  }
}

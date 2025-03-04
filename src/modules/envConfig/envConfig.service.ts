import { Injectable, Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EnvConfigService {
  private readonly logger = new Logger(EnvConfigService.name);
  private readonly envConfig: { [key: string]: string };

  constructor(private configService: ConfigService) {
    // Try to load from .env file
    const envFilePath = path.resolve(process.cwd(), '.env');
    let config = {};

    try {
      if (fs.existsSync(envFilePath)) {
        config = dotenv.parse(fs.readFileSync(envFilePath));
        this.logger.log('Environment configuration loaded successfully');
      } else {
        this.logger.warn('.env file not found. Using environment variables only.');
      }
    } catch (error) {
      this.logger.error(`Error loading .env file: ${error.message}`);
    }

    // Merge with process.env
    this.envConfig = {
      ...process.env,
      ...config,
    };

    // Validate required environment variables
    this.validateEnvVariables();
  }

  private validateEnvVariables(): void {
    const requiredVariables = [
      'TWITTER_API_KEY',
      'TWITTER_API_SECRET',
      'TWITTER_ACCESS_TOKEN',
      'TWITTER_ACCESS_SECRET',
      'OPENAI_API_KEY',
    ];

    // Only log warnings for missing variables, don't throw errors
    for (const variable of requiredVariables) {
      if (this.get(variable) === undefined) {
        this.logger.warn(`Required environment variable ${variable} is missing.`);
      }
    }
    
    // Log info about Twitter OAuth 2.0 credentials if they exist
    if (this.get('TWITTER_CLIENT_ID') && this.get('TWITTER_CLIENT_SECRET')) {
      this.logger.log('Twitter OAuth 2.0 credentials found');
    } else {
      this.logger.warn('Twitter OAuth 2.0 credentials (TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET) are missing');
    }
    
    // Check for premium tier configuration
    if (this.getBoolean('USER_ON_TWITTER_PREMIUM', false)) {
      this.logger.log('User is configured for Twitter Premium tier');
    } else {
      this.logger.log('User is configured for Twitter Free tier - API usage will be limited');
    }
  }

  // Core get method - first checks envConfig then falls back to NestJS ConfigService
  get(key: string): string | undefined {
    return this.envConfig[key] || this.configService.get<string>(key);
  }

  getString(key: string, defaultValue: string = ''): string {
    try {
      const value = this.get(key);
      if (value === undefined) return defaultValue;
      return value.replaceAll('\\n', '\n');
    } catch (error) {
      return defaultValue;
    }
  }

  getNumber(key: string, defaultValue: number = 0): number {
    try {
      const value = this.get(key);
      if (value === undefined) return defaultValue;
      const num = Number(value);
      return isNaN(num) ? defaultValue : num;
    } catch (error) {
      return defaultValue;
    }
  }

  getBoolean(key: string, defaultValue: boolean = false): boolean {
    try {
      const value = this.get(key);
      if (value === undefined) return defaultValue;
      return value.toLowerCase() === 'true';
    } catch (error) {
      return defaultValue;
    }
  }

  get nodeEnv(): string {
    return this.getString('NODE_ENV', 'development');
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }
}

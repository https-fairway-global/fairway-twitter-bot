import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ManageTweetService } from './modules/manage-tweet/manage-tweet.service';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

async function testAutoFollow() {
  const logger = new Logger('TestAutoFollowScript');
  
  // Set up log file
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  const logFilePath = path.join(logsDir, 'autofollow-test.log');
  fs.writeFileSync(logFilePath, `Auto-follow test started at ${new Date().toISOString()}\n`);
  
  const logToFile = (message: string) => {
    console.log(message);
    fs.appendFileSync(logFilePath, `${message}\n`);
  };
  
  try {
    logToFile('Initializing NestJS application...');
    const app = await NestFactory.createApplicationContext(AppModule);
    logToFile('Application initialized successfully');
    
    // Get the ManageTweetService
    const manageTweetService = app.get(ManageTweetService);
    logToFile('Retrieved ManageTweetService instance');
    
    // Check environment variables
    const envConfigService = app.get('EnvConfigService');
    const autoFollowEnabled = envConfigService.getBoolean('TWITTER_AUTO_FOLLOW_ENABLED', false);
    logToFile(`Auto-follow enabled in config: ${autoFollowEnabled}`);
    
    const followKeywords = envConfigService.getString('TWITTER_FOLLOW_KEYWORDS', '');
    logToFile(`Follow keywords: ${followKeywords}`);
    
    // Run the auto-follow function
    logToFile('Starting auto-follow process...');
    await manageTweetService.scheduleAutoFollow();
    logToFile('Auto-follow process completed');
    
    await app.close();
    logToFile('Application closed');
  } catch (error) {
    logToFile(`ERROR: ${error.message}`);
    logToFile(error.stack);
  }
}

testAutoFollow().catch(err => {
  console.error('Unhandled error in test script:', err);
  process.exit(1);
}); 
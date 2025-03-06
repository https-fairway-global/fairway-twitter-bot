import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { EnvConfigService } from './modules/envConfig/envConfig.service';
import { TwitterApiService } from './modules/api-integrations/twitterApi.service';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  // Set up logging directory
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  const logFilePath = path.join(logsDir, 'app-verbose.log');
  console.log(`Application starting, logging details to: ${logFilePath}`);
  
  // Logging function that writes to both console and file
  const logMessage = (message: string, level = 'INFO') => {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(formattedMessage);
    
    try {
      fs.appendFileSync(logFilePath, formattedMessage + '\n');
    } catch (error) {
      console.error(`Error writing to log file: ${error.message}`);
    }
  };

  try {
    // Initialize the app first
    logMessage('Creating application instance...', 'INIT');
    const app = await NestFactory.create(AppModule, {
      // Set logger levels
      logger: ['error', 'warn', 'log'],
    });
    
    // Basic configuration
    app.enableCors();
    app.setGlobalPrefix('api');
    
    // Start the server first to ensure it's available even if other operations fail
    const port = process.env.PORT || 3000;
    logMessage(`Starting server on port ${port}...`, 'INIT');
    await app.listen(port);
    logMessage(`Server started successfully on port ${port}`, 'INIT');
    
    // Perform Twitter API operations in the background
    setTimeout(async () => {
      try {
        // Get environment configuration
        const envConfig = app.get(EnvConfigService);
        logMessage('Checking auto-follow configuration...', 'CONFIG');
        
        const autoFollowEnabled = envConfig.getBoolean('TWITTER_AUTO_FOLLOW_ENABLED', false);
        logMessage(`Auto-follow enabled: ${autoFollowEnabled}`, 'CONFIG');
        
        // Initialize Twitter API
        try {
          const twitterApiService = app.get(TwitterApiService);
          logMessage('Twitter API service initialized', 'INIT');
          
          try {
            const twitterHealth = await twitterApiService.checkApiHealth();
            if (twitterHealth.healthy) {
              logMessage('Twitter API connection is healthy', 'INIT');
            } else {
              logMessage(`Twitter API connection issue: ${twitterHealth.reason}`, 'WARN');
            }
          } catch (err) {
            logMessage(`Error checking Twitter health: ${err.message}`, 'WARN');
            logMessage('Continuing application startup despite Twitter API issues', 'WARN');
          }
        } catch (err) {
          logMessage(`Twitter API service initialization error: ${err.message}`, 'ERROR');
          logMessage('Application will continue to run, but Twitter functionality may be limited', 'WARN');
        }
      } catch (error) {
        logMessage(`Background initialization error: ${error.message}`, 'ERROR');
        logMessage('Application will continue to run, but some functionality may be limited', 'WARN');
      }
    }, 1000);
    
    logMessage('Application bootstrap completed successfully', 'INIT');
    
  } catch (error) {
    logMessage(`Critical error during bootstrap: ${error.message}`, 'FATAL');
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
  // Don't exit the process, just log the error
});

process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT EXCEPTION]', error);
  // Don't exit the process, just log the error
});

// Start the application
bootstrap();

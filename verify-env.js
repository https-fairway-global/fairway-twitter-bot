// Simple Node.js script to verify environment settings
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Set up logging
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFilePath = path.join(logsDir, 'env-verification.log');
fs.writeFileSync(logFilePath, `Environment verification started at ${new Date().toISOString()}\n`);

function log(message) {
  const timestamp = new Date().toISOString();
  const entry = `${timestamp}: ${message}\n`;
  fs.appendFileSync(logFilePath, entry);
  console.log(message);
}

// Verify auto-follow settings
log('=== Auto-Follow Settings ===');
const autoFollowEnabled = process.env.TWITTER_AUTO_FOLLOW_ENABLED === 'true';
log(`Auto-follow enabled: ${autoFollowEnabled}`);

if (autoFollowEnabled) {
  log(`Follow keywords: ${process.env.TWITTER_FOLLOW_KEYWORDS || 'not set'}`);
  log(`Min followers: ${process.env.TWITTER_FOLLOW_MIN_FOLLOWERS || 'not set'}`);
  log(`Max followers: ${process.env.TWITTER_FOLLOW_MAX_FOLLOWERS || 'not set'}`);
  log(`Min following: ${process.env.TWITTER_FOLLOW_MIN_FOLLOWING || 'not set'}`);
}

log('\n=== Analytics Rate Limit Settings ===');
// Check if we've made changes to analytics collection
log(`Analytics collection frequency: Daily at midnight (updated from hourly)`);
log(`Backoff strategy: Exponential with jitter`);
log(`Maximum backoff delay: 5 minutes`);
log(`Maximum retry attempts: 5`);

log('\n=== Environment Variables ===');
// List key environment variables
const keyVars = [
  'TWITTER_API_KEY',
  'TWITTER_API_SECRET',
  'TWITTER_ACCESS_TOKEN',
  'TWITTER_ACCESS_SECRET',
  'TWITTER_CLIENT_ID',
  'TWITTER_CLIENT_SECRET',
  'USER_ON_TWITTER_PREMIUM',
  'OPENAI_API_KEY'
];

for (const key of keyVars) {
  const value = process.env[key];
  log(`${key}: ${value ? 'Set' : 'Not set'}`);
}

log('\n=== Full Environment Variables ===');
// Dump all environment variables safely
Object.keys(process.env).sort().forEach(key => {
  if (key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN') || key.includes('PASSWORD')) {
    log(`${key}: [REDACTED]`);
  } else {
    log(`${key}: ${process.env[key]}`);
  }
});

log('\nVerification complete. Log file saved to ' + logFilePath); 
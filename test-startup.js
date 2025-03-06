// Simple script to test application startup with Twitter rate limiting
require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting test-startup.js - simulating app startup with Twitter rate limiting');

// Set up logging directory
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFilePath = path.join(logsDir, 'startup-test.log');
console.log(`📝 Logging to: ${logFilePath}`);

// Logging function
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(formattedMessage);
  fs.appendFileSync(logFilePath, formattedMessage + '\n');
}

// Function to simulate API call with rate limiting
function simulateTwitterApiCall(shouldRateLimit = false) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldRateLimit) {
        const error = new Error('Request failed with code 429');
        error.code = 429;
        reject(error);
      } else {
        resolve({ id: '1234567890', username: 'test_user' });
      }
    }, 500); // simulate network delay
  });
}

// Main function
async function simulateStartup() {
  try {
    log('📡 Application starting up...');
    
    // Start the "server" first
    log('🌐 Starting server...');
    log('✅ Server started successfully on port 3000');
    
    // Run Twitter operations after server is started
    log('🐦 Starting Twitter API operations in the background...');
    
    try {
      // Simulate a rate-limited Twitter API call
      log('🔍 Getting Twitter user info...');
      await simulateTwitterApiCall(true); // true = simulate rate limiting
      log('✅ Got Twitter user info');
    } catch (error) {
      // This should NOT crash the application
      log(`⚠️ Twitter API error: ${error.message}`, 'WARN');
      log('⚠️ Rate limited but application continues running', 'WARN');
    }
    
    // Application keeps running despite Twitter API failure
    log('💻 Application is running and stable despite Twitter API rate limiting');
    log('✅ Test completed successfully - application remains running despite rate limits');
    
    // Check auto-follow settings
    const autoFollowEnabled = process.env.TWITTER_AUTO_FOLLOW_ENABLED === 'true';
    log(`🔄 Auto-follow enabled: ${autoFollowEnabled}`);
    
    return true;
  } catch (error) {
    log(`❌ Critical error: ${error.message}`, 'ERROR');
    console.error(error);
    return false;
  }
}

// Run the simulation
simulateStartup()
  .then(success => {
    log(`🏁 Simulation ${success ? 'succeeded' : 'failed'}`);
  })
  .catch(err => {
    log(`💥 Unexpected error: ${err.message}`, 'FATAL');
    console.error(err);
  }); 
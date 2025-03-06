// Script to schedule auto-follow to run daily
require('dotenv').config();
const cron = require('node-cron');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Setup logging
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFilePath = path.join(logsDir, 'scheduler.log');

// Logging function
function log(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;
  console.log(formattedMessage);
  fs.appendFileSync(logFilePath, formattedMessage + '\n');
}

// Function to run the auto-follow script
function runAutoFollow() {
  log('Running scheduled auto-follow task...');
  try {
    const output = execSync('node auto-follow.js', { encoding: 'utf8' });
    log('Auto-follow task completed successfully');
    log(`Output: ${output.split('\n').slice(-2)[0]}`); // Log the summary line
  } catch (error) {
    log(`Error running auto-follow task: ${error.message}`);
  }
}

// Schedule the auto-follow task to run daily at 10 AM
// Cron format: minute hour day-of-month month day-of-week
log('Setting up auto-follow scheduler...');
cron.schedule('0 10 * * *', () => {
  log('Trigger time reached - running auto-follow task');
  runAutoFollow();
});

// Also provide a way to run it immediately by passing 'now' as an argument
if (process.argv.includes('now')) {
  log('Manual trigger received - running auto-follow task immediately');
  runAutoFollow();
}

log('Auto-follow scheduler is running. Auto-follow will run daily at 10:00 AM.');
log('Press Ctrl+C to stop the scheduler.');

// Keep the script running
process.stdin.resume(); 
// Simple script to start the app directly without NestJS CLI
require('dotenv').config();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Setup logging
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFilePath = path.join(logsDir, 'direct-start.log');
console.log(`Logging to: ${logFilePath}`);

function log(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;
  console.log(formattedMessage);
  fs.appendFileSync(logFilePath, formattedMessage + '\n');
}

// First, make sure we have a built application
log('Building application...');
const buildProcess = spawn('npm', ['run', 'build'], { 
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' }
});

buildProcess.on('exit', (code) => {
  if (code !== 0) {
    log(`Build failed with code ${code}`);
    return;
  }
  
  log('Build completed successfully');
  log('Starting application directly with Node.js...');
  
  // Start the application with Node.js directly
  const nodeProcess = spawn('node', ['dist/main.js'], {
    stdio: 'inherit',
    env: { 
      ...process.env, 
      NODE_ENV: 'development',
      NODE_OPTIONS: '--inspect' // Enable debugging
    }
  });
  
  nodeProcess.on('exit', (code) => {
    log(`Application exited with code ${code}`);
  });
  
  // Handle Ctrl+C to gracefully shut down
  process.on('SIGINT', () => {
    log('Received SIGINT. Shutting down gracefully...');
    nodeProcess.kill('SIGINT');
  });
});

log('Script started. Waiting for build to complete...'); 
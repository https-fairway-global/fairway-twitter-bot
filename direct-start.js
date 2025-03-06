// Minimal script to directly start the application without building first
require('dotenv').config();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Setup logging
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFilePath = path.join(logsDir, 'minimal-start.log');
console.log(`Logging to: ${logFilePath}`);

function log(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;
  console.log(formattedMessage);
  fs.appendFileSync(logFilePath, formattedMessage + '\n');
}

// Check if the dist directory exists
if (!fs.existsSync(path.join(process.cwd(), 'dist'))) {
  log('Error: dist directory not found. Please build the application first with "npm run build"');
  process.exit(1);
}

// Check if the main.js file exists
if (!fs.existsSync(path.join(process.cwd(), 'dist/main.js'))) {
  log('Error: dist/main.js not found. Please build the application first with "npm run build"');
  process.exit(1);
}

log('Starting application directly with Node.js...');

// Start the application with Node.js directly
const nodeProcess = spawn('node', ['dist/main.js'], {
  stdio: 'inherit',
  env: { 
    ...process.env, 
    NODE_ENV: 'development',
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

log('Application should be starting now...'); 
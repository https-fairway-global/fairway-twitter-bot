const fs = require('fs');
const path = require('path');

// Setup logging
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFilePath = path.join(logsDir, 'debug-app.log');
console.log(`Logging to: ${logFilePath}`);

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(formattedMessage);
  
  try {
    fs.appendFileSync(logFilePath, formattedMessage + '\n');
  } catch (error) {
    console.error(`Error writing to log file: ${error.message}`);
  }
}

// Check if dist directory exists
const distDir = path.join(process.cwd(), 'dist');
if (!fs.existsSync(distDir)) {
  log(`Dist directory does not exist: ${distDir}`, 'ERROR');
  process.exit(1);
}

// List files in dist directory
log('Files in dist directory:');
try {
  const files = fs.readdirSync(distDir);
  files.forEach(file => {
    log(`- ${file}`);
  });
} catch (error) {
  log(`Error reading dist directory: ${error.message}`, 'ERROR');
}

// Check if main.js exists
const mainJsPath = path.join(distDir, 'main.js');
if (!fs.existsSync(mainJsPath)) {
  log(`Main.js does not exist: ${mainJsPath}`, 'ERROR');
  process.exit(1);
}

// Try to require main.js
log('Attempting to require main.js...', 'DEBUG');
try {
  log('This might hang if there are issues with main.js initialization', 'WARN');
  require(mainJsPath);
  log('Main.js required successfully', 'SUCCESS');
} catch (error) {
  log(`Error requiring main.js: ${error.message}`, 'ERROR');
  log(`Error stack: ${error.stack}`, 'ERROR');
} 
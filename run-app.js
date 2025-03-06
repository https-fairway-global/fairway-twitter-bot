const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Setup logging
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFilePath = path.join(logsDir, 'startup-debug.log');
console.log(`Debugging application startup. Logs will be written to: ${logFilePath}`);

function log(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;
  console.log(formattedMessage);
  
  try {
    fs.appendFileSync(logFilePath, formattedMessage + '\n');
  } catch (error) {
    console.error(`Error writing to log file: ${error.message}`);
  }
}

// Clear previous log content
fs.writeFileSync(logFilePath, '');

// Check if dist directory exists
const distDir = path.join(process.cwd(), 'dist');
if (!fs.existsSync(distDir)) {
  log(`ERROR: Dist directory does not exist: ${distDir}`);
  process.exit(1);
}

// Check if main.js exists
const mainJsPath = path.join(distDir, 'main.js');
if (!fs.existsSync(mainJsPath)) {
  log(`ERROR: Main.js does not exist: ${mainJsPath}`);
  process.exit(1);
}

// Check for port usage
log('Checking if port 3000 is already in use...');
const portCheckProcess = spawn('lsof', ['-i', ':3000']);
let portOutput = '';

portCheckProcess.stdout.on('data', (data) => {
  portOutput += data.toString();
});

portCheckProcess.on('close', (code) => {
  if (portOutput.includes('LISTEN')) {
    log('WARNING: Port 3000 is already in use. This might cause the application to fail to start.');
    log('Port usage details:');
    log(portOutput);
  } else {
    log('Port 3000 is available.');
  }
  
  startApp();
});

function startApp() {
  // Run the application as a child process with debugging flags
  log('Starting application with debugging...');
  const childProcess = spawn('node', ['--trace-warnings', '--trace-uncaught', 'dist/main.js'], {
    env: { 
      ...process.env,
      NODE_ENV: 'development',
      DEBUG: 'nestjs:*'
    }
  });

  // Set a timeout to check if app is still running
  const startupTimeoutSeconds = 30;
  const startupTimeout = setTimeout(() => {
    log(`Application startup is taking longer than ${startupTimeoutSeconds} seconds. It may be stuck.`);
    log('Here are the active Node.js processes:');
    
    const psProcess = spawn('ps', ['aux', '|', 'grep', 'node']);
    psProcess.stdout.on('data', (data) => {
      log(`Process info: ${data.toString().trim()}`);
    });
    
    log('Consider terminating this process if it appears to be stuck.');
  }, startupTimeoutSeconds * 1000);

  // Handle output
  childProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    log(`[APP OUT] ${output}`);
  });

  childProcess.stderr.on('data', (data) => {
    const output = data.toString().trim();
    log(`[APP ERR] ${output}`);
  });

  // Handle process exit
  childProcess.on('exit', (code) => {
    clearTimeout(startupTimeout);
    if (code === 0) {
      log('Application exited successfully');
    } else {
      log(`Application exited with code ${code}`);
    }
  });

  log('Monitor started. Press Ctrl+C to terminate.');
} 
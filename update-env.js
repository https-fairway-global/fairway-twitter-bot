// Script to update .env file with Twitter user ID placeholder
const fs = require('fs');
const path = require('path');

function updateEnvFile() {
  console.log('Updating .env file with Twitter user ID placeholder...');
  
  try {
    // Path to .env file
    const envPath = path.join(process.cwd(), '.env');
    
    // Read the current .env file
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    } else {
      console.error('.env file not found!');
      return false;
    }
    
    // Check if TWITTER_USER_ID is already in the file
    if (envContent.includes('TWITTER_USER_ID=')) {
      console.log('TWITTER_USER_ID already exists in .env file.');
      
      // Extract the current value
      const match = envContent.match(/TWITTER_USER_ID=([^\n]*)/);
      if (match && match[1]) {
        console.log(`Current value: TWITTER_USER_ID=${match[1]}`);
      }
      
      return true;
    }
    
    // Add TWITTER_USER_ID placeholder
    const updatedContent = envContent.trim() + '\n\n# Your Twitter user ID (required for auto-follow)\n# Get this by running: node get-user-id.js\nTWITTER_USER_ID=YOUR_TWITTER_USER_ID_HERE\n';
    
    // Write the updated content back to the file
    fs.writeFileSync(envPath, updatedContent);
    
    console.log('Successfully added TWITTER_USER_ID placeholder to .env file.');
    console.log('Please replace YOUR_TWITTER_USER_ID_HERE with your actual Twitter user ID.');
    console.log('You can get your Twitter user ID by running: node get-user-id.js');
    
    return true;
  } catch (error) {
    console.error('Error updating .env file:', error.message);
    return false;
  }
}

// Run the function
updateEnvFile(); 
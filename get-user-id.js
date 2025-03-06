// Simple script to get Twitter user ID
require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');

async function getTwitterUserId() {
  console.log('Starting Twitter user ID lookup...');
  
  try {
    // Initialize the Twitter client
    console.log('Initializing Twitter client...');
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });
    
    // Get the authenticated user's information
    console.log('Getting user information...');
    const me = await client.v2.me();
    
    console.log('\n=== Twitter User Information ===');
    console.log(`User ID: ${me.data.id}`);
    console.log(`Username: @${me.data.username}`);
    console.log(`Name: ${me.data.name}`);
    console.log('\nAdd this to your .env file:');
    console.log(`TWITTER_USER_ID=${me.data.id}\n`);
    
    return me.data.id;
  } catch (error) {
    console.error('Error getting Twitter user ID:');
    console.error(error.message);
    
    if (error.data) {
      console.error('API Error Data:', JSON.stringify(error.data, null, 2));
    }
    
    return null;
  }
}

// Run the function
getTwitterUserId()
  .then(() => console.log('Script completed.'))
  .catch(err => console.error('Unhandled error:', err)); 
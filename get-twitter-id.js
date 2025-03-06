require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');

async function getTwitterUserId() {
  try {
    console.log('Initializing Twitter client...');
    const twitterClient = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    }).readWrite;
    
    console.log('Getting user information...');
    const me = await twitterClient.v2.me();
    
    console.log('\n=== Twitter User Information ===');
    console.log(`User ID: ${me.data.id}`);
    console.log(`Username: ${me.data.username}`);
    console.log(`Name: ${me.data.name}`);
    console.log('\nAdd this to your .env file:');
    console.log(`TWITTER_USER_ID=${me.data.id}`);
    
    return me.data.id;
  } catch (error) {
    console.error('Error getting Twitter user ID:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.data) {
      console.error('Error data:', JSON.stringify(error.data, null, 2));
    }
    return null;
  }
}

getTwitterUserId().catch(console.error); 
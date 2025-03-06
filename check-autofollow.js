// Simple script to check auto-follow functionality
require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');
const fs = require('fs');
const path = require('path');

async function checkAutoFollow() {
  console.log('==== Auto-Follow Check Script ====');
  
  // Setup logging
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  const logFilePath = path.join(logsDir, 'autofollow-check.log');
  
  function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(logFilePath, logMessage + '\n');
  }
  
  log('Starting auto-follow check');
  
  try {
    // Check environment variables
    log('Checking environment settings...');
    
    const autoFollowEnabled = process.env.TWITTER_AUTO_FOLLOW_ENABLED === 'true';
    log(`Auto-follow enabled: ${autoFollowEnabled}`);
    
    if (!autoFollowEnabled) {
      log('Auto-follow is disabled. Enable it in .env file to use this feature.');
      return;
    }
    
    const twitterUserId = process.env.TWITTER_USER_ID;
    log(`Twitter User ID: ${twitterUserId || 'NOT SET'}`);
    
    if (!twitterUserId) {
      log('Error: TWITTER_USER_ID is not set in .env file. This is required for auto-follow.');
      return;
    }
    
    const followKeywords = process.env.TWITTER_FOLLOW_KEYWORDS || '';
    log(`Follow keywords: ${followKeywords}`);
    
    if (!followKeywords) {
      log('Warning: No follow keywords configured. Auto-follow will not work properly.');
      return;
    }
    
    // Initialize the Twitter client
    log('Initializing Twitter client...');
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });
    
    // Get the authenticated user's information
    log('Getting user information...');
    try {
      const me = await client.v2.me();
      log(`Authenticated as: @${me.data.username} (ID: ${me.data.id})`);
      
      // Check if the provided Twitter user ID matches
      if (twitterUserId !== me.data.id) {
        log(`Warning: TWITTER_USER_ID in .env (${twitterUserId}) does not match the authenticated user's ID (${me.data.id}).`);
        log(`You should update your .env file with: TWITTER_USER_ID=${me.data.id}`);
      }
    } catch (error) {
      log(`Error getting user information: ${error.message}`);
      log('This could indicate an issue with your Twitter API credentials');
      return;
    }
    
    // Test searching for users to follow
    const keyword = followKeywords.split(',')[0].trim();
    log(`Testing user search with keyword: ${keyword}`);
    
    try {
      const result = await client.v2.search({
        query: keyword,
        max_results: 10,
        "tweet.fields": ['created_at', 'author_id'],
        "user.fields": ['description', 'public_metrics', 'verified', 'profile_image_url', 'created_at'],
        "expansions": ['author_id']
      });
      
      const users = result.data.includes?.users || [];
      log(`Found ${users.length} users in search results for keyword: ${keyword}`);
      
      if (users.length > 0) {
        // Print some details about the first user
        const user = users[0];
        log(`Sample user: @${user.username} (ID: ${user.id})`);
        log(`Followers: ${user.public_metrics?.followers_count}, Following: ${user.public_metrics?.following_count}`);
        
        // Check if we could follow this user
        const minFollowers = parseInt(process.env.TWITTER_FOLLOW_MIN_FOLLOWERS || '100', 10);
        const maxFollowers = parseInt(process.env.TWITTER_FOLLOW_MAX_FOLLOWERS || '100000', 10);
        const minFollowing = parseInt(process.env.TWITTER_FOLLOW_MIN_FOLLOWING || '10', 10);
        
        const followerCount = user.public_metrics?.followers_count || 0;
        const followingCount = user.public_metrics?.following_count || 0;
        
        const meetsFollowerCriteria = followerCount >= minFollowers && followerCount <= maxFollowers;
        const meetsFollowingCriteria = followingCount >= minFollowing;
        
        log(`User meets follower criteria: ${meetsFollowerCriteria} (${followerCount} followers, min: ${minFollowers}, max: ${maxFollowers})`);
        log(`User meets following criteria: ${meetsFollowingCriteria} (${followingCount} following, min: ${minFollowing})`);
        
        if (meetsFollowerCriteria && meetsFollowingCriteria) {
          log('This user could be auto-followed based on your criteria');
        }
      }
    } catch (error) {
      log(`Error searching for users: ${error.message}`);
      return;
    }
    
    log('Auto-follow check completed successfully');
  } catch (error) {
    log(`Unexpected error: ${error.message}`);
    console.error(error);
  }
}

// Run the function
checkAutoFollow()
  .then(() => console.log('Script completed.'))
  .catch(err => console.error('Unhandled error:', err)); 
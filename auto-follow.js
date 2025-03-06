// Standalone script for Twitter auto-follow functionality
require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');
const fs = require('fs');
const path = require('path');

// Setup logging
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFilePath = path.join(logsDir, 'auto-follow.log');

// Logging function
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(formattedMessage);
  fs.appendFileSync(logFilePath, formattedMessage + '\n');
}

// Get random item from array
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Main auto-follow function
async function runAutoFollow() {
  log('Starting auto-follow process', 'START');
  
  try {
    // Verify auto-follow is enabled
    const autoFollowEnabled = process.env.TWITTER_AUTO_FOLLOW_ENABLED === 'true';
    log(`Auto-follow enabled: ${autoFollowEnabled}`);
    
    if (!autoFollowEnabled) {
      log('Auto-follow is disabled. Enable it in .env file to use this feature.', 'WARN');
      return;
    }
    
    // Get required configuration
    const twitterUserId = process.env.TWITTER_USER_ID;
    log(`Using Twitter User ID: ${twitterUserId || 'NOT SET'}`);
    
    if (!twitterUserId) {
      log('Error: TWITTER_USER_ID is not set in .env file. This is required for auto-follow.', 'ERROR');
      return;
    }
    
    // Check if twitterUserId is a valid format (numeric)
    if (!/^\d+$/.test(twitterUserId)) {
      log(`Warning: TWITTER_USER_ID (${twitterUserId}) does not appear to be a valid numeric Twitter ID.`, 'WARN');
    }
    
    // Get follow keywords
    const followKeywords = process.env.TWITTER_FOLLOW_KEYWORDS || '';
    log(`Follow keywords: ${followKeywords}`);
    
    if (!followKeywords) {
      log('Warning: No follow keywords configured. Auto-follow will not work properly.', 'WARN');
      return;
    }
    
    const keywordsArray = followKeywords.split(',').map(k => k.trim()).filter(Boolean);
    
    // Setup Twitter client
    log('Initializing Twitter client...');
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });
    
    // Get a random keyword to search for
    const keyword = getRandomItem(keywordsArray);
    log(`Selected random keyword for search: ${keyword}`);
    
    // Build follow criteria from environment variables
    const followCriteria = {
      minFollowers: parseInt(process.env.TWITTER_FOLLOW_MIN_FOLLOWERS || '100', 10),
      maxFollowers: parseInt(process.env.TWITTER_FOLLOW_MAX_FOLLOWERS || '100000', 10),
      minFollowing: parseInt(process.env.TWITTER_FOLLOW_MIN_FOLLOWING || '10', 10)
    };
    
    log(`Using follow criteria: min followers=${followCriteria.minFollowers}, max followers=${followCriteria.maxFollowers}, min following=${followCriteria.minFollowing}`);
    
    // Search for tweets with the keyword
    log(`Searching for tweets with keyword: ${keyword}`);
    try {
      const result = await client.v2.search({
        query: keyword,
        max_results: 30, // Get more results for filtering
        "tweet.fields": ['created_at', 'author_id'],
        "user.fields": ['description', 'public_metrics', 'verified', 'profile_image_url', 'created_at'],
        "expansions": ['author_id']
      });
      
      // Check if we got results
      const tweets = result.data?.data || [];
      const users = result.data?.includes?.users || [];
      log(`Found ${tweets.length} tweets and ${users.length} users in search results`);
      
      if (users.length === 0) {
        log(`No users found for keyword: ${keyword}`, 'WARN');
        return;
      }
      
      // Filter users based on criteria
      const filteredUsers = users.filter(user => {
        if (!user.public_metrics) return false;
        
        const followerCount = user.public_metrics.followers_count || 0;
        const followingCount = user.public_metrics.following_count || 0;
        
        return (
          followerCount >= followCriteria.minFollowers &&
          followerCount <= followCriteria.maxFollowers &&
          followingCount >= followCriteria.minFollowing
        );
      });
      
      log(`Found ${filteredUsers.length} users matching criteria`);
      
      // Sort by follower count (descending)
      const sortedUsers = filteredUsers.sort((a, b) => {
        return (b.public_metrics?.followers_count || 0) - (a.public_metrics?.followers_count || 0);
      });
      
      // Limit to max 2 users to follow at once
      const maxToFollow = 2;
      const usersToFollow = sortedUsers.slice(0, maxToFollow);
      
      // Follow each user
      let followedCount = 0;
      for (const user of usersToFollow) {
        log(`Attempting to follow user: @${user.username} (${user.id})`);
        
        try {
          const followResult = await client.v2.follow(twitterUserId, user.id);
          
          if (followResult.errors && followResult.errors.length > 0) {
            log(`Error following user @${user.username}: ${JSON.stringify(followResult.errors)}`, 'ERROR');
          } else {
            followedCount++;
            log(`Successfully followed user: @${user.username} (${user.id})`);
          }
          
          // Add delay between follow requests to avoid rate limiting
          if (usersToFollow.length > 1) {
            const delay = 5000;
            log(`Waiting ${delay/1000} seconds before next follow...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (error) {
          if (error.message?.includes('429') || error.code === 429) {
            log(`Rate limited when trying to follow user @${user.username}. Try again later.`, 'WARN');
          } else {
            log(`Error following user @${user.username}: ${error.message}`, 'ERROR');
          }
        }
      }
      
      log(`Auto-follow task completed. Followed ${followedCount} out of ${usersToFollow.length} users.`);
      
    } catch (error) {
      if (error.message?.includes('429') || error.code === 429) {
        log('Rate limited by Twitter API. Try again later.', 'WARN');
      } else {
        log(`Error searching for tweets: ${error.message}`, 'ERROR');
        console.error(error);
      }
    }
    
  } catch (error) {
    log(`Unexpected error: ${error.message}`, 'ERROR');
    console.error(error);
  }
}

// Run the auto-follow function
runAutoFollow()
  .then(() => {
    log('Auto-follow script completed');
  })
  .catch(error => {
    log(`Critical error: ${error.message}`, 'FATAL');
    console.error(error);
  }); 
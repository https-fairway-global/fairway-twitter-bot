# Twitter API Setup Guide

This document provides a comprehensive guide for setting up your Twitter API credentials for the AI Twitter Bot.

## Twitter API Requirements

The bot uses Twitter API v2, which has specific rate limiting considerations:

### Free Tier Limitations
- **POST /2/tweets**: 50 requests per day (bot conservatively uses 15)
- **GET /2/users/:id/mentions**: 1 request per 15 minutes
- **GET /2/users/me**: 75 requests per 15 minutes

Due to these limits, the bot is configured to be extremely conservative with API calls on the free tier.

## Required Credentials

The bot requires two sets of Twitter API credentials:

### 1. Twitter API v1.1 Credentials
These are used for some legacy endpoints like direct messages:
- `TWITTER_API_KEY`
- `TWITTER_API_SECRET`
- `TWITTER_ACCESS_TOKEN`
- `TWITTER_ACCESS_SECRET`

### 2. Twitter API v2 OAuth 2.0 Credentials
These are used for more modern authentication flows:
- `TWITTER_CLIENT_ID`
- `TWITTER_CLIENT_SECRET`

## Step-by-Step Setup Guide

### Step 1: Create a Twitter Developer Account
1. Go to [Twitter Developer Portal](https://developer.twitter.com/en)
2. Sign in with your Twitter account
3. Apply for a developer account if you don't have one

### Step 2: Create a Project and App
1. In the Developer Portal, create a new Project
2. Within the Project, create a new App
3. Set the App permissions to "Read and Write"
4. Set the Type of App to "Web App, Automated App or Bot"

### Step 3: Set Up Authentication
1. In your App settings, navigate to the "Authentication settings" section
2. Enable OAuth 2.0
3. Set the Callback URL to `http://localhost:3000/auth/twitter/callback`
4. Set the Website URL to your website or `http://localhost:3000` for development
5. Save your changes

### Step 4: Get API Keys and Tokens
1. From the App details page, copy the following credentials:
   - API Key (Consumer Key)
   - API Key Secret (Consumer Secret)
   
2. Generate Access Token and Secret:
   - In the App settings, navigate to the "Keys and tokens" tab
   - Generate "Access Token and Secret"
   - Copy these values

3. Get OAuth 2.0 Client ID and Secret:
   - In the App settings, find the OAuth 2.0 section
   - Copy the Client ID and Client Secret

### Step 5: Configure the Bot
1. Open the `.env` file in the root directory of the project
2. Fill in the following variables with your credentials:
   ```
   TWITTER_API_KEY=your_api_key
   TWITTER_API_SECRET=your_api_secret
   TWITTER_ACCESS_TOKEN=your_access_token
   TWITTER_ACCESS_SECRET=your_access_token_secret
   TWITTER_CLIENT_ID=your_oauth2_client_id
   TWITTER_CLIENT_SECRET=your_oauth2_client_secret
   ```
3. Set your tier status:
   ```
   USER_ON_TWITTER_PREMIUM=false
   ```
   Change to `true` if you have a premium Twitter API subscription.

## Troubleshooting

### 403 Forbidden Errors
If you receive 403 Forbidden errors when trying to post tweets:
1. Check that your App has "Read and Write" permissions
2. Verify your access tokens have the correct permissions
3. Ensure your developer account is in good standing

### 429 Rate Limit Errors
If you receive 429 Rate Limit errors:
1. The bot will automatically manage rate limits, but may need to delay operations
2. Consider upgrading to a paid Twitter API plan if you need more requests
3. Check the logs for rate limit information

### Authentication Failures
If you experience authentication issues:
1. Verify all credentials in the `.env` file
2. Make sure you are using the correct OAuth version for each endpoint
3. Check that your App is active in the Twitter Developer Portal

## Security Considerations

- **Never commit your API credentials to version control**
- The bot's `.gitignore` automatically excludes `.env` files
- Consider using environment variables or a secure credential manager in production

## Additional Resources

- [Twitter API Documentation](https://developer.twitter.com/en/docs)
- [Twitter API Rate Limits](https://developer.twitter.com/en/docs/twitter-api/rate-limits)
- [OAuth 2.0 Authorization Guide](https://developer.twitter.com/en/docs/authentication/oauth-2-0) 
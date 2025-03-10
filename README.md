# Fairway Twitter Bot

A sophisticated Twitter bot designed to promote Fairway's blockchain identity verification solutions on Cardano and other chains. Leveraging advanced AI, it delivers engaging content about decentralized identity, compliance, Web3 hiring, and blockchain technology with a "panicked AI intern" personality inspired by Glootie from Rick and Morty.

## Key Features

- **Intelligent Content Strategy**: Creates engaging content focused on Cardano, blockchain identity, compliance, and related topics
- **Automated Network Building**: Automatically follows relevant accounts in your industry based on customizable criteria
- **Smart Engagement System**: Automatically finds and engages with relevant conversations using prioritized hashtags and keywords
- **Strategic Following**: Discovers and follows relevant accounts based on customizable criteria including follower count, bio keywords, and activity levels
- **Balanced Promotion**: Maintains a 50/50 split between promotional and non-promotional content
- **Voice & Tone**: Confident, witty, slightly irreverent tone that challenges outdated systems
- **API Efficiency**: Automatically respects Twitter API rate limits for free tier users
- **Dashboard**: Real-time analytics dashboard to monitor performance and activity
- **Content Customization**: Weighted topic selection to emphasize priority topics
- **Optimized Performance**: Streamlined dependencies and improved startup reliability
- **Robust Error Handling**: Graceful handling of Twitter API rate limits and other potential errors

## Auto-Follow Functionality

The bot includes a powerful auto-follow system that helps grow your Twitter network by finding and following accounts relevant to your industry. This feature:

- Automatically discovers accounts based on keywords you define
- Applies sophisticated filtering based on follower counts, following counts, verification status, etc.
- Respects daily follow limits to avoid triggering Twitter's anti-spam measures
- Targets accounts with specific keywords in their bio
- Logs all auto-follow activity for your review
- Can be easily enabled/disabled via environment variables

To enable auto-follow, make sure `TWITTER_USER_ID` is properly set and `TWITTER_AUTO_FOLLOW_ENABLED` is set to `true` in your `.env` file.

## Content Strategy

The bot focuses on key areas relevant to Fairway's mission:

1. **Identity Verification & Digital Credentials** - Decentralized ID, self-sovereign identity, verifiable credentials
2. **Compliance, KYC & Regulation** - Privacy-preserving compliance, ZK proofs, tokenized compliance
3. **Web3 Hiring & Workforce Mobility** - Blockchain-based credentials for hiring and skills verification
4. **DeFi, Payments & Tokenized Finance** - Identity-backed stablecoins and compliant DeFi  
5. **Enterprise & Government Adoption** - Digital ID frameworks for public services and corporate KYC
6. **Cardano, Midnight & Blockchain Infrastructure** - Cardano's CIP-113, Midnight's privacy features
7. **Ethiopia & Emerging Markets** - Blockchain adoption and financial inclusion in emerging markets
8. **Legacy System Critique** - Highlighting inefficiencies in traditional identity and financial systems

## Engagement Rules

The bot follows specific rules when engaging with tweets:

1. **Minimum Likes Threshold**: Only engages with tweets that have at least 10 likes to ensure quality interactions
2. **Engagement Types**:
   - **Fun**: Generates witty replies with memes or jokes while keeping it organic
   - **Fairway**: Offers insights on existing solution problems and Fairway's improvements
   - **Parody**: Creates satirical responses related to Web3 regulation and bureaucracy
3. **Rate Limiting**: Respects Twitter API rate limits and includes exponential backoff
4. **Error Handling**: Gracefully handles API errors and provides clear feedback

## Getting Started

To get started with the Fairway Twitter Bot, follow these steps:

1. Clone this repository to your local machine
2. Install the necessary dependencies using npm:
   ```
   npm install
   ```
3. Set up your Twitter developer account and obtain API keys (see "Twitter API Setup" below)
4. Configure the bot with your Twitter API keys and other credentials by creating a `.env` file using the `.env.example` template
5. Start the bot:
   ```
   npm run start
   ```

### Twitter API Setup

The bot requires Twitter API v2 credentials to function. Due to Twitter's API limitations for free tier users, the bot is configured to be conservative with API calls.

#### Required Credentials:
- Twitter API v1.1 credentials (API Key, API Secret, Access Token, Access Secret)
- Twitter API v2 OAuth 2.0 credentials (Client ID, Client Secret)

For detailed instructions on setting up your Twitter API credentials, please see the [Twitter API Setup Guide](docs/twitter_api_setup.md).

### OpenAI API Setup

The bot uses OpenAI to generate content. You'll need to:

1. Create an OpenAI API key at https://platform.openai.com
2. Add your API key to the `.env` file

### Free Tier Limitations

If you're using the Twitter API free tier, be aware of these limitations:
- Only 50 tweets per day (bot conservatively uses max 3)
- Limited mentions and direct message checking
- Restricted analytics capabilities

The bot automatically adjusts its behavior based on whether you're using the free or premium tier.

## Dashboard

The bot includes a real-time dashboard that you can access at `http://localhost:3000/dashboard` to monitor:
- Total tweets and engagement metrics
- Recent and top-performing tweets
- Performance by topic
- Best posting times
- Current tweet schedules

## Customizing Content Strategy

To customize the content strategy:

1. Modify the prompts in `src/constants/topic-prompts.constant.ts`
2. Adjust topic weights in `src/modules/manage-tweet/manage-tweet.service.ts`
3. Update hashtags and keywords in `src/constants/hashtags.constant.ts`
4. Adjust the bot's tone in `docs/tone-guide.md`

## Bot Personality & Tone

The bot uses a unique "panicked intern" personality inspired by Glootie from Rick and Morty. This distinctive voice:

- Makes the bot stand out from corporate accounts
- Creates more engaging and memorable content
- Fits with the bot's mission of challenging outdated systems
- Balances humor with substantive blockchain knowledge

For detailed guidance on the bot's tone and personality, see the [Tone Guide](docs/tone-guide.md).

## Troubleshooting

If you encounter issues:
- Check the application logs in the `logs/` directory for detailed error messages
- Ensure all required API keys are correctly set in your `.env` file
- Verify your Twitter API credentials have the appropriate permissions
- Use the debugging scripts (`verify-env.js`, `test-autofollow.js`) to troubleshoot specific features
- Check that your `TWITTER_USER_ID` is correctly set in the `.env` file

## Debugging Tools

The application includes several utility scripts to help with debugging:
- `verify-env.js` - Verifies that all required environment variables are set correctly
- `test-autofollow.js` - Tests the auto-follow functionality without affecting the main application
- `debug-app.js` - Provides detailed logs during application startup
- `run-app.js` - Monitors the application startup process with better error reporting

## Contributing

Contributions to improve the bot are welcome! Feel free to submit pull requests with new features, bug fixes, or improvements.

## License

This project is licensed under the [MIT License](LICENSE).

## Contact

If you have any questions, suggestions, or feedback, feel free to reach out to me at [anthony@nwobodo.me].

## Environment Variables

### Twitter API Configuration

- `TWITTER_API_KEY`: Your Twitter API key
- `TWITTER_API_SECRET`: Your Twitter API secret
- `TWITTER_ACCESS_TOKEN`: Your Twitter access token
- `TWITTER_ACCESS_SECRET`: Your Twitter access token secret
- `TWITTER_USER_ID`: Your Twitter user ID for API v2 (REQUIRED for auto-follow functionality)

### Auto-Follow Configuration

- `TWITTER_AUTO_FOLLOW_ENABLED`: Set to 'true' to enable automatic following (default: false)
- `TWITTER_FOLLOW_KEYWORDS`: Comma-separated list of keywords to search for users to follow (default: "programming,javascript,tech")
- `TWITTER_MAX_FOLLOWS_PER_DAY`: Maximum number of users to follow per day (default: 2)
- `TWITTER_FOLLOW_MIN_FOLLOWERS`: Minimum follower count for accounts to follow (default: 100)
- `TWITTER_FOLLOW_MAX_FOLLOWERS`: Maximum follower count for accounts to follow (default: 100000)
- `TWITTER_FOLLOW_MIN_FOLLOWING`: Minimum following count for accounts to follow (default: 10)
- `TWITTER_FOLLOW_MAX_FOLLOWING`: Maximum following count for accounts to follow (default: 5000)
- `TWITTER_FOLLOW_MIN_TWEETS`: Minimum tweet count for accounts to follow (default: 50)
- `TWITTER_FOLLOW_MUST_BE_VERIFIED`: Set to 'true' to only follow verified accounts (default: false)
- `TWITTER_FOLLOW_MUST_HAVE_PICTURE`: Set to 'true' to only follow accounts with profile pictures (default: true)
- `TWITTER_FOLLOW_MUST_HAVE_BIO`: Set to 'true' to only follow accounts with bios (default: true)
- `TWITTER_FOLLOW_MIN_ACCOUNT_AGE`: Minimum account age in days (default: 30)
- `TWITTER_FOLLOW_BIO_KEYWORDS`: Comma-separated list of keywords that must appear in user bios (optional)

## Optimizing Performance

If you encounter sluggish performance or high memory usage:

1. **Clean dependencies**: Periodically run `npm prune` to remove unused dependencies
2. **Restart services**: Restart the application if you notice memory leaks or decreased performance over time
3. **Check logs**: Monitor the log files in the `logs/` directory for any recurring errors or warnings
4. **Adjust polling frequencies**: If needed, modify the cron schedules in the services to reduce API calls
# Fairway Twitter Bot

A sophisticated Twitter bot designed to promote Fairway's blockchain identity verification solutions on Cardano and other chains. Leveraging advanced AI, it delivers engaging content about decentralized identity, compliance, Web3 hiring, and blockchain technology.

## Features

- **Intelligent Content Strategy**: Creates engaging content focused on Cardano, blockchain identity, compliance, and related topics
- **Smart Engagement System**: Automatically finds and engages with relevant conversations using prioritized hashtags and keywords
- **Strategic Following**: Discovers and follows relevant accounts based on customizable criteria including follower count, bio keywords, and activity levels
- **Balanced Promotion**: Maintains a 50/50 split between promotional and non-promotional content
- **Voice & Tone**: Confident, witty, slightly irreverent tone that challenges outdated systems
- **API Efficiency**: Automatically respects Twitter API rate limits for free tier users
- **Dashboard**: Real-time analytics dashboard to monitor performance and activity
- **Content Customization**: Weighted topic selection to emphasize priority topics

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
3. Update hashtags and keywords in `src/modules/user-interactions/user-interactions.service.ts`

## Troubleshooting

If you encounter issues:
- Check the application logs for specific error messages
- Ensure all required API keys are correctly set in your `.env` file
- Verify your Twitter API credentials have the appropriate permissions

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
- `TWITTER_USER_ID`: Your Twitter user ID for API v2

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
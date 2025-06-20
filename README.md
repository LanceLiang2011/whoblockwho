# Whoblockwho - Bluesky Blocked Post Info Bot

## How to Use

The bot works for both **reposts** and **quote posts** with blocked content:

### Scenario 1: Blocked Reposts

1. **Find a Blocked Repost**: Look for reposts that show "[Post unavailable]" in your Bluesky feed
2. **Mention the Bot**: Reply to that repost and mention `@whoblockthis.bsky.social`
3. **Get the Answer**: The bot identifies who blocked whom in the repost relationship

### Scenario 2: Blocked Quote Posts

1. **Find a Quote Post with Blocked Content**: Look for quote posts where the quoted content shows as blocked/unavailable
2. **Mention the Bot**: Reply to that quote post and mention `@whoblockthis.bsky.social`
3. **Get the Answer**: The bot identifies who blocked whom in the quote relationship

### Response Examples

The bot will analyze the blocking relationship and reply with messages like:

- `🛈 The repost by @alice shows "[Post unavailable]" **because @bob has blocked @alice**. The original post by @bob is hidden from the reposter.`
- `🛈 The original post by @alice is hidden **because @alice has blocked you**.`
- `🛈 The original post by @alice is hidden **because you have blocked @alice**.`bot that identifies who blocked whom when posts are hidden. When users see "[Post unavailable]" due to blocking, they can mention the bot to find out the blocking relationship.

## Features

- **Automatic Mention Monitoring**: Continuously monitors for mentions of the bot
- **Post Parsing**: Intelligently identifies original posts from reposts and reply chains
- **Modular Architecture**: Built with SOLID principles for maintainability
- **TypeScript Support**: Full type safety and development experience

## Prerequisites

1. **Bluesky Account**: A dedicated bot account on Bluesky
2. **App Password**: Generate an app password in Bluesky Settings → App Passwords
3. **Node.js**: Version 16 or higher

## Setup

1. **Clone and Install**:

   ```bash
   npm install
   ```

2. **Configure Environment**:
   Your `.env` file should have:

   ```env
   BSKY_HANDLE=whoblockthis.bsky.social
   BSKY_APP_PASSWORD=your-actual-app-password
   POLL_INTERVAL_MS=30000
   MAX_NOTIFICATIONS_PER_POLL=50
   ```

3. **Get Your App Password**:

   - Go to Bluesky Settings → App Passwords
   - Create a new app password for the bot
   - Update `BSKY_APP_PASSWORD` in `.env`

4. **Run the Bot**:

   ```bash
   npm run dev
   ```

## Usage

Once the bot is running, here's how to use it:

1. **Find a Hidden Post**: Look for reposts that show "[Post unavailable]" in your Bluesky feed
2. **Mention the Bot**: Reply to that repost and mention `@whoblockthis.bsky.social`
3. **Get the Answer**: The bot will analyze the blocking relationship and reply with one of:
   - `� The original post by @alice is hidden **because @alice has blocked you**.`
   - `� The original post by @alice is hidden **because you have blocked @alice**.`
   - `� The original post by @alice is unavailable, but no direct block between you and @alice was found. It may have been deleted or hidden by a moderation list.`

### Example

```text
User sees: "John reposted [Post unavailable]"
User replies: "@whoblockthis.bsky.social why can't I see this?"
Bot replies: "� The original post by @alice is hidden because @alice has blocked you."
```

## Project Structure

```text
src/
├── auth/           # Authentication module (Step 1)
├── notifications/  # Mention monitoring (Step 2)
├── post-parser/    # Original post identification (Step 3)
├── block-checker/  # Block relationship analysis (Step 4)
├── response/       # Reply generation and sending (Step 5)
├── types/          # TypeScript type definitions
├── config/         # Configuration management
├── bot.ts          # Main bot orchestrator
└── index.ts        # Entry point
```

## Current Implementation Status

✅ **Step 1: Authentication** - Bot can log in to Bluesky using AT Protocol
✅ **Step 2: Mention Monitoring** - Continuously monitors for bot mentions
✅ **Step 3: Post Parsing** - Identifies original posts from reposts and replies
✅ **Step 4: Block Relationship Checking** - Uses Bluesky's public block graph API
✅ **Step 5: Response Generation** - Sends informative replies about block relationships

## How It Works

1. **Authentication**: The bot logs in using your Bluesky handle and app password
2. **Monitoring**: Polls Bluesky's notification feed every 30 seconds for mentions
3. **Parsing**: When mentioned, analyzes the reply chain to find the original hidden post
4. **Block Analysis**: Uses Bluesky's public block graph API to check relationships
5. **Response**: Sends an informative reply explaining who blocked whom

## Development

- **TypeScript**: Full type safety with strict mode enabled
- **Modular Design**: Each responsibility separated into its own module
- **Error Handling**: Comprehensive error handling and logging
- **Graceful Shutdown**: Proper cleanup on SIGINT/SIGTERM

## Next Steps

The current implementation covers all steps of the bot development:

- ✅ Bluesky authentication
- ✅ Mention monitoring
- ✅ Original post identification
- ✅ Block relationship detection using public graph API
- ✅ Intelligent response generation with fallback cases

## Bot Response Examples

The bot will respond with messages like:

- `� The original post by @alice is hidden **because @alice has blocked you**.`
- `� The original post by @alice is hidden **because you have blocked @alice**.`
- `� The original post by @alice is unavailable, but no direct block between you and @alice was found. It may have been deleted or hidden by a moderation list.`

## Environment Variables

| Variable                     | Description                          | Default  |
| ---------------------------- | ------------------------------------ | -------- |
| `BSKY_HANDLE`                | Your bot's Bluesky handle            | Required |
| `BSKY_APP_PASSWORD`          | App password from Bluesky settings   | Required |
| `POLL_INTERVAL_MS`           | How often to check for mentions (ms) | 30000    |
| `MAX_NOTIFICATIONS_PER_POLL` | Max notifications per check          | 50       |

## Security Notes

- Never commit your `.env` file
- Use app passwords, not your main Bluesky password
- The `.env` file is already in `.gitignore`

## Deployment to Railway

This bot is ready for deployment to Railway with all necessary configuration files included.

### Deployment Prerequisites

1. **GitHub Repository**: Push your code to GitHub
2. **Railway Account**: Sign up at [railway.app](https://railway.app)
3. **Bluesky App Password**: Generate one in Bluesky Settings → App Passwords

### Deployment Steps

1. **Connect to Railway**:

   - Go to [railway.app](https://railway.app) and sign up with GitHub
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your `whoblockwho` repository

2. **Configure Environment Variables**:
   In Railway dashboard, go to your project → **Variables** tab and add:

   ```env
   BSKY_HANDLE=your-bot-handle.bsky.social
   BSKY_APP_PASSWORD=your_app_password_here
   NODE_ENV=production
   ```

3. **Deploy**:

   - Railway will automatically detect the Dockerfile
   - The build process will install dependencies and compile TypeScript
   - Your bot will start automatically

4. **Monitor**:
   - Check the **Logs** tab in Railway dashboard
   - Visit the **Metrics** tab to monitor resource usage
   - Health check endpoint available at: `https://your-app.railway.app/health`

### Deployment Files Included

- **`Dockerfile`**: Multi-stage optimized container build (includes TypeScript compilation)
- **`.dockerignore`**: Excludes unnecessary files from Docker build
- **Health Check**: Built-in HTTP server for monitoring at `/health`

### Costs

Railway provides $5/month in free credits, which is typically sufficient for a bot like this.

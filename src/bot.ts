import { ConfigManager } from "./config";
import { BlueskyAuthenticator } from "./auth";
import { NotificationMonitor } from "./notifications";
import { PostParser } from "./post-parser";
import { BlockRelationshipChecker } from "./block-checker";
import { ResponseSender } from "./response";
import { NotificationData, ParsedPostInfo, BotActors } from "./types";

export class WhoblockwhoBot {
  private config = ConfigManager.getInstance().getConfig();
  private authenticator: BlueskyAuthenticator;
  private notificationMonitor!: NotificationMonitor;
  private postParser!: PostParser;
  private blockChecker!: BlockRelationshipChecker;
  private responseSender!: ResponseSender;

  constructor() {
    this.authenticator = new BlueskyAuthenticator(this.config);
  }

  public async start(): Promise<void> {
    try {
      console.log("Starting Whoblockwho Bot...");

      // Step 1: Authenticate with Bluesky
      await this.authenticator.login();

      const agent = this.authenticator.getAgent();

      // Initialize modules with authenticated agent
      this.notificationMonitor = new NotificationMonitor(agent, this.config);
      this.postParser = new PostParser(agent);
      this.blockChecker = new BlockRelationshipChecker(agent);
      this.responseSender = new ResponseSender(agent);

      // Step 2: Start monitoring mentions
      await this.notificationMonitor.startMonitoring(
        this.handleMention.bind(this)
      );

      console.log("Bot is now running and monitoring mentions...");

      // Set up graceful shutdown
      this.setupGracefulShutdown();
    } catch (error) {
      console.error("Failed to start bot:", error);
      process.exit(1);
    }
  }

  private async handleMention(notification: NotificationData): Promise<void> {
    try {
      console.log(
        `\n--- Processing mention from @${notification.author.handle} ---`
      );

      // Step 3: Parse the mention to find the original post
      const parsedPostInfo = await this.postParser.parseOriginalPost(
        notification
      );

      if (parsedPostInfo) {
        console.log(
          `Successfully identified original post by @${parsedPostInfo.original.authorHandle}`
        );

        if (parsedPostInfo.reposter) {
          console.log(`Reposted by @${parsedPostInfo.reposter.handle}`);
        }

        // Step 4: Check block relationships
        const actors: BotActors = {
          viewer: {
            did: notification.author.did,
            handle: notification.author.handle,
          },
          author: {
            did: parsedPostInfo.original.authorDid,
            handle: parsedPostInfo.original.authorHandle,
          },
          reposter: parsedPostInfo.reposter
            ? {
                did: parsedPostInfo.reposter.did,
                handle: parsedPostInfo.reposter.handle,
              }
            : undefined,
        };

        const blockAnalysis =
          await this.blockChecker.analyzeAllBlockRelationships(actors);

        // Step 5: Generate and send response
        const replyText =
          this.blockChecker.generateComprehensiveReplyText(blockAnalysis);

        console.log(`Sending reply: ${replyText}`);

        // Reply to the mention
        const success = await this.responseSender.sendReply(
          notification.uri,
          notification.cid,
          replyText
        );

        if (success) {
          console.log("Successfully sent reply to mention");
        } else {
          console.error("Failed to send reply");
        }
      } else {
        console.log("Could not identify original post - sending help message");

        // Send a helpful response when we can't identify the original post
        const helpText = `🚫 I couldn't find a hidden post to analyze. Please mention me in a reply to a repost that shows "[Post unavailable]" and I'll tell you who blocked whom!`;

        const success = await this.responseSender.sendReply(
          notification.uri,
          notification.cid,
          helpText
        );

        if (success) {
          console.log("Successfully sent help message");
        } else {
          console.error("Failed to send help message");
        }
      }
    } catch (error) {
      console.error("Error handling mention:", error);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = () => {
      console.log("\\nShutting down bot gracefully...");

      if (this.notificationMonitor) {
        this.notificationMonitor.stopMonitoring();
      }

      if (this.authenticator) {
        this.authenticator.logout();
      }

      console.log("Bot shut down complete");
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }

  public async stop(): Promise<void> {
    console.log("Stopping bot...");

    if (this.notificationMonitor) {
      this.notificationMonitor.stopMonitoring();
    }

    await this.authenticator.logout();
    console.log("Bot stopped");
  }
}

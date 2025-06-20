import { AtpAgent } from "@atproto/api";
import { NotificationData, BotConfig } from "../types";

export class NotificationMonitor {
  private agent: AtpAgent;
  private config: BotConfig;
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private processedNotifications: Set<string> = new Set();

  constructor(agent: AtpAgent, config: BotConfig) {
    this.agent = agent;
    this.config = config;
  }

  public async startMonitoring(
    onMentionCallback: (notification: NotificationData) => Promise<void>
  ): Promise<void> {
    if (this.isMonitoring) {
      console.log("Already monitoring notifications");
      return;
    }

    console.log(
      `Starting notification monitoring (checking every ${this.config.pollIntervalMs}ms)`
    );
    this.isMonitoring = true;

    // Check immediately on start
    await this.checkMentions(onMentionCallback);

    // Set up periodic checking
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkMentions(onMentionCallback);
      } catch (error) {
        console.error("Error checking mentions:", error);
      }
    }, this.config.pollIntervalMs);
  }

  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    // Clear processed notifications when stopping
    this.processedNotifications.clear();
    console.log("Stopped monitoring notifications and cleared processed list");
  }

  private async checkMentions(
    onMentionCallback: (notification: NotificationData) => Promise<void>
  ): Promise<void> {
    try {
      console.log("Checking for new mentions...");

      const response = await this.agent.listNotifications({
        limit: this.config.maxNotificationsPerPoll,
        reasons: ["mention"],
      });

      // Filter for mentions we haven't processed yet (regardless of read status)
      const unprocessedMentions = response.data.notifications.filter(
        (notif: any) =>
          notif.reason === "mention" &&
          !this.processedNotifications.has(notif.uri)
      );

      console.log(`Found ${unprocessedMentions.length} unprocessed mentions`);

      for (const notif of unprocessedMentions) {
        try {
          // Mark as processed before handling to avoid duplicates
          this.processedNotifications.add(notif.uri);

          const notificationData: NotificationData = {
            uri: notif.uri,
            cid: notif.cid,
            author: {
              did: notif.author.did,
              handle: notif.author.handle,
              displayName: notif.author.displayName,
            },
            reason: notif.reason,
            record: notif.record,
            isRead: notif.isRead,
            indexedAt: notif.indexedAt,
          };

          console.log(
            `Processing mention from @${notif.author.handle} (${notif.uri})`
          );
          await onMentionCallback(notificationData);
          console.log(
            `Successfully processed mention from @${notif.author.handle}`
          );
        } catch (error) {
          console.error(
            `Error processing mention from @${notif.author.handle}:`,
            error
          );
          // Don't remove from processed set on error - we don't want to retry failed mentions
        }
      }

      // Only mark notifications as seen if we processed some
      // This is safer than marking all as read
      if (unprocessedMentions.length > 0) {
        // Mark as seen with a slight delay to ensure processing is complete
        setTimeout(async () => {
          try {
            await this.agent.updateSeenNotifications();
            console.log("Marked notifications as read");
          } catch (error) {
            console.error("Error marking notifications as read:", error);
          }
        }, 1000);
      }

      // Clean up old processed notifications (keep last 1000 to prevent memory issues)
      if (this.processedNotifications.size > 1000) {
        const notificationsArray = Array.from(this.processedNotifications);
        this.processedNotifications = new Set(notificationsArray.slice(-500));
        console.log("Cleaned up old processed notifications");
      }
    } catch (error) {
      console.error("Error in checkMentions:", error);
      throw error;
    }
  }

  public isCurrentlyMonitoring(): boolean {
    return this.isMonitoring;
  }
}

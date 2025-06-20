import { AtpAgent } from "@atproto/api";
import { NotificationData, BotConfig } from "../types";

export class NotificationMonitor {
  private agent: AtpAgent;
  private config: BotConfig;
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

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
    console.log("Stopped monitoring notifications");
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

      const unreadMentions = response.data.notifications.filter(
        (notif: any) => !notif.isRead && notif.reason === "mention"
      );

      console.log(`Found ${unreadMentions.length} unread mentions`);

      for (const notif of unreadMentions) {
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

        await onMentionCallback(notificationData);
      }

      // Mark notifications as read after processing
      if (unreadMentions.length > 0) {
        await this.agent.updateSeenNotifications();
        console.log("Marked notifications as read");
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

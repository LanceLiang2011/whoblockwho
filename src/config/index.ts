import * as dotenv from "dotenv";
import { BotConfig } from "../types";

dotenv.config();

export class ConfigManager {
  private static instance: ConfigManager;
  private config: BotConfig;

  private constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public getConfig(): BotConfig {
    return this.config;
  }

  private loadConfig(): BotConfig {
    return {
      bskyHandle: process.env.BSKY_HANDLE || "",
      bskyAppPassword: process.env.BSKY_APP_PASSWORD || "",
      pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || "30000"),
      maxNotificationsPerPoll: parseInt(
        process.env.MAX_NOTIFICATIONS_PER_POLL || "50"
      ),
    };
  }

  private validateConfig(): void {
    const { bskyHandle, bskyAppPassword } = this.config;

    if (!bskyHandle) {
      throw new Error("BSKY_HANDLE environment variable is required");
    }

    if (!bskyAppPassword) {
      throw new Error("BSKY_APP_PASSWORD environment variable is required");
    }

    if (!bskyHandle.includes(".")) {
      throw new Error(
        "BSKY_HANDLE must be a valid handle (e.g., username.bsky.social)"
      );
    }
  }
}

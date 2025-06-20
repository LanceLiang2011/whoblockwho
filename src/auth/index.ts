import { AtpAgent } from "@atproto/api";
import { BotConfig } from "../types";

export class BlueskyAuthenticator {
  private agent: AtpAgent;
  private isAuthenticated: boolean = false;

  constructor(private config: BotConfig) {
    this.agent = new AtpAgent({
      service: "https://bsky.social",
    });
  }

  public async login(): Promise<void> {
    try {
      console.log(`Attempting to login with handle: ${this.config.bskyHandle}`);

      await this.agent.login({
        identifier: this.config.bskyHandle,
        password: this.config.bskyAppPassword,
      });

      this.isAuthenticated = true;
      console.log("Successfully authenticated with Bluesky");
    } catch (error) {
      this.isAuthenticated = false;
      console.error("Failed to authenticate with Bluesky:", error);
      throw new Error(`Authentication failed: ${error}`);
    }
  }

  public getAgent(): AtpAgent {
    if (!this.isAuthenticated) {
      throw new Error("Agent is not authenticated. Call login() first.");
    }
    return this.agent;
  }

  public isLoggedIn(): boolean {
    return this.isAuthenticated;
  }

  public async logout(): Promise<void> {
    // Note: AtpAgent doesn't have explicit logout, but we can clear our state
    this.isAuthenticated = false;
    console.log("Logged out");
  }
}

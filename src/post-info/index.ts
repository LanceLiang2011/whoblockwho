export class PostInfoGenerator {
  constructor() {
    // No agent needed since we're just formatting post information
  }

  public async generatePostInfo(
    originalAuthorHandle: string,
    originalPostUri: string,
    reposterHandle?: string,
    isReply: boolean = false
  ): Promise<string> {
    try {
      console.log(`Generating post info for @${originalAuthorHandle}`);

      // Convert AT Protocol URI to Bluesky web URL
      const originalPostUrl = this.convertAtUriToBskyUrl(originalPostUri);

      // Generate appropriate response based on scenario
      if (reposterHandle) {
        if (isReply) {
          return `The original post is by @${originalAuthorHandle} and @${reposterHandle} replied to it. Original post: ${originalPostUrl}`;
        } else {
          return `The original post is by @${originalAuthorHandle} and reposted by @${reposterHandle}. Original post: ${originalPostUrl}`;
        }
      } else {
        return `The original post is by @${originalAuthorHandle}. Link: ${originalPostUrl}`;
      }
    } catch (error) {
      console.error("Error generating post info:", error);
      return "Could not analyze the post relationship.";
    }
  }

  private convertAtUriToBskyUrl(atUri: string): string {
    try {
      // AT Protocol URI format: at://did:plc:example/app.bsky.feed.post/recordkey
      const parts = atUri.split("/");
      if (
        parts.length >= 4 &&
        parts[0] === "at:" &&
        parts[3] === "app.bsky.feed.post"
      ) {
        const did = parts[2];
        const rkey = parts[4];
        return `https://bsky.app/profile/${did}/post/${rkey}`;
      }
      // Fallback if we can't parse the URI
      return atUri;
    } catch (error) {
      console.error("Error converting AT URI to Bsky URL:", error);
      return atUri;
    }
  }
}

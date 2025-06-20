export class PostInfoGenerator {
  constructor() {
    // No agent needed since we're just formatting post information
  }

  public async generatePostInfo(
    originalAuthorHandle: string,
    reposterHandle?: string,
    isReply: boolean = false
  ): Promise<string> {
    try {
      console.log(`Generating post info for @${originalAuthorHandle}`);

      // Generate appropriate response based on scenario
      if (reposterHandle) {
        if (isReply) {
          return `The original post is by @${originalAuthorHandle} and @${reposterHandle} replied to it.`;
        } else {
          return `The original post is by @${originalAuthorHandle} and reposted by @${reposterHandle}.`;
        }
      } else {
        return `The original post is by @${originalAuthorHandle}.`;
      }
    } catch (error) {
      console.error("Error generating post info:", error);
      return "Could not analyze the post relationship.";
    }
  }
}

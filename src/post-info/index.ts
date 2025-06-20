import { AtpAgent } from "@atproto/api";

export class PostInfoGenerator {
  private agent: AtpAgent;

  constructor(agent: AtpAgent) {
    this.agent = agent;
  }

  public async generatePostInfo(
    originalAuthorHandle: string,
    reposterHandle?: string,
    isReply: boolean = false
  ): Promise<string> {
    try {
      console.log(`Generating post info for @${originalAuthorHandle}`);

      // Generate appropriate response based on scenario with clickable profile links
      const originalAuthorLink = `https://bsky.app/profile/${originalAuthorHandle}`;
      
      if (reposterHandle) {
        const reposterLink = `https://bsky.app/profile/${reposterHandle}`;

        if (isReply) {
          return `The original post is by ${originalAuthorLink} and ${reposterLink} replied to it.`;
        } else {
          return `The original post is by ${originalAuthorLink} and reposted by ${reposterLink}.`;
        }
      } else {
        return `The original post is by ${originalAuthorLink}.`;
      }
    } catch (error) {
      console.error("Error generating post info:", error);
      return "Could not analyze the post relationship.";
    }
  }


}

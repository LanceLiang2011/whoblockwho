import { AtpAgent } from "@atproto/api";

export class BlockRelationshipChecker {
  private agent: AtpAgent;

  constructor(agent: AtpAgent) {
    this.agent = agent;
  }

  public async analyzeSimpleBlocking(
    userDid: string,
    userHandle: string,
    originalAuthorDid: string,
    originalAuthorHandle: string,
    reposterHandle?: string,
    isReply: boolean = false
  ): Promise<string> {
    try {
      console.log(`Checking if @${userHandle} blocks @${originalAuthorHandle}`);

      // Only check if user blocks the original author
      const userBlocksOriginal = await this.checkUserBlocksAuthor(
        userDid,
        originalAuthorDid
      );

      console.log(`User blocks original author: ${userBlocksOriginal}`);

      // Generate appropriate response based on scenario
      if (reposterHandle) {
        const blockText = userBlocksOriginal
          ? ` You have blocked @${originalAuthorHandle}.`
          : "";
        
        if (isReply) {
          return `The original post is by @${originalAuthorHandle} and @${reposterHandle} replied to it.${blockText}`;
        } else {
          return `The original post is by @${originalAuthorHandle} and reposted by @${reposterHandle}.${blockText}`;
        }
      } else {
        const blockText = userBlocksOriginal
          ? ` You have blocked @${originalAuthorHandle}.`
          : "";
        return `The original post is by @${originalAuthorHandle}.${blockText}`;
      }
    } catch (error) {
      console.error("Error analyzing blocking:", error);
      return "Could not analyze the post relationship.";
    }
  }

  private async checkUserBlocksAuthor(
    userDid: string,
    authorDid: string
  ): Promise<boolean> {
    try {
      const response = await this.agent.api.app.bsky.graph.getRelationships({
        actor: userDid,
        others: [authorDid],
      });

      if (
        !response.data.relationships ||
        response.data.relationships.length === 0
      ) {
        return false;
      }

      const relationship = response.data.relationships[0];
      const relationshipData = relationship as any;

      return relationshipData.blocking || false;
    } catch (error) {
      console.error(`Error checking if user blocks author:`, error);
      return false;
    }
  }
}

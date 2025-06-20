import { AtpAgent } from "@atproto/api";
import {
  BlockRelationship,
  ComprehensiveBlockAnalysis,
  BotActors,
} from "../types";

export class BlockRelationshipChecker {
  private agent: AtpAgent;

  constructor(agent: AtpAgent) {
    this.agent = agent;
  }

  public async analyzeAllBlockRelationships(
    actors: BotActors
  ): Promise<ComprehensiveBlockAnalysis> {
    try {
      console.log(`\n=== COMPREHENSIVE BLOCK ANALYSIS ===`);
      console.log(`Viewer: @${actors.viewer.handle}`);
      console.log(`Author: @${actors.author.handle}`);
      if (actors.reposter) {
        console.log(`Reposter: @${actors.reposter.handle}`);
      }

      // Check all possible relationships
      const viewerAuthorRelation = await this.getRelationship(
        actors.viewer.did,
        actors.author.did
      );
      console.log(
        `Viewer ↔ Author: blocking=${viewerAuthorRelation.blocking}, blockedBy=${viewerAuthorRelation.blockedBy}`
      );

      let viewerReposterRelation: BlockRelationship | undefined;
      let reposterAuthorRelation: BlockRelationship | undefined;

      if (actors.reposter) {
        viewerReposterRelation = await this.getRelationship(
          actors.viewer.did,
          actors.reposter.did
        );
        console.log(
          `Viewer ↔ Reposter: blocking=${viewerReposterRelation.blocking}, blockedBy=${viewerReposterRelation.blockedBy}`
        );

        // This is the KEY relationship that often causes "[Post unavailable]"
        reposterAuthorRelation = await this.getRelationship(
          actors.reposter.did,
          actors.author.did
        );
        console.log(
          `Reposter ↔ Author: blocking=${reposterAuthorRelation.blocking}, blockedBy=${reposterAuthorRelation.blockedBy}`
        );
      }

      return {
        viewerDid: actors.viewer.did,
        viewerHandle: actors.viewer.handle,
        authorDid: actors.author.did,
        authorHandle: actors.author.handle,
        reposterDid: actors.reposter?.did,
        reposterHandle: actors.reposter?.handle,
        viewerAuthorRelation,
        viewerReposterRelation,
        reposterAuthorRelation,
      };
    } catch (error) {
      console.error("Error analyzing block relationships:", error);
      throw error;
    }
  }

  private async getRelationship(
    actorDid: string,
    otherDid: string
  ): Promise<BlockRelationship> {
    try {
      const response = await this.agent.api.app.bsky.graph.getRelationships({
        actor: actorDid,
        others: [otherDid],
      });

      if (
        !response.data.relationships ||
        response.data.relationships.length === 0
      ) {
        console.warn(
          `No relationship data found between ${actorDid} and ${otherDid}`
        );
        return { blocking: false, blockedBy: false };
      }

      const relationship = response.data.relationships[0];

      // Handle the AT Protocol relationship type safely
      const relationshipData = relationship as any;

      return {
        blocking: relationshipData.blocking || false,
        blockedBy: relationshipData.blockedBy || false,
      };
    } catch (error) {
      console.error(
        `Error fetching relationship between ${actorDid} and ${otherDid}:`,
        error
      );
      // Return safe defaults on error
      return { blocking: false, blockedBy: false };
    }
  }

  public generateComprehensiveReplyText(
    analysis: ComprehensiveBlockAnalysis
  ): string {
    const {
      viewerAuthorRelation,
      viewerReposterRelation,
      reposterAuthorRelation,
      authorHandle,
      reposterHandle,
      viewerHandle,
    } = analysis;

    console.log(`\n=== GENERATING REPLY ===`);

    // Priority 1: Direct viewer-author blocking
    if (viewerAuthorRelation.blockedBy) {
      console.log(`Case: Author blocked viewer`);
      return `🛈 The original post by @${authorHandle} is hidden **because @${authorHandle} has blocked you**.`;
    }

    if (viewerAuthorRelation.blocking) {
      console.log(`Case: Viewer blocked author`);
      return `🛈 The original post by @${authorHandle} is hidden **because you have blocked @${authorHandle}**.`;
    }

    // Priority 2: Reposter-author blocking (the common cause of "[Post unavailable]")
    if (reposterAuthorRelation && reposterHandle) {
      if (reposterAuthorRelation.blockedBy) {
        console.log(`Case: Author blocked reposter`);
        return `🛈 The repost by @${reposterHandle} shows "[Post unavailable]" **because @${authorHandle} has blocked @${reposterHandle}**. The original post by @${authorHandle} is hidden from the reposter.`;
      }

      if (reposterAuthorRelation.blocking) {
        console.log(`Case: Reposter blocked author`);
        return `🛈 The repost by @${reposterHandle} shows "[Post unavailable]" **because @${reposterHandle} has blocked @${authorHandle}**. The reposter can't see @${authorHandle}'s content.`;
      }
    }

    // Priority 3: Viewer-reposter blocking
    if (viewerReposterRelation && reposterHandle) {
      if (viewerReposterRelation.blockedBy) {
        console.log(`Case: Reposter blocked viewer`);
        return `🛈 You cannot see this repost **because @${reposterHandle} has blocked you**. The original post is by @${authorHandle}.`;
      }

      if (viewerReposterRelation.blocking) {
        console.log(`Case: Viewer blocked reposter`);
        return `🛈 This repost appears hidden **because you have blocked @${reposterHandle}**. The original post is by @${authorHandle}.`;
      }
    }

    // Fallback: No blocking found
    console.log(`Case: No blocking relationships found`);
    if (reposterHandle) {
      return `🛈 The original post by @${authorHandle} (reposted by @${reposterHandle}) is unavailable, but no blocking relationships were found. It may have been deleted, restricted by a moderation list, or there may be a temporary issue.`;
    } else {
      return `🛈 The original post by @${authorHandle} is unavailable, but no direct block between you and @${authorHandle} was found. It may have been deleted or hidden by a moderation list.`;
    }
  }
}

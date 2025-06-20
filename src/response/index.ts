import { AtpAgent } from "@atproto/api";

export class ResponseSender {
  private agent: AtpAgent;

  constructor(agent: AtpAgent) {
    this.agent = agent;
  }

  public async sendReply(
    mentionPostUri: string,
    mentionPostCid: string,
    replyText: string,
    rootUri?: string,
    rootCid?: string
  ): Promise<boolean> {
    try {
      console.log("Sending reply:", replyText);

      // Create proper reply reference
      const replyRef = {
        root: {
          uri: rootUri || mentionPostUri,
          cid: rootCid || mentionPostCid,
        },
        parent: {
          uri: mentionPostUri,
          cid: mentionPostCid,
        },
      };

      const response = await this.agent.post({
        text: replyText,
        reply: replyRef,
      });

      if (response.uri) {
        console.log("Reply sent successfully:", response.uri);
        return true;
      } else {
        console.error("Failed to send reply - no URI returned");
        return false;
      }
    } catch (error) {
      console.error("Error sending reply:", error);
      return false;
    }
  }

  public async sendDirectPost(text: string): Promise<boolean> {
    try {
      console.log("Sending direct post:", text);

      const response = await this.agent.post({
        text: text,
      });

      if (response.uri) {
        console.log("Post sent successfully:", response.uri);
        return true;
      } else {
        console.error("Failed to send post - no URI returned");
        return false;
      }
    } catch (error) {
      console.error("Error sending post:", error);
      return false;
    }
  }
}

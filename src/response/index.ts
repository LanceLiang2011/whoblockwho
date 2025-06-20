import { AtpAgent, RichText } from "@atproto/api";

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

      // Create RichText object to handle facets for clickable mentions
      const rt = new RichText({ text: replyText });
      await rt.detectFacets(this.agent); // Auto-detects @mentions and makes them clickable

      // Create proper reply reference with correct threading
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

      // Send the post with rich text facets and reply threading
      const response = await this.agent.post({
        text: rt.text,
        facets: rt.facets,
        reply: replyRef,
        createdAt: new Date().toISOString(),
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

      // Create RichText object to handle facets for clickable mentions and links
      const rt = new RichText({ text });
      await rt.detectFacets(this.agent);

      const response = await this.agent.post({
        text: rt.text,
        facets: rt.facets,
        createdAt: new Date().toISOString(),
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

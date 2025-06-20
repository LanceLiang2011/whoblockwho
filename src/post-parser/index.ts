import { AtpAgent } from "@atproto/api";
import {
  NotificationData,
  OriginalPostInfo,
  ParsedPostInfo,
  PostRecord,
  ReplyReference,
} from "../types";

export class PostParser {
  private agent: AtpAgent;

  constructor(agent: AtpAgent) {
    this.agent = agent;
  }

  public async parseOriginalPost(
    notification: NotificationData
  ): Promise<ParsedPostInfo | null> {
    try {
      console.log(`Parsing mention from @${notification.author.handle}`);

      const mentionRecord = notification.record as PostRecord;

      if (!mentionRecord.reply) {
        console.log("Mention is not a reply, cannot determine original post");
        return null;
      }

      const parsedInfo = await this.findOriginalPost(mentionRecord.reply);

      if (parsedInfo) {
        console.log(
          `Found original post by @${parsedInfo.original.authorHandle}`
        );
        if (parsedInfo.reposter) {
          console.log(`Reposted by @${parsedInfo.reposter.handle}`);
        }
      } else {
        console.log("Could not determine original post");
      }

      return parsedInfo;
    } catch (error) {
      console.error("Error parsing original post:", error);
      return null;
    }
  }

  private async findOriginalPost(
    reply: ReplyReference
  ): Promise<ParsedPostInfo | null> {
    try {
      // Focus on the immediate parent post that the user is replying to
      const parentUri = reply.parent.uri;
      console.log(`Checking immediate parent post: ${parentUri}`);

      // SCENARIO 1: Repost with blocked content
      // When A reposts B's post and A↔B are blocked, the repost shows "[Post unavailable]"
      if (parentUri.includes("app.bsky.feed.repost")) {
        console.log("Detected repost - checking for blocked reposted content");
        return await this.handleRepost(parentUri);
      }

      // SCENARIO 2: Quote post with blocked content OR Reply to blocked post
      // When A quote posts B's post and A↔B are blocked, the quoted content shows as blocked
      // When B replies to A's post and user blocks A, the user sees B's reply but not A's original
      if (parentUri.includes("app.bsky.feed.post")) {
        console.log(
          "Detected direct post - checking for blocked quote content or reply to blocked post"
        );
        return await this.handleDirectPost(parentUri);
      }

      console.log(`Unknown URI format: ${parentUri}`);
      return null;
    } catch (error) {
      console.error("Error finding original post:", error);
      return null;
    }
  }

  private async getOriginalFromUri(
    uri: string
  ): Promise<ParsedPostInfo | null> {
    try {
      // Check if this is a repost URI
      if (uri.includes("app.bsky.feed.repost")) {
        return await this.handleRepost(uri);
      } else if (uri.includes("app.bsky.feed.post")) {
        return await this.handleDirectPost(uri);
      }

      console.log(`Unknown URI format: ${uri}`);
      return null;
    } catch (error) {
      console.error(`Error processing URI ${uri}:`, error);
      return null;
    }
  }

  private async handleRepost(
    repostUri: string
  ): Promise<ParsedPostInfo | null> {
    try {
      console.log(`Fetching repost: ${repostUri}`);

      const postsResponse = await this.agent.getPosts({ uris: [repostUri] });

      if (!postsResponse.data.posts || postsResponse.data.posts.length === 0) {
        console.log("Repost not found");
        return null;
      }

      const repost = postsResponse.data.posts[0];
      console.log(`Repost by @${repost.author.handle}`);

      // Get the immediate subject of the repost
      if (repost.record && (repost.record as any).subject) {
        const originalUri = (repost.record as any).subject.uri;
        console.log(`Repost points to immediate post: ${originalUri}`);

        // Extract the author from the URI directly (this is the blocked user)
        const originalAuthor = await this.extractAuthorFromUri(originalUri);
        if (originalAuthor) {
          console.log(
            `Found immediate original author: @${originalAuthor.authorHandle}`
          );
          return {
            original: originalAuthor,
            reposter: {
              handle: repost.author.handle,
              did: repost.author.did,
            },
          };
        }
      }

      // Check embed for blocked content (this indicates a block relationship)
      if (repost.embed) {
        const embedData = repost.embed as any;
        if (
          embedData.$type === "app.bsky.embed.record#view" &&
          embedData.record
        ) {
          const embeddedRecord = embedData.record;

          // If it's blocked or not found, this is what we're looking for
          if (embeddedRecord.blocked || embeddedRecord.notFound) {
            console.log("Found blocked content in repost embed");

            if (embeddedRecord.uri) {
              const blockedAuthor = await this.extractAuthorFromUri(
                embeddedRecord.uri
              );
              if (blockedAuthor) {
                console.log(
                  `Found blocked author: @${blockedAuthor.authorHandle}`
                );
                return {
                  original: blockedAuthor,
                  reposter: {
                    handle: repost.author.handle,
                    did: repost.author.did,
                  },
                };
              }
            }
          }

          // If we can see the author, this is the immediate original
          if (embeddedRecord.author) {
            console.log(
              `Found immediate original author in embed: @${embeddedRecord.author.handle}`
            );
            return {
              original: {
                uri: embeddedRecord.uri || "unknown",
                authorHandle: embeddedRecord.author.handle,
                authorDid: embeddedRecord.author.did,
              },
              reposter: {
                handle: repost.author.handle,
                did: repost.author.did,
              },
            };
          }
        }
      }

      console.log("Could not extract immediate original post info from repost");
      return null;
    } catch (error) {
      console.error("Error handling repost:", error);
      return null;
    }
  }

  private async handleDirectPost(
    postUri: string
  ): Promise<ParsedPostInfo | null> {
    try {
      console.log(`Fetching direct post: ${postUri}`);

      const postsResponse = await this.agent.getPosts({ uris: [postUri] });

      if (!postsResponse.data.posts || postsResponse.data.posts.length === 0) {
        console.log("Post not found");
        return null;
      }

      const post = postsResponse.data.posts[0];
      console.log(`Post author: @${post.author.handle}`);

      // Check if this post has embedded content (quote post scenario)
      if (post.embed) {
        const embedData = post.embed as any;
        console.log(`Post has embed of type: ${embedData.$type}`);

        // Handle quote posts with blocked content
        if (
          embedData.$type === "app.bsky.embed.record#view" &&
          embedData.record
        ) {
          const embeddedRecord = embedData.record;
          console.log(
            `Embedded record - blocked: ${!!embeddedRecord.blocked}, notFound: ${!!embeddedRecord.notFound}`
          );

          // This is a quote post with blocked content!
          if (embeddedRecord.blocked || embeddedRecord.notFound) {
            console.log("Found blocked embedded content in quote post");

            if (embeddedRecord.uri) {
              const blockedAuthor = await this.extractAuthorFromUri(
                embeddedRecord.uri
              );
              if (blockedAuthor) {
                console.log(
                  `Found blocked author in quote post: @${blockedAuthor.authorHandle}`
                );
                return {
                  original: blockedAuthor,
                  reposter: {
                    handle: post.author.handle, // The quote poster
                    did: post.author.did,
                  },
                };
              }
            }
          }

          // If we can see the embedded record author, this is a visible quote post
          if (
            embeddedRecord.author &&
            !embeddedRecord.blocked &&
            !embeddedRecord.notFound
          ) {
            console.log(
              `Quote post with visible content by @${embeddedRecord.author.handle}`
            );
            // This quote post is visible, so no blocking issue here
            return null;
          }
        }

        // Handle other embed types (images with records, etc.)
        if (
          embedData.$type === "app.bsky.embed.recordWithMedia#view" &&
          embedData.record &&
          embedData.record.record
        ) {
          const nestedRecord = embedData.record.record;

          if (nestedRecord.blocked || nestedRecord.notFound) {
            console.log("Found blocked content in recordWithMedia embed");

            if (nestedRecord.uri) {
              const blockedAuthor = await this.extractAuthorFromUri(
                nestedRecord.uri
              );
              if (blockedAuthor) {
                console.log(
                  `Found blocked author in media quote post: @${blockedAuthor.authorHandle}`
                );
                return {
                  original: blockedAuthor,
                  reposter: {
                    handle: post.author.handle,
                    did: post.author.did,
                  },
                };
              }
            }
          }
        }
      }

      // SCENARIO 3: Reply to blocked post
      // When B replies to A's post and user blocks A, user sees B's reply but A's original is blocked
      const postRecord = post.record as any;
      if (postRecord && postRecord.reply) {
        console.log("This post is a reply - checking if replying to blocked content");
        
        // Check if the root or parent post is blocked
        const rootUri = postRecord.reply.root?.uri;
        const parentUri = postRecord.reply.parent?.uri;
        
        console.log(`Reply structure - root: ${rootUri}, parent: ${parentUri}`);
        
        // Try to get the root post (original post in thread)
        if (rootUri && rootUri !== parentUri) {
          const blockedRootAuthor = await this.checkIfPostIsBlocked(rootUri);
          if (blockedRootAuthor) {
            console.log(`Found blocked root author: @${blockedRootAuthor.authorHandle}`);
            return {
              original: blockedRootAuthor,
              reposter: {
                handle: post.author.handle, // B (the replier)
                did: post.author.did,
              },
              isReply: true,
            };
          }
        }
        
        // Try to get the immediate parent post
        if (parentUri && parentUri !== postUri) {
          const blockedParentAuthor = await this.checkIfPostIsBlocked(parentUri);
          if (blockedParentAuthor) {
            console.log(`Found blocked parent author: @${blockedParentAuthor.authorHandle}`);
            return {
              original: blockedParentAuthor,
              reposter: {
                handle: post.author.handle, // B (the replier)
                did: post.author.did,
              },
              isReply: true,
            };
          }
        }
      }

      // If no blocked content found, this might just be a regular post
      console.log("No blocked content found in direct post");
      return null;
    } catch (error) {
      console.error("Error handling direct post:", error);
      return null;
    }
  }

  private async getDirectPost(
    postUri: string
  ): Promise<OriginalPostInfo | null> {
    try {
      console.log(`Fetching direct post: ${postUri}`);

      const postsResponse = await this.agent.getPosts({ uris: [postUri] });

      if (!postsResponse.data.posts || postsResponse.data.posts.length === 0) {
        console.log("Post not found");
        return null;
      }

      const post = postsResponse.data.posts[0];

      // Debug: Log the post structure to understand what we're working with
      console.log(
        `Post record keys: ${Object.keys(post.record || {}).join(", ")}`
      );
      console.log(`Post response keys: ${Object.keys(post).join(", ")}`);

      // Check if this post has embedded content that might be blocked
      const embeddedContent = await this.checkForEmbeddedContent(post);
      if (embeddedContent) {
        console.log(
          `Found embedded blocked content by @${embeddedContent.authorHandle}`
        );
        return embeddedContent;
      }

      return {
        uri: postUri,
        authorHandle: post.author.handle,
        authorDid: post.author.did,
      };
    } catch (error) {
      console.error("Error handling direct post:", error);
      return null;
    }
  }

  private async checkForEmbeddedContent(
    post: any
  ): Promise<OriginalPostInfo | null> {
    try {
      console.log("Checking for embedded content...");

      // Log embed information for debugging
      if (post.record?.embed) {
        console.log(`Record embed type: ${post.record.embed.$type}`);
        console.log(
          `Record embed keys: ${Object.keys(post.record.embed).join(", ")}`
        );
      }

      if (post.embed) {
        console.log(`Response embed type: ${post.embed.$type}`);
        console.log(
          `Response embed keys: ${Object.keys(post.embed).join(", ")}`
        );
      }

      // Check for embed in the post record
      if (post.record?.embed) {
        const embed = post.record.embed;

        // Handle different types of embeds
        if (embed.$type === "app.bsky.embed.record" && embed.record?.uri) {
          console.log(`Found embedded record: ${embed.record.uri}`);
          return await this.getDirectPost(embed.record.uri);
        }

        if (
          embed.$type === "app.bsky.embed.recordWithMedia" &&
          embed.record?.record?.uri
        ) {
          console.log(
            `Found embedded record with media: ${embed.record.record.uri}`
          );
          return await this.getDirectPost(embed.record.record.uri);
        }
      }

      // Check if the post itself shows as having blocked content in the response
      if (post.embed) {
        const responseEmbed = post.embed;

        // Check for blocked record embed
        if (responseEmbed.$type === "app.bsky.embed.record#view") {
          console.log(
            "Found record embed view, checking for blocked content..."
          );

          if (responseEmbed.record?.blocked || responseEmbed.record?.notFound) {
            console.log("Found blocked embed in response");
            // Try to extract the original URI from the blocked record
            if (responseEmbed.record?.uri) {
              const blockedPost = await this.extractAuthorFromUri(
                responseEmbed.record.uri
              );
              if (blockedPost) {
                return blockedPost;
              }
            }
          }

          // Check if the record has author info but is blocked
          if (responseEmbed.record?.author) {
            console.log(
              `Found embedded record by @${responseEmbed.record.author.handle}`
            );
            return {
              uri: responseEmbed.record.uri || "blocked",
              authorHandle: responseEmbed.record.author.handle,
              authorDid: responseEmbed.record.author.did,
            };
          }
        }

        // Check for blocked record with media
        if (
          responseEmbed.$type === "app.bsky.embed.recordWithMedia#view" &&
          responseEmbed.record
        ) {
          console.log(
            "Found record with media embed view, checking for blocked content..."
          );

          if (
            responseEmbed.record.record?.blocked ||
            responseEmbed.record.record?.notFound
          ) {
            console.log("Found blocked embed with media in response");
            if (responseEmbed.record.record?.author) {
              return {
                uri: responseEmbed.record.record.uri || "blocked",
                authorHandle: responseEmbed.record.record.author.handle,
                authorDid: responseEmbed.record.record.author.did,
              };
            }
          }
        }
      }

      console.log("No embedded content found");
      return null;
    } catch (error) {
      console.error("Error checking for embedded content:", error);
      return null;
    }
  }

  private async extractAuthorFromUri(
    uri: string
  ): Promise<OriginalPostInfo | null> {
    try {
      // Extract DID from URI
      const did = this.extractDidFromUri(uri);
      if (!did) {
        return null;
      }

      // Try to get profile info for the DID
      const profileResponse = await this.agent.getProfile({ actor: did });
      if (profileResponse.data) {
        return {
          uri: uri,
          authorHandle: profileResponse.data.handle,
          authorDid: profileResponse.data.did,
        };
      }

      return null;
    } catch (error) {
      console.error("Error extracting author from URI:", error);
      return null;
    }
  }

  private extractDidFromUri(uri: string): string | null {
    try {
      // AT Protocol URI format: at://did:plc:example/app.bsky.feed.post/recordkey
      const parts = uri.split("/");
      if (parts.length >= 2 && parts[0] === "at:") {
        return parts[2]; // The DID part
      }
      return null;
    } catch (error) {
      console.error("Error extracting DID from URI:", error);
      return null;
    }
  }

  private async checkIfPostIsBlocked(uri: string): Promise<OriginalPostInfo | null> {
    try {
      console.log(`Checking if post is blocked: ${uri}`);
      
      // Try to fetch the post
      const postsResponse = await this.agent.getPosts({ uris: [uri] });
      
      if (!postsResponse.data.posts || postsResponse.data.posts.length === 0) {
        console.log(`Post not found or blocked: ${uri}`);
        
        // Post not found could mean it's blocked, try to extract author from URI
        const authorInfo = await this.extractAuthorFromUri(uri);
        if (authorInfo) {
          console.log(`Extracted author info from blocked post URI: @${authorInfo.authorHandle}`);
          return authorInfo;
        }
        
        return null;
      }
      
      // If we can fetch the post, it's not blocked
      console.log(`Post is accessible, not blocked: ${uri}`);
      return null;
    } catch (error) {
      console.error(`Error checking if post is blocked: ${error}`);
      
      // If there's an error fetching, it might be because it's blocked
      // Try to extract author info from the URI
      const authorInfo = await this.extractAuthorFromUri(uri);
      if (authorInfo) {
        console.log(`Error accessing post, assuming blocked. Extracted author: @${authorInfo.authorHandle}`);
        return authorInfo;
      }
      
      return null;
    }
  }
}

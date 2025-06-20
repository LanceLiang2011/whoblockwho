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
      console.log(
        `\n=== PARSING MENTION FROM @${notification.author.handle} ===`
      );

      const mentionRecord = notification.record as PostRecord;
      console.log(
        `Mention record keys: ${Object.keys(mentionRecord).join(", ")}`
      );

      if (!mentionRecord.reply) {
        console.log(
          "❌ Mention is not a reply, cannot determine original post"
        );
        return null;
      }

      console.log(
        `✅ Mention is a reply. Parent: ${mentionRecord.reply.parent.uri}`
      );
      console.log(
        `✅ Mention is a reply. Root: ${mentionRecord.reply.root.uri}`
      );

      const parsedInfo = await this.findOriginalPost(mentionRecord.reply);

      if (parsedInfo) {
        console.log(
          `✅ SUCCESS: Found original post by @${parsedInfo.original.authorHandle}`
        );
        if (parsedInfo.reposter) {
          console.log(
            `✅ Processed by @${parsedInfo.reposter.handle} (isReply: ${parsedInfo.isReply})`
          );
        }
      } else {
        console.log("❌ FAILED: Could not determine original post");
      }

      return parsedInfo;
    } catch (error) {
      console.error("❌ ERROR: Error parsing original post:", error);
      return null;
    }
  }

  private async findOriginalPost(
    reply: ReplyReference
  ): Promise<ParsedPostInfo | null> {
    try {
      // Focus on the immediate parent post that the user is replying to
      const parentUri = reply.parent.uri;
      console.log(`🔍 Checking immediate parent post: ${parentUri}`);

      // CASE 1: Parent is a REPOST - checking for reposted content
      if (parentUri.includes("app.bsky.feed.repost")) {
        console.log(
          "📋 CASE 1: Parent is a REPOST - checking for reposted content"
        );
        return await this.handleRepost(parentUri);
      }

      // CASE 2: Parent is a DIRECT POST (could be quote post OR reply)
      if (parentUri.includes("app.bsky.feed.post")) {
        console.log(
          "📄 CASE 2: Parent is a DIRECT POST - determining if quote post or reply"
        );

        // First, get the post to understand its structure
        const postInfo = await this.analyzeDirectPost(parentUri);
        return postInfo;
      }

      console.log(`❌ Unknown URI format: ${parentUri}`);
      return null;
    } catch (error) {
      console.error("❌ Error finding original post:", error);
      return null;
    }
  }

  private async analyzeDirectPost(
    postUri: string
  ): Promise<ParsedPostInfo | null> {
    try {
      console.log(`\n--- ANALYZING DIRECT POST: ${postUri} ---`);

      const postsResponse = await this.agent.getPosts({ uris: [postUri] });

      if (!postsResponse.data.posts || postsResponse.data.posts.length === 0) {
        console.log("❌ Post not found");
        return null;
      }

      const post = postsResponse.data.posts[0];
      const postRecord = post.record as any;

      console.log(`📄 Post by @${post.author.handle}`);
      console.log(`📄 Has embed: ${!!post.embed}`);
      console.log(`📄 Is reply: ${!!(postRecord && postRecord.reply)}`);

      // SCENARIO A: Post has EMBED (this is a quote post/repost)
      if (post.embed) {
        console.log(
          `🔗 SCENARIO A: Post has embed - finding original quoted/reposted author`
        );
        return await this.findOriginalFromEmbed(post);
      }

      // SCENARIO B: Post is a REPLY
      if (postRecord && postRecord.reply) {
        console.log(
          `💬 SCENARIO B: Post is a reply - finding original post author being replied to`
        );
        return await this.findOriginalFromReply(post, postRecord);
      }

      console.log(
        "❌ Post is neither a quote/repost nor a reply - cannot help"
      );
      return null;
    } catch (error) {
      console.error("❌ Error analyzing direct post:", error);
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
        return await this.analyzeDirectPost(uri);
      }

      console.log(`Unknown URI format: ${uri}`);
      return null;
    } catch (error) {
      console.error(`Error processing URI ${uri}:`, error);
      return null;
    }
  }

  private async findOriginalFromEmbed(
    post: any
  ): Promise<ParsedPostInfo | null> {
    try {
      const embedData = post.embed as any;
      console.log(`🔗 Embed type: ${embedData.$type}`);

      // Handle quote posts with embedded records
      if (
        embedData.$type === "app.bsky.embed.record#view" &&
        embedData.record
      ) {
        const embeddedRecord = embedData.record;

        // If embed has URI, get the original author from it
        if (embeddedRecord.uri) {
          console.log(`🔗 Found embedded record URI: ${embeddedRecord.uri}`);
          const originalAuthor = await this.extractAuthorFromUri(
            embeddedRecord.uri
          );
          if (originalAuthor) {
            console.log(
              `✅ Found original author: @${originalAuthor.authorHandle}`
            );
            return {
              original: originalAuthor,
              reposter: {
                handle: post.author.handle,
                did: post.author.did,
              },
              isReply: false,
            };
          }
        }

        // If embed has author directly visible
        if (embeddedRecord.author) {
          console.log(
            `✅ Found embedded author: @${embeddedRecord.author.handle}`
          );
          return {
            original: {
              uri: embeddedRecord.uri || "unknown",
              authorHandle: embeddedRecord.author.handle,
              authorDid: embeddedRecord.author.did,
            },
            reposter: {
              handle: post.author.handle,
              did: post.author.did,
            },
            isReply: false,
          };
        }
      }

      // Handle other embed types
      if (
        embedData.$type === "app.bsky.embed.recordWithMedia#view" &&
        embedData.record?.record
      ) {
        const nestedRecord = embedData.record.record;

        if (nestedRecord.uri) {
          console.log(`🔗 Found nested record URI: ${nestedRecord.uri}`);
          const originalAuthor = await this.extractAuthorFromUri(
            nestedRecord.uri
          );
          if (originalAuthor) {
            console.log(
              `✅ Found original author in media embed: @${originalAuthor.authorHandle}`
            );
            return {
              original: originalAuthor,
              reposter: {
                handle: post.author.handle,
                did: post.author.did,
              },
              isReply: false,
            };
          }
        }

        if (nestedRecord.author) {
          console.log(`✅ Found nested author: @${nestedRecord.author.handle}`);
          return {
            original: {
              uri: nestedRecord.uri || "unknown",
              authorHandle: nestedRecord.author.handle,
              authorDid: nestedRecord.author.did,
            },
            reposter: {
              handle: post.author.handle,
              did: post.author.did,
            },
            isReply: false,
          };
        }
      }

      console.log("❌ Could not find original author in embed");
      return null;
    } catch (error) {
      console.error("❌ Error finding original from embed:", error);
      return null;
    }
  }

  private async findOriginalFromReply(
    post: any,
    postRecord: any
  ): Promise<ParsedPostInfo | null> {
    try {
      const rootUri = postRecord.reply.root?.uri;
      const parentUri = postRecord.reply.parent?.uri;

      console.log(
        `💬 Reply structure - root: ${rootUri}, parent: ${parentUri}`
      );

      // Try root first (original post in thread)
      if (rootUri) {
        console.log(`💬 Getting original author from root: ${rootUri}`);
        const originalAuthor = await this.extractAuthorFromUri(rootUri);
        if (originalAuthor) {
          console.log(
            `✅ Found original author from root: @${originalAuthor.authorHandle}`
          );
          return {
            original: originalAuthor,
            reposter: {
              handle: post.author.handle,
              did: post.author.did,
            },
            isReply: true,
          };
        }
      }

      // Try parent if different from root
      if (parentUri && parentUri !== rootUri) {
        console.log(`� Getting original author from parent: ${parentUri}`);
        const originalAuthor = await this.extractAuthorFromUri(parentUri);
        if (originalAuthor) {
          console.log(
            `✅ Found original author from parent: @${originalAuthor.authorHandle}`
          );
          return {
            original: originalAuthor,
            reposter: {
              handle: post.author.handle,
              did: post.author.did,
            },
            isReply: true,
          };
        }
      }

      console.log("❌ Could not find original author in reply chain");
      return null;
    } catch (error) {
      console.error("❌ Error finding original from reply:", error);
      return null;
    }
  }

  private async detectBlockedAuthorFromUri(
    uri: string
  ): Promise<OriginalPostInfo | null> {
    try {
      console.log(`🔍 DETECTING BLOCKED AUTHOR FROM URI: ${uri}`);

      // Try to fetch the post
      const postsResponse = await this.agent.getPosts({ uris: [uri] });

      if (!postsResponse.data.posts || postsResponse.data.posts.length === 0) {
        console.log(`❌ Post not found: ${uri}`);
        // If post is not found, try to extract author from URI
        return await this.extractAuthorFromUri(uri);
      }

      const post = postsResponse.data.posts[0];

      // Check if the post response indicates it's blocked
      if ((post as any).blocked || (post as any).notFound) {
        console.log(`🚫 Post marked as blocked: ${uri}`);
        return await this.extractAuthorFromUri(uri);
      }

      // Here's the key insight: If we can fetch the post normally, we need to check
      // if this author is someone who might be blocked by the user mentioning our bot
      //
      // The way to detect this is: the user mentioned our bot in reply to someone's post,
      // and that person was replying to this post. If the user couldn't see this original
      // post, they wouldn't know what the reply was about.
      //
      // So we assume that if they're asking about it, there might be a blocking relationship.

      console.log(`📄 Found post by @${post.author.handle}`);

      // Return the author info - the post-info generator will format the response
      return {
        uri: uri,
        authorHandle: post.author.handle,
        authorDid: post.author.did,
      };
    } catch (error) {
      console.error(`❌ Error detecting blocked author from URI: ${error}`);

      // If there's an error fetching, it might be because it's blocked
      return await this.extractAuthorFromUri(uri);
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
      console.log(`\n--- HANDLING DIRECT POST: ${postUri} ---`);

      const postsResponse = await this.agent.getPosts({ uris: [postUri] });

      if (!postsResponse.data.posts || postsResponse.data.posts.length === 0) {
        console.log("❌ Post not found");
        return null;
      }

      const post = postsResponse.data.posts[0];
      console.log(`📄 Post by @${post.author.handle}`);
      console.log(
        `📄 Post record keys: ${Object.keys(post.record || {}).join(", ")}`
      );

      // FIRST: Check if this post is a reply to a blocked post (most important for our use case)
      const postRecord = post.record as any;
      if (postRecord && postRecord.reply) {
        console.log(
          `💬 This post IS A REPLY - checking if replying to content`
        );

        // Check if the root or parent post is blocked
        const rootUri = postRecord.reply.root?.uri;
        const parentUri = postRecord.reply.parent?.uri;

        console.log(
          `💬 Reply structure - root: ${rootUri}, parent: ${parentUri}`
        );

        // Try to get the root post (original post in thread)
        if (rootUri && rootUri !== parentUri) {
          console.log(`🔍 Checking root post for blocking: ${rootUri}`);
          const blockedRootAuthor = await this.checkIfPostIsBlocked(rootUri);
          if (blockedRootAuthor) {
            console.log(
              `✅ FOUND BLOCKED ROOT AUTHOR: @${blockedRootAuthor.authorHandle}`
            );
            return {
              original: blockedRootAuthor,
              reposter: {
                handle: post.author.handle, // B (the replier)
                did: post.author.did,
              },
              isReply: true,
            };
          } else {
            console.log(`❌ Root post is not blocked or not found`);
          }
        }

        // Try to get the immediate parent post
        if (parentUri && parentUri !== postUri) {
          console.log(`🔍 Checking parent post for blocking: ${parentUri}`);
          const blockedParentAuthor = await this.checkIfPostIsBlocked(
            parentUri
          );
          if (blockedParentAuthor) {
            console.log(
              `✅ FOUND BLOCKED PARENT AUTHOR: @${blockedParentAuthor.authorHandle}`
            );
            return {
              original: blockedParentAuthor,
              reposter: {
                handle: post.author.handle, // B (the replier)
                did: post.author.did,
              },
              isReply: true,
            };
          } else {
            console.log(`❌ Parent post is not blocked or not found`);
          }
        }
      } else {
        console.log(`📄 This post is NOT a reply`);
      }

      // SECOND: Check if this post has embedded content (quote post scenario)
      if (post.embed) {
        console.log(`🔗 Post has embed of type: ${(post.embed as any).$type}`);

        const embedData = post.embed as any;

        // Handle quote posts with content that might be blocked
        if (
          embedData.$type === "app.bsky.embed.record#view" &&
          embedData.record
        ) {
          const embeddedRecord = embedData.record;
          console.log(
            `🔗 Embedded record - blocked: ${!!embeddedRecord.blocked}, notFound: ${!!embeddedRecord.notFound}`
          );

          // This is a quote post with content that might be blocked!
          if (embeddedRecord.blocked || embeddedRecord.notFound) {
            console.log("✅ Found blocked embedded content in quote post");

            if (embeddedRecord.uri) {
              const blockedAuthor = await this.extractAuthorFromUri(
                embeddedRecord.uri
              );
              if (blockedAuthor) {
                console.log(
                  `✅ Found blocked author in quote post: @${blockedAuthor.authorHandle}`
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
              `🔗 Quote post with visible content by @${embeddedRecord.author.handle}`
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
            console.log("✅ Found content in recordWithMedia embed");

            if (nestedRecord.uri) {
              const blockedAuthor = await this.extractAuthorFromUri(
                nestedRecord.uri
              );
              if (blockedAuthor) {
                console.log(
                  `✅ Found blocked author in media quote post: @${blockedAuthor.authorHandle}`
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
      } else {
        console.log(`📄 No embed found in post`);
      }

      // If no hidden content found, this might just be a regular post
      console.log("❌ No hidden content found in direct post");
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
          `Found embedded content by @${embeddedContent.authorHandle}`
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

      // Check if the post itself shows as having content in the response
      if (post.embed) {
        const responseEmbed = post.embed;

        // Check for blocked record embed
        if (responseEmbed.$type === "app.bsky.embed.record#view") {
          console.log(
            "Found record embed view, checking for content..."
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
            "Found record with media embed view, checking for content..."
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

  private async checkIfPostIsBlocked(
    uri: string
  ): Promise<OriginalPostInfo | null> {
    try {
      console.log(`🔍 CHECKING IF POST IS BLOCKED: ${uri}`);

      // Try to fetch the post
      const postsResponse = await this.agent.getPosts({ uris: [uri] });

      if (!postsResponse.data.posts || postsResponse.data.posts.length === 0) {
        console.log(`❌ Post not found or blocked: ${uri}`);

        // Post not found could mean it's blocked, try to extract author from URI
        const authorInfo = await this.extractAuthorFromUri(uri);
        if (authorInfo) {
          console.log(
            `✅ EXTRACTED AUTHOR FROM BLOCKED POST URI: @${authorInfo.authorHandle}`
          );
          return authorInfo;
        }

        console.log(`❌ Could not extract author info from URI: ${uri}`);
        return null;
      }

      const post = postsResponse.data.posts[0];
      console.log(`📄 Post found by @${post.author.handle}`);

      // Check if the post is marked as blocked or not found
      if ((post as any).blocked || (post as any).notFound) {
        console.log(`🚫 Post is marked as blocked: ${uri}`);
        const authorInfo = await this.extractAuthorFromUri(uri);
        if (authorInfo) {
          console.log(
            `✅ EXTRACTED AUTHOR FROM BLOCKED POST: @${authorInfo.authorHandle}`
          );
          return authorInfo;
        }
        return null;
      }

      // Additional check: if we can see the post but it's from a user we might have blocked
      // In this case, we need to check if there's a blocking relationship
      console.log(
        `✅ Post is accessible by @${post.author.handle} - not blocked in this context`
      );

      // If we can access the post normally, it's probably not the hidden content we're looking for
      // unless this is part of a reply chain where the PARENT or ROOT is blocked
      return null;
    } catch (error) {
      console.error(`❌ ERROR checking if post is blocked: ${error}`);

      // If there's an error fetching, it might be because it's blocked
      // Try to extract author info from the URI
      const authorInfo = await this.extractAuthorFromUri(uri);
      if (authorInfo) {
        console.log(
          `✅ ERROR ACCESSING POST, ASSUMING BLOCKED. Extracted author: @${authorInfo.authorHandle}`
        );
        return authorInfo;
      }

      return null;
    }
  }
}

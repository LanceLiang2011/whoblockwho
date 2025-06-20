export interface BotConfig {
  bskyHandle: string;
  bskyAppPassword: string;
  pollIntervalMs: number;
  maxNotificationsPerPoll: number;
}

export interface NotificationData {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
  };
  reason: string;
  record: any;
  isRead: boolean;
  indexedAt: string;
}

export interface PostReference {
  uri: string;
  cid: string;
}

export interface ReplyReference {
  root: PostReference;
  parent: PostReference;
}

export interface PostRecord {
  text: string;
  createdAt: string;
  reply?: ReplyReference;
  [key: string]: any;
}

export interface OriginalPostInfo {
  uri: string;
  authorHandle: string;
  authorDid: string;
}

export interface ParsedPostInfo {
  original: OriginalPostInfo;
  reposter?: {
    handle: string;
    did: string;
  };
  isReply?: boolean;
}

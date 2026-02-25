import Snoowrap from 'snoowrap';
import { BasePlatformAdapter } from '../base.js';
import type { RawContent, SourcePlatform, MediaItem } from '../../core/types.js';

interface RedditPost {
  id: string;
  title: string;
  selftext?: string;
  author: { name: string };
  permalink: string;
  created_utc: number;
  ups: number;
  num_comments: number;
  url_overridden_by_dest?: string;
  is_video: boolean;
  media?: { reddit_video?: { fallback_url: string } } | null;
}

interface RedditConfig {
  clientId: string;
  clientSecret: string;
  userAgent: string;
  username?: string;
  password?: string;
  thresholds?: {
    minUpvotes?: number;
    minComments?: number;
  };
}

export class RedditAdapter extends BasePlatformAdapter {
  readonly name: SourcePlatform = 'reddit';
  private client: Snoowrap | null = null;
  private config: RedditConfig;
  private thresholds = {
    minUpvotes: 100,
    minComments: 20,
  };

  constructor(config: RedditConfig) {
    super();
    this.config = config;
    this.thresholds = {
      minUpvotes: config.thresholds?.minUpvotes ?? 100,
      minComments: config.thresholds?.minComments ?? 20,
    };
  }

  private getClient(): Snoowrap {
    if (!this.client) {
      this.client = new Snoowrap({
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        userAgent: this.config.userAgent,
        username: this.config.username,
        password: this.config.password,
      });
    }
    return this.client;
  }

  async fetchContent(
    query: string,
    options: { maxResults?: number; subreddits?: string[] } = {}
  ): Promise<RawContent[]> {
    const maxResults = options.maxResults || 100;
    const subreddits = options.subreddits || ['all'];

    const contents: RawContent[] = [];

    for (const subreddit of subreddits) {
      try {
        const submissions = await this.getClient().search({
          query,
          subreddit,
          limit: maxResults,
        });

        for (const post of submissions) {
          // 直接转换，不使用基类的 validateContent
          // 因为 Reddit API 返回的是 RedditPost 类型，不是 RawContent 类型
          // validateContent 会将类型收窄为 RawContent，导致与 transformToRawContent 的参数类型不匹配
          contents.push(this.transformToRawContent(post));
        }
      } catch (error) {
        console.error(`Error fetching from r/${subreddit}:`, error);
      }
    }

    return contents;
  }

  isViral(content: RawContent): boolean {
    const upvotes = content.metrics.upvotes || 0;
    const comments = content.metrics.comments || 0;

    return upvotes >= this.thresholds.minUpvotes && comments >= this.thresholds.minComments;
  }

  private transformToRawContent(post: RedditPost): RawContent {
    return {
      id: post.id,
      platform: 'reddit',
      text: post.title + '\n\n' + (post.selftext || ''),
      author: {
        username: post.author.name,
        name: post.author.name,
      },
      url: `https://reddit.com${post.permalink}`,
      createdAt: new Date(post.created_utc * 1000).toISOString(),
      fetchedAt: new Date().toISOString(),
      isViral: false,
      metrics: {
        upvotes: post.ups || 0,
        comments: post.num_comments || 0,
      },
      media: this.extractMedia(post),
    };
  }

  private extractMedia(post: RedditPost): MediaItem[] | undefined {
    const media: MediaItem[] = [];

    if (post.url_overridden_by_dest) {
      const url = post.url_overridden_by_dest;
      if (url.match(/\.(jpg|jpeg|png|gif)$/i)) {
        media.push({ type: 'image', url });
      } else if (url.match(/youtube\.com/i) || url.match(/vimeo\.com/i)) {
        media.push({ type: 'video', url });
      }
    }

    // post.media 可能是 null，需要显式检查
    if (post.is_video && post.media && post.media.reddit_video) {
      media.push({ type: 'video', url: post.media.reddit_video.fallback_url });
    }

    return media.length > 0 ? media : undefined;
  }
}

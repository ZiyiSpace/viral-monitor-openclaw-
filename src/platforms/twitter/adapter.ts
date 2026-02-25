import { TwitterClient } from '@cm-growth-hacking/twitter-client';
import { BasePlatformAdapter } from '../base.js';
import type { RawContent, SourcePlatform } from '../../core/types.js';
import type { Tweet } from '../../types.js';
import { ViralDetector } from '../../viral-detector.js';

interface TwitterAPITweet {
  id: string;
  text: string;
  author: {
    username: string;
    name: string;
    followersCount?: number;
  };
  createdAt: string;
  viewCount?: number;
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  media?: Array<{
    type: string;
    url: string;
    thumbnailUrl?: string;
  }>;
}

export class TwitterAdapter extends BasePlatformAdapter {
  readonly name: SourcePlatform = 'twitter';
  private client: TwitterClient;
  private detector: ViralDetector;

  constructor(config: { authToken: string; ct0: string }) {
    super();
    this.client = new TwitterClient(config);
    this.detector = new ViralDetector();
  }

  async fetchContent(query: string, options: { maxResults?: number } = {}): Promise<RawContent[]> {
    const maxResults = options.maxResults || 200;

    try {
      const result = await this.client.search(query, maxResults);

      if (!result.success) {
        console.error(`[TwitterAdapter] Search failed for query "${query}"`);
        return [];
      }

      if (!result.tweets || result.tweets.length === 0) {
        return [];
      }

      return result.tweets.map((tweet: TwitterAPITweet) => this.transformToRawContent(tweet));
    } catch (error) {
      console.error(`[TwitterAdapter] Exception during fetch:`, error);
      return [];
    }
  }

  isViral(content: RawContent): boolean {
    const tweet: Tweet = {
      id: content.id,
      text: content.text,
      author: {
        id: content.author.username,
        username: content.author.username,
        name: content.author.name || '',
      },
      createdAt: content.createdAt,
      viewCount: content.metrics.views || 0,
      likeCount: content.metrics.likes || 0,
      retweetCount: content.metrics.retweets || 0,
      replyCount: content.metrics.comments || 0,
      quoteCount: 0,
      bookmarkCount: 0,
    };

    const detectionResult = this.detector.detect(tweet);
    return detectionResult.tier !== null;
  }

  private transformToRawContent(tweet: TwitterAPITweet): RawContent {
    const rawContent: RawContent = {
      id: tweet.id,
      platform: 'twitter',
      text: tweet.text,
      author: {
        username: tweet.author.username,
        name: tweet.author.name,
        followersCount: tweet.author.followersCount,
      },
      url: `https://twitter.com/${tweet.author.username}/status/${tweet.id}`,
      createdAt: tweet.createdAt,
      fetchedAt: new Date().toISOString(),
      isViral: false,
      metrics: {
        views: tweet.viewCount ?? 0,
        likes: tweet.likeCount ?? 0,
        retweets: tweet.retweetCount ?? 0,
        comments: tweet.replyCount ?? 0,
      },
    };

    if (tweet.media && tweet.media.length > 0) {
      rawContent.media = tweet.media.map(m => ({
        type: m.type as 'image' | 'video' | 'gif',
        url: m.url,
        thumbnailUrl: m.thumbnailUrl,
      }));
    }

    return rawContent;
  }
}

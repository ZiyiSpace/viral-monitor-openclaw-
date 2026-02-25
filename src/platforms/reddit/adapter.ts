import { BasePlatformAdapter } from '../base.js';
import type { RawContent, SourcePlatform, MediaItem } from '../../core/types.js';

interface RedditPost {
  id: string;
  title: string;
  selftext?: string;
  author: string;
  permalink: string;
  created_utc: number;
  ups: number;
  num_comments: number;
  url: string;
  url_overridden_by_dest?: string;
  is_video: boolean;
  media?: { reddit_video?: { fallback_url: string } } | null;
  over_18?: boolean;
}

interface RedditConfig {
  thresholds?: {
    minUpvotes?: number;
    minComments?: number;
  };
  keywords?: string[];  // 关键词过滤列表
}

interface FetchOptions {
  maxResults?: number;
  subreddits?: string[];
}

/**
 * Reddit Adapter - 使用匿名公开 API 访问
 * 无需 credentials，直接调用 Reddit 公开端点
 */
export class RedditAdapter extends BasePlatformAdapter {
  readonly name: SourcePlatform = 'reddit';
  private thresholds = {
    minUpvotes: 100,
    minComments: 20,
  };
  private keywords: string[] = [];

  constructor(config: RedditConfig = {}) {
    super();
    this.thresholds = {
      minUpvotes: config.thresholds?.minUpvotes ?? 100,
      minComments: config.thresholds?.minComments ?? 20,
    };
    this.keywords = config.keywords || [];
  }

  /**
   * 从 Reddit 获取内容（匿名访问）
   */
  async fetchContent(
    query: string,
    options: FetchOptions = {}
  ): Promise<RawContent[]> {
    const maxResults = options.maxResults || 100;
    const subreddits = options.subreddits || ['all'];

    // 构建搜索关键词列表（query 参数 + 配置的 keywords）
    const searchKeywords = this.keywords.length > 0 ? this.keywords : [query];
    // 如果传入了 query 但 keywords 为空，使用 query 作为搜索词
    const keywords = query ? [query, ...this.keywords] : this.keywords;

    const contents: RawContent[] = [];

    for (const subreddit of subreddits) {
      try {
        // 使用 Reddit 公开 API 获取热门帖子
        const url = `https://old.reddit.com/r/${subreddit}/hot.json?limit=${maxResults}`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'OpenClawMonitor/1.0',
          },
        });

        if (!response.ok) {
          console.warn(`Reddit API returned ${response.status} for r/${subreddit}`);
          continue;
        }

        const data = await response.json();

        if (data.data && data.data.children) {
          for (const child of data.data.children) {
            const post = child.data as RedditPost;

            // 过滤 NSFW 内容
            if (post.over_18) {
              continue;
            }

            // 客户端关键词过滤：标题或正文必须包含至少一个关键词
            if (keywords.length > 0 && !this.matchesKeywords(post, keywords)) {
              continue;
            }

            contents.push(this.transformToRawContent(post));
          }
        }

        // 匿名模式有速率限制，添加延迟
        if (subreddits.indexOf(subreddit) < subreddits.length - 1) {
          await this.delay(1000); // 1秒延迟，避免超过 10 req/min
        }
      } catch (error) {
        console.error(`Error fetching from r/${subreddit}:`, error);
      }
    }

    return contents;
  }

  /**
   * 检查帖子是否匹配关键词
   */
  private matchesKeywords(post: RedditPost, keywords: string[]): boolean {
    if (keywords.length === 0) return true;

    const text = (post.title + ' ' + (post.selftext || '')).toLowerCase();

    // 检查是否匹配任意关键词（不区分大小写）
    return keywords.some(keyword => {
      const kw = keyword.toLowerCase();
      // 处理带 # 号的关键词（如 #openclaw）
      const cleanKw = kw.replace(/^#/, '');
      return text.includes(kw) || text.includes(cleanKw);
    });
  }

  /**
   * 判断是否为爆款内容
   */
  isViral(content: RawContent): boolean {
    const upvotes = content.metrics.upvotes || 0;
    const comments = content.metrics.comments || 0;

    return upvotes >= this.thresholds.minUpvotes && comments >= this.thresholds.minComments;
  }

  /**
   * 转换 Reddit 帖子为统一格式
   */
  private transformToRawContent(post: RedditPost): RawContent {
    return {
      id: post.id,
      platform: 'reddit',
      text: post.title + '\n\n' + (post.selftext || ''),
      author: {
        username: post.author,
        name: post.author,
      },
      url: `https://reddit.com${post.permalink}`,
      createdAt: new Date(post.created_utc * 1000).toISOString(),
      fetchedAt: new Date().toISOString(),
      isViral: false, // 稍后由 isViral 判断
      metrics: {
        upvotes: post.ups || 0,
        comments: post.num_comments || 0,
      },
      media: this.extractMedia(post),
    };
  }

  /**
   * 提取媒体信息
   */
  private extractMedia(post: RedditPost): MediaItem[] | undefined {
    const media: MediaItem[] = [];

    // 检查 url_overridden_by_dest 或 url
    const postUrl = post.url_overridden_by_dest || post.url;

    if (postUrl) {
      if (postUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        media.push({ type: 'image', url: postUrl });
      } else if (postUrl.match(/youtube\.com|youtu\.be/i)) {
        media.push({ type: 'video', url: postUrl });
      } else if (postUrl.match(/vimeo\.com/i)) {
        media.push({ type: 'video', url: postUrl });
      } else if (postUrl.match(/\.mp4|\.webm|\.gifv/i)) {
        media.push({ type: 'video', url: postUrl });
      }
    }

    // 检查 Reddit 视频媒体
    if (post.is_video && post.media?.reddit_video) {
      media.push({ type: 'video', url: post.media.reddit_video.fallback_url });
    }

    return media.length > 0 ? media : undefined;
  }

  /**
   * 延迟函数（用于速率限制）
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
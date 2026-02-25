# 多平台爆款监控系统实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 将现有 Twitter 爆款监控器扩展为支持 Discord、Reddit、Telegram 的多平台内容聚合系统，用户通过调用 skill 即可触发全平台爆款检测。

**架构:** 采用分层架构，核心调度器并行调用各平台适配器，每个平台适配器实现统一接口负责内容抓取和爆款检测，统一存储层按日期+平台分类存储原始内容和 AI 处理后内容。

**技术栈:** TypeScript + Node.js + bun，使用现有 @cm-growth-hacking/twitter-client，新增 Reddit/Discord/Telegram 客户端库。

---

## Phase 1: 核心架构

### Task 1: 创建统一类型定义

**文件:**
- 创建: `src/core/types.ts`

**Step 1: 创建类型定义文件**

```typescript
// ========== 统一内容类型 ==========
export interface RawContent {
  id: string;
  platform: string;
  text: string;
  author: {
    username: string;
    name?: string;
    followersCount?: number;
  };
  url: string;
  createdAt: string;  // ISO 8601
  fetchedAt: string;  // ISO 8601
  isViral: boolean;
  metrics: ContentMetrics;
  media?: MediaItem[];
}

export interface ContentMetrics {
  views?: number;
  likes?: number;
  upvotes?: number;
  comments?: number;
  reactions?: number;
  shares?: number;
  retweets?: number;
}

export interface MediaItem {
  type: 'image' | 'video' | 'gif';
  url: string;
  localPath?: string;
  thumbnailUrl?: string;
}

// ========== 处理后内容类型 ==========
export interface ProcessedContent {
  sourceId: string;
  sourcePlatform: string;
  processedAt: string;
  targetPlatform: 'xiaohongshu' | 'douyin' | 'kuaishou';
  title: string;
  content: string;
  media: string[];
  hashtags: string[];
}

// ========== 平台适配器接口 ==========
export interface PlatformAdapter {
  readonly name: string;
  fetchContent(query: string, options?: FetchOptions): Promise<RawContent[]>;
  isViral(content: RawContent): boolean;
  downloadMedia(content: RawContent): Promise<string[]>;
}

export interface FetchOptions {
  maxResults?: number;
  subreddits?: string[];
  channels?: string[];
}

// ========== 爆款检测结果 ==========
export interface ViralDetectionResult {
  contentId: string;
  platform: string;
  isViral: boolean;
  tier?: string;
  reason?: string;
}

// ========== 调度结果 ==========
export interface SchedulerResult {
  timestamp: string;
  keywords: string[];
  platforms: {
    [key: string]: PlatformResult;
  };
  summary: {
    totalContents: number;
    viralCount: number;
    successCount: number;
    failureCount: number;
  };
}

export interface PlatformResult {
  status: 'success' | 'failure' | 'partial';
  contentsFetched: number;
  viralCount: number;
  error?: string;
}

// ========== 存储接口 ==========
export interface ContentRepository {
  saveRaw(content: RawContent): Promise<string>;
  saveProcessed(content: ProcessedContent): Promise<string>;
  listRaw(date: string, platform?: string): Promise<RawContent[]>;
  listProcessed(date: string): Promise<ProcessedContent[]>;
}
```

**Step 2: 保存文件**

文件已创建，无需运行测试。

**Step 3: 提交**

```bash
git add src/core/types.ts
git commit -m "feat(core): add unified type definitions for multi-platform support"
```

---

### Task 2: 创建 PlatformAdapter 基类

**文件:**
- 创建: `src/platforms/base.ts`
- 创建: `src/platforms/base.test.ts`

**Step 1: 编写基类测试**

```typescript
import { describe, it, expect } from 'bun:test';
import { BasePlatformAdapter } from './base';

describe('BasePlatformAdapter', () => {
  it('should have a name property', () => {
    class TestAdapter extends BasePlatformAdapter {}
    const adapter = new TestAdapter();
    expect(adapter.name).toBe('test');
  });

  it('should throw error if fetchContent not implemented', async () => {
    class TestAdapter extends BasePlatformAdapter {}
    const adapter = new TestAdapter();
    await expect(adapter.fetchContent('test')).rejects.toThrow('not implemented');
  });

  it('should throw error if isViral not implemented', () => {
    class TestAdapter extends BasePlatformAdapter {}
    const adapter = new TestAdapter();
    expect(() => adapter.isViral({} as any)).toThrow('not implemented');
  });

  it('should implement default downloadMedia that returns empty array', async () => {
    class TestAdapter extends BasePlatformAdapter {}
    const adapter = new TestAdapter();
    const result = await adapter.downloadMedia({} as any);
    expect(result).toEqual([]);
  });
});
```

**Step 2: 运行测试验证失败**

```bash
bun test src/platforms/base.test.ts
```

预期输出: `Error: Cannot find module './base'`

**Step 3: 实现基类**

```typescript
import type { PlatformAdapter, RawContent } from '../core/types.js';

export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract readonly name: string;

  /**
   * 抓取内容 - 子类必须实现
   */
  async fetchContent(query: string, options?: any): Promise<RawContent[]> {
    throw new Error(`fetchContent not implemented in ${this.name}`);
  }

  /**
   * 判断是否爆款 - 子类必须实现
   */
  isViral(content: RawContent): boolean {
    throw new Error(`isViral not implemented in ${this.name}`);
  }

  /**
   * 下载媒体 - 默认实现返回空数组
   */
  async downloadMedia(content: RawContent): Promise<string[]> {
    if (!content.media || content.media.length === 0) {
      return [];
    }

    const downloadedPaths: string[] = [];
    // 默认不下载，子类可以覆盖
    return downloadedPaths;
  }

  /**
   * 验证内容是否包含必要字段
   */
  protected validateContent(content: any): content is RawContent {
    return !!(
      content.id &&
      content.text &&
      content.author &&
      content.author.username &&
      content.url &&
      content.createdAt
    );
  }
}
```

**Step 4: 运行测试验证通过**

```bash
bun test src/platforms/base.test.ts
```

预期输出: 全部 PASS

**Step 5: 提交**

```bash
git add src/platforms/base.ts src/platforms/base.test.ts
git commit -m "feat(platforms): add BasePlatformAdapter abstract class"
```

---

### Task 3: 重构 Twitter 代码为适配器

**文件:**
- 创建: `src/platforms/twitter/adapter.ts`
- 修改: `src/monitor.ts` (保持向后兼容)
- 创建: `src/platforms/twitter/adapter.test.ts`

**Step 1: 编写 Twitter 适配器测试**

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { TwitterAdapter } from './adapter';
import type { RawContent } from '../../core/types';

describe('TwitterAdapter', () => {
  let adapter: TwitterAdapter;

  beforeEach(() => {
    adapter = new TwitterAdapter({
      authToken: process.env.TWITTER_AUTH_TOKEN || '',
      ct0: process.env.TWITTER_CT0 || '',
    });
  });

  it('should have name "twitter"', () => {
    expect(adapter.name).toBe('twitter');
  });

  it('should fetch content for given keyword', async () => {
    const results = await adapter.fetchContent('openclaw', { maxResults: 10 });
    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0) {
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('text');
      expect(results[0]).toHaveProperty('platform', 'twitter');
    }
  }, 30000);

  it('should detect viral content correctly', () => {
    const viralContent: RawContent = {
      id: '1',
      platform: 'twitter',
      text: 'test',
      author: { username: 'test' },
      url: 'https://twitter.com/test/1',
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      fetchedAt: new Date().toISOString(),
      isViral: false,
      metrics: { views: 6000 }, // 满足 Tier 1: 5000 views in 30min
    };

    expect(adapter.isViral(viralContent)).toBe(true);
  });

  it('should not detect non-viral content', () => {
    const nonViralContent: RawContent = {
      id: '1',
      platform: 'twitter',
      text: 'test',
      author: { username: 'test' },
      url: 'https://twitter.com/test/1',
      createdAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      isViral: false,
      metrics: { views: 100 },
    };

    expect(adapter.isViral(nonViralContent)).toBe(false);
  });
});
```

**Step 2: 运行测试验证失败**

```bash
bun test src/platforms/twitter/adapter.test.ts
```

预期输出: `Error: Cannot find module './adapter'`

**Step 3: 实现 Twitter 适配器**

```typescript
import { TwitterClient } from '@cm-growth-hacking/twitter-client';
import { BasePlatformAdapter } from '../base.js';
import type { RawContent } from '../../core/types.js';
import type { Tweet } from '../../types.js';
import { ViralDetector } from '../../viral-detector.js';

export class TwitterAdapter extends BasePlatformAdapter {
  readonly name = 'twitter';
  private client: TwitterClient;
  private detector: ViralDetector;

  constructor(config: { authToken: string; ct0: string }) {
    super();
    this.client = new TwitterClient(config);
    this.detector = new ViralDetector();
  }

  /**
   * 抓取 Twitter 内容
   */
  async fetchContent(query: string, options: { maxResults?: number } = {}): Promise<RawContent[]> {
    const maxResults = options.maxResults || 200;

    const result = await this.client.search(query, maxResults);

    if (!result.success || !result.tweets) {
      return [];
    }

    return result.tweets.map((tweet: any) => this.transformToRawContent(tweet));
  }

  /**
   * 判断是否爆款
   */
  isViral(content: RawContent): boolean {
    // 转换为 Tweet 格式进行检测
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

  /**
   * 将 Tweet 转换为 RawContent
   */
  private transformToRawContent(tweet: any): RawContent {
    return {
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
      isViral: false, // 稍后检测
      metrics: {
        views: tweet.viewCount || 0,
        likes: tweet.likeCount || 0,
        retweets: tweet.retweetCount || 0,
        comments: tweet.replyCount || 0,
      },
      media: tweet.media?.map((m: any) => ({
        type: m.type,
        url: m.url,
        thumbnailUrl: m.thumbnailUrl,
      })),
    };
  }
}
```

**Step 4: 运行测试验证通过**

```bash
bun test src/platforms/twitter/adapter.test.ts
```

预期输出: 全部 PASS

**Step 5: 提交**

```bash
git add src/platforms/twitter/adapter.ts src/platforms/twitter/adapter.test.ts
git commit -m "feat(platforms): implement TwitterAdapter"
```

---

### Task 4: 实现统一存储层

**文件:**
- 创建: `src/storage/repository.ts`
- 创建: `src/storage/repository.test.ts`

**Step 1: 编写存储测试**

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { fs } from 'fs/promises';
import { JsonContentRepository } from './repository';
import type { RawContent, ProcessedContent } from '../core/types';
import { rm } from 'fs/promises';

describe('JsonContentRepository', () => {
  const testDir = './data/test';
  let repo: JsonContentRepository;

  beforeEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    repo = new JsonContentRepository(testDir);
  });

  it('should save raw content', async () => {
    const content: RawContent = {
      id: 'test123',
      platform: 'test',
      text: 'test content',
      author: { username: 'testuser' },
      url: 'https://test.com/123',
      createdAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      isViral: false,
      metrics: {},
    };

    const filePath = await repo.saveRaw(content);
    expect(filePath).toContain('test123.json');
  });

  it('should list raw content by date', async () => {
    const content: RawContent = {
      id: 'test123',
      platform: 'test',
      text: 'test content',
      author: { username: 'testuser' },
      url: 'https://test.com/123',
      createdAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      isViral: false,
      metrics: {},
    };

    await repo.saveRaw(content);
    const contents = await repo.listRaw(new Date().toISOString().split('T')[0]);
    expect(contents.length).toBe(1);
    expect(contents[0].id).toBe('test123');
  });
});
```

**Step 2: 运行测试验证失败**

```bash
bun test src/storage/repository.test.ts
```

预期输出: `Error: Cannot find module './repository'`

**Step 3: 实现存储层**

```typescript
import fs from 'fs/promises';
import path from 'path';
import type { ContentRepository, RawContent, ProcessedContent } from '../core/types.js';

export class JsonContentRepository implements ContentRepository {
  private rawDir: string;
  private processedDir: string;

  constructor(baseDir: string = './data') {
    this.rawDir = path.join(baseDir, 'raw');
    this.processedDir = path.join(baseDir, 'processed');
  }

  /**
   * 保存原始内容
   * 文件路径: data/raw/YYYY-MM-DD/platform/contentId.json
   */
  async saveRaw(content: RawContent): Promise<string> {
    const date = content.fetchedAt.split('T')[0];
    const platformDir = path.join(this.rawDir, date, content.platform);
    const filePath = path.join(platformDir, `${content.id}.json`);

    await fs.mkdir(platformDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(content, null, 2), 'utf-8');

    return filePath;
  }

  /**
   * 保存处理后内容
   */
  async saveProcessed(content: ProcessedContent): Promise<string> {
    const date = content.processedAt.split('T')[0];
    const platformDir = path.join(this.processedDir, date, content.targetPlatform);
    const fileName = `${content.sourcePlatform}_${content.sourceId}.json`;
    const filePath = path.join(platformDir, fileName);

    await fs.mkdir(platformDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(content, null, 2), 'utf-8');

    return filePath;
  }

  /**
   * 列出原始内容
   */
  async listRaw(date: string, platform?: string): Promise<RawContent[]> {
    const searchDir = platform
      ? path.join(this.rawDir, date, platform)
      : path.join(this.rawDir, date);

    const contents: RawContent[] = [];

    try {
      const entries = await fs.readdir(searchDir, { recursive: true });

      for (const entry of entries) {
        if (entry.endsWith('.json')) {
          const filePath = path.join(searchDir, entry);
          const fileContent = await fs.readFile(filePath, 'utf-8');
          contents.push(JSON.parse(fileContent));
        }
      }
    } catch (error) {
      // 目录不存在返回空数组
    }

    return contents;
  }

  /**
   * 列出处理后内容
   */
  async listProcessed(date: string): Promise<ProcessedContent[]> {
    const searchDir = path.join(this.processedDir, date);
    const contents: ProcessedContent[] = [];

    try {
      const entries = await fs.readdir(searchDir, { recursive: true });

      for (const entry of entries) {
        if (entry.endsWith('.json')) {
          const filePath = path.join(searchDir, entry);
          const fileContent = await fs.readFile(filePath, 'utf-8');
          contents.push(JSON.parse(fileContent));
        }
      }
    } catch (error) {
      // 目录不存在返回空数组
    }

    return contents;
  }
}
```

**Step 4: 运行测试验证通过**

```bash
bun test src/storage/repository.test.ts
```

预期输出: 全部 PASS

**Step 5: 提交**

```bash
git add src/storage/repository.ts src/storage/repository.test.ts
git commit -m "feat(storage): implement JsonContentRepository"
```

---

### Task 5: 实现核心调度器

**文件:**
- 创建: `src/core/scheduler.ts`
- 创建: `src/core/scheduler.test.ts`

**Step 1: 编写调度器测试**

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { ContentScheduler } from './scheduler';
import { TwitterAdapter } from '../platforms/twitter/adapter.js';
import { JsonContentRepository } from '../storage/repository.js';
import { rm } from 'fs/promises';

describe('ContentScheduler', () => {
  let scheduler: ContentScheduler;
  let mockAdapter: any;

  beforeEach(async () => {
    await rm('./data/test-scheduler', { recursive: true, force: true });

    // Mock adapter
    mockAdapter = {
      name: 'test',
      fetchContent: async () => [
        {
          id: '1',
          platform: 'test',
          text: 'test',
          author: { username: 'test' },
          url: 'https://test.com/1',
          createdAt: new Date().toISOString(),
          fetchedAt: new Date().toISOString(),
          isViral: true,
          metrics: {},
        },
      ],
      isViral: (content: any) => content.isViral,
      downloadMedia: async () => [],
    };

    const repo = new JsonContentRepository('./data/test-scheduler');
    scheduler = new ContentScheduler(repo);
  });

  it('should run all adapters', async () => {
    const result = await scheduler.run(['test'], [mockAdapter]);

    expect(result.summary.totalContents).toBeGreaterThan(0);
    expect(result.summary.successCount).toBe(1);
  });

  it('should handle adapter failures gracefully', async () => {
    const failingAdapter = {
      name: 'failing',
      fetchContent: async () => {
        throw new Error('Network error');
      },
      isViral: () => false,
      downloadMedia: async () => [],
    };

    const result = await scheduler.run(['test'], [mockAdapter, failingAdapter]);

    expect(result.summary.failureCount).toBe(1);
    expect(result.platforms.failing.status).toBe('failure');
  });
});
```

**Step 2: 运行测试验证失败**

```bash
bun test src/core/scheduler.test.ts
```

预期输出: `Error: Cannot find module './scheduler'`

**Step 3: 实现调度器**

```typescript
import type {
  PlatformAdapter,
  RawContent,
  SchedulerResult,
  PlatformResult,
  ContentRepository,
} from './types.js';

export class ContentScheduler {
  private repository: ContentRepository;

  constructor(repository: ContentRepository) {
    this.repository = repository;
  }

  /**
   * 运行所有平台适配器
   */
  async run(
    keywords: string[],
    adapters: PlatformAdapter[]
  ): Promise<SchedulerResult> {
    const timestamp = new Date().toISOString();
    const platforms: { [key: string]: PlatformResult } = {};
    let totalContents = 0;
    let viralCount = 0;
    let successCount = 0;
    let failureCount = 0;

    // 并行运行所有适配器
    const results = await Promise.allSettled(
      adapters.map((adapter) => this.runAdapter(adapter, keywords))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const platformResult = result.value;
        platforms[platformResult.name] = {
          status: platformResult.status,
          contentsFetched: platformResult.contentsFetched,
          viralCount: platformResult.viralCount,
        };

        totalContents += platformResult.contentsFetched;
        viralCount += platformResult.viralCount;
        successCount++;
      } else {
        const adapterName = this.extractAdapterName(result.reason);
        platforms[adapterName] = {
          status: 'failure',
          contentsFetched: 0,
          viralCount: 0,
          error: result.reason?.message || 'Unknown error',
        };
        failureCount++;
      }
    }

    return {
      timestamp,
      keywords,
      platforms,
      summary: {
        totalContents,
        viralCount,
        successCount,
        failureCount,
      },
    };
  }

  /**
   * 运行单个适配器
   */
  private async runAdapter(
    adapter: PlatformAdapter,
    keywords: string[]
  ): Promise<PlatformResult & { name: string }> {
    let contentsFetched = 0;
    let viralCount = 0;
    const seenIds = new Set<string>();

    for (const keyword of keywords) {
      try {
        const contents = await adapter.fetchContent(keyword);

        for (const content of contents) {
          // 去重
          if (seenIds.has(content.id)) continue;
          seenIds.add(content.id);

          content.isViral = adapter.isViral(content);
          if (content.isViral) {
            viralCount++;
          }

          // 保存到存储
          await this.repository.saveRaw(content);
          contentsFetched++;
        }
      } catch (error) {
        console.error(`Error fetching from ${adapter.name} for keyword "${keyword}":`, error);
        // 继续处理其他关键词
      }
    }

    return {
      name: adapter.name,
      status: 'success',
      contentsFetched,
      viralCount,
    };
  }

  /**
   * 从错误中提取适配器名称
   */
  private extractAdapterName(error: any): string {
    return error?.adapterName || 'unknown';
  }
}
```

**Step 4: 运行测试验证通过**

```bash
bun test src/core/scheduler.test.ts
```

预期输出: 全部 PASS

**Step 5: 提交**

```bash
git add src/core/scheduler.ts src/core/scheduler.test.ts
git commit -m "feat(core): implement ContentScheduler"
```

---

## Phase 2: Reddit 支持

### Task 6: 添加 Reddit 依赖

**文件:**
- 修改: `package.json`

**Step 1: 安装 Reddit 客户端库**

```bash
bun add snoowrap
bun add -D @types/snoowrap
```

**Step 2: 更新 .env.example**

```bash
echo "REDDIT_CLIENT_ID=your_reddit_client_id" >> .env.example
echo "REDDIT_CLIENT_SECRET=your_reddit_client_secret" >> .env.example
echo "REDDIT_USER_AGENT=your_user_agent" >> .env.example
```

**Step 3: 提交**

```bash
git add package.json package-lock.json .env.example
git commit -m "deps: add snoowrap for Reddit API access"
```

---

### Task 7: 实现 Reddit 适配器

**文件:**
- 创建: `src/platforms/reddit/adapter.ts`
- 创建: `src/platforms/reddit/adapter.test.ts`

**Step 1: 编写 Reddit 适配器测试**

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { RedditAdapter } from './adapter';

describe('RedditAdapter', () => {
  let adapter: RedditAdapter;

  beforeEach(() => {
    adapter = new RedditAdapter({
      clientId: process.env.REDDIT_CLIENT_ID || '',
      clientSecret: process.env.REDDIT_CLIENT_SECRET || '',
      userAgent: 'TestAgent/1.0',
    });
  });

  it('should have name "reddit"', () => {
    expect(adapter.name).toBe('reddit');
  });

  it('should detect viral content based on upvotes', () => {
    const viralContent: any = {
      id: '1',
      platform: 'reddit',
      text: 'test',
      author: { username: 'test' },
      url: 'https://reddit.com/r/test/1',
      createdAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      isViral: false,
      metrics: { upvotes: 150, comments: 25 },
    };

    expect(adapter.isViral(viralContent)).toBe(true);
  });

  it('should not detect non-viral content', () => {
    const nonViralContent: any = {
      id: '1',
      platform: 'reddit',
      text: 'test',
      author: { username: 'test' },
      url: 'https://reddit.com/r/test/1',
      createdAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      isViral: false,
      metrics: { upvotes: 50, comments: 5 },
    };

    expect(adapter.isViral(nonViralContent)).toBe(false);
  });
});
```

**Step 2: 运行测试验证失败**

```bash
bun test src/platforms/reddit/adapter.test.ts
```

预期输出: `Error: Cannot find module './adapter'`

**Step 3: 实现 Reddit 适配器**

```typescript
import Snoowrap from 'snoowrap';
import { BasePlatformAdapter } from '../base.js';
import type { RawContent } from '../../core/types.js';

interface RedditConfig {
  clientId: string;
  clientSecret: string;
  userAgent: string;
  username?: string;
  password?: string;
}

export class RedditAdapter extends BasePlatformAdapter {
  readonly name = 'reddit';
  private client: Snoowrap;
  private thresholds = {
    minUpvotes: 100,
    minComments: 20,
  };

  constructor(config: RedditConfig) {
    super();
    this.client = new Snoowrap({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      userAgent: config.userAgent,
      username: config.username,
      password: config.password,
    });
  }

  /**
   * 从 Reddit 抓取内容
   */
  async fetchContent(
    query: string,
    options: { maxResults?: number; subreddits?: string[] } = {}
  ): Promise<RawContent[]> {
    const maxResults = options.maxResults || 100;
    const subreddits = options.subreddits || ['all'];

    const contents: RawContent[] = [];

    for (const subreddit of subreddits) {
      try {
        const submissions = await this.client
          .getSubreddit(subreddit)
          .search({ query, limit: maxResults });

        for (const post of submissions) {
          if (!this.validateContent(post)) continue;

          contents.push(this.transformToRawContent(post));
        }
      } catch (error) {
        console.error(`Error fetching from r/${subreddit}:`, error);
      }
    }

    return contents;
  }

  /**
   * 判断是否爆款
   */
  isViral(content: RawContent): boolean {
    const upvotes = content.metrics.upvotes || 0;
    const comments = content.metrics.comments || 0;

    return upvotes >= this.thresholds.minUpvotes && comments >= this.thresholds.minComments;
  }

  /**
   * 转换 Reddit 帖子为 RawContent
   */
  private transformToRawContent(post: any): RawContent {
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

  /**
   * 提取媒体信息
   */
  private extractMedia(post: any): any[] | undefined {
    const media: any[] = [];

    if (post.url_overridden_by_dest) {
      const url = post.url_overridden_by_dest;
      if (url.match(/\.(jpg|jpeg|png|gif)$/i)) {
        media.push({ type: 'image', url });
      } else if (url.match(/youtube\.com/i) || url.match(/vimeo\.com/i)) {
        media.push({ type: 'video', url });
      }
    }

    if (post.is_video && post.media?.reddit_video) {
      media.push({ type: 'video', url: post.media.reddit_video.fallback_url });
    }

    return media.length > 0 ? media : undefined;
  }
}
```

**Step 4: 运行测试验证通过**

```bash
bun test src/platforms/reddit/adapter.test.ts
```

预期输出: 全部 PASS

**Step 5: 提交**

```bash
git add src/platforms/reddit/adapter.ts src/platforms/reddit/adapter.test.ts
git commit -m "feat(platforms): implement RedditAdapter"
```

---

## Phase 3: Discord 支持

### Task 8: 添加 Discord 依赖

**文件:**
- 修改: `package.json`

**Step 1: 安装 Discord 客户端库**

```bash
bun add discord.js
```

**Step 2: 更新 .env.example**

```bash
echo "DISCORD_BOT_TOKEN=your_discord_bot_token" >> .env.example
```

**Step 3: 提交**

```bash
git add package.json package-lock.json .env.example
git commit -m "deps: add discord.js for Discord API access"
```

---

### Task 9: 实现 Discord 适配器

**文件:**
- 创建: `src/platforms/discord/adapter.ts`
- 创建: `src/platforms/discord/adapter.test.ts`

**Step 1: 编写 Discord 适配器测试**

```typescript
import { describe, it, expect } from 'bun:test';
import { DiscordAdapter } from './adapter';

describe('DiscordAdapter', () => {
  it('should have name "discord"', () => {
    const adapter = new DiscordAdapter({ token: 'test' });
    expect(adapter.name).toBe('discord');
  });

  it('should detect viral content based on reactions', () => {
    const adapter = new DiscordAdapter({ token: 'test' });
    const viralContent: any = {
      id: '1',
      platform: 'discord',
      text: 'test',
      author: { username: 'test' },
      url: 'https://discord.com/1',
      createdAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      isViral: false,
      metrics: { reactions: 60 },
    };

    expect(adapter.isViral(viralContent)).toBe(true);
  });
});
```

**Step 2-5:** 同之前的模式，实现后测试提交。

```typescript
// src/platforms/discord/adapter.ts
import { Client, GatewayIntentBits, Message } from 'discord.js';
import { BasePlatformAdapter } from '../base.js';
import type { RawContent } from '../../core/types.js';

export class DiscordAdapter extends BasePlatformAdapter {
  readonly name = 'discord';
  private client: Client;
  private thresholds = {
    minReactions: 50,
  };

  constructor(config: { token: string }) {
    super();
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    // 注意：实际使用需要先 login
    // this.client.login(config.token);
  }

  async fetchContent(
    query: string,
    options: { maxResults?: number; channels?: string[] } = {}
  ): Promise<RawContent[]> {
    // Discord 需要连接后搜索历史消息
    // 这是简化版本，实际实现需要更复杂的逻辑
    return [];
  }

  isViral(content: RawContent): boolean {
    const reactions = content.metrics.reactions || 0;
    return reactions >= this.thresholds.minReactions;
  }
}
```

---

## Phase 4: 创建配置文件

### Task 10: 创建平台配置文件

**文件:**
- 创建: `config/platforms.json`

**Step 1: 创建配置文件**

```json
{
  "keywords": ["openclaw", "open claw", "#openclaw"],
  "platforms": {
    "twitter": {
      "enabled": true,
      "maxResults": 200
    },
    "reddit": {
      "enabled": true,
      "subreddits": ["all", "technology", "cryptocurrency"],
      "maxResults": 100,
      "viralThresholds": {
        "minUpvotes": 100,
        "minComments": 20
      }
    },
    "discord": {
      "enabled": false,
      "channels": [],
      "maxResults": 50
    },
    "telegram": {
      "enabled": false,
      "channels": [],
      "maxResults": 50
    }
  },
  "aiProcessing": {
    "enabled": false,
    "targetLanguage": "zh-CN",
    "targetPlatforms": ["xiaohongshu", "douyin", "kuaishou"]
  }
}
```

**Step 2: 提交**

```bash
git add config/platforms.json
git commit -m "feat(config): add platforms configuration"
```

---

## Phase 5: Skill 集成

### Task 11: 创建 monitor-viral skill

**文件:**
- 创建: `skills/monitor-viral/skill.md`
- 创建: `src/commands/monitor.ts`

**Step 1: 创建 skill 定义**

```markdown
# monitor-viral

检测多平台爆款内容，支持 Twitter、Reddit、Discord、Telegram。

## 用法

```
@monitor-viral [关键词]
```

## 示例

```
@monitor-viral openclaw
@monitor-viral AI
```

## 功能

- 并行抓取所有启用的平台
- 自动检测爆款内容
- 按日期和平台分类存储
- 返回汇总报告
```

**Step 2: 创建 CLI 命令**

```typescript
// src/commands/monitor.ts
import { ContentScheduler } from '../core/scheduler.js';
import { TwitterAdapter } from '../platforms/twitter/adapter.js';
import { RedditAdapter } from '../platforms/reddit/adapter.js';
import { JsonContentRepository } from '../storage/repository.js';
import platformsConfig from '../../config/platforms.json' assert { type: 'json' };

export async function monitorCommand(keywords?: string[]) {
  const searchKeywords = keywords || platformsConfig.keywords;

  const repo = new JsonContentRepository('./data');
  const scheduler = new ContentScheduler(repo);

  const adapters: any[] = [];

  // 添加启用的平台适配器
  if (platformsConfig.platforms.twitter.enabled) {
    adapters.push(new TwitterAdapter({
      authToken: process.env.TWITTER_AUTH_TOKEN || '',
      ct0: process.env.TWITTER_CT0 || '',
    }));
  }

  if (platformsConfig.platforms.reddit.enabled) {
    adapters.push(new RedditAdapter({
      clientId: process.env.REDDIT_CLIENT_ID || '',
      clientSecret: process.env.REDDIT_CLIENT_SECRET || '',
      userAgent: 'OpenClawMonitor/1.0',
    }));
  }

  const result = await scheduler.run(searchKeywords, adapters);

  // 输出报告
  console.log('\n📊 监控报告');
  console.log('='.repeat(40));
  console.log(`时间: ${result.timestamp}`);
  console.log(`关键词: ${result.keywords.join(', ')}`);
  console.log('\n各平台结果:');
  for (const [platform, platformResult] of Object.entries(result.platforms)) {
    console.log(`  ${platform}:`);
    console.log(`    状态: ${platformResult.status}`);
    console.log(`    抓取: ${platformResult.contentsFetched} 条`);
    console.log(`    爆款: ${platformResult.viralCount} 条`);
  }
  console.log('\n总计:');
  console.log(`  总内容: ${result.summary.totalContents} 条`);
  console.log(`  爆款: ${result.summary.viralCount} 条`);
  console.log(`  成功: ${result.summary.successCount} 个平台`);
  console.log(`  失败: ${result.summary.failureCount} 个平台`);
  console.log('='.repeat(40));

  return result;
}
```

**Step 3: 更新 CLI 入口**

修改 `src/index.ts` 添加新命令：

```typescript
// 在现有命令后添加
if (args[0] === 'multi') {
  const keywords = args.slice(1);
  await monitorCommand(keywords);
}
```

**Step 4: 提交**

```bash
git add skills/ src/commands/monitor.ts src/index.ts
git commit -m "feat(skill): add monitor-viral skill implementation"
```

---

## Phase 6: 端到端测试

### Task 12: 集成测试

**文件:**
- 创建: `src/integration/multi-platform.test.ts`

**Step 1: 编写集成测试**

```typescript
import { describe, it, expect } from 'bun:test';
import { ContentScheduler } from '../core/scheduler.js';
import { TwitterAdapter } from '../platforms/twitter/adapter.js';
import { JsonContentRepository } from '../storage/repository.js';
import { rm } from 'fs/promises';

describe('Multi-Platform Integration', () => {
  it('should run full workflow', async () => {
    await rm('./data/integration-test', { recursive: true, force: true });

    const repo = new JsonContentRepository('./data/integration-test');
    const scheduler = new ContentScheduler(repo);

    const twitterAdapter = new TwitterAdapter({
      authToken: process.env.TWITTER_AUTH_TOKEN || '',
      ct0: process.env.TWITTER_CT0 || '',
    });

    const result = await scheduler.run(['openclaw'], [twitterAdapter]);

    expect(result.summary.successCount).toBeGreaterThan(0);
    expect(result.platforms.twitter.status).toBe('success');
  }, 60000);
});
```

**Step 2: 运行集成测试**

```bash
bun test src/integration/multi-platform.test.ts
```

**Step 3: 提交**

```bash
git add src/integration/multi-platform.test.ts
git commit -m "test(integration): add multi-platform integration test"
```

---

## 执行检查清单

完成实现后，确认以下检查项：

- [ ] 所有测试通过 (`bun test`)
- [ ] Twitter 适配器工作正常
- [ ] Reddit 适配器工作正常
- [ ] 存储层正确保存文件到 `data/raw/YYYY-MM-DD/platform/`
- [ ] 调度器能并行处理多个平台
- [ ] 单个平台失败不影响其他平台
- [ ] CLI 命令 `bun run src/index.ts multi openclaw` 工作正常
- [ ] 配置文件 `config/platforms.json` 可正确加载

---

## 开发注意事项

1. **TDD 原则**: 每个功能先写测试，再写实现
2. **小步提交**: 每个 Task 完成后立即 commit
3. **错误处理**: 使用 Promise.allSettled 确保单个平台失败不影响其他
4. **日志记录**: 关键操作添加 console.log 便于调试
5. **环境变量**: 敏感信息使用 .env 文件，不提交到 git
6. **向后兼容**: 保持现有 Twitter 监控器功能不受影响

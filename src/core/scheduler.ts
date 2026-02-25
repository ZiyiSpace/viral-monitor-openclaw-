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

  private async runAdapter(
    adapter: PlatformAdapter,
    keywords: string[]
  ): Promise<PlatformResult & { name: string }> {
    let contentsFetched = 0;
    let viralCount = 0;
    const seenIds = new Set<string>();
    let hasError = false;
    let firstError: any = null;

    for (const keyword of keywords) {
      try {
        const contents = await adapter.fetchContent(keyword);

        for (const content of contents) {
          if (seenIds.has(content.id)) continue;
          seenIds.add(content.id);

          content.isViral = adapter.isViral(content);
          if (content.isViral) {
            viralCount++;
          }

          // 过滤：只保存爆款 + 最近 3 天内的内容
          if (!this.shouldSave(content)) {
            continue;
          }

          await this.repository.saveRaw(content);
          contentsFetched++;
        }
      } catch (error) {
        console.error(`Error fetching from ${adapter.name} for keyword "${keyword}":`, error);
        hasError = true;
        if (!firstError) {
          firstError = error;
        }
      }
    }

    // 如果发生错误且没有成功获取任何内容，则抛出异常
    if (hasError && contentsFetched === 0) {
      const error = new Error(firstError?.message || 'Failed to fetch content');
      (error as any).adapterName = adapter.name;
      throw error;
    }

    return {
      name: adapter.name,
      status: 'success',
      contentsFetched,
      viralCount,
    };
  }

  private extractAdapterName(error: any): string {
    return error?.adapterName || 'unknown';
  }

  /**
   * 判断是否应该保存该内容
   * 只保存爆款内容
   */
  private shouldSave(content: RawContent): boolean {
    return content.isViral;
  }
}

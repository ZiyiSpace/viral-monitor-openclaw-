import type { PlatformAdapter, RawContent, FetchOptions } from '../core/types.js';

export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract readonly name: string;

  /**
   * 抓取内容 - 子类必须实现
   */
  async fetchContent(query: string, options?: FetchOptions): Promise<RawContent[]> {
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

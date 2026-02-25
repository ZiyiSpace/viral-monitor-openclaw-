import type { Tweet, TweetRecord } from './types.js';
import { AIProcessor, createProcessor } from './ai-processor.js';
import { ImageDownloader, createDownloader } from './image-downloader.js';
import { XiaohongshuPublisher, createPublisher } from './xiaohongshu-publisher.js';

/**
 * 发布工作流配置
 */
export interface PublishWorkflowConfig {
  ai?: {
    apiKey?: string;
    model?: string;
  };
  images?: {
    outputDir?: string;
  };
  xiaohongshu?: {
    apiKey?: string;
  };
}

/**
 * 发布结果
 */
export interface PublishWorkflowResult {
  tweetId: string;
  success: boolean;
  xiaohongshuUrl?: string;
  error?: string;
}

/**
 * Twitter → 小红书 发布工作流
 */
export class PublishWorkflow {
  private aiProcessor: AIProcessor;
  private imageDownloader: ImageDownloader;
  private xiaohongshuPublisher: XiaohongshuPublisher;

  constructor(config: PublishWorkflowConfig = {}) {
    this.aiProcessor = createProcessor(config.ai);
    this.imageDownloader = createDownloader(config.images?.outputDir);
    this.xiaohongshuPublisher = createPublisher(config.xiaohongshu);
  }

  /**
   * 处理单条推文并发布
   */
  async processAndPublish(tweet: Tweet | TweetRecord): Promise<PublishWorkflowResult> {
    try {
      console.log(`\n📝 处理推文: ${tweet.id}`);
      console.log(`   原文: ${tweet.text.substring(0, 50)}...`);

      // 1. AI 处理内容（翻译 + 总结）
      console.log(`   🤖 AI 处理中...`);
      const processed = await this.aiProcessor.processTweet(tweet.text);

      // 2. 下载图片
      let imagePaths: string[] = [];
      const media = (tweet as any).media;
      if (media && media.length > 0) {
        console.log(`   📸 下载图片...`);
        imagePaths = await this.imageDownloader.downloadTweetImages(tweet.id, media);
      }

      // 3. 构建小红书内容
      const xiaohongshuPost = this.buildXiaohongshuPost(processed, imagePaths, tweet);

      // 4. 发布到小红书
      console.log(`   📱 发布到小红书...`);
      const publishResult = await this.xiaohongshuPublisher.publish(xiaohongshuPost);

      if (publishResult.success) {
        console.log(`   ✅ 发布成功: ${publishResult.url}`);
        return {
          tweetId: tweet.id,
          success: true,
          xiaohongshuUrl: publishResult.url,
        };
      } else {
        console.log(`   ❌ 发布失败: ${publishResult.error}`);
        return {
          tweetId: tweet.id,
          success: false,
          error: publishResult.error,
        };
      }

    } catch (error) {
      console.error(`❌ 处理推文 ${tweet.id} 失败:`, error);
      return {
        tweetId: tweet.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 批量处理并发布
   */
  async processAndPublishBatch(tweets: (Tweet | TweetRecord)[]): Promise<PublishWorkflowResult[]> {
    const results: PublishWorkflowResult[] = [];

    console.log(`\n🚀 开始批量处理 ${tweets.length} 条推文...\n`);

    for (let i = 0; i < tweets.length; i++) {
      const tweet = tweets[i];
      console.log(`[${i + 1}/${tweets.length}]`, '');

      const result = await this.processAndPublish(tweet);
      results.push(result);

      // 延迟避免限流
      if (i < tweets.length - 1) {
        await this.delay(10000); // 10秒延迟
      }
    }

    // 打印总结
    const successCount = results.filter(r => r.success).length;
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📊 批量发布完成`);
    console.log(`   成功: ${successCount}/${tweets.length}`);
    console.log(`   失败: ${tweets.length - successCount}/${tweets.length}`);
    console.log(`${'='.repeat(50)}\n`);

    return results;
  }

  /**
   * 构建小红书发布内容
   */
  private buildXiaohongshuPost(
    processed: any,
    imagePaths: string[],
    originalTweet: Tweet | TweetRecord
  ) {
    // 直接使用 AI 生成的标题和文案
    const title = processed.suggestedTitle || 'OpenClaw 热门内容';

    // summary 现在是 AI 生成的完整小红书文案
    const content = processed.summary + `\n\n🔗 原推: https://x.com/i/status/${originalTweet.id}`;

    // MCP API requires at least 1 image
    const images = imagePaths.length > 0
      ? imagePaths
      : ['https://picsum.photos/800/600']; // Placeholder image

    return {
      title,
      content,
      images,
      tags: processed.suggestedTags || ['#OpenClaw', '#AI', '#科技'],
    };
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 创建工作流
 */
export function createWorkflow(config?: PublishWorkflowConfig): PublishWorkflow {
  return new PublishWorkflow(config);
}

import { TwitterClient } from '@cm-growth-hacking/twitter-client';
import fs from 'fs/promises';
import path from 'path';
import type { Tweet, TweetRecord, DailyData, Snapshot, ViralDetectionResult, MonitorConfig } from './types.js';
import { ViralDetector } from './viral-detector.js';

/**
 * Twitter 爆款监控器
 */
export class TwitterMonitor {
  private client: TwitterClient;
  private detector: ViralDetector;
  private config: MonitorConfig;
  private dataDir: string;

  constructor(config: MonitorConfig) {
    this.config = config;
    this.dataDir = config.dataDir;

    // 初始化 Twitter 客户端
    this.client = new TwitterClient({
      authToken: process.env.TWITTER_AUTH_TOKEN || '',
      ct0: process.env.TWITTER_CT0 || '',
    });

    // 初始化检测器
    this.detector = new ViralDetector(config.thresholds);
  }

  /**
   * 执行监控任务
   */
  async run(): Promise<void> {
    console.log('🔍 开始监控 Twitter...');

    // 1. 搜索所有关键词
    const allTweets = await this.searchAllKeywords();
    console.log(`📊 搜索到 ${allTweets.length} 条推文`);

    // 2. 检测爆款
    const viralResults = this.detector.filterViral(allTweets);
    console.log(`🔥 发现 ${viralResults.length} 条爆款推文`);

    // 统计各等级数量
    const groups = this.detector.groupByTier(viralResults);
    for (const [tier, results] of groups) {
      if (tier) {
        console.log(`   ${this.getTierLabel(tier)}: ${results.length} 条`);
      }
    }

    // 3. 加载历史数据
    const todayData = await this.loadTodayData();

    // 4. 更新数据（合并历史快照）
    await this.updateData(todayData, allTweets, viralResults);

    // 5. 保存数据
    await this.saveData(todayData);

    console.log('✅ 监控完成');
  }

  /**
   * 搜索所有关键词
   */
  private async searchAllKeywords(): Promise<Tweet[]> {
    const allTweets: Tweet[] = [];
    const seen = new Set<string>();

    for (const keyword of this.config.keywords) {
      console.log(`   🔎 搜索: "${keyword}"`);

      try {
        const result = await this.client.search(keyword, this.config.searchConfig.count);

        if (result.success && result.tweets) {
          for (const tweet of result.tweets) {
            // 去重
            if (!seen.has(tweet.id)) {
              seen.add(tweet.id);
              allTweets.push(tweet as unknown as Tweet);
            }
          }
        }

        // 简单延迟，避免速率限制
        await this.delay(1000);
      } catch (error) {
        console.error(`   ❌ 搜索 "${keyword}" 失败:`, error);
      }
    }

    return allTweets;
  }

  /**
   * 加载今日数据
   */
  private async loadTodayData(): Promise<DailyData> {
    const filePath = this.getTodayFilePath();

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as DailyData;
    } catch {
      // 文件不存在，创建新数据
      return this.createEmptyDailyData();
    }
  }

  /**
   * 创建空数据结构
   */
  private createEmptyDailyData(): DailyData {
    return {
      date: this.getTodayDate(),
      keywords: this.config.keywords,
      totalTweets: 0,
      viralCandidates: 0,
      viral: 0,
      sustainedViral: 0,
      tweets: [],
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 更新数据
   */
  private async updateData(
    dailyData: DailyData,
    tweets: Tweet[],
    viralResults: ViralDetectionResult[]
  ): Promise<void> {
    const now = new Date().toISOString();

    // 创建 viralResult 的快速查找映射
    const viralMap = new Map<string, ViralDetectionResult>();
    for (const result of viralResults) {
      viralMap.set(result.tweetId, result);
    }

    // 处理每条推文
    for (const tweet of tweets) {
      const existingRecord = dailyData.tweets.find(t => t.id === tweet.id);
      const viralResult = viralMap.get(tweet.id);

      // 创建当前快照
      const snapshot: Snapshot = {
        timestamp: now,
        viewCount: tweet.viewCount,
        likeCount: tweet.likeCount,
        retweetCount: tweet.retweetCount,
        tier: viralResult?.tier || null,
      };

      if (existingRecord) {
        // 更新现有记录
        existingRecord.lastUpdated = now;
        existingRecord.viewCount = tweet.viewCount;
        existingRecord.likeCount = tweet.likeCount;
        existingRecord.retweetCount = tweet.retweetCount;
        existingRecord.currentTier = viralResult?.tier || null;
        existingRecord.history.push(snapshot);
      } else {
        // 创建新记录
        const record: TweetRecord = {
          id: tweet.id,
          text: tweet.text,
          author: {
            username: tweet.author.username,
            name: tweet.author.name,
            followersCount: tweet.author.followersCount,
          },
          createdAt: tweet.createdAt,
          detectedAt: now,
          lastUpdated: now,
          currentTier: viralResult?.tier || null,
          viewCount: tweet.viewCount,
          likeCount: tweet.likeCount,
          retweetCount: tweet.retweetCount,
          history: [snapshot],
        };
        dailyData.tweets.push(record);
      }
    }

    // 更新统计
    dailyData.totalTweets = dailyData.tweets.length;
    dailyData.viralCandidates = dailyData.tweets.filter(t => t.currentTier === 'viral_candidate').length;
    dailyData.viral = dailyData.tweets.filter(t => t.currentTier === 'viral').length;
    dailyData.sustainedViral = dailyData.tweets.filter(t => t.currentTier === 'sustained_viral').length;
    dailyData.updatedAt = now;
  }

  /**
   * 保存数据
   */
  private async saveData(dailyData: DailyData): Promise<void> {
    const filePath = this.getTodayFilePath();

    // 确保目录存在
    await fs.mkdir(this.dataDir, { recursive: true });

    // 保存文件（格式化 JSON）
    await fs.writeFile(filePath, JSON.stringify(dailyData, null, 2), 'utf-8');

    console.log(`💾 数据已保存: ${filePath}`);
  }

  /**
   * 获取今日文件路径
   */
  private getTodayFilePath(): string {
    const date = this.getTodayDate();
    return path.join(this.dataDir, `${date}.json`);
  }

  /**
   * 获取今日日期字符串
   */
  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * 获取 Tier 标签
   */
  private getTierLabel(tier: string): string {
    switch (tier) {
      case 'viral_candidate':
        return 'Tier 1 (Early Momentum)';
      case 'viral':
        return 'Tier 2 (Confirmed Viral)';
      case 'sustained_viral':
        return 'Tier 3 (Sustained Viral)';
      default:
        return tier;
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

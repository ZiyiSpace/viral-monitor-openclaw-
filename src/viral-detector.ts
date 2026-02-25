import type { Tweet, ViralDetectionResult, ViralTier, ViralThreshold } from './types.js';

/**
 * 爆款检测器
 * 根据 Leader 定义的 Tier 规则检测推文是否为爆款
 */
export class ViralDetector {
  private thresholds: ViralThreshold[];

  constructor(thresholds: ViralThreshold[] = []) {
    this.thresholds = thresholds.length > 0 ? thresholds : this.getDefaultThresholds();
  }

  /**
   * 检测单条推文
   */
  detect(tweet: Tweet): ViralDetectionResult {
    const age = this.getAgeInHours(tweet.createdAt);
    const views = tweet.viewCount;

    // 从最严格到最宽松检查（Tier 3 -> Tier 2 -> Tier 1）
    // 这样能匹配到最高等级
    for (const threshold of [...this.thresholds].sort((a, b) => b.hours - a.hours)) {
      if (age <= threshold.hours && views >= threshold.views) {
        return {
          tweetId: tweet.id,
          tier: threshold.tier,
          reason: this.formatReason(threshold, age, views),
          age,
          views,
        };
      }
    }

    // 不符合任何爆款规则
    return {
      tweetId: tweet.id,
      tier: null,
      reason: 'Not viral',
      age,
      views,
    };
  }

  /**
   * 批量检测推文
   */
  detectBatch(tweets: Tweet[]): ViralDetectionResult[] {
    return tweets.map(tweet => this.detect(tweet));
  }

  /**
   * 筛选爆款推文
   */
  filterViral(tweets: Tweet[]): ViralDetectionResult[] {
    return this.detectBatch(tweets).filter(result => result.tier !== null);
  }

  /**
   * 按 Tier 分组
   */
  groupByTier(results: ViralDetectionResult[]): Map<ViralTier, ViralDetectionResult[]> {
    const groups = new Map<ViralTier, ViralDetectionResult[]>();

    for (const result of results) {
      const tier = result.tier;
      if (!groups.has(tier)) {
        groups.set(tier, []);
      }
      groups.get(tier)!.push(result);
    }

    return groups;
  }

  /**
   * 计算帖子年龄（小时）
   */
  private getAgeInHours(createdAt: string): number {
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    return (now - created) / (1000 * 60 * 60);
  }

  /**
   * 格式化检测结果说明
   */
  private formatReason(threshold: ViralThreshold, age: number, views: number): string {
    const tierName = this.getTierName(threshold.tier);
    return `${tierName}: ${views.toLocaleString()} views within ${this.formatAge(age)}`;
  }

  /**
   * 格式化年龄显示
   */
  private formatAge(hours: number): string {
    if (hours < 1) {
      return `${Math.round(hours * 60)} minutes`;
    }
    if (hours < 24) {
      return `${Math.round(hours)} hours`;
    }
    return `${Math.round(hours / 24)} days`;
  }

  /**
   * 获取 Tier 名称
   */
  private getTierName(tier: ViralTier): string {
    switch (tier) {
      case 'viral_candidate':
        return 'Early Momentum';
      case 'viral':
        return 'Confirmed Viral';
      case 'sustained_viral':
        return 'Sustained Viral';
      default:
        return 'Unknown';
    }
  }

  /**
   * 获取默认阈值配置
   */
  private getDefaultThresholds(): ViralThreshold[] {
    return [
      // Tier 1: Early Momentum
      { hours: 0.5, views: 5000, tier: 'viral_candidate' },
      { hours: 1, views: 10000, tier: 'viral_candidate' },
      { hours: 3, views: 30000, tier: 'viral_candidate' },
      { hours: 6, views: 60000, tier: 'viral_candidate' },
      // Tier 2: Confirmed Viral
      { hours: 12, views: 100000, tier: 'viral' },
      { hours: 24, views: 200000, tier: 'viral' },
      // Tier 3: Sustained Viral
      { hours: 72, views: 350000, tier: 'sustained_viral' },
      { hours: 168, views: 500000, tier: 'sustained_viral' },
    ];
  }
}

/**
 * 创建检测器的工厂函数
 */
export function createDetector(thresholds?: ViralThreshold[]): ViralDetector {
  return new ViralDetector(thresholds);
}

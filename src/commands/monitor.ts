import { ContentScheduler } from '../core/scheduler.js';
import { TwitterAdapter } from '../platforms/twitter/adapter.js';
import { RedditAdapter } from '../platforms/reddit/adapter.js';
import { DiscordAdapter } from '../platforms/discord/adapter.js';
import { JsonContentRepository } from '../storage/repository.js';
import platformsConfig from '../../config/platforms.json' assert { type: 'json' };

interface ScoredContent {
  content: any;
  score: number;
  reason: string;
}

export async function monitorCommand(keywords?: string[], options: { topN?: number } = {}) {
  // 如果 keywords 是空数组或 undefined，使用配置文件中的默认关键词
  const searchKeywords = keywords && keywords.length > 0 ? keywords : platformsConfig.keywords;
  const topN = options.topN || 10;

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
      thresholds: platformsConfig.platforms.reddit.viralThresholds,
      keywords: searchKeywords,  // 传递搜索关键词
    }));
  }

  if (platformsConfig.platforms.discord.enabled) {
    adapters.push(new DiscordAdapter({
      token: process.env.DISCORD_BOT_TOKEN || '',
    }));
  }

  console.log(`\n🔍 正在抓取关键词: ${searchKeywords.join(', ')}`);
  console.log(`📍 平台: ${adapters.map(a => a.name).join(', ')}`);

  const result = await scheduler.run(searchKeywords, adapters);

  // 获取所有保存的内容
  const today = new Date().toISOString().split('T')[0];
  const allContents: ScoredContent[] = [];

  for (const adapter of adapters) {
    const contents = await repo.listRaw(today, adapter.name);
    for (const content of contents) {
      const score = calculateContentScore(content);
      allContents.push({
        content,
        score: score.total,
        reason: score.reason,
      });
    }
  }

  // 按分数排序，取前 topN
  allContents.sort((a, b) => b.score - a.score);
  const topContents = allContents.slice(0, topN);

  // 输出报告
  console.log('\n📊 监控报告');
  console.log('='.repeat(50));
  console.log(`⏰ 抓取时间: ${new Date(result.timestamp).toLocaleString('zh-CN')}`);
  console.log(`🔑 关键词: ${result.keywords.join(', ')}`);
  console.log(`\n📈 平台汇总:`);
  for (const [platform, platformResult] of Object.entries(result.platforms)) {
    console.log(`  ${platform}: ${platformResult.contentsFetched} 条 | 🔥 ${platformResult.viralCount} 条爆款`);
  }
  console.log(`\n✨ 总计: ${result.summary.totalContents} 条 | 🔥 ${result.summary.viralCount} 条爆款`);

  // 输出 top 内容
  console.log('\n🏆 今日最热门内容 TOP ' + topN);
  console.log('━'.repeat(50));

  for (let i = 0; i < topContents.length; i++) {
    const { content, score, reason } = topContents[i];
    const platformIcon = getPlatformIcon(content.platform);
    const viralBadge = content.isViral ? '🔥爆款' : '';

    console.log(`\n${i + 1}. ${platformIcon} ${content.author?.username || 'unknown'} ${viralBadge}`);
    console.log(`   📝 ${content.text.slice(0, 100)}${content.text.length > 100 ? '...' : ''}`);
    console.log(`   📊 互动: ${formatMetrics(content.metrics)}`);
    console.log(`   ⏱️ ${getTimeAgo(content.createdAt)} | ⭐ 分数: ${Math.round(score)}`);
    console.log(`   🔗 ${content.url}`);
  }

  console.log('\n' + '━'.repeat(50));
  console.log(`💾 数据已保存到: data/raw/${today}/`);
  console.log('='.repeat(50));

  return { ...result, topContents };
}

/**
 * 计算内容分数：时间近 + 热门度高 = 分数高
 */
function calculateContentScore(content: any): { total: number; reason: string } {
  const ageHours = (Date.now() - new Date(content.createdAt).getTime()) / (1000 * 60 * 60);

  // 时间分数：越新越好 (0-24小时内线性衰减，之后稳定在较低分数)
  let timeScore = 0;
  if (ageHours < 24) {
    timeScore = 100 - (ageHours / 24) * 50; // 100 → 50
  } else if (ageHours < 72) {
    timeScore = 50 - ((ageHours - 24) / 48) * 30; // 50 → 20
  } else {
    timeScore = 20;
  }

  // 热度分数：基于平台指标
  let engagementScore = 0;
  if (content.platform === 'twitter') {
    const views = content.metrics.views || 0;
    const likes = content.metrics.likes || 0;
    const retweets = content.metrics.retweets || 0;
    const comments = content.metrics.comments || 0;
    engagementScore = Math.log10(views + 1) * 20 + Math.log10(likes + retweets * 2 + comments + 1) * 15;
  } else if (content.platform === 'reddit') {
    const upvotes = content.metrics.upvotes || 0;
    const comments = content.metrics.comments || 0;
    engagementScore = Math.log10(upvotes + 1) * 20 + Math.log10(comments + 1) * 15;
  }

  const total = timeScore + engagementScore;

  let reason = '';
  if (ageHours < 6) reason += '超新 ';
  if (content.isViral) reason += '爆款 ';
  if (content.metrics.views > 100000) reason += '10万+浏览 ';
  else if (content.metrics.views > 10000) reason += '1万+浏览 ';

  return { total, reason: reason.trim() };
}

function formatMetrics(metrics: any): string {
  const parts: string[] = [];
  if (metrics.views) parts.push(`${formatNumber(metrics.views)}浏览`);
  if (metrics.likes) parts.push(`${formatNumber(metrics.likes)}赞`);
  if (metrics.retweets) parts.push(`${formatNumber(metrics.retweets)}转`);
  if (metrics.upvotes) parts.push(`${formatNumber(metrics.upvotes)}顶`);
  if (metrics.comments) parts.push(`${formatNumber(metrics.comments)}评论`);
  return parts.join(' | ');
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function getTimeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return '刚刚';
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return '一周前';
}

function getPlatformIcon(platform: string): string {
  const icons: Record<string, string> = {
    twitter: '𝕏',
    reddit: '📱',
    discord: '💬',
    telegram: '✈️',
  };
  return icons[platform] || '📌';
}

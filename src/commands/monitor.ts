import { ContentScheduler } from '../core/scheduler.js';
import { TwitterAdapter } from '../platforms/twitter/adapter.js';
import { RedditAdapter } from '../platforms/reddit/adapter.js';
import { DiscordAdapter } from '../platforms/discord/adapter.js';
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

  if (platformsConfig.platforms.discord.enabled) {
    adapters.push(new DiscordAdapter({
      token: process.env.DISCORD_BOT_TOKEN || '',
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

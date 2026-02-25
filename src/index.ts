#!/usr/bin/env node
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { TwitterMonitor } from './monitor.js';
import { createWorkflow } from './publish-workflow.js';
import { createPublisher } from './xiaohongshu-publisher.js';
import type { MonitorConfig, TweetRecord } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * CLI 主入口
 */
async function main() {
  const args = process.argv.slice(2);
  const input = args.join(' ');

  // 尝试自然语言解析
  const nlResult = parseNaturalLanguage(input);
  if (nlResult.isNaturalLanguage) {
    await runMultiPlatform(nlResult.keywords, { topN: nlResult.topN });
    return;
  }

  // 传统命令模式
  const command = args[0] || 'help';

  switch (command) {
    case 'monitor':
    case 'run':
      await runMonitor();
      break;

    case 'stats':
      await showStats(args[1]);
      break;

    case 'publish':
      await runPublish(args[1]);
      break;

    case 'xhs-status':
      await checkXiaohongshuStatus();
      break;

    case 'multi':
      await runMultiPlatform(args.slice(1));
      break;

    case 'help':
      showHelp();
      break;

    default:
      console.log(`❌ 未知命令: ${command}`);
      showHelp();
      process.exit(1);
  }
}

/**
 * 解析自然语言输入
 */
function parseNaturalLanguage(input: string): { isNaturalLanguage: boolean; keywords?: string[]; topN?: number } {
  if (!input) return { isNaturalLanguage: false };

  const lower = input.toLowerCase();

  // 检测是否包含监控相关的意图词
  const intentPatterns = [
    /监控|检测|抓取|看看|查查|搜|search|monitor|detect|check/,
    /爆款|热门|火|viral|hot|popular/,
    /今天|今日|today|recent|latest/
  ];

  const hasIntent = intentPatterns.some(p => p.test(lower));

  if (!hasIntent) return { isNaturalLanguage: false };

  // 提取关键词
  let keywords: string[] = [];

  // 包含特定关键词
  if (lower.includes('openclaw') || lower.includes('open claw')) {
    keywords.push('openclaw', 'open claw', '#openclaw');
  } else if (lower.includes('ai') || lower.includes('人工智能')) {
    keywords.push('AI', 'artificial intelligence', 'LLM', 'GPT');
  } else if (lower.includes('区块链') || lower.includes('blockchain') || lower.includes('crypto')) {
    keywords.push('blockchain', 'crypto', 'web3');
  }

  // 如果没有识别到特定关键词，使用配置文件中的默认关键词
  if (keywords.length === 0) {
    return { isNaturalLanguage: true, keywords: undefined, topN: 10 };
  }

  return { isNaturalLanguage: true, keywords, topN: 10 };
}

/**
 * 检查小红书登录状态
 */
async function checkXiaohongshuStatus() {
  console.log('📱 检查小红书 MCP 状态...\n');

  const publisher = createPublisher();

  try {
    const status = await publisher.checkStatus();

    if (status.loggedIn) {
      console.log(`✅ 已登录小红书`);
      console.log(`   用户: ${status.username || '未知'}`);
      console.log(`   MCP 服务器: http://localhost:18060`);
    } else {
      console.log(`❌ 未登录小红书`);
      console.log(`\n请先运行登录工具：`);
      console.log(`   cd ~/Downloads`);
      console.log(`   ./xiaohongshu-login-darwin-arm64`);
      console.log(`\n然后扫描二维码登录`);
    }
  } catch (error) {
    console.error(`❌ 无法连接到小红书 MCP 服务器`);
    console.error(`\n请确保 MCP 服务器正在运行：`);
    console.error(`   cd ~/Downloads`);
    console.error(`   ./xiaohongshu-mcp-darwin-arm64`);
  }
}

/**
 * 运行监控
 */
async function runMonitor() {
  // 加载配置
  const config = await loadConfig();

  // 检查环境变量
  if (!process.env.TWITTER_AUTH_TOKEN || !process.env.TWITTER_CT0) {
    console.error('❌ 缺少 Twitter 认证信息！');
    console.error('请在 .env 文件中设置 TWITTER_AUTH_TOKEN 和 TWITTER_CT0');
    console.error('');
    console.error('获取方法：');
    console.error('1. 打开浏览器，登录 Twitter/X');
    console.error('2. 按 F12 打开开发者工具');
    console.error('3. 进入 Application → Storage → Cookies');
    console.error('4. 复制 auth_token 和 ct0 的值');
    process.exit(1);
  }

  // 创建监控器并运行
  const monitor = new TwitterMonitor(config);

  try {
    await monitor.run();
  } catch (error) {
    console.error('❌ 监控执行失败:', error);
    process.exit(1);
  }
}

/**
 * 运行发布流程
 */
async function runPublish(date?: string) {
  const config = await loadConfig();
  const targetDate = date || new Date().toISOString().split('T')[0];
  const filePath = path.join(config.dataDir, `${targetDate}.json`);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as any;

    // 获取爆款推文
    const viralTweets = data.tweets
      .filter((t: TweetRecord) => t.currentTier)
      .sort((a: TweetRecord, b: TweetRecord) => b.viewCount - a.viewCount);

    if (viralTweets.length === 0) {
      console.log('❌ 没有找到爆款推文');
      return;
    }

    console.log(`\n📱 准备发布 ${viralTweets.length} 条爆款推文到小红书...\n`);

    // 创建工作流
    const workflow = createWorkflow({
      ai: {
        apiKey: process.env.ANTHROPIC_API_KEY,
      },
      images: {
        outputDir: './data/images',
      },
    });

    // 执行发布
    const results = await workflow.processAndPublishBatch(viralTweets);

    // 打印结果
    const successCount = results.filter(r => r.success).length;
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📊 发布完成`);
    console.log(`   成功: ${successCount}/${results.length}`);
    console.log(`   失败: ${results.length - successCount}/${results.length}`);

    // 显示失败的项目
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      console.log(`\n❌ 失败的推文:`);
      for (const f of failed) {
        console.log(`   - ${f.tweetId}: ${f.error}`);
      }
    }
    console.log(`${'='.repeat(50)}\n`);

  } catch (error) {
    console.error(`❌ 读取数据文件失败: ${filePath}`);
    console.error(error);
    process.exit(1);
  }
}

/**
 * 显示统计信息
 */
async function showStats(date?: string) {
  const config = await loadConfig();
  const targetDate = date || new Date().toISOString().split('T')[0];
  const filePath = path.join(config.dataDir, `${targetDate}.json`);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    console.log('');
    console.log(`📊 数据统计 - ${data.date}`);
    console.log('━'.repeat(50));
    console.log(`关键词: ${data.keywords.join(', ')}`);
    console.log(`总推文数: ${data.totalTweets}`);
    console.log(`更新时间: ${new Date(data.updatedAt).toLocaleString('zh-CN')}`);
    console.log('');
    console.log('爆款统计:');
    console.log(`  Tier 1 (Early Momentum):     ${data.viralCandidates} 条`);
    console.log(`  Tier 2 (Confirmed Viral):     ${data.viral} 条`);
    console.log(`  Tier 3 (Sustained Viral):     ${data.sustainedViral} 条`);
    console.log('');

    // 显示前几条爆款
    const viralTweets = data.tweets
      .filter(t => t.currentTier)
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 5);

    if (viralTweets.length > 0) {
      console.log('🔥 Top 5 爆款推文:');
      console.log('');
      for (let i = 0; i < viralTweets.length; i++) {
        const tweet = viralTweets[i];
        const tierLabel = getTierLabel(tweet.currentTier);
        console.log(`  ${i + 1}. @${tweet.author.name}`);
        console.log(`     ${tweet.text.substring(0, 80)}${tweet.text.length > 80 ? '...' : ''}`);
        console.log(`     👀 ${tweet.viewCount.toLocaleString()} | ❤️ ${tweet.likeCount} | 🔄 ${tweet.retweetCount}`);
        console.log(`     等级: ${tierLabel}`);
        console.log(`     链接: https://x.com/i/status/${tweet.id}`);
        console.log('');
      }
    }
  } catch {
    console.log(`❌ 找不到日期 ${targetDate} 的数据文件`);
    console.log(`   路径: ${filePath}`);
  }
}

/**
 * 加载配置
 */
async function loadConfig(): Promise<MonitorConfig> {
  const configPath = path.join(__dirname, '../config/keywords.json');

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const configData = JSON.parse(content);

    return {
      keywords: configData.keywords,
      searchConfig: configData.searchConfig,
      thresholds: configData.thresholds || [],
      dataDir: process.env.DATA_DIR || './data',
    };
  } catch {
    // 默认配置
    return {
      keywords: ['openclaw', 'open claw', '#openclaw'],
      searchConfig: { count: 200, maxPages: 3 },
      thresholds: [],
      dataDir: './data',
    };
  }
}

/**
 * 获取 Tier 标签
 */
function getTierLabel(tier: string | null): string {
  switch (tier) {
    case 'viral_candidate':
      return 'Tier 1 (Early Momentum)';
    case 'viral':
      return 'Tier 2 (Confirmed Viral)';
    case 'sustained_viral':
      return 'Tier 3 (Sustained Viral)';
    default:
      return 'N/A';
  }
}

/**
 * 运行多平台监控
 */
async function runMultiPlatform(keywords?: string[], options: { topN?: number } = {}) {
  const { monitorCommand } = await import('./commands/monitor.js');
  // 如果 keywords 是空数组，传 undefined 让 monitorCommand 使用默认配置
  const actualKeywords = keywords && keywords.length > 0 ? keywords : undefined;
  await monitorCommand(actualKeywords, options);
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log('');
  console.log('🐦 Twitter 爆款监控器 → 小红书发布');
  console.log('');
  console.log('用法:');
  console.log('  npm run <command>');
  console.log('');
  console.log('命令:');
  console.log('  monitor              执行监控任务');
  console.log('  stats [date]         显示统计信息 (默认今天)');
  console.log('  publish [date]       发布爆款到小红书 (默认今天)');
  console.log('  xhs-status           检查小红书登录状态');
  console.log('  multi [keywords]     多平台监控 (Twitter, Reddit, Discord)');
  console.log('  help                 显示帮助信息');
  console.log('');
  console.log('示例:');
  console.log('  npm run monitor              # 监控 Twitter');
  console.log('  npm run dev stats            # 查看今天统计');
  console.log('  npm run dev stats 2026-02-18 # 查看指定日期');
  console.log('  npm run dev publish          # 发布今天爆款到小红书');
  console.log('  npm run dev xhs-status       # 检查小红书登录状态');
  console.log('  npm run dev multi            # 多平台监控（使用配置关键词）');
  console.log('  npm run dev multi openclaw   # 多平台监控指定关键词');
  console.log('');
  console.log('环境变量:');
  console.log('  TWITTER_AUTH_TOKEN  Twitter auth_token (必填)');
  console.log('  TWITTER_CT0         Twitter ct0 token (必填)');
  console.log('  REDDIT_CLIENT_ID    Reddit client ID (可选)');
  console.log('  REDDIT_CLIENT_SECRET Reddit client secret (可选)');
  console.log('  DISCORD_BOT_TOKEN   Discord bot token (可选)');
  console.log('  ANTHROPIC_API_KEY   Claude API key (AI翻译，可选)');
  console.log('  DATA_DIR            数据目录 (默认: ./data)');
  console.log('');
  console.log('发布前准备:');
  console.log('  1. 启动 MCP 服务器: cd ~/Downloads && ./xiaohongshu-mcp-darwin-arm64');
  console.log('  2. 扫码登录: cd ~/Downloads && ./xiaohongshu-login-darwin-arm64');
  console.log('  3. 检查状态: npm run dev xhs-status');
  console.log('');
  console.log('发布流程:');
  console.log('  1. 监控检测爆款 → 2. AI翻译总结 → 3. 下载图片 → 4. 发布小红书');
  console.log('');
}

// 运行
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

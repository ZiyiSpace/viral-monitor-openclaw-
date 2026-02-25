import fs from 'fs/promises';
import path from 'path';
import { JsonContentRepository } from '../storage/repository.js';
import { AIContentProcessor, type ProcessedContent } from '../publish/ai-processor.js';
import { ImageDownloader } from '../publish/image-downloader.js';
import type { RawContent } from '../core/types.js';

export interface PublishOptions {
  date?: string;
  platform?: 'twitter' | 'reddit' | 'all';
  aiProvider?: 'glm' | 'anthropic';
  topN?: number;
}

/**
 * 发布命令：处理爆款内容，生成多平台格式
 */
export async function publishCommand(options: PublishOptions = {}) {
  const targetDate = options.date || new Date().toISOString().split('T')[0];
  const platform = options.platform || 'all';
  const topN = options.topN || 10;

  console.log(`\n📱 准备处理爆款内容...\n`);
  console.log(`📅 日期: ${targetDate}`);
  console.log(`🌐 平台: ${platform === 'all' ? '全部' : platform}`);
  console.log(`🤖 AI: ${options.aiProvider === 'glm' ? 'GLM-4.7' : 'Anthropic'}\n`);

  // 1. 读取爆款数据
  const repo = new JsonContentRepository('./data');
  const contents = await loadViralContents(repo, targetDate, platform);

  if (contents.length === 0) {
    console.log('❌ 没有找到爆款内容');
    return;
  }

  console.log(`✅ 找到 ${contents.length} 条爆款内容\n`);

  // 2. 下载图片
  console.log('📸 下载图片...');
  const downloader = new ImageDownloader('./data/images');
  const imageMap = await downloader.downloadBatch(contents, targetDate);
  console.log(`✅ 下载了 ${Array.from(imageMap.values()).flat().length} 张图片\n`);

  // 3. AI 处理内容
  console.log('🤖 AI 处理内容...');
  const apiKey = process.env.GLM_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('缺少 API Key！请设置 GLM_API_KEY 或 ANTHROPIC_API_KEY 环境变量');
  }

  const processor = new AIContentProcessor({
    provider: options.aiProvider || 'glm',
    apiKey,
    baseUrl: process.env.GLM_BASE_URL,
  });

  const processedContents: ProcessedContent[] = [];
  for (let i = 0; i < contents.length; i++) {
    const content = contents[i];
    console.log(`  处理 ${i + 1}/${contents.length}: ${content.author?.username || content.id}...`);

    try {
      const processed = await processor.processContent(content);
      processedContents.push(processed);
    } catch (error) {
      console.warn(`  ⚠️ 处理失败: ${error}`);
    }
  }

  console.log(`✅ 处理了 ${processedContents.length} 条内容\n`);

  // 4. 按 AI 推荐分数排序
  processedContents.sort((a, b) => b.recommendationScore - a.recommendationScore);

  // 5. 输出结果
  outputResults(processedContents, imageMap, targetDate, topN);
}

/**
 * 加载爆款内容
 */
async function loadViralContents(
  repo: JsonContentRepository,
  date: string,
  platform: 'twitter' | 'reddit' | 'all'
): Promise<any[]> {
  const contents: any[] = [];

  const platforms = platform === 'all' ? ['twitter', 'reddit'] : [platform];

  for (const p of platforms) {
    const rawContents = await repo.listRaw(date, p);

    for (const content of rawContents) {
      if (content.isViral) {
        contents.push(content);
      }
    }
  }

  return contents;
}

/**
 * 输出处理结果
 */
function outputResults(
  contents: ProcessedContent[],
  imageMap: Map<string, string[]>,
  date: string,
  topN: number
) {
  const displayContents = contents.slice(0, topN);

  console.log('\n' + '═'.repeat(60));
  console.log(`📊 AI 推荐的爆款内容 TOP ${displayContents.length}`);
  console.log('═'.repeat(60) + '\n');

  for (let i = 0; i < displayContents.length; i++) {
    const item = displayContents[i];
    const images = imageMap.get(item.original.url.split('/').pop() || '') || [];

    // 推荐 star
    const stars = '⭐'.repeat(Math.round(item.recommendationScore / 20));

    console.log(`${'━'.repeat(60)}`);
    console.log(`📌 推荐 #${i + 1} ${stars}`);
    console.log(`推荐指数: ${item.recommendationScore}/100`);
    console.log(`${'━'.repeat(60)}`);
    console.log(`来源: ${item.original.author}`);
    console.log(`原文: ${item.original.title.substring(0, 60)}...`);
    console.log(`链接: ${item.original.url}\n`);

    // 小红书格式
    console.log(`【小红书格式】📱`);
    console.log(`${item.xiaohongshu.title}`);
    console.log('');
    console.log(`${item.xiaohongshu.content}`);
    console.log(`${item.xiaohongshu.tags.join(' ')}`);
    if (images.length > 0) {
      console.log(`图片: ${images[0]}`);
    }
    console.log('');

    // 抖音/快手格式
    console.log(`【抖音/快手格式】📹`);
    console.log(`标题: ${item.douyin.title}`);
    console.log(`内容: ${item.douyin.content}`);
    console.log(`${item.douyin.tags.join(' ')}`);
    console.log('');

    // 快手格式
    console.log(`【快手格式】📱`);
    console.log(`标题: ${item.kuaishou.title}`);
    console.log(`内容: ${item.kuaishou.content}`);
    console.log(`${item.kuaishou.tags.join(' ')}`);
    console.log('');
    console.log(`${'━'.repeat(60)}\n`);
  }

  console.log('═'.repeat(60));
  console.log(`💾 复制以上内容到对应平台发布即可`);
  console.log(`📁 图片已保存到: data/images/${date}/`);
  console.log('═'.repeat(60) + '\n');
}

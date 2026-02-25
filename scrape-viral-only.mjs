/**
 * 抓取真正热门的推文（按Tier标准筛选）
 */

import { TwitterClient } from '@cm-growth-hacking/twitter-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLM_API_KEY = process.env.GLM_API_KEY || '639a8ccb5e7a44a2afe4b11c2f315919.uukSQwgpJ5zQkpdY';

const AUTH_TOKEN = "6af4542607f11b7f23b6edc1ed829a978db19fb9";
const CT0 = "b9bd73c0bf1ef6eb0de855313e6fb7ea9ced25ccc845ebe4b70cad34b5eb91aba18a11e02bd443e06d1aaaf0692de961ee7a58034c6855ee38dc56ac4741e1a7c73e5d90cc8aed52124b5ec11fa0dab5";

const client = new TwitterClient({
  authToken: AUTH_TOKEN,
  ct0: CT0
});

const today = '2026-02-21';
const outputDir = `./output/posts/${today}`;

/**
 * 计算时间差（小时）
 */
function hoursAgo(createdAt) {
  const created = new Date(createdAt);
  const now = new Date();
  return (now - created) / (1000 * 60 * 60);
}

/**
 * 判断热门等级
 */
function checkViralStatus(createdAt, viewCount) {
  const hours = hoursAgo(createdAt);
  const days = hours / 24;

  // Tier 1 — Early Momentum
  if (hours <= 0.5 && viewCount >= 5000) return { tier: 1, label: 'viral_candidate', reason: `≥5K in ${Math.round(hours*60)}min` };
  if (hours <= 1 && viewCount >= 10000) return { tier: 1, label: 'viral_candidate', reason: `≥10K in ${Math.round(hours*60)}min` };
  if (hours <= 3 && viewCount >= 30000) return { tier: 1, label: 'viral_candidate', reason: `≥30K in ${Math.round(hours*60)}min` };
  if (hours <= 6 && viewCount >= 60000) return { tier: 1, label: 'viral_candidate', reason: `≥60K in ${Math.round(hours)}h` };

  // Tier 2 — Confirmed Viral
  if (hours <= 12 && viewCount >= 100000) return { tier: 2, label: 'viral', reason: `≥100K in ${Math.round(hours)}h` };
  if (hours <= 24 && viewCount >= 200000) return { tier: 2, label: 'viral', reason: `≥200K in ${Math.round(hours)}h` };

  // Tier 3 — Sustained Viral
  if (days <= 3 && viewCount >= 350000) return { tier: 3, label: 'sustained_viral', reason: `≥350K in ${Math.round(days*10)/10}d` };
  if (days <= 7 && viewCount >= 500000) return { tier: 3, label: 'sustained_viral', reason: `≥500K in ${Math.round(days*10)/10}d` };

  return null; // 非热门
}

/**
 * 翻译
 */
async function translateText(text) {
  const prompt = `你是专业译者。将下面英文推文翻译为中文，要求口语自然但信息准确。

硬规则：
只输出中文翻译，不要输出任何解释/标题/emoji/标签/引言/引用标记。
保留专有名词、产品名、账号名、缩写（OpenClaw、Claude Code、Telegram、VPS、SSH 等）。
原文中的链接原样保留，但不要新增任何链接。
允许调整断句让中文通顺，但不得增删事实、不得脑补。

英文原文：
${text}`;

  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GLM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

/**
 * 生成小红书文案
 */
async function generatePost(translatedText, authorName) {
  const prompt = `你是一名小红书科技博主（理性、信息密度高，不鸡汤）。基于给定的"已翻译推文"生成可发布的小红书笔记。

【已翻译的推文】（重要：content 第一段必须逐字逐行原样粘贴，包含换行）
${translatedText}

【推文作者】
${authorName}

【必须输出 JSON】禁止输出 JSON 之外的任何文字。JSON 结构必须严格为：
{
"title": "...",
"content": "...",
"tags": ["..."]
}

【content 拼接规则】
content 必须按以下顺序拼接（不要多/少任何段）：
(1) 第一段：原样粘贴【已翻译的推文】
(2) 空行
(3) 转自 twitter @${authorName}
(4) 空行
(5) 正文解读（写成流畅的小红书文案，不要用【】标题）
(6) 空行
(7) 标签串（与 tags 数组一致，用空格分隔，如：#OpenClaw #安全 ...）

【正文固定结构】（必须写成"可读的发布文案"，不要提纲格式）
第一段：钩子（80-120字，2-3行）- 一句结论、为什么重要、口语化
第二段：到底在吹什么（2-4行）- 点名核心名词、用原文具体数字
第三段：对普通人意味着什么（2-4行）- 实际好处
第四段：注意事项（1-2行）- 引用原文前提条件
第五段：收尾（1行）- 给行动点
全文允许≤6个emoji。

【禁区补充】
禁止把"安全风险"当主轴，除非原推明确提到安全/被黑/漏洞等关键词。
禁止空泛：不要写"开源魅力/梦想/新世界大门/无限可能/程序员不易"。

【标题要求】≤30字，可带1-2个emoji，简洁有力，吸引点击。

【tags 要求】5-8个，必须包含#OpenClaw，其余从：#开源 #AI工具 #Claude #安全 #网络安全 #运维 #程序员 #GitHub #提示词 中选择。

现在开始，只输出 JSON。`;

  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GLM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  const content = data.choices[0].message.content;

  let jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
                  content.match(/```\s*([\s\S]*?)\s*```/) ||
                  content.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    let jsonStr = jsonMatch[1] || jsonMatch[0];
    jsonStr = jsonStr.replace(/^[^{]*/, '').replace(/[^}]*$/, '').trim();
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * 下载图片
 */
async function downloadImages(imageUrls, tweetDir) {
  if (!imageUrls || imageUrls.length === 0) return 0;
  const imagesDir = path.join(tweetDir, '05-images');
  await fs.promises.mkdir(imagesDir, { recursive: true });

  let downloaded = 0;
  for (let i = 0; i < imageUrls.length; i++) {
    try {
      const url = imageUrls[i];
      const ext = url.match(/\.(jpg|jpeg|png|gif|webp)/i)?.[1] || 'jpg';
      const filename = `image_${i}.${ext}`;
      const filepath = path.join(imagesDir, filename);

      const response = await fetch(url);
      if (!response.ok) continue;

      const buffer = await response.arrayBuffer();
      await fs.promises.writeFile(filepath, Buffer.from(buffer));
      downloaded++;
    } catch (error) {}
  }
  return downloaded;
}

/**
 * 保存推文
 */
async function saveTweet(tweet, viralInfo, index) {
  const mediaType = tweet.media?.some(m => m.type === 'video') ? '视频'
                  : tweet.media?.some(m => m.type === 'photo') ? '图片'
                  : '纯文本';

  const folderName = `${index}-${tweet.id}-${mediaType}`;
  const folderPath = path.join(outputDir, folderName);
  await fs.promises.mkdir(folderPath, { recursive: true });

  const hasVideo = tweet.media?.some(m => m.type === 'video');
  const hasImages = tweet.media?.some(m => m.type === 'photo');
  const images = hasImages
    ? tweet.media.filter(m => m.type === 'photo').map(m => m.media_url_https || m.url)
    : [];

  const content = `${tweet.text}

Author: ${tweet.author?.name} (@${tweet.author?.username})
Created: ${tweet.createdAt}
Link: ${tweet.url}

Views: ${tweet.viewCount?.toLocaleString() || 0}
Likes: ${tweet.likeCount || 0}
Retweets: ${tweet.retweetCount || 0}
Has Video: ${hasVideo}
Has Images: ${hasImages} (${images.length} images)
Images: ${images.length > 0 ? images.map((url, i) => `${i + 1}. ${url}`).join('\n         ') : 'None'}

【热门等级】Tier ${viralInfo.tier} - ${viralInfo.label}
【原因】${viralInfo.reason}`;

  await fs.promises.writeFile(path.join(folderPath, '01-original-tweet.txt'), content, 'utf8');

  // 翻译
  console.log('   🌐 翻译中...');
  const translatedText = await translateText(tweet.text);
  await fs.promises.writeFile(path.join(folderPath, '02-translated.txt'), translatedText);

  // 生成文案
  console.log('   ✍️  生成文案中...');
  const generatedPost = await generatePost(translatedText, tweet.author?.name || 'Unknown');

  if (generatedPost) {
    console.log(`   标题: ${generatedPost.title}`);
    await fs.promises.writeFile(
      path.join(folderPath, '03-xiaohongshu-post.json'),
      JSON.stringify(generatedPost, null, 2)
    );
    await fs.promises.writeFile(
      path.join(folderPath, '04-xiaohongshu-post-readable.txt'),
      `标题：${generatedPost.title}\n\n${generatedPost.content}`
    );
  }

  // 下载图片
  if (images.length > 0) {
    console.log(`   📸 下载 ${images.length} 张图片...`);
    await downloadImages(images, folderPath);
  }

  console.log(`   ✅ 已保存: ${folderName}`);
}

/**
 * 主函数
 */
async function main() {
  console.log(`🔍 搜索 OpenClaw 推文并筛选热门...\n`);

  // 创建输出目录
  await fs.promises.mkdir(outputDir, { recursive: true });

  // 加载已抓取的推文ID用于去重
  const scrapedIds = new Set();

  // 从 2026-02-20 读取
  try {
    const feb20 = fs.readdirSync('./output/posts/2026-02-20');
    for (const f of feb20) {
      const match = f.match(/^(\d+)-/);
      if (match) scrapedIds.add(match[1]);
    }
  } catch (e) {}

  console.log(`已排除 ${scrapedIds.size} 条历史推文\n`);

  // 搜索推文
  const result = await client.search("OpenClaw OR Moltbot OR Clawdbot OR steipete", 100, "Top");

  if (!result.success) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  console.log(`找到 ${result.tweets.length} 条推文\n`);
  console.log('='.repeat(60));

  // 筛选热门推文
  const viralTweets = [];

  for (const tweet of result.tweets) {
    if (scrapedIds.has(tweet.id)) continue;

    const viral = checkViralStatus(tweet.createdAt, tweet.viewCount || 0);
    if (viral) {
      viralTweets.push({ tweet, viral });
    }
  }

  // 按热门等级排序
  viralTweets.sort((a, b) => b.viral.tier - a.viral.tier || (b.tweet.viewCount || 0) - (a.tweet.viewCount || 0));

  console.log(`\n🔥 找到 ${viralTweets.length} 条热门推文!\n`);

  if (viralTweets.length === 0) {
    console.log('没有找到符合热门标准的新推文。');
    return;
  }

  // 保存推文
  for (let i = 0; i < viralTweets.length; i++) {
    const { tweet, viral } = viralTweets[i];
    const tierIcon = viral.tier === 3 ? '🏆' : viral.tier === 2 ? '🔥' : '⚡';

    console.log(`\n[${i + 1}/${viralTweets.length}] ${tierIcon} Tier ${viral.tier}`);
    console.log(`作者: ${tweet.author?.name} (@${tweet.author?.username})`);
    console.log(`发布: ${tweet.createdAt} (${Math.round(hoursAgo(tweet.createdAt) * 10) / 10}小时前)`);
    console.log(`浏览: ${tweet.viewCount?.toLocaleString() || 0}`);
    console.log(`原因: ${viral.reason}`);

    await saveTweet(tweet, viral, i + 1);

    // 延迟避免 API 限流
    if (i < viralTweets.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n🎉 完成! 共保存 ${viralTweets.length} 条热门推文`);
  console.log(`保存位置: ${outputDir}/`);
}

main().catch(console.error);

/**
 * 从Twitter搜索热门OpenClaw推文并生成小红书文案
 * 用法: node generate-posts.js
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { TwitterClient } from '@cm-growth-hacking/twitter-client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLM_API_KEY = process.env.GLM_API_KEY || '639a8ccb5e7a44a2afe4b11c2f315919.uukSQwgpJ5zQkpdY';

// 今天的日期作为文件夹名
const today = new Date().toISOString().split('T')[0]; // 2026-02-20
const outputDir = `./output/posts/${today}`;

// 昨天的数据文件，用于去重
const yesterdayFile = './data/2026-02-19.json';

// Twitter 认证
const twitter = new TwitterClient({
  authToken: process.env.TWITTER_AUTH_TOKEN || '83b9bcbc9d2b7c426da6b2139f43fc5ba42035fc',
  ct0: process.env.TWITTER_CT0 || '9f1b28ba70a936d4cc90b20617ebd28a058b79ba53fb4c1590d58e39cbd0425c2c6d95b613cb7879e58d43005e6928e9827baac13217e6e8a4b7ba21c8b8d00f1595f53d379213baee7303b68c9436ab'
});

/**
 * 加载昨天的推文ID用于去重
 */
async function loadYesterdayTweetIds() {
  try {
    const data = JSON.parse(await fs.readFile(yesterdayFile, 'utf8'));
    const ids = new Set(data.tweets.map(t => t.id));
    console.log(`📋 已加载昨天的 ${ids.size} 条推文ID用于去重`);
    return ids;
  } catch (error) {
    console.log(`⚠️  无法加载昨天的数据: ${error.message}`);
    return new Set();
  }
}

/**
 * 从Twitter搜索热门推文
 */
async function searchViralTweets(yesterdayIds) {
  const keywords = ['openclaw', 'open claw', '#openclaw'];
  const allTweets = [];
  const seenIds = new Set(yesterdayIds);

  console.log('🔍 正在从Twitter搜索OpenClaw相关推文...');

  for (const keyword of keywords) {
    try {
      const result = await twitter.search(keyword, 100, 'Top');

      if (result && result.tweets) {
        let newCount = 0;
        for (const tweet of result.tweets) {
          if (seenIds.has(tweet.id)) continue;
          seenIds.add(tweet.id);
          newCount++;

          // 检测媒体类型
          const hasVideo = tweet.media?.some(m => m.type === 'video');
          const hasImages = tweet.media?.some(m => m.type === 'photo');
          const images = hasImages
            ? tweet.media.filter(m => m.type === 'photo').map(m => m.media_url_https || m.url)
            : [];

          allTweets.push({
            id: tweet.id,
            text: tweet.text,
            author: {
              username: tweet.author?.username || 'unknown',
              name: tweet.author?.name || 'Unknown'
            },
            createdAt: tweet.createdAt,
            viewCount: tweet.viewCount || 0,
            likeCount: tweet.likeCount || 0,
            retweetCount: tweet.retweetCount || 0,
            media: tweet.media || [],
            hasVideo,
            hasImages,
            images
          });
        }

        console.log(`   关键词 "${keyword}": 找到 ${result.tweets.length} 条，新增 ${newCount} 条`);
      }

      // 避免限流，延迟1秒
      await new Promise(r => setTimeout(r, 1000));

    } catch (error) {
      console.error(`   搜索 "${keyword}" 失败:`, error.message);
    }
  }

  // 按浏览量排序，取前30条
  allTweets.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  return allTweets.slice(0, 30);
}

/**
 * A) 翻译提示词
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
 * B) 生成文案提示词
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

第一段：钩子（80-120字，2-3行）
- 一句结论：这是什么/有什么用
- 为什么重要：数字/对比/反差（如"10美元硬件跑完整AI"）
- 口语化，有情绪

第二段：到底在吹什么（2-4行）
- 点名核心名词（OpenClaw、具体技术等）
- 用原文的具体数字/事实

第三段：对普通人意味着什么（2-4行）
- 实际好处：省钱/省事/便携/本地部署等
- 不要上价值，别讲空话

第四段：注意事项（1-2行）
- 引用原文的前提条件
- 不要编造，没有就不写

第五段：收尾（1行）
- 给行动点：关注/等demo/尝试/查看等

全文允许≤6个emoji，不要模板化，不要"风险：触发条件："这种格式。

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

  // Parse JSON
  let jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
                  content.match(/```\s*([\s\S]*?)\s*```/) ||
                  content.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    let jsonStr = jsonMatch[1] || jsonMatch[0];
    jsonStr = jsonStr.replace(/^[^{]*/, '').replace(/[^}]*$/, '').trim();
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('JSON 解析失败:', e.message);
      return null;
    }
  }

  return null;
}

/**
 * 下载图片
 */
async function downloadImages(imageUrls, tweetDir, index) {
  if (!imageUrls || imageUrls.length === 0) return 0;

  const imagesDir = path.join(tweetDir, '05-images');
  await fs.mkdir(imagesDir, { recursive: true });

  let downloaded = 0;
  const imageUrlsFile = path.join(tweetDir, '01-original-tweet.txt');

  for (let i = 0; i < imageUrls.length; i++) {
    try {
      const url = imageUrls[i];
      const ext = url.match(/\.(jpg|jpeg|png|gif|webp)/i)?.[1] || 'jpg';
      const filename = `image_${i}.${ext}`;
      const filepath = path.join(imagesDir, filename);

      const response = await fetch(url);
      if (!response.ok) {
        console.log(`      ⚠️  图片 ${i + 1} 下载失败: ${response.status}`);
        continue;
      }

      const buffer = await response.arrayBuffer();
      await fs.writeFile(filepath, Buffer.from(buffer));
      downloaded++;
      console.log(`      ✅ 图片 ${i + 1}/${imageUrls.length} 下载成功: ${filename}`);

    } catch (error) {
      console.error(`      ❌ 图片 ${i + 1} 下载失败:`, error.message);
    }
  }

  return downloaded;
}

/**
 * 保存到本地文件
 */
async function savePost(tweet, translatedText, generatedPost, index, total) {
  // 文件夹命名：序号-ID + 媒体标注
  const mediaSuffix = [];
  if (tweet.hasVideo) mediaSuffix.push('视频');
  if (tweet.hasImages) mediaSuffix.push('图片');
  const folderSuffix = mediaSuffix.length > 0 ? `-${mediaSuffix.join('+')}` : '';

  const tweetDir = path.join(outputDir, `${index + 1}-${tweet.id}${folderSuffix}`);
  await fs.mkdir(tweetDir, { recursive: true });

  // 保存原文
  const mediaInfo = [
    `Views: ${tweet.viewCount?.toLocaleString() || 0}`,
    `Likes: ${tweet.likeCount}`,
    `Has Video: ${tweet.hasVideo}`,
    `Has Images: ${tweet.hasImages} (${tweet.images?.length || 0} images)`,
    `Images: ${tweet.images?.map((url, i) => `${i + 1}. ${url}`).join('\n         ') || 'None'}`
  ].join('\n');

  await fs.writeFile(
    path.join(tweetDir, '01-original-tweet.txt'),
    `${tweet.text}\n\nAuthor: ${tweet.author.name} (@${tweet.author.username})\nCreated: ${tweet.createdAt}\nLink: https://x.com/i/status/${tweet.id}\n\n${mediaInfo}`
  );

  // 保存翻译
  await fs.writeFile(
    path.join(tweetDir, '02-translated.txt'),
    translatedText
  );

  // 下载图片
  if (tweet.hasImages) {
    console.log(`   📸 发现 ${tweet.images.length} 张图片，开始下载...`);
    const downloaded = await downloadImages(tweet.images, tweetDir, index);
    console.log(`   ✅ 图片下载完成: ${downloaded}/${tweet.images.length}`);
  }

  // 保存生成的小红书文案
  if (generatedPost) {
    await fs.writeFile(
      path.join(tweetDir, '03-xiaohongshu-post.json'),
      JSON.stringify(generatedPost, null, 2)
    );

    // 保存可读格式
    await fs.writeFile(
      path.join(tweetDir, '04-xiaohongshu-post-readable.txt'),
      `标题：${generatedPost.title}\n\n${generatedPost.content}`
    );
  }

  const mediaIcon = tweet.hasVideo ? '📹' : (tweet.hasImages ? '🖼️' : '');
  console.log(`   ✅ [${index + 1}/${total}] 已保存: ${path.basename(tweetDir)} ${mediaIcon}`);
}

/**
 * 主函数
 */
async function main() {
  console.log(`🚀 开始从Twitter搜索OpenClaw热门推文并生成文案...\n📅 日期: ${today}\n`);

  // 创建输出目录
  await fs.mkdir(outputDir, { recursive: true });

  // 加载昨天的推文ID用于去重
  const yesterdayIds = await loadYesterdayTweetIds();

  // 从Twitter搜索热门推文（过滤掉昨天的）
  const viralTweets = await searchViralTweets(yesterdayIds);

  console.log(`\n📊 找到 ${viralTweets.length} 条新推文（按浏览量排序）\n`);

  for (let i = 0; i < viralTweets.length; i++) {
    const tweet = viralTweets[i];
    const mediaInfo = [];
    if (tweet.hasVideo) mediaInfo.push('📹视频');
    if (tweet.hasImages) mediaInfo.push(`🖼️${tweet.images.length}图`);

    console.log(`[${i + 1}/${viralTweets.length}] 处理推文: ${tweet.id}`);
    console.log(`   作者: ${tweet.author.name} (@${tweet.author.username})`);
    console.log(`   浏览: ${tweet.viewCount?.toLocaleString() || 0} | 点赞: ${tweet.likeCount}${mediaInfo.length > 0 ? ' | ' + mediaInfo.join(' ') : ''}`);

    try {
      // Step 1: 翻译
      console.log('   🌐 翻译中...');
      const translatedText = await translateText(tweet.text);
      console.log('   ✅ 翻译完成');

      // Step 2: 生成文案
      console.log('   ✍️  生成文案中...');
      const generatedPost = await generatePost(translatedText, tweet.author.name);

      if (generatedPost) {
        console.log(`   标题: ${generatedPost.title}`);
      }

      // Step 3: 保存到本地（包括图片）
      await savePost(tweet, translatedText, generatedPost, i, viralTweets.length);

    } catch (error) {
      console.error(`   ❌ 处理失败: ${error.message}`);
      // 仍然保存基本信息
      const mediaSuffix = [];
      if (tweet.hasVideo) mediaSuffix.push('视频');
      if (tweet.hasImages) mediaSuffix.push('图片');
      const folderSuffix = mediaSuffix.length > 0 ? `-${mediaSuffix.join('+')}` : '';
      const tweetDir = path.join(outputDir, `${i + 1}-${tweet.id}${folderSuffix}`);
      await fs.mkdir(tweetDir, { recursive: true });
      await fs.writeFile(
        path.join(tweetDir, '01-original-tweet.txt'),
        `${tweet.text}\n\n处理失败: ${error.message}`
      );
    }

    console.log();

    // 延迟避免 API 限流
    if (i < viralTweets.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log(`🎉 全部完成！生成的文案保存在: ${outputDir}/`);
  console.log(`\n📁 文件夹命名格式: 序号-推文ID / 序号-推文ID-视频 / 序号-推文ID-图片 / 序号-推文ID-视频+图片`);
}

main().catch(console.error);

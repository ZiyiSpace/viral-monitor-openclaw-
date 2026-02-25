/**
 * Standalone script to publish viral tweets to Xiaohongshu
 * Usage: node publish-viral.js
 */

import fs from 'fs';

const MCP_BASE_URL = 'http://localhost:18060';
const GLM_API_KEY = process.env.GLM_API_KEY || '639a8ccb5e7a44a2afe4b11c2f315919.uukSQwgpJ5zQkpdY';

// Read today's data file
const dataFile = `./data/${new Date().toISOString().split('T')[0]}.json`;

/**
 * Check MCP login status
 */
async function checkStatus() {
  const response = await fetch(`${MCP_BASE_URL}/api/v1/login/status`);
  const data = await response.json();
  return data;
}

/**
 * Process tweet with GLM API - 直译 + 深度解读
 */
async function processWithGLM(tweetText, authorName) {
  // Step 1: Translate the tweet
  const translatedText = await translateText(tweetText);

  // Step 2: Generate the full post with insights
  const prompt = `你是一名小红书科技博主。基于以下翻译好的推文，生成一篇小红书文案。

【已翻译的推文】
${translatedText}

【推文作者】${authorName}

**格式要求**：
1. 第一段：直接使用上面的翻译内容（不要改动）
2. 第二段：转自 twitter @作者名
3. 后面：深度解读（设问、对比、排比、升华）
4. 结尾：标签（5-8个，包含#OpenClaw）

请返回JSON：
{
  "title": "带emoji的标题（30字以内）",
  "content": "[直接使用上面已翻译的文本]\\\\n\\\\n转自 twitter @${authorName}\\\\n\\\\n[深度解读：设问、对比、排比、升华]\\\\n\\\\n#OpenClaw #GitHub #开源 #程序员 #技术",
  "tags": ["#OpenClaw", "#GitHub", "#开源", "#程序员", "#技术"]
}

注意：
1. content第一段必须直接使用"已翻译的推文"，不要改动
2. 深度解读要结合OpenClaw的背景，挖掘技术深层含义
3. 标签要包含#OpenClaw及5-8个相关科技标签`;

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
      return {
        title: 'OpenClaw 热门内容',
        content: `${translatedText}\n\n转自：twitter @${authorName}`,
        tags: ['#OpenClaw', '#AI', '#科技']
      };
    }
  }

  throw new Error('无法解析 GLM 响应');
}

/**
 * Translate text to Chinese
 */
async function translateText(text) {
  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GLM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages: [{
        role: 'user',
        content: `准确翻译以下英文推文成中文，保持原文语气和口语化风格，只返回翻译结果：\n\n${text}`
      }],
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

/**
 * Publish to Xiaohongshu
 */
async function publishToXHS(post) {
  // Ensure images array has at least one image (MCP requirement)
  if (!post.images || post.images.length === 0) {
    post.images = ['https://picsum.photos/800/600'];
  }

  // Ensure tags is an array
  if (typeof post.tags === 'string') {
    post.tags = post.tags.split(' ').filter(t => t.trim().length > 0);
  }
  if (!post.tags || post.tags.length === 0) {
    post.tags = ['#OpenClaw', '#AI', '#科技'];
  }

  const response = await fetch(`${MCP_BASE_URL}/api/v1/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(post),
  });

  return await response.json();
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 开始发布病毒式推文到小红书...\n');

  // Check login status
  console.log('📱 检查小红书登录状态...');
  const status = await checkStatus();
  if (!status.success || !status.data.is_logged_in) {
    console.error('❌ 未登录小红书，请先登录');
    return;
  }
  console.log(`✅ 已登录: ${status.data.username}\n`);

  // Read data file
  if (!fs.existsSync(dataFile)) {
    console.error(`❌ 数据文件不存在: ${dataFile}`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const viralTweets = data.tweets.filter(t => t.currentTier === 'sustained_viral' || t.currentTier === 'viral');

  console.log(`📊 找到 ${viralTweets.length} 条病毒式推文\n`);

  for (let i = 0; i < viralTweets.length; i++) {
    const tweet = viralTweets[i];
    console.log(`[${i + 1}/${viralTweets.length}] 处理推文: ${tweet.id}`);
    console.log(`   作者: ${tweet.author.name} (@${tweet.author.username})`);
    console.log(`   浏览: ${tweet.viewCount.toLocaleString()} | 等级: ${tweet.currentTier}`);

    try {
      // Process with GLM
      console.log('   🤖 AI 处理中...');
      const processed = await processWithGLM(tweet.text, tweet.author.name);

      // Build post
      const post = {
        title: processed.title || 'OpenClaw 热门内容',
        content: processed.content + `\n\n🔗 原推链接: https://x.com/i/status/${tweet.id}`,
        images: [],
        tags: processed.tags || ['#OpenClaw', '#AI', '#科技'],
      };

      // Publish
      console.log('   📱 发布到小红书...');
      console.log(`   标题: ${post.title}`);
      const result = await publishToXHS(post);

      if (result.success) {
        console.log(`   ✅ 发布成功! (MCP未返回Post ID，请在小红书APP中查看)\n`);
      } else {
        console.log(`   ❌ 发布失败: ${result.error}\n`);
      }

    } catch (error) {
      console.error(`   ❌ 处理失败: ${error.message}\n`);
    }

    // Delay between posts
    if (i < viralTweets.length - 1) {
      await new Promise(r => setTimeout(r, 10000));
    }
  }

  console.log('🎉 发布完成!');
}

main().catch(console.error);
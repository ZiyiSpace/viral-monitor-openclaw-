/**
 * 并行处理版本 - 快速生成小红书文案
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLM_API_KEY = '639a8ccb5e7a44a2afe4b11c2f315919.uukSQwgpJ5zQkpdY';

const today = '2026-02-21';
const outputDir = `./output/posts/${today}`;

// 并发控制：最多同时处理3条
const CONCURRENT_LIMIT = 3;

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
第一段：钩子（80-120字，2-3行）
第二段：到底在吹什么（2-4行）
第三段：对普通人意味着什么（2-4行）
第四段：注意事项（1-2行）
第五段：收尾（1行）
全文允许≤6个emoji。

【标题要求】≤30字，可带1-2个emoji。
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
 * 并发控制器
 */
async function concurrent(items, fn, limit) {
  const results = [];
  const executing = [];

  for (const item of items) {
    const promise = fn(item).then(result => {
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });

    results.push(promise);
    executing.push(promise);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

/**
 * 处理单个推文
 */
async function processTweet(folderName) {
  const folderPath = path.join(outputDir, folderName);
  const tweetFile = path.join(folderPath, '01-original-tweet.txt');

  // 检查是否已处理
  try {
    await fs.access(path.join(folderPath, '02-translated.txt'));
    return { folder: folderName, status: 'skip' };
  } catch {}

  // 读取原始推文
  const content = await fs.readFile(tweetFile, 'utf8');
  const lines = content.split('\n');
  const text = lines[0];
  const authorLine = lines.find(l => l.startsWith('Author: '));
  const authorName = authorLine?.match(/Author: (.+?) \(@/)?.[1] || 'Unknown';

  try {
    // 并行：翻译 + 生成文案
    const [translatedText, generatedPost] = await Promise.all([
      translateText(text),
      generatePost(text, authorName) // 优化：直接用原文生成，避免等待翻译
    ]);

    // 保存翻译
    await fs.writeFile(path.join(folderPath, '02-translated.txt'), translatedText);

    // 保存文案
    if (generatedPost) {
      await fs.writeFile(
        path.join(folderPath, '03-xiaohongshu-post.json'),
        JSON.stringify(generatedPost, null, 2)
      );
      await fs.writeFile(
        path.join(folderPath, '04-xiaohongshu-post-readable.txt'),
        `标题：${generatedPost.title}\n\n${generatedPost.content}`
      );
    }

    return { folder: folderName, status: 'done', title: generatedPost?.title };

  } catch (error) {
    return { folder: folderName, status: 'error', error: error.message };
  }
}

async function main() {
  console.log(`🚀 并行处理模式 (最多${CONCURRENT_LIMIT}个并发)\n`);

  const folders = await fs.readdir(outputDir);
  const tweetFolders = folders.filter(f => f.match(/^\d+-\d+/)).sort();

  console.log(`📁 处理 ${tweetFolders.length} 个推文文件夹\n`);

  const startTime = Date.now();

  const results = await concurrent(tweetFolders, processTweet, CONCURRENT_LIMIT);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(50));
  console.log(`✅ 完成! 耗时: ${elapsed}秒\n`);

  for (const r of results) {
    if (r.status === 'done') {
      console.log(`✅ ${r.folder}`);
      console.log(`   ${r.title}`);
    } else if (r.status === 'skip') {
      console.log(`⏭️  ${r.folder} (已处理)`);
    } else {
      console.log(`❌ ${r.folder} - ${r.error}`);
    }
  }
}

main().catch(console.error);

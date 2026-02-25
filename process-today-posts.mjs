/**
 * 处理已保存的推文，生成小红书文案
 * 按之前的流程：翻译 → 生成文案 → 下载图片
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLM_API_KEY = process.env.GLM_API_KEY || '639a8ccb5e7a44a2afe4b11c2f315919.uukSQwgpJ5zQkpdY';

const today = '2026-02-21';
const outputDir = `./output/posts/${today}`;

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
async function downloadImages(imageUrls, tweetDir) {
  if (!imageUrls || imageUrls.length === 0) return 0;

  const imagesDir = path.join(tweetDir, '05-images');
  await fs.mkdir(imagesDir, { recursive: true });

  let downloaded = 0;

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
 * 从推文文件解析图片URL
 */
function extractImageUrls(content) {
  const lines = content.split('\n');
  const urls = [];
  let inImagesSection = false;

  for (const line of lines) {
    if (line.startsWith('Images:')) {
      inImagesSection = true;
      if (line === 'Images: None') return [];
      continue;
    }
    if (inImagesSection && line.trim()) {
      // 解析格式: "1. url" 或 "https://..."
      const urlMatch = line.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        urls.push(urlMatch[0]);
      }
    }
  }

  return urls;
}

/**
 * 处理单个推文文件夹
 */
async function processTweetFolder(folderName, index, total) {
  const folderPath = path.join(outputDir, folderName);
  const tweetFile = path.join(folderPath, '01-original-tweet.txt');

  // 检查文件是否存在
  try {
    await fs.access(tweetFile);
  } catch {
    console.log(`   ⚠️  [${index}/${total}] ${folderName} 文件不存在，跳过`);
    return;
  }

  // 检查是否已处理
  const hasTranslated = await fs.access(path.join(folderPath, '02-translated.txt')).then(() => true).catch(() => false);
  if (hasTranslated) {
    console.log(`   ⏭️  [${index}/${total}] ${folderName} 已处理，跳过`);
    return;
  }

  // 读取原始推文
  const content = await fs.readFile(tweetFile, 'utf8');
  const lines = content.split('\n');

  // 提取信息
  const text = lines[0];
  const authorLine = lines.find(l => l.startsWith('Author: '));
  const authorName = authorLine?.match(/Author: (.+?) \(@/)?.[1] || 'Unknown';

  console.log(`[${index}/${total}] 处理: ${folderName}`);
  console.log(`   作者: ${authorName}`);

  try {
    // Step 1: 翻译
    console.log('   🌐 翻译中...');
    const translatedText = await translateText(text);
    await fs.writeFile(path.join(folderPath, '02-translated.txt'), translatedText);
    console.log('   ✅ 翻译完成');

    // Step 2: 生成文案
    console.log('   ✍️  生成文案中...');
    const generatedPost = await generatePost(translatedText, authorName);

    if (generatedPost) {
      console.log(`   标题: ${generatedPost.title}`);
      await fs.writeFile(
        path.join(folderPath, '03-xiaohongshu-post.json'),
        JSON.stringify(generatedPost, null, 2)
      );
      await fs.writeFile(
        path.join(folderPath, '04-xiaohongshu-post-readable.txt'),
        `标题：${generatedPost.title}\n\n${generatedPost.content}`
      );
    }

    // Step 3: 下载图片
    const imageUrls = extractImageUrls(content);
    if (imageUrls.length > 0) {
      console.log(`   📸 发现 ${imageUrls.length} 张图片，开始下载...`);
      const downloaded = await downloadImages(imageUrls, folderPath);
      console.log(`   ✅ 图片下载完成: ${downloaded}/${imageUrls.length}`);
    }

    console.log(`   ✅ 处理完成\n`);

  } catch (error) {
    console.error(`   ❌ 处理失败: ${error.message}\n`);
  }

  // 延迟避免 API 限流
  await new Promise(r => setTimeout(r, 2000));
}

async function main() {
  console.log(`🚀 开始处理 ${today} 的推文...\n`);

  const folders = await fs.readdir(outputDir);
  const tweetFolders = folders.filter(f => f.match(/^\d+-\d+/)).sort();

  console.log(`📁 找到 ${tweetFolders.length} 个推文文件夹\n`);

  for (let i = 0; i < tweetFolders.length; i++) {
    await processTweetFolder(tweetFolders[i], i + 1, tweetFolders.length);
  }

  console.log(`🎉 全部完成！`);
}

main().catch(console.error);

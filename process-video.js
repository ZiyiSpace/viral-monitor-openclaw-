/**
 * 视频推文处理脚本 - 下载视频并生成剪映配音脚本
 * 用法: node process-video.js <tweet-folder>
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { TwitterClient } from '@cm-growth-hacking/twitter-client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GLM_API_KEY = process.env.GLM_API_KEY || '639a8ccb5e7a44a2afe4b11c2f315919.uukSQwgpJ5zQkpdY';

const twitter = new TwitterClient({
  authToken: process.env.TWITTER_AUTH_TOKEN || '83b9bcbc9d2b7c426da6b2139f43fc5ba42035fc',
  ct0: process.env.TWITTER_CT0 || '9f1b28ba70a936d4cc90b20617ebd28a058b79ba53fb4c1590d58e39cbd0425c2c6d95b613cb7879e58d43005e6928e9827baac13217e6e8a4b7ba21c8b8d00f1595f53d379213baee7303b68c9436ab'
});

/**
 * 从原始推文文件中提取推文ID
 */
async function parseTweetFile(folderPath) {
  const content = await fs.readFile(path.join(folderPath, '01-original-tweet.txt'), 'utf8');
  const lines = content.split('\n');

  const tweet = {
    text: lines[0],
    link: lines.find(l => l.startsWith('Link: '))?.replace('Link: ', ''),
    id: null
  };

  // 从链接中提取ID: https://x.com/i/status/123456789
  const idMatch = tweet.link?.match(/status\/(\d+)/);
  if (idMatch) {
    tweet.id = idMatch[1];
  }

  return tweet;
}

/**
 * 下载推文视频
 * Twitter视频URL通常在 media 数组中，需要重新获取推文详情
 */
async function downloadVideo(tweetId, outputDir) {
  console.log(`📹 正在获取推文 ${tweetId} 的视频信息...`);

  try {
    // 获取推文详情
    const tweetDetail = await twitter.getTweet(tweetId);

    if (!tweetDetail.success || !tweetDetail.tweet) {
      console.log('   ⚠️  无法获取推文详情');
      return null;
    }

    const tweet = tweetDetail.tweet;
    if (!tweet.media || tweet.media.length === 0) {
      console.log('   ⚠️  该推文没有媒体文件');
      return null;
    }

    // 查找视频
    const video = tweet.media.find(m => m.type === 'video' || m.type === 'animated_gif');

    if (!video) {
      console.log('   ⚠️  该推文没有视频');
      return null;
    }

    // 获取最高质量的视频URL
    const videoUrl = video.video_info?.variants
      ?.filter(v => v.content_type === 'video/mp4')
      ?.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))?.[0]?.url;

    if (!videoUrl) {
      console.log('   ⚠️  无法获取视频URL');
      return null;
    }

    console.log(`   📥 正在下载视频: ${videoUrl}`);

    const response = await fetch(videoUrl);
    if (!response.ok) {
      console.log(`   ❌ 下载失败: ${response.status}`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    const videoPath = path.join(outputDir, '05-video.mp4');
    await fs.writeFile(videoPath, Buffer.from(buffer));

    console.log(`   ✅ 视频已下载: ${videoPath}`);
    return videoPath;

  } catch (error) {
    console.error(`   ❌ 下载视频失败:`, error.message);
    return null;
  }
}

/**
 * 生成剪映配音脚本
 */
async function generateVoiceoverScript(translatedText, originalText) {
  const prompt = `你是一个专业的视频配音文案撰稿人。将以下翻译后的推文转化为适合剪映AI配音的口播脚本。

【翻译后的推文】
${translatedText}

【英文原文】
${originalText}

要求：
1. 口语化、自然流畅，适合AI语音朗读
2. 控制在150-200字之间（约60-80秒）
3. 分段清晰，每段之间有自然停顿
4. 保留技术名词（OpenClaw、3D打印等）
5. 开头有吸引钩子，结尾有行动呼吁
6. 用【停顿】标记自然停顿处

只输出脚本内容，不要其他解释。`;

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
 * 生成剪映操作指南
 */
function generateGuide(tweetFolder) {
  return `
========================================================
           🎬 剪映视频处理操作指南
========================================================

📁 视频位置: ${tweetFolder}/05-video.mp4
📝 配音脚本: ${tweetFolder}/06-voiceover-script.txt

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【方案一：AI配音 + 自动字幕（推荐）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ 导入视频
   • 打开剪映，点击"开始创作"
   • 选择视频文件导入

2️⃣ 静音原视频（英文音频）
   • 选中视频轨道
   • 右侧"音量"设为 0

3️⃣ 添加AI配音
   • 点击底部"文本" → "文本成片"
   • 粘贴配音脚本内容
   • 选择语音类型（推荐：知性女声-林薇 或 沉稳男声-陈哲）
   • 调整语速（推荐 1.0x）
   • 点击"生成"应用配音

4️⃣ 自动生成字幕
   • 点击"文本" → "智能字幕"
   • 选择"识别字幕" → "开始识别"
   • 系统会自动生成中文字幕

5️⃣ 调整导出
   • 预览视频，调整字幕位置
   • 导出设置：分辨率1080P，帧率30fps
   • 点击"导出"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【方案二：手动配音 + 智能字幕】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

如果你想自己配音：
1. 导入视频后静音原音轨
2. 准备配音脚本，按照【停顿】标记朗读
3. 点击"录音"功能录制你的配音
4. 使用"智能字幕"自动生成字幕

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【剪映会员功能提示】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ AI配音：多种音色可选，支持语速调节
✅ 4K导出：会员可导出4K/60fps高清视频
✅ 智能字幕：自动识别语音生成字幕
✅ 降噪：音频处理，去除背景噪音

========================================================
`;
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('用法: node process-video.js <推文文件夹路径>');
    console.log('示例: node process-video.js ./output/posts/2026-02-20/2-2023524486679851206-视频');
    process.exit(1);
  }

  const tweetFolder = args[0];
  console.log(`🎬 开始处理视频推文: ${tweetFolder}\n`);

  // 解析推文信息
  const tweet = await parseTweetFile(tweetFolder);
  console.log(`📝 推文ID: ${tweet.id}`);
  console.log(`📝 推文链接: ${tweet.link}\n`);

  // 下载视频
  const videoPath = await downloadVideo(tweet.id, tweetFolder);

  if (!videoPath) {
    console.log('❌ 无法下载视频，退出');
    process.exit(1);
  }

  // 读取翻译文本
  const translatedText = await fs.readFile(
    path.join(tweetFolder, '02-translated.txt'),
    'utf8'
  );

  // 生成配音脚本
  console.log('\n✍️  生成AI配音脚本...');
  const voiceoverScript = await generateVoiceoverScript(translatedText, tweet.text);

  // 保存配音脚本
  const scriptPath = path.join(tweetFolder, '06-voiceover-script.txt');
  await fs.writeFile(scriptPath, voiceoverScript);
  console.log(`✅ 配音脚本已保存: ${scriptPath}`);

  // 生成操作指南
  const guide = generateGuide(tweetFolder);
  const guidePath = path.join(tweetFolder, '07-剪映操作指南.txt');
  await fs.writeFile(guidePath, guide);

  console.log(`\n${guide}`);
  console.log(`\n✅ 完整指南已保存: ${guidePath}`);
}

main().catch(console.error);

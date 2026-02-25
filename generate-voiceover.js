/**
 * 生成剪映配音脚本和操作指南
 * 用法: node generate-voiceover.js <推文文件夹路径>
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLM_API_KEY = process.env.GLM_API_KEY || '639a8ccb5e7a44a2afe4b11c2f315919.uukSQwgpJ5zQkpdY';

/**
 * 生成剪映配音脚本
 */
async function generateVoiceoverScript(translatedText, originalText) {
  const prompt = `你是一个专业的视频配音文案撰稿人。将以下翻译后的推文转化为适合剪映AI配音的口播脚本。

【翻译后的推文】
${translatedText}

【英文原文参考】
${originalText}

要求：
1. 口语化、自然流畅，适合AI语音朗读
2. 控制在150-200字之间（约60-80秒）
3. 分段清晰，每段之间有自然停顿
4. 保留技术名词（OpenClaw、PicoClaw、3D打印等）
5. 开头有吸引钩子，结尾有行动呼吁
6. 用【停顿】标记自然停顿处
7. 不要过度情绪化，保持科技类内容的理性风格

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
function generateJianyingGuide(folderName, scriptPath) {
  return `
========================================================
           🎬 剪映视频处理操作指南
========================================================

📁 推文: ${folderName}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【完整流程：5步搞定中文化】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣  下载原视频
   • 打开推文链接
   • 右键视频 → "在浏览器中打开视频" 或使用下载工具
   • 保存为: ${folderName}/05-video.mp4

2️⃣  导入视频到剪映
   • 打开剪映，点击"开始创作"
   • 选择视频文件导入

3️⃣  静音原视频（英文音频）
   • 选中视频轨道
   • 右侧"音量"设为 0

4️⃣  添加AI配音
   • 点击底部"文本" → "文本成片"
   • 粘贴配音脚本（见下方）
   • 选择语音类型（推荐：知性女声-林薇 或 沉稳男声-陈哲）
   • 调整语速（推荐 1.0x）
   • 点击"生成"应用配音

5️⃣  导出视频
   • 预览视频，确认音画同步
   • 导出设置：分辨率1080P，帧率30fps
   • 点击"导出"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【可选：添加字幕】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• 点击"文本" → "智能字幕"
• 选择"识别字幕" → "开始识别"
• 系统会自动根据配音生成中文字幕

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【剪映会员功能】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ AI配音：多种音色可选，支持语速调节
✅ 4K导出：会员可导出4K/60fps高清视频
✅ 智能字幕：自动识别语音生成字幕
✅ 音频降噪：去除背景噪音

========================================================

📝 配音脚本已保存到: ${scriptPath}

复制下方内容到剪映"文本成片"：

`;
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('用法: node generate-voiceover.js <推文文件夹路径>');
    console.log('示例: node generate-voiceover.js ./output/posts/2026-02-20/2-2023524486679851206-视频');
    process.exit(1);
  }

  const tweetFolder = args[0];
  console.log(`🎬 生成配音脚本: ${tweetFolder}\n`);

  // 读取翻译文本和原文
  const translatedText = await fs.readFile(
    path.join(tweetFolder, '02-translated.txt'),
    'utf8'
  );

  const originalContent = await fs.readFile(
    path.join(tweetFolder, '01-original-tweet.txt'),
    'utf8'
  );

  // 提取原文（前几行是推文正文）
  const originalLines = originalContent.split('\n');
  const originalText = originalLines.slice(0, 6).join('\n').replace(/https:\/\/t\.co\/\S+/g, '').trim();

  // 生成配音脚本
  console.log('✍️  生成AI配音脚本...');
  const voiceoverScript = await generateVoiceoverScript(translatedText, originalText);

  // 保存配音脚本
  const scriptPath = path.join(tweetFolder, '06-voiceover-script.txt');
  await fs.writeFile(scriptPath, voiceoverScript);
  console.log(`✅ 配音脚本已保存: ${scriptPath}`);

  // 生成并保存操作指南
  const folderName = path.basename(tweetFolder);
  const guide = generateJianyingGuide(folderName, scriptPath);

  const guidePath = path.join(tweetFolder, '07-剪映操作指南.txt');
  await fs.writeFile(guidePath, guide + voiceoverScript);

  console.log(`✅ 操作指南已保存: ${guidePath}\n`);

  console.log('========================================================');
  console.log('📝 配音脚本内容：');
  console.log('========================================================\n');
  console.log(voiceoverScript);
  console.log('\n========================================================\n');
}

main().catch(console.error);

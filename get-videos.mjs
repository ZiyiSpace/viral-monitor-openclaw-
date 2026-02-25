/**
 * 获取指定作者的视频推文
 */

import { TwitterClient } from '@cm-growth-hacking/twitter-client';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const AUTH_TOKEN = "6af4542607f11b7f23b6edc1ed829a978db19fb9";
const CT0 = "b9bd73c0bf1ef6eb0de855313e6fb7ea9ced25ccc845ebe4b70cad34b5eb91aba18a11e02bd443e06d1aaaf0692de961ee7a58034c6855ee38dc56ac4741e1a7c73e5d90cc8aed52124b5ec11fa0dab5";

const client = new TwitterClient({
  authToken: AUTH_TOKEN,
  ct0: CT0
});

const today = '2026-02-21';
const outputDir = `./output/posts/${today}`;

async function downloadVideo(url, folderPath) {
  const response = await fetch(url);
  if (!response.ok) {
    console.log(`   ❌ 下载失败: ${response.status}`);
    return false;
  }

  const buffer = await response.arrayBuffer();
  const videoPath = path.join(folderPath, '00-original-video.mp4');
  await fs.writeFile(videoPath, Buffer.from(buffer));

  const sizeMB = (buffer.byteLength / 1024 / 1024).toFixed(1);
  console.log(`   ✅ 下载完成: ${sizeMB}MB`);
  return true;
}

async function main() {
  // 搜索指定作者的视频推文
  const authors = ["MatthewBerman", "jessegenet"];

  for (const author of authors) {
    console.log(`\n搜索 @${author} 的推文...`);

    const result = await client.search(`from:${author} OpenClaw`, 20, "Top");

    if (!result.success) {
      console.error(`Error: ${result.error}`);
      continue;
    }

    for (const tweet of result.tweets) {
      const hasVideo = tweet.media?.some(m => m.type === 'video');
      if (!hasVideo) continue;

      const video = tweet.media.find(m => m.type === 'video');
      const variants = video?.video_info?.variants || [];
      const mp4Variants = variants.filter(v => v.content_type === 'video/mp4');

      if (mp4Variants.length === 0) continue;

      mp4Variants.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      const videoUrl = mp4Variants[0].url;

      console.log(`\n找到视频: ${tweet.id}`);
      console.log(`作者: ${tweet.author?.name}`);
      console.log(`浏览: ${tweet.viewCount?.toLocaleString() || 0}`);
      console.log(`比特率: ${mp4Variants[0].bitrate || 0} bps`);

      // 确定文件夹
      let folderName;
      const folders = await fs.readdir(outputDir);
      for (const f of folders) {
        if (f.includes(tweet.id)) {
          folderName = f;
          break;
        }
      }

      if (!folderName) {
        console.log(`   ⚠️  没有找到对应的文件夹`);
        continue;
      }

      const folderPath = path.join(outputDir, folderName);

      // 检查是否已下载
      try {
        await fs.access(path.join(folderPath, '00-original-video.mp4'));
        console.log(`   ⏭️  视频已存在`);
        continue;
      } catch {}

      // 下载视频
      await downloadVideo(videoUrl, folderPath);
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n🎉 完成!');
}

main().catch(console.error);

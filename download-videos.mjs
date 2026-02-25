/**
 * 下载今天的视频推文
 */

import { TwitterClient } from '@cm-growth-hacking/twitter-client';
import fs from 'fs/promises';
import path from 'path';

const AUTH_TOKEN = "6af4542607f11b7f23b6edc1ed829a978db19fb9";
const CT0 = "b9bd73c0bf1ef6eb0de855313e6fb7ea9ced25ccc845ebe4b70cad34b5eb91aba18a11e02bd443e06d1aaaf0692de961ee7a58034c6855ee38dc56ac4741e1a7c73e5d90cc8aed52124b5ec11fa0dab5";

const client = new TwitterClient({
  authToken: AUTH_TOKEN,
  ct0: CT0
});

const today = '2026-02-21';
const outputDir = `./output/posts/${today}`;

// 视频推文ID
const videoTweets = [
  "2023843493765157235",  // Matthew Berman
  "2023524486679851206",  // Jesse Genet
];

/**
 * 获取视频URL并下载
 */
async function downloadVideo(tweetId, folderPath) {
  console.log(`📹 获取推文 ${tweetId} 的视频...`);

  try {
    const tweetDetail = await client.getTweet(tweetId);

    if (!tweetDetail.success || !tweetDetail.tweet) {
      console.log(`   ⚠️  无法获取推文详情`);
      return false;
    }

    const tweet = tweetDetail.tweet;
    if (!tweet.media || tweet.media.length === 0) {
      console.log(`   ⚠️  该推文没有媒体文件`);
      return false;
    }

    // 找视频
    const video = tweet.media.find(m => m.type === 'video');
    if (!video) {
      console.log(`   ⚠️  该推文没有视频`);
      return false;
    }

    // 获取最高质量的视频URL
    const variants = video.video_info?.variants || [];
    const mp4Variants = variants.filter(v => v.content_type === 'video/mp4');

    if (mp4Variants.length === 0) {
      console.log(`   ⚠️  没有找到 MP4 视频`);
      return false;
    }

    // 按比特率排序，选最高的
    mp4Variants.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    const videoUrl = mp4Variants[0].url;

    console.log(`   📥 下载视频 (${mp4Variants[0].bitrate || 0} bps)...`);

    const response = await fetch(videoUrl);
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

  } catch (error) {
    console.log(`   ❌ 错误: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log(`🚀 下载 ${today} 的视频推文\n`);

  for (let i = 0; i < videoTweets.length; i++) {
    const tweetId = videoTweets[i];
    const folderName = `${i + 1}-${tweetId}-视频`;
    const folderPath = path.join(outputDir, folderName);

    console.log(`[${i + 1}/${videoTweets.length}] ${folderName}`);

    // 检查是否已下载
    try {
      await fs.access(path.join(folderPath, '00-original-video.mp4'));
      console.log(`   ⏭️  视频已存在，跳过\n`);
      continue;
    } catch {}

    await downloadVideo(tweetId, folderPath);
    console.log();
  }

  console.log(`🎉 完成!`);
  console.log(`\n💡 下一步：使用 pyVideoTrans 翻译视频`);
  console.log(`   bash video-translation/batch-translate.sh "${outputDir}"`);
}

main().catch(console.error);

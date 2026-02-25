/**
 * 从搜索结果获取视频URL
 */

import { TwitterClient } from '@cm-growth-hacking/twitter-client';

const AUTH_TOKEN = "6af4542607f11b7f23b6edc1ed829a978db19fb9";
const CT0 = "b9bd73c0bf1ef6eb0de855313e6fb7ea9ced25ccc845ebe4b70cad34b5eb91aba18a11e02bd443e06d1aaaf0692de961ee7a58034c6855ee38dc56ac4741e1a7c73e5d90cc8aed52124b5ec11fa0dab5";

const client = new TwitterClient({
  authToken: AUTH_TOKEN,
  ct0: CT0
});

async function main() {
  // 搜索包含视频的推文
  const result = await client.search("OpenClaw filter:videos", 50, "Top");

  if (!result.success) {
    console.error(`Error: ${result.error}`);
    return;
  }

  console.log(`找到 ${result.tweets.length} 条推文\n`);

  for (const tweet of result.tweets) {
    const hasVideo = tweet.media?.some(m => m.type === 'video');
    if (hasVideo) {
      const video = tweet.media.find(m => m.type === 'video');
      const variants = video?.video_info?.variants || [];
      const mp4Variants = variants.filter(v => v.content_type === 'video/mp4');

      if (mp4Variants.length > 0) {
        mp4Variants.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        console.log(`\n${tweet.id}`);
        console.log(`作者: ${tweet.author?.name}`);
        console.log(`浏览: ${tweet.viewCount?.toLocaleString() || 0}`);
        console.log(`视频URL: ${mp4Variants[0].url}`);
        console.log(`比特率: ${mp4Variants[0].bitrate || 0} bps`);
      }
    }
  }
}

main().catch(console.error);

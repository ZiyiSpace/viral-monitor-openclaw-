/**
 * 单独获取缺失的推文
 */

import { TwitterClient } from '@cm-growth-hacking/twitter-client';
import fs from 'fs';
import path from 'path';

const AUTH_TOKEN = "6af4542607f11b7f23b6edc1ed829a978db19fb9";
const CT0 = "b9bd73c0bf1ef6eb0de855313e6fb7ea9ced25ccc845ebe4b70cad34b5eb91aba18a11e02bd443e06d1aaaf0692de961ee7a58034c6855ee38dc56ac4741e1a7c73e5d90cc8aed52124b5ec11fa0dab5";

const client = new TwitterClient({
  authToken: AUTH_TOKEN,
  ct0: CT0
});

const today = '2026-02-21';
const outputDir = `./output/posts/${today}`;

// 缺失的推文ID
const missingIds = [
  "2017185105039790140",  // 傅盛
  "2024079236437319851",  // NEARWEEK
  "2024962545396633727",  // Cocoanetics
];

function getMediaType(tweet) {
  if (tweet.media?.some(m => m.type === 'video')) return '视频';
  if (tweet.media?.some(m => m.type === 'photo')) return '图片';
  return '纯文本';
}

function formatTweetContent(tweet) {
  const hasVideo = tweet.media?.some(m => m.type === 'video');
  const hasImages = tweet.media?.some(m => m.type === 'photo');
  const images = hasImages
    ? tweet.media.filter(m => m.type === 'photo').map(m => m.media_url_https || m.url)
    : [];

  return `${tweet.text}

Author: ${tweet.author?.name} (@${tweet.author?.username})
Created: ${tweet.createdAt}
Link: ${tweet.url}

Views: ${tweet.viewCount?.toLocaleString() || 0}
Likes: ${tweet.likeCount || 0}
Retweets: ${tweet.retweetCount || 0}
Has Video: ${hasVideo}
Has Images: ${hasImages} (${images.length} images)
Images: ${images.length > 0 ? images.join('\n') : 'None'}`;
}

async function saveTweet(tweet, index) {
  const mediaType = getMediaType(tweet);
  const folderName = `${index}-${tweet.id}-${mediaType}`;
  const folderPath = path.join(outputDir, folderName);

  fs.mkdirSync(folderPath, { recursive: true });
  const content = formatTweetContent(tweet);
  fs.writeFileSync(path.join(folderPath, '01-original-tweet.txt'), content, 'utf8');

  console.log(`✅ 已保存: ${folderName}`);
}

async function main() {
  const existing = fs.readdirSync(outputDir);
  let startIndex = existing.length + 1;

  for (const tweetId of missingIds) {
    console.log(`获取推文: ${tweetId}`);
    const result = await client.getTweet(tweetId);

    if (result.success && result.tweet) {
      await saveTweet(result.tweet, startIndex++);
    } else {
      console.log(`❌ 获取失败: ${tweetId} - ${result.error}`);
    }
  }

  console.log('\n完成!');
}

main().catch(console.error);

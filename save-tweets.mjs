/**
 * 保存推文到 output 目录
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

// 新推文ID列表（从刚才的抓取结果中获取）
const newTweetIds = [
  "2023843493765157235",  // Matthew Berman 视频
  "2025095190709469619",  // Alpha_Ninja 图片
  "2025093557682663508",  // Nix 纯文本
  "2021443075416129867",  // 王子怡 图片
  "2024079793352835363",  // Affiseo 图片
  "2025080296614588744",  // Jeff 图片
  "2021483819921179036",  // 王子怡 图片
  "2025078753689567300",  // suganthan 图片
  "2021866927854170480",  // 王子怡 图片
  "2025095087236235564",  // Aryav 纯文本
  "2021445159159017838",  // 王子怡 图片
  "2022152930535821805",  // 王子怡 图片
  "2024892391874814391",  // SecurityScorecard 视频
  "2017185105039790140",  // 傅盛 图片
  "2024079236437319851",  // NEARWEEK 视频
  "2024962545396633727",  // Cocoanetics 视频
  "2024987174077432126",  // karpathy 纯文本
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

  // 创建文件夹
  fs.mkdirSync(folderPath, { recursive: true });

  // 保存推文内容
  const content = formatTweetContent(tweet);
  fs.writeFileSync(path.join(folderPath, '01-original-tweet.txt'), content, 'utf8');

  console.log(`✅ 已保存: ${folderName}`);
}

async function main() {
  console.log(`正在保存 ${newTweetIds.length} 条推文到 ${outputDir}...\n`);

  // 确保输出目录存在
  fs.mkdirSync(outputDir, { recursive: true });

  // 获取现有文件夹数量作为起始序号
  const existing = fs.readdirSync(outputDir);
  let startIndex = existing.length + 1;

  // 搜索推文并保存
  const result = await client.search("OpenClaw OR Moltbot OR Clawdbot OR steipete", 100, "Top");

  if (!result.success) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  const tweetsMap = new Map(result.tweets.map(t => [t.id, t]));

  for (const tweetId of newTweetIds) {
    const tweet = tweetsMap.get(tweetId);
    if (tweet) {
      await saveTweet(tweet, startIndex++);
    } else {
      console.log(`⚠️  未找到推文: ${tweetId}`);
    }
  }

  console.log(`\n完成! 共保存 ${newTweetIds.length} 条推文`);
}

main().catch(console.error);

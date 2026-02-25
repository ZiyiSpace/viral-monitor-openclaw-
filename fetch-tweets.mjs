#!/usr/bin/env node

import { TwitterClient } from './node_modules/@cm-growth-hacking/twitter-client/dist/client.js';

const AUTH_TOKEN = "6af4542607f11b7f23b6edc1ed829a978db19fb9";
const CT0 = "b9bd73c0bf1ef6eb0de855313e6fb7ea9ced25ccc845ebe4b70cad34b5eb91aba18a11e02bd443e06d1aaaf0692de961ee7a58034c6855ee38dc56ac4741e1a7c73e5d90cc8aed52124b5ec11fa0dab5";

const client = new TwitterClient({
  authToken: AUTH_TOKEN,
  ct0: CT0
});

// 昨天已抓取的推文ID
const YESTERDAY_IDS = new Set([
  "1932556535701647679", "2018967988905636138", "2020482116278988846",
  "2020754763508600943", "2020853471478743219", "2020891096360915319",
  "2020935810565263628", "2020951315103511021", "2022328067348373688",
  "2023439732328525890", "2023523383586287814", "2023524486679851206",
  "2024424137616207956", "2024450026362343463", "2024493690908033324",
  "2024510867845341574", "2024546941385003058", "2024547738780643540",
  "2024559115767324720", "2024607227093422099", "2024619739759153188",
  "2024631130411163854", "2024643414466158633", "2024647544350122485",
  "2024648938591310160", "2024650215761072492", "2024659455733117125",
  "2024675973212352817", "2024683621597020587", "2024685520446501240"
]);

async function saveTweet(tweet, index) {
  const outputDir = `/Users/wangziyi/Desktop/lujing/output/posts/2026-02-21`;
  const tweetId = tweet.id;

  // 确定推文类型
  let type = "图片";
  if (tweet.media && tweet.media.length > 0) {
    const hasVideo = tweet.media.some(m => m.type === "video" || m.type === "gif");
    type = hasVideo ? "视频" : "图片";
  } else {
    type = "纯文本";
  }

  const dirName = `${index + 1}-${tweetId}-${type}`;
  const fullPath = `${outputDir}/${dirName}`;

  // 创建目录
  await import('fs').then(fs => {
    fs.mkdirSync(fullPath, { recursive: true });
  });

  // 保存原始推文
  const originalContent = `${tweet.text}

Author: ${tweet.author.name} (@${tweet.author.username})
Created: ${tweet.createdAt}
Link: ${tweet.url}

Views: ${tweet.viewCount || 'N/A'}
Likes: ${tweet.likeCount}
Retweets: ${tweet.retweetCount}
Has Video: ${tweet.media && tweet.media.some(m => m.type === "video" || m.type === "gif")}
Has Images: ${tweet.media ? tweet.media.filter(m => m.type === "photo").length : false} (${tweet.media ? tweet.media.filter(m => m.type === "photo").length : 0} images)
`;

  await import('fs').then(fs => {
    fs.writeFileSync(`${fullPath}/01-original-tweet.txt`, originalContent);
  });

  // 如果有媒体，下载图片/视频
  if (tweet.media && tweet.media.length > 0) {
    for (let i = 0; i < tweet.media.length; i++) {
      const media = tweet.media[i];
      let mediaUrl = media.type === "video" || media.type === "gif"
        ? media.videoUrl
        : media.url;

      if (mediaUrl) {
        const extension = media.type === "video" || media.type === "gif" ? "mp4" : "jpg";
        const mediaPath = `${fullPath}/05-media.${extension}`;

        // 下载媒体
        try {
          const response = await fetch(mediaUrl);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          await import('fs').then(fs => {
            fs.writeFileSync(mediaPath, buffer);
          });
        } catch (e) {
          console.error(`Failed to download media: ${e.message}`);
        }
      }
    }
  }

  console.log(`Saved: ${dirName}`);
  return fullPath;
}

async function main() {
  console.log("Searching for OpenClaw tweets...");

  const result = await client.search("OpenClaw OR steipete OR Peter Steinberger", 50, "Latest");

  if (!result.success) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  console.log(`Found ${result.tweets.length} tweets\n`);

  // 过滤掉昨天的推文
  const newTweets = result.tweets.filter(tweet => !YESTERDAY_IDS.has(tweet.id));

  console.log(`New tweets (not from yesterday): ${newTweets.length}\n`);

  let savedCount = 0;
  for (const tweet of newTweets) {
    try {
      await saveTweet(tweet, savedCount);
      savedCount++;
    } catch (e) {
      console.error(`Failed to save tweet ${tweet.id}: ${e.message}`);
    }
  }

  console.log(`\nSaved ${savedCount} tweets to /Users/wangziyi/Desktop/lujing/output/posts/2026-02-21/`);
}

main().catch(console.error);

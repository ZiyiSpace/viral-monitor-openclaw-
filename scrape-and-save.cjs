#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

const AUTH_TOKEN = "6af4542607f11b7f23b6edc1ed829a978db19fb9";
const CT0 = "b9bd73c0bf1ef6eb0de855313e6fb7ea9ced25ccc845ebe4b70cad34b5eb91aba18a11e02bd443e06d1aaaf0692de961ee7a58034c6855ee38dc56ac4741e1a7c73e5d90cc8aed52124b5ec11fa0dab5";

async function downloadMedia(url, destPath) {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(destPath, buffer);
    return true;
  } catch (e) {
    console.error(`Failed to download ${url}: ${e.message}`);
    return false;
  }
}

async function getTweetDetails(tweetId) {
  const cmd = `export TWITTER_AUTH_TOKEN="${AUTH_TOKEN}" && export TWITTER_CT0="${CT0}" && node node_modules/@cm-growth-hacking/twitter-client/bin/twitter.js get ${tweetId}`;
  try {
    const output = execSync(cmd, { encoding: 'utf8', timeout: 30000 });

    // 解析输出
    const lines = output.split('\n');
    let tweet = {
      id: tweetId,
      text: '',
      author: { username: '', name: '' },
      createdAt: '',
      likeCount: 0,
      retweetCount: 0,
      viewCount: 0,
      media: []
    };

    let inText = false;
    for (const line of lines) {
      if (line.startsWith('@') && !inText) {
        // 解析作者行
        const match = line.match(/^@(\w+):\s*(.*)/);
        if (match) {
          tweet.author.username = match[1];
          tweet.text = match[2] || '';
          inText = true;
        }
      } else if (line.includes('Likes:') && line.includes('Retweets:')) {
        const likeMatch = line.match(/Likes:\s*(\d+)/);
        const rtMatch = line.match(/Retweets:\s*(\d+)/);
        if (likeMatch) tweet.likeCount = parseInt(likeMatch[1]);
        if (rtMatch) tweet.retweetCount = parseInt(rtMatch[1]);
        inText = false;
      } else if (line.includes('https://x.com/')) {
        const urlMatch = line.match(/(https:\/\/x\.com\/\S+)/);
        if (urlMatch) {
          tweet.url = urlMatch[1];
        }
      }
    }

    return tweet;
  } catch (e) {
    console.error(`Failed to get tweet ${tweetId}: ${e.message}`);
    return null;
  }
}

async function main() {
  const outputDir = '/Users/wangziyi/Desktop/lujing/output/posts/2026-02-21';
  fs.mkdirSync(outputDir, { recursive: true });

  // 搜索推文
  console.log('Searching for OpenClaw tweets...');
  const searchCmd = `export TWITTER_AUTH_TOKEN="${AUTH_TOKEN}" && export TWITTER_CT0="${CT0}" && node node_modules/@cm-growth-hacking/twitter-client/bin/twitter.js search "OpenClaw OR steipete OR Peter Steinberger" 50`;

  const searchOutput = execSync(searchCmd, { encoding: 'utf8', timeout: 60000 });

  // 从搜索结果中提取推文ID
  const tweetIds = [];
  const lines = searchOutput.split('\n');

  for (const line of lines) {
    // 尝试从URL中提取推文ID
    const urlMatch = line.match(/https:\/\/x\.com\/\w+\/status\/(\d+)/);
    if (urlMatch) {
      const tweetId = urlMatch[1];
      if (!YESTERDAY_IDS.has(tweetId) && !tweetIds.includes(tweetId)) {
        tweetIds.push(tweetId);
      }
    }
  }

  console.log(`Found ${tweetIds.length} new tweets`);

  let savedCount = 0;
  for (const tweetId of tweetIds.slice(0, 15)) {
    console.log(`Processing tweet ${tweetId}...`);

    const tweet = await getTweetDetails(tweetId);
    if (!tweet) continue;

    // 确定类型
    let type = "纯文本";

    // 创建目录
    const dirName = `${savedCount + 1}-${tweetId}-${type}`;
    const fullPath = path.join(outputDir, dirName);
    fs.mkdirSync(fullPath, { recursive: true });

    // 保存原始推文
    const originalContent = `${tweet.text}

Author: ${tweet.author.name} (@${tweet.author.username})
Created: ${tweet.createdAt}
Link: ${tweet.url || `https://x.com/${tweet.author.username}/status/${tweetId}`}

Views: ${tweet.viewCount || 'N/A'}
Likes: ${tweet.likeCount}
Retweets: ${tweet.retweetCount}
`;

    fs.writeFileSync(path.join(fullPath, '01-original-tweet.txt'), originalContent);

    console.log(`Saved: ${dirName}`);
    savedCount++;
  }

  console.log(`\nTotal saved: ${savedCount} tweets`);
}

main().catch(console.error);

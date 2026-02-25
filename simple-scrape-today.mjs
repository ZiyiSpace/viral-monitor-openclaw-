/**
 * 抓取今天的新推文（排除所有已抓取过的）
 */

import { TwitterClient } from '@cm-growth-hacking/twitter-client';
import fs from 'fs';

const AUTH_TOKEN = "6af4542607f11b7f23b6edc1ed829a978db19fb9";
const CT0 = "b9bd73c0bf1ef6eb0de855313e6fb7ea9ced25ccc845ebe4b70cad34b5eb91aba18a11e02bd443e06d1aaaf0692de961ee7a58034c6855ee38dc56ac4741e1a7c73e5d90cc8aed52124b5ec11fa0dab5";

const client = new TwitterClient({
  authToken: AUTH_TOKEN,
  ct0: CT0
});

// 收集所有之前抓取过的推文ID
function getAllScrapedIds() {
  const ids = new Set();

  // scrape-tweets.js 中的 YESTERDAY_IDS
  const yesterdayIds = [
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
  ];

  // 从 output 目录读取已抓取的推文ID
  try {
    const feb20 = fs.readdirSync('./output/posts/2026-02-20');
    for (const f of feb20) {
      const match = f.match(/^(\d+)-/);
      if (match) ids.add(match[1]);
    }
  } catch (e) {}

  try {
    const feb21 = fs.readdirSync('./output/posts/2026-02-21');
    for (const f of feb21) {
      const match = f.match(/^(\d+)-/);
      if (match) ids.add(match[1]);
    }
  } catch (e) {}

  yesterdayIds.forEach(id => ids.add(id));

  console.log(`已排除 ${ids.size} 条历史推文`);
  return ids;
}

async function main() {
  const scrapedIds = getAllScrapedIds();
  console.log("Searching for OpenClaw tweets...");

  // 使用 Top 获取热门推文
  const result = await client.search("OpenClaw OR Moltbot OR Clawdbot OR steipete", 100, "Top");

  if (!result.success) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  console.log(`\n找到 ${result.tweets.length} 条推文\n`);

  // 过滤：排除已抓取的，只保留新的
  const newTweets = result.tweets.filter(tweet => {
    return !scrapedIds.has(tweet.id);
  });

  console.log(`新推文: ${newTweets.length} 条\n`);
  console.log("=" .repeat(60));

  for (const tweet of newTweets) {
    const hasVideo = tweet.media?.some(m => m.type === 'video');
    const hasImages = tweet.media?.some(m => m.type === 'photo');
    const mediaTag = hasVideo ? '视频' : hasImages ? '图片' : '纯文本';

    console.log(`\n【${mediaTag}】${tweet.id}`);
    console.log(`作者: @${tweet.author?.username || 'unknown'} (${tweet.author?.name || 'Unknown'})`);
    console.log(`时间: ${tweet.createdAt}`);
    console.log(`内容: ${tweet.text.substring(0, 150)}${tweet.text.length > 150 ? '...' : ''}`);
    console.log(`数据: ${tweet.viewCount?.toLocaleString() || 0} 浏览 | ${tweet.likeCount || 0} 赞 | ${tweet.retweetCount || 0} 转`);
    console.log(`链接: ${tweet.url}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log(`\n共找到 ${newTweets.length} 条新推文`);
}

main().catch(console.error);

/**
 * 检查最近24小时内的推文
 */

import { TwitterClient } from '@cm-growth-hacking/twitter-client';

const AUTH_TOKEN = "6af4542607f11b7f23b6edc1ed829a978db19fb9";
const CT0 = "b9bd73c0bf1ef6eb0de855313e6fb7ea9ced25ccc845ebe4b70cad34b5eb91aba18a11e02bd443e06d1aaaf0692de961ee7a58034c6855ee38dc56ac4741e1a7c73e5d90cc8aed52124b5ec11fa0dab5";

const client = new TwitterClient({
  authToken: AUTH_TOKEN,
  ct0: CT0
});

function hoursAgo(createdAt) {
  return (new Date() - new Date(createdAt)) / (1000 * 60 * 60);
}

async function main() {
  const fs = await import('fs');
  const scrapedIds = new Set();
  try {
    const feb20 = fs.readdirSync('./output/posts/2026-02-20');
    const feb21 = fs.readdirSync('./output/posts/2026-02-21');
    for (const f of [...feb20, ...feb21]) {
      const match = f.match(/^(\d+)-/);
      if (match) scrapedIds.add(match[1]);
    }
  } catch (e) {}

  console.log('搜索最近24小时的推文...\n');

  const result = await client.search("OpenClaw OR Moltbot OR Clawdbot OR steipete", 100, "Latest");

  if (!result.success) {
    console.error(`Error: ${result.error}`);
    return;
  }

  // 筛选24小时内的推文
  const recentTweets = result.tweets
    .filter(t => !scrapedIds.has(t.id))
    .filter(t => hoursAgo(t.createdAt) <= 24)
    .sort((a, b) => hoursAgo(a.createdAt) - hoursAgo(b.createdAt));

  console.log(`最近24小时内找到 ${recentTweets.length} 条新推文\n`);
  console.log('='.repeat(70));

  for (const tweet of recentTweets) {
    const hours = hoursAgo(tweet.createdAt);
    const views = tweet.viewCount || 0;

    // 计算是否接近热门标准
    let potential = '';
    if (hours <= 0.5 && views >= 2000) potential = ' ⚠️ 接近Tier 1';
    else if (hours <= 1 && views >= 5000) potential = ' ⚠️ 接近Tier 1';
    else if (hours <= 3 && views >= 15000) potential = ' ⚠️ 接近Tier 1';
    else if (hours <= 6 && views >= 30000) potential = ' ⚠️ 接近Tier 1';

    console.log(`\n${tweet.id}`);
    console.log(`作者: ${tweet.author?.name} (@${tweet.author?.username})`);
    console.log(`时间: ${tweet.createdAt} (${Math.round(hours * 10) / 10}h前)`);
    console.log(`浏览: ${views.toLocaleString()}${potential}`);
    console.log(`内容: ${tweet.text.substring(0, 100)}...`);
  }

  console.log('\n' + '='.repeat(70));
}

main().catch(console.error);

/**
 * 全面搜索 OpenClaw 推文
 * 使用 Top 和 Latest 两种排序
 */

import { TwitterClient } from '@cm-growth-hacking/twitter-client';

const AUTH_TOKEN = "6af4542607f11b7f23b6edc1ed829a978db19fb9";
const CT0 = "b9bd73c0bf1ef6eb0de855313e6fb7ea9ced25ccc845ebe4b70cad34b5eb91aba18a11e02bd443e06d1aaaf0692de961ee7a58034c6855ee38dc56ac4741e1a7c73e5d90cc8aed52124b5ec11fa0dab5";

const client = new TwitterClient({
  authToken: AUTH_TOKEN,
  ct0: CT0
});

/**
 * 计算时间差（小时）
 */
function hoursAgo(createdAt) {
  const created = new Date(createdAt);
  const now = new Date();
  return (now - created) / (1000 * 60 * 60);
}

/**
 * 判断热门等级
 */
function checkViralStatus(createdAt, viewCount) {
  const hours = hoursAgo(createdAt);
  const days = hours / 24;

  if (hours <= 0.5 && viewCount >= 5000) return { tier: 1, reason: `≥5K in ${Math.round(hours*60)}min` };
  if (hours <= 1 && viewCount >= 10000) return { tier: 1, reason: `≥10K in ${Math.round(hours*60)}min` };
  if (hours <= 3 && viewCount >= 30000) return { tier: 1, reason: `≥30K in ${Math.round(hours*60)}min` };
  if (hours <= 6 && viewCount >= 60000) return { tier: 1, reason: `≥60K in ${Math.round(hours)}h` };
  if (hours <= 12 && viewCount >= 100000) return { tier: 2, reason: `≥100K in ${Math.round(hours)}h` };
  if (hours <= 24 && viewCount >= 200000) return { tier: 2, reason: `≥200K in ${Math.round(hours)}h` };
  if (days <= 3 && viewCount >= 350000) return { tier: 3, reason: `≥350K in ${Math.round(days*10)/10}d` };
  if (days <= 7 && viewCount >= 500000) return { tier: 3, reason: `≥500K in ${Math.round(days*10)/10}d` };

  return null;
}

async function main() {
  // 已抓取的ID
  const scrapedIds = new Set();
  try {
    const fs = await import('fs');
    const feb20 = fs.readdirSync('./output/posts/2026-02-20');
    const feb21 = fs.readdirSync('./output/posts/2026-02-21');
    for (const f of [...feb20, ...feb21]) {
      const match = f.match(/^(\d+)-/);
      if (match) scrapedIds.add(match[1]);
    }
  } catch (e) {}

  console.log(`已排除 ${scrapedIds.size} 条历史推文\n`);

  const keywords = [
    "OpenClaw",
    "Moltbot",
    "Clawdbot",
    "open claw",
    "#openclaw"
  ];

  const allTweets = new Map(); // id -> tweet

  // 搜索 Top
  console.log('🔍 搜索 Top 排序...');
  for (const kw of keywords) {
    const result = await client.search(kw, 100, "Top");
    if (result.success && result.tweets) {
      for (const t of result.tweets) {
        if (!scrapedIds.has(t.id)) {
          allTweets.set(t.id, t);
        }
      }
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  // 搜索 Latest
  console.log('🔍 搜索 Latest 排序...');
  for (const kw of keywords) {
    const result = await client.search(kw, 100, "Latest");
    if (result.success && result.tweets) {
      for (const t of result.tweets) {
        if (!scrapedIds.has(t.id)) {
          allTweets.set(t.id, t);
        }
      }
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n找到 ${allTweets.size} 条新推文\n`);
  console.log('='.repeat(70));

  // 分析每条推文
  const viralTweets = [];
  const notViral = [];

  for (const [id, tweet] of allTweets) {
    const viral = checkViralStatus(tweet.createdAt, tweet.viewCount || 0);
    if (viral) {
      viralTweets.push({ tweet, viral });
    } else {
      notViral.push({ tweet, hours: hoursAgo(tweet.createdAt), views: tweet.viewCount || 0 });
    }
  }

  // 排序
  viralTweets.sort((a, b) => b.viral.tier - a.viral.tier || (b.tweet.viewCount || 0) - (a.tweet.viewCount || 0));
  notViral.sort((a, b) => b.views - a.views);

  console.log(`\n🔥 热门推文 (${viralTweets.length}条):\n`);

  for (const { tweet, viral } of viralTweets) {
    const tierIcon = viral.tier === 3 ? '🏆' : viral.tier === 2 ? '🔥' : '⚡';
    console.log(`${tierIcon} ${tweet.id}`);
    console.log(`   ${tweet.author?.name} (@${tweet.author?.username})`);
    console.log(`   ${tweet.createdAt} (${Math.round(hoursAgo(tweet.createdAt) * 10) / 10}h前)`);
    console.log(`   ${tweet.viewCount?.toLocaleString() || 0} 浏览 | ${tweet.reason}`);
    console.log('');
  }

  console.log(`\n📊 非热门但浏览量高的 (${notViral.slice(0, 10).length}条):\n`);

  for (const { tweet, hours, views } of notViral.slice(0, 10)) {
    console.log(`   ${tweet.id}`);
    console.log(`   ${tweet.author?.name} | ${views.toLocaleString()} 浏览 | ${Math.round(hours * 10) / 10}h前`);
    console.log('');
  }

  console.log('='.repeat(70));
  console.log(`\n总结: ${viralTweets.length} 条热门 / ${allTweets.size} 总数`);
}

main().catch(console.error);

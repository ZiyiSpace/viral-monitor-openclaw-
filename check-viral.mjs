/**
 * 按正确的热门标准检查推文
 */

import fs from 'fs/promises';
import path from 'path';

const outputDir = './output/posts';

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

  // Tier 1 — Early Momentum
  if (hours <= 0.5 && viewCount >= 5000) return { tier: 1, label: 'viral_candidate', reason: `≥5K浏览 in ${Math.round(hours*60)}分钟` };
  if (hours <= 1 && viewCount >= 10000) return { tier: 1, label: 'viral_candidate', reason: `≥10K浏览 in ${Math.round(hours*60)}分钟` };
  if (hours <= 3 && viewCount >= 30000) return { tier: 1, label: 'viral_candidate', reason: `≥30K浏览 in ${Math.round(hours*60)}分钟` };
  if (hours <= 6 && viewCount >= 60000) return { tier: 1, label: 'viral_candidate', reason: `≥60K浏览 in ${Math.round(hours)}小时` };

  // Tier 2 — Confirmed Viral
  if (hours <= 12 && viewCount >= 100000) return { tier: 2, label: 'viral', reason: `≥100K浏览 in ${Math.round(hours)}小时` };
  if (hours <= 24 && viewCount >= 200000) return { tier: 2, label: 'viral', reason: `≥200K浏览 in ${Math.round(hours)}小时` };

  // Tier 3 — Sustained Viral
  if (days <= 3 && viewCount >= 350000) return { tier: 3, label: 'sustained_viral', reason: `≥350K浏览 in ${Math.round(days*10)/10}天` };
  if (days <= 7 && viewCount >= 500000) return { tier: 3, label: 'sustained_viral', reason: `≥500K浏览 in ${Math.round(days*10)/10}天` };

  return { tier: 0, label: 'not_viral', reason: `未达到热门标准 (${Math.round(hours)}小时, ${viewCount.toLocaleString()}浏览)` };
}

/**
 * 解析推文文件
 */
function parseTweetFile(content) {
  const lines = content.split('\n');
  const text = lines[0];

  const authorLine = lines.find(l => l.startsWith('Author: '));
  const createdLine = lines.find(l => l.startsWith('Created: '));
  const viewsLine = lines.find(l => l.startsWith('Views: '));

  const author = authorLine?.match(/Author: (.+?) \(@/)?.[1] || 'Unknown';
  const createdAt = createdLine?.replace('Created: ', '') || '';
  const views = viewsLine?.match(/Views: ([\d,]+)/)?.[1]?.replace(/,/g, '') || '0';

  return { text, author, createdAt, viewCount: parseInt(views) };
}

async function main() {
  const dates = ['2026-02-20', '2026-02-21'];
  const results = [];

  for (const date of dates) {
    const dir = path.join(outputDir, date);
    try {
      const folders = await fs.readdir(dir);
      const tweetFolders = folders.filter(f => f.match(/^\d+-\d+/));

      for (const folder of tweetFolders) {
        try {
          const filePath = path.join(dir, folder, '01-original-tweet.txt');
          const content = await fs.readFile(filePath, 'utf8');
          const tweet = parseTweetFile(content);

          const viral = checkViralStatus(tweet.createdAt, tweet.viewCount);

          results.push({
            date,
            folder,
            author: tweet.author,
            createdAt: tweet.createdAt,
            viewCount: tweet.viewCount,
            hoursAgo: Math.round(hoursAgo(tweet.createdAt) * 10) / 10,
            ...viral
          });
        } catch (e) {
          // skip errors
        }
      }
    } catch (e) {
      // skip missing dates
    }
  }

  // 按热门等级排序，然后按浏览量排序
  results.sort((a, b) => b.tier - a.tier || b.viewCount - a.viewCount);

  console.log('📊 热门推文分析\n');
  console.log('='.repeat(80));

  const viralOnly = results.filter(r => r.tier > 0);
  const notViral = results.filter(r => r.tier === 0);

  // 热门推文
  console.log(`\n🔥 真正的热门推文 (${viralOnly.length}条):\n`);

  for (const r of viralOnly) {
    const tierIcon = r.tier === 3 ? '🏆' : r.tier === 2 ? '🔥' : '⚡';
    console.log(`${tierIcon} [${r.date}] ${r.folder}`);
    console.log(`   作者: ${r.author}`);
    console.log(`   发布: ${r.createdAt} (${r.hoursAgo}小时前)`);
    console.log(`   浏览: ${r.viewCount.toLocaleString()}`);
    console.log(`   等级: Tier ${r.tier} - ${r.label}`);
    console.log(`   原因: ${r.reason}`);
    console.log('');
  }

  // 非热门推文
  console.log(`\n❌ 非热门推文 (${notViral.length}条):\n`);

  for (const r of notViral.slice(0, 10)) {
    console.log(`   [${r.date}] ${r.folder}`);
    console.log(`   ${r.author} | ${r.createdAt} | ${r.viewCount.toLocaleString()}浏览 | ${r.hoursAgo}小时前`);
    console.log(`   原因: ${r.reason}`);
    console.log('');
  }

  if (notViral.length > 10) {
    console.log(`   ... 还有 ${notViral.length - 10} 条\n`);
  }

  console.log('='.repeat(80));
  console.log(`\n总结: ${viralOnly.length} 条热门 / ${results.length} 总数`);
}

main().catch(console.error);

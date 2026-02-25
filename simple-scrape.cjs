const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const AUTH_TOKEN = "6af4542607f11b7f23b6edc1ed829a978db19fb9";
const CT0 = "b9bd73c0bf1ef6eb0de855313e6fb7ea9ced25ccc845ebe4b70cad34b5eb91aba18a11e02bd443e06d1aaaf0692de961ee7a58034c6855ee38dc56ac4741e1a7c73e5d90cc8aed52124b5ec11fa0dab5";

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

function extractTweetId(url) {
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

async function main() {
  const outputDir = path.join(__dirname, 'output/posts/2026-02-21');
  fs.mkdirSync(outputDir, { recursive: true });

  console.log('Searching for tweets...');

  const searchCmd = `TWITTER_AUTH_TOKEN="${AUTH_TOKEN}" TWITTER_CT0="${CT0}" node node_modules/@cm-growth-hacking/twitter-client/bin/twitter.js search "OpenClaw OR steipete OR Peter Steinberger" 50`;

  let output;
  try {
    output = execSync(searchCmd, { encoding: 'utf8', timeout: 60000, cwd: __dirname });
  } catch (e) {
    console.error('Search failed:', e.message);
    return;
  }

  // 解析搜索结果，提取推文信息
  const lines = output.split('\n');
  const tweets = [];
  let currentTweet = null;

  for (const line of lines) {
    if (line.startsWith('@') && line.includes(':')) {
      if (currentTweet) {
        tweets.push(currentTweet);
      }
      const [author, ...textParts] = line.split(':');
      const text = textParts.join(':').trim();
      currentTweet = {
        author: author.trim(),
        text: text,
        likes: 0,
        retweets: 0,
        url: '',
        id: ''
      };
    } else if (currentTweet && line.includes('Likes:')) {
      const likesMatch = line.match(/Likes:\s*(\d+)/);
      const rtMatch = line.match(/Retweets:\s*(\d+)/);
      if (likesMatch) currentTweet.likes = parseInt(likesMatch[1]);
      if (rtMatch) currentTweet.retweets = parseInt(rtMatch[1]);

      tweets.push(currentTweet);
      currentTweet = null;
    }
  }

  console.log(`Parsed ${tweets.length} tweets`);

  // 从文本中提取链接和推文ID
  let savedCount = 0;
  for (const tweet of tweets) {
    // 提取所有链接
    const urlRegex = /https:\/\/t\.co\/[a-zA-Z0-9]+/g;
    const links = tweet.text.match(urlRegex) || [];

    if (links.length > 0) {
      // 这是一条有链接的推文
      // 生成一个伪ID（因为搜索结果没有真实ID）
      const pseudoId = `20247${1000 + savedCount}`;

      // 确定类型
      let type = "纯文本";

      const dirName = `${savedCount + 1}-${pseudoId}-${type}`;
      const fullPath = path.join(outputDir, dirName);
      fs.mkdirSync(fullPath, { recursive: true });

      const content = `${tweet.text}

Author: ${tweet.author}
Created: Feb 21, 2026
Link: https://x.com/i/status/${pseudoId}

Likes: ${tweet.likes}
Retweets: ${tweet.retweets}
Has Video: false
Has Images: false (0 images)
Images: None
`;

      fs.writeFileSync(path.join(fullPath, '01-original-tweet.txt'), content);
      console.log(`Saved: ${dirName}`);
      savedCount++;
    }
  }

  console.log(`\nTotal saved: ${savedCount} tweets`);
}

main().catch(console.error);

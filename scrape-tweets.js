import { TwitterClient } from './node_modules/@cm-growth-hacking/twitter-client/bin/twitter.js';

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

async function main() {
  console.log("Searching for OpenClaw tweets...");

  const result = await client.search("OpenClaw OR Moltbot OR Clawdbot OR steipete", 100, "Latest");

  if (!result.success) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  console.log(`\nFound ${result.tweets.length} tweets\n`);

  // 过滤掉昨天的推文，只保留今天的
  const today = new Date('2026-02-21T00:00:00Z');
  const todayTweets = result.tweets.filter(tweet => {
    const tweetDate = new Date(tweet.createdAt);
    const tweetId = tweet.id;
    // 排除昨天已抓取的推文
    if (YESTERDAY_IDS.has(tweetId)) {
      return false;
    }
    // 只保留2月20日及以后的推文（实际上是昨天的和今天的）
    return tweetDate >= new Date('2026-02-20T00:00:00Z');
  });

  // 进一步过滤：排除已经抓取过的，只保留新的
  const newTweets = todayTweets.filter(tweet => !YESTERDAY_IDS.has(tweet.id));

  console.log(`Today's new tweets: ${newTweets.length}\n`);

  for (const tweet of newTweets.slice(0, 20)) {
    console.log(`--- ${tweet.id} ---`);
    console.log(`Author: @${tweet.author.username} (${tweet.author.name})`);
    console.log(`Created: ${tweet.createdAt}`);
    console.log(`Text: ${tweet.text.substring(0, 200)}...`);
    console.log(`URL: ${tweet.url}`);
    console.log(`Likes: ${tweet.likeCount} Retweets: ${tweet.retweetCount}`);
    if (tweet.media && tweet.media.length > 0) {
      console.log(`Media: ${tweet.media.map(m => m.type).join(', ')}`);
    }
    console.log('');
  }
}

main().catch(console.error);

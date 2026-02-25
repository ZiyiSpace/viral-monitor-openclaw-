// ========== 推文数据类型 ==========
export interface Tweet {
  id: string;
  text: string;
  author: TwitterUser;
  createdAt: string;
  viewCount: number;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  bookmarkCount: number;
  media?: MediaItem[];
  isQuote?: boolean;
  isRetweet?: boolean;
  inReplyTo?: string;
}

export interface TwitterUser {
  id: string;
  username: string;
  name: string;
  description?: string;
  followersCount?: number;
  followingCount?: number;
  isBlueVerified?: boolean;
  profileImageUrl?: string;
}

export interface MediaItem {
  type: string;
  url: string;
  thumbnailUrl?: string;
}

// ========== 检测结果类型 ==========
export type ViralTier = 'viral_candidate' | 'viral' | 'sustained_viral' | null;

export interface ViralDetectionResult {
  tweetId: string;
  tier: ViralTier;
  reason: string;
  age: number;  // 帖子年龄（小时）
  views: number;
}

// ========== 存储数据类型 ==========
export interface Snapshot {
  timestamp: string;
  viewCount: number;
  likeCount: number;
  retweetCount: number;
  tier: ViralTier;
}

export interface TweetRecord {
  id: string;
  text: string;
  author: {
    username: string;
    name: string;
    followersCount?: number;
  };
  createdAt: string;
  detectedAt: string;          // 首次检测时间
  lastUpdated: string;         // 最后更新时间
  currentTier: ViralTier;      // 当前等级
  viewCount: number;
  likeCount: number;
  retweetCount: number;
  history: Snapshot[];         // 历史快照
}

export interface DailyData {
  date: string;
  keywords: string[];
  totalTweets: number;
  viralCandidates: number;     // Tier 1
  viral: number;               // Tier 2
  sustainedViral: number;      // Tier 3
  tweets: TweetRecord[];
  updatedAt: string;
}

// ========== 爆款阈值配置 ==========
export interface ViralThreshold {
  hours: number;
  views: number;
  tier: ViralTier;
}

export const DEFAULT_THRESHOLDS: ViralThreshold[] = [
  // Tier 1: Early Momentum
  { hours: 0.5, views: 5000, tier: 'viral_candidate' },
  { hours: 1, views: 10000, tier: 'viral_candidate' },
  { hours: 3, views: 30000, tier: 'viral_candidate' },
  { hours: 6, views: 60000, tier: 'viral_candidate' },
  // Tier 2: Confirmed Viral
  { hours: 12, views: 100000, tier: 'viral' },
  { hours: 24, views: 200000, tier: 'viral' },
  // Tier 3: Sustained Viral
  { hours: 72, views: 350000, tier: 'sustained_viral' },
  { hours: 168, views: 500000, tier: 'sustained_viral' },
];

// ========== 监控配置 ==========
export interface MonitorConfig {
  keywords: string[];
  searchConfig: {
    count: number;
    maxPages: number;
  };
  thresholds: ViralThreshold[];
  dataDir: string;
}

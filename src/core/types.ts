// ========== 平台类型定义 ==========
export type SourcePlatform = 'twitter' | 'reddit' | 'discord' | 'telegram';
export type TargetPlatform = 'xiaohongshu' | 'douyin' | 'kuaishou';

export const SUPPORTED_SOURCE_PLATFORMS: SourcePlatform[] = ['twitter', 'reddit', 'discord', 'telegram'];
export const SUPPORTED_TARGET_PLATFORMS: TargetPlatform[] = ['xiaohongshu', 'douyin', 'kuaishou'];

// ========== 爆款等级类型 ==========
export type ViralTier = 'viral_candidate' | 'viral' | 'sustained_viral' | null;

// ========== 统一内容类型 ==========
export interface RawContent {
  id: string;
  platform: SourcePlatform;
  text: string;
  author: {
    username: string;
    name?: string;
    followersCount?: number;
  };
  url: string;
  createdAt: string;  // ISO 8601
  fetchedAt: string;  // ISO 8601
  isViral: boolean;
  metrics: ContentMetrics;
  media?: MediaItem[];
}

export interface ContentMetrics {
  views?: number;
  likes?: number;
  upvotes?: number;
  comments?: number;
  reactions?: number;
  shares?: number;
  retweets?: number;
}

export interface MediaItem {
  type: 'image' | 'video' | 'gif';
  url: string;
  localPath?: string;
  thumbnailUrl?: string;
}

// ========== 处理后内容类型 ==========
export interface ProcessedContent {
  sourceId: string;
  sourcePlatform: SourcePlatform;
  processedAt: string;
  targetPlatform: TargetPlatform;
  title: string;
  content: string;
  media: string[];
  hashtags: string[];
}

// ========== 平台适配器接口 ==========
export interface PlatformAdapter {
  readonly name: string;
  fetchContent(query: string, options?: FetchOptions): Promise<RawContent[]>;
  isViral(content: RawContent): boolean;
  downloadMedia(content: RawContent): Promise<string[]>;
}

export interface FetchOptions {
  maxResults?: number;
  subreddits?: string[];
  channels?: string[];
}

// ========== 爆款检测结果 ==========
export interface ViralDetectionResult {
  contentId: string;
  platform: SourcePlatform;
  isViral: boolean;
  tier?: ViralTier;
  reason?: string;
}

// ========== 调度结果 ==========
export interface SchedulerResult {
  timestamp: string;
  keywords: string[];
  platforms: {
    [key: string]: PlatformResult;
  };
  summary: {
    totalContents: number;
    viralCount: number;
    successCount: number;
    failureCount: number;
  };
}

export interface PlatformResult {
  status: 'success' | 'failure' | 'partial';
  contentsFetched: number;
  viralCount: number;
  error?: string;
}

// ========== 存储接口 ==========
export interface ContentRepository {
  saveRaw(content: RawContent): Promise<string>;
  saveProcessed(content: ProcessedContent): Promise<string>;
  listRaw(date: string, platform?: string): Promise<RawContent[]>;
  listProcessed(date: string): Promise<ProcessedContent[]>;
}

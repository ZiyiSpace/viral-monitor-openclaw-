# 多平台爆款监控系统设计文档

**日期**: 2026-02-25
**作者**: AI Assistant
**状态**: 设计阶段

---

## 概述

将现有的 Twitter 爆款监控器扩展为多平台内容聚合系统，支持 Discord、Reddit、Telegram 等平台，以 skill 方式调用，自动检测各平台关于 openclaw 的爆款内容并存储到本地供手动发布到国内平台（抖音、小红书、快手）。

---

## 整体架构

系统采用分层架构，用户通过调用 skill 触发全平台检测。

```
用户: @monitor-viral 检测今天的 openclaw 相关爆款
         │
         ▼
┌─────────────────────────────────────────────────────┐
│              Skill 入口层                            │
│          (skills/monitor-viral/)                    │
└─────────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────────┐
│              核心调度器                              │
│     自动并行调用所有平台适配器                        │
└─────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼───────┐ ┌──────▼──────┐ ┌──────▼──────┐
│ Twitter       │ │  Reddit     │ │ Discord     │
│ Adapter       │ │  Adapter    │ │ Adapter     │
└───────────────┘ └─────────────┘ └─────────────┘
```

---

## 核心组件

### Platform Adapter 接口

所有平台适配器实现统一接口：

```typescript
interface PlatformAdapter {
  name: string                                    // 平台名称
  fetchContent(query: string): Promise<RawContent[]>  // 抓取内容
  isViral(content: RawContent): boolean          // 判断是否爆款
  downloadMedia(content: RawContent): Promise<string> // 下载媒体
}

interface RawContent {
  id: string
  text: string
  author: { username: string; name?: string }
  url: string
  createdAt: Date
  metrics: {
    views?: number
    likes?: number
    upvotes?: number
    comments?: number
    reactions?: number
    shares?: number
  }
  media?: MediaItem[]
}

interface MediaItem {
  type: 'image' | 'video' | 'gif'
  url: string
  localPath?: string
}
```

### Viral Detector 策略

各平台爆款检测标准：

| 平台 | 检测指标 | 阈值 |
|------|----------|------|
| Twitter | 现有三级检测 | view count + 时间 |
| Reddit | upvote + comments | upvote > 100 且 comments > 20 |
| Discord | reactions + active users | reactions > 50 且 active users > 10 |
| Telegram | views + reactions | views > 5000 且 reactions > 30 |

### Content Repository

统一的存储接口：

```typescript
interface ContentRepository {
  saveRaw(content: RawContent, platform: string): Promise<string>
  saveProcessed(content: ProcessedContent): Promise<string>
  listRaw(date: string, platform?: string): Promise<RawContent[]>
  listProcessed(date: string): Promise<ProcessedContent[]>
}
```

### AI Processor（可选）

内容改写/翻译层：
- 输入：原始内容
- 输出：适配国内平台风格的内容（中文、优化标题、调整语气）

---

## 数据流

```
1. 用户调用 @monitor-viral
         │
         ▼
2. Skill 解析参数（关键词、时间范围等）
         │
         ▼
3. 并行调用所有 Platform Adapters
   ├── Twitter → 抓取推文 → 爆款检测
   ├── Reddit → 抓取帖子 → 爆款检测
   ├── Discord → 抓取消息 → 爆款检测
   └── Telegram → 抓取消息 → 爆款检测
         │
         ▼
4. 聚合检测结果
         │
         ▼
5. 存储到本地（按日期 + 平台分类）
   ├── data/raw/2026-02-25/
   │   ├── twitter/
   │   ├── reddit/
   │   ├── discord/
   │   └── telegram/
   └── data/processed/2026-02-25/
       └── (AI处理后的内容)
         │
         ▼
6. 返回汇总报告给用户
```

---

## 文件结构

```
lujing/
├── skills/
│   └── monitor-viral/              # 新增 skill
│       └── skill.md                # skill 定义
├── src/
│   ├── core/
│   │   ├── scheduler.ts            # 核心调度器
│   │   └── types.ts                # 统一类型定义
│   ├── platforms/
│   │   ├── base.ts                 # PlatformAdapter 基类
│   │   ├── twitter/
│   │   │   └── adapter.ts          # 现有，重构为适配器
│   │   ├── reddit/
│   │   │   ├── adapter.ts          # Reddit 适配器
│   │   │   └── viral-detector.ts   # Reddit 爆款检测
│   │   ├── discord/
│   │   │   ├── adapter.ts
│   │   │   └── viral-detector.ts
│   │   └── telegram/
│   │       ├── adapter.ts
│   │       └── viral-detector.ts
│   ├── storage/
│   │   └── repository.ts           # 统一存储接口
│   └── ai/
│       └── processor.ts            # AI 内容处理（可选）
├── data/
│   ├── raw/                        # 原始内容
│   └── processed/                  # AI 处理后
├── config/
│   ├── platforms.json              # 平台配置（关键词、阈值等）
│   └── .env                        # 各平台认证信息
└── logs/                           # 日志目录
```

---

## 错误处理

### 平台级容错
- 某个平台抓取失败不影响其他平台
- 记录失败日志，继续执行其他平台
- 返回结果时标注各平台状态（成功/失败/部分成功）

### 重试机制
- 网络错误：自动重试 3 次，指数退避
- API 限流：等待后重试
- 认证失败：立即停止并提示用户

### 数据验证
- 抓取的内容必须包含必要字段（id、text、author等）
- 媒体下载失败时记录警告，不影响内容保存
- 爆款检测失败时默认保存，标记为"未检测"

### 日志记录
```
logs/
├── 2026-02-25-monitor.log      # 监控日志
├── 2026-02-25-errors.log       # 错误日志
└── 2026-02-25-summary.json     # 执行摘要
```

---

## 配置文件

### platforms.json

```json
{
  "keywords": ["openclaw", "open claw", "#openclaw"],
  "platforms": {
    "twitter": {
      "enabled": true,
      "maxResults": 200,
      "viralThresholds": {
        "tier1": { "views30min": 5000, "views1hour": 10000 },
        "tier2": { "views12hours": 100000 },
        "tier3": { "views3days": 350000 }
      }
    },
    "reddit": {
      "enabled": true,
      "subreddits": ["all", "technology", "cryptocurrency"],
      "maxResults": 100,
      "viralThresholds": {
        "minUpvotes": 100,
        "minComments": 20
      }
    },
    "discord": {
      "enabled": true,
      "channels": ["general", "announcements"],
      "maxResults": 50,
      "viralThresholds": {
        "minReactions": 50,
        "minActiveUsers": 10
      }
    },
    "telegram": {
      "enabled": true,
      "channels": ["@openclaw"],
      "maxResults": 50,
      "viralThresholds": {
        "minViews": 5000,
        "minReactions": 30
      }
    }
  },
  "aiProcessing": {
    "enabled": false,
    "targetLanguage": "zh-CN",
    "targetPlatforms": ["xiaohongshu", "douyin", "kuaishou"]
  }
}
```

---

## 测试策略

### 单元测试
每个 Platform Adapter 独立测试：
```bash
bun test src/platforms/twitter/adapter.test.ts
bun test src/platforms/reddit/adapter.test.ts
```

### 集成测试
测试完整流程：
```bash
bun test src/core/scheduler.integration.test.ts
```

### 手动测试流程
1. 先用少量关键词测试单个平台
2. 验证爆款检测准确性
3. 确认存储格式正确

### 测试数据
```typescript
const mockContent = {
  id: "test123",
  text: "openclaw is amazing",
  author: { username: "test_user" },
  metrics: { upvotes: 150, comments: 25 }
}
```

---

## 数据格式示例

### 原始内容格式
```json
{
  "id": "abc123",
  "platform": "reddit",
  "text": "OpenClaw is revolutionizing...",
  "author": { "username": "user123", "name": "John Doe" },
  "url": "https://reddit.com/r/.../abc123",
  "createdAt": "2026-02-25T10:30:00Z",
  "fetchedAt": "2026-02-25T15:00:00Z",
  "isViral": true,
  "metrics": {
    "upvotes": 150,
    "comments": 25
  },
  "media": []
}
```

### 处理后内容格式
```json
{
  "sourceId": "abc123",
  "sourcePlatform": "reddit",
  "processedAt": "2026-02-25T15:05:00Z",
  "targetPlatform": "xiaohongshu",
  "title": "OpenClaw 正在改变...",
  "content": "OpenClaw 是一个革命性的...",
  "media": ["images/abc123_1.jpg"],
  "hashtags": ["#openclaw", "#科技"]
}
```

---

## 实现阶段规划

### Phase 1: 核心架构
- [ ] 创建 PlatformAdapter 基类接口
- [ ] 重构现有 Twitter 代码为适配器
- [ ] 实现核心调度器
- [ ] 统一存储层

### Phase 2: Reddit 支持
- [ ] 实现 Reddit Adapter
- [ ] 实现 Reddit 爆款检测
- [ ] 测试验证

### Phase 3: Discord 支持
- [ ] 实现 Discord Adapter
- [ ] 实现 Discord 爆款检测
- [ ] 测试验证

### Phase 4: Telegram 支持
- [ ] 实现 Telegram Adapter
- [ ] 实现 Telegram 爆款检测
- [ ] 测试验证

### Phase 5: Skill 集成
- [ ] 创建 monitor-viral skill
- [ ] 集成调度器
- [ ] 端到端测试

### Phase 6: AI 处理（可选）
- [ ] 实现 AI 内容处理器
- [ ] 多平台内容适配

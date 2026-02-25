# Twitter 爆款监控器

监控 Twitter 上特定关键词的爆款推文，根据浏览量增长速度自动识别爆款。

## 功能特性

- 🔍 多关键词搜索监控
- 📊 三级爆款检测（Early Momentum → Confirmed Viral → Sustained Viral）
- 💾 按日期归档存储
- 📈 历史快照追踪
- 🔄 自动去重

## 爆款定义

### Tier 1 — Early Momentum (possible viral candidate)
- ≥ 5,000 views within 30 minutes
- ≥ 10,000 views within 1 hour
- ≥ 30,000 views within 3 hours
- ≥ 60,000 views within 6 hours

### Tier 2 — Confirmed Viral (short-term)
- ≥ 100,000 views within 12 hours
- ≥ 200,000 views within 24 hours

### Tier 3 — Sustained Viral (multi-day reach)
- ≥ 350,000 views within 3 days
- ≥ 500,000 views within 7 days

## 安装

```bash
# 安装依赖
bun install

# 复制环境变量模板
cp .env.example .env
```

## 配置

### 1. 设置 Twitter 认证

在浏览器中获取 Twitter cookies:
1. 打开 Twitter/X 并登录
2. 按 F12 打开开发者工具
3. 进入 **Application** → **Storage** → **Cookies**
4. 复制 `auth_token` 和 `ct0` 的值

在 `.env` 文件中设置:
```bash
TWITTER_AUTH_TOKEN=你的_auth_token值
TWITTER_CT0=你的_ct0值
```

### 2. 配置关键词

编辑 `config/keywords.json`:
```json
{
  "keywords": [
    "openclaw",
    "open claw",
    "#openclaw"
  ],
  "searchConfig": {
    "count": 200,
    "maxPages": 3
  }
}
```

## 使用

### 执行监控
```bash
bun run src/index.ts monitor
```

### 查看统计
```bash
# 查看今天
bun run src/index.ts stats

# 查看指定日期
bun run src/index.ts stats 2026-02-18
```

## 定时任务

### 使用 cron
```bash
crontab -e
```
添加:
```
0 9 * * * cd /Users/wangziyi/Desktop/lujing && bun run src/index.ts monitor >> logs/monitor.log 2>&1
```

### 使用 macOS launchd (推荐)
参考 `crontab.example` 文件中的配置。

## 数据格式

数据保存在 `data/` 目录，按日期命名:
```
data/
├── 2026-02-19.json
├── 2026-02-18.json
└── ...
```

每条记录包含:
```typescript
{
  "id": "推文ID",
  "text": "推文内容",
  "author": { "username": "...", "name": "..." },
  "createdAt": "发布时间",
  "detectedAt": "首次检测时间",
  "lastUpdated": "最后更新时间",
  "currentTier": "当前等级",
  "viewCount": 浏览量,
  "likeCount": 点赞数,
  "retweetCount": 转发数,
  "history": [
    {
      "timestamp": "快照时间",
      "viewCount": 浏览量,
      "likeCount": 点赞数,
      "retweetCount": 转发数,
      "tier": "等级"
    }
  ]
}
```

## 项目结构

```
.
├── src/
│   ├── index.ts          # CLI 入口
│   ├── monitor.ts        # 监控核心逻辑
│   ├── viral-detector.ts # 爆款检测
│   └── types.ts          # 类型定义
├── config/
│   └── keywords.json     # 关键词配置
├── data/                 # 数据存储目录
├── package.json
└── tsconfig.json
```

## License

MIT

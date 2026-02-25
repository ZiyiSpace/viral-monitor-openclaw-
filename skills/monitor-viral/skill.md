# monitor-viral

检测多平台爆款内容，支持 Twitter、Reddit、Discord、Telegram。

## 用法

```
bun run src/index.ts multi [关键词]
```

## 示例

```
bun run src/index.ts multi openclaw
bun run src/index.ts multi AI
```

## 功能

- 并行抓取所有启用的平台
- 自动检测爆款内容
- 按日期和平台分类存储到 `data/raw/YYYY-MM-DD/platform/`
- 返回汇总报告

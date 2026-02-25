import { describe, it, expect } from 'bun:test';
import { ContentScheduler } from '../core/scheduler.js';
import { JsonContentRepository } from '../storage/repository.js';
import { rm } from 'fs/promises';

describe('Multi-Platform Integration', () => {
  it('should run full workflow with mock adapter', async () => {
    await rm('./data/integration-test', { recursive: true, force: true });

    const repo = new JsonContentRepository('./data/integration-test');
    const scheduler = new ContentScheduler(repo);

    // 创建 mock 适配器
    const mockAdapter = {
      name: 'mock',
      fetchContent: async () => [
        {
          id: 'test123',
          platform: 'mock',
          text: 'Test content about openclaw',
          author: { username: 'testuser' },
          url: 'https://test.com/123',
          createdAt: new Date().toISOString(),
          fetchedAt: new Date().toISOString(),
          isViral: false,
          metrics: { views: 1000 },
        },
      ],
      isViral: (content: any) => content.metrics?.views > 500,
      downloadMedia: async () => [],
    };

    const result = await scheduler.run(['openclaw'], [mockAdapter]);

    // 验证调度结果
    expect(result.summary.successCount).toBe(1);
    expect(result.summary.totalContents).toBe(1);
    expect(result.platforms.mock.status).toBe('success');

    // 验证数据已保存
    const today = new Date().toISOString().split('T')[0];
    const contents = await repo.listRaw(today, 'mock');
    expect(contents.length).toBe(1);
    expect(contents[0].id).toBe('test123');
  }, 30000);

  it('should handle adapter failure gracefully', async () => {
    await rm('./data/integration-test-fail', { recursive: true, force: true });

    const repo = new JsonContentRepository('./data/integration-test-fail');
    const scheduler = new ContentScheduler(repo);

    const failingAdapter = {
      name: 'failing',
      fetchContent: async () => {
        throw new Error('Network error');
      },
      isViral: () => false,
      downloadMedia: async () => [],
    };

    const result = await scheduler.run(['test'], [failingAdapter]);

    expect(result.summary.failureCount).toBe(1);
    expect(result.platforms.failing.status).toBe('failure');
  });
});

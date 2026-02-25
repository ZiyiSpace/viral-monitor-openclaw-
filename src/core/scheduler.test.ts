import { describe, it, expect, beforeEach } from 'bun:test';
import { ContentScheduler } from './scheduler';
import { TwitterAdapter } from '../platforms/twitter/adapter.js';
import { JsonContentRepository } from '../storage/repository.js';
import { rm } from 'fs/promises';

describe('ContentScheduler', () => {
  let scheduler: ContentScheduler;
  let mockAdapter: any;

  beforeEach(async () => {
    await rm('./data/test-scheduler', { recursive: true, force: true });

    mockAdapter = {
      name: 'test',
      fetchContent: async () => [
        {
          id: '1',
          platform: 'twitter',
          text: 'test',
          author: { username: 'test' },
          url: 'https://test.com/1',
          createdAt: new Date().toISOString(),
          fetchedAt: new Date().toISOString(),
          isViral: true,
          metrics: {},
        },
      ],
      isViral: (content: any) => content.isViral,
      downloadMedia: async () => [],
    };

    const repo = new JsonContentRepository('./data/test-scheduler');
    scheduler = new ContentScheduler(repo);
  });

  it('should run all adapters', async () => {
    const result = await scheduler.run(['test'], [mockAdapter]);

    expect(result.summary.totalContents).toBeGreaterThan(0);
    expect(result.summary.successCount).toBe(1);
  });

  it('should handle adapter failures gracefully', async () => {
    const failingAdapter = {
      name: 'failing',
      fetchContent: async () => {
        throw new Error('Network error');
      },
      isViral: () => false,
      downloadMedia: async () => [],
    };

    const result = await scheduler.run(['test'], [mockAdapter, failingAdapter]);

    expect(result.summary.failureCount).toBe(1);
    expect(result.platforms.failing.status).toBe('failure');
  });
});

import { describe, it, expect, beforeEach } from 'bun:test';
import { TwitterAdapter } from './adapter';
import type { RawContent } from '../../core/types';

describe('TwitterAdapter', () => {
  let adapter: TwitterAdapter;

  beforeEach(() => {
    adapter = new TwitterAdapter({
      authToken: process.env.TWITTER_AUTH_TOKEN || '',
      ct0: process.env.TWITTER_CT0 || '',
    });
  });

  it('should have name "twitter"', () => {
    expect(adapter.name).toBe('twitter');
  });

  it('should fetch content for given keyword', async () => {
    const results = await adapter.fetchContent('openclaw', { maxResults: 10 });
    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0) {
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('text');
      expect(results[0]).toHaveProperty('platform', 'twitter');
    }
  }, 30000);

  it('should detect viral content correctly', () => {
    const viralContent: RawContent = {
      id: '1',
      platform: 'twitter',
      text: 'test',
      author: { username: 'test' },
      url: 'https://twitter.com/test/1',
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      fetchedAt: new Date().toISOString(),
      isViral: false,
      metrics: { views: 6000 },
    };

    expect(adapter.isViral(viralContent)).toBe(true);
  });

  it('should not detect non-viral content', () => {
    const nonViralContent: RawContent = {
      id: '1',
      platform: 'twitter',
      text: 'test',
      author: { username: 'test' },
      url: 'https://twitter.com/test/1',
      createdAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      isViral: false,
      metrics: { views: 100 },
    };

    expect(adapter.isViral(nonViralContent)).toBe(false);
  });
});

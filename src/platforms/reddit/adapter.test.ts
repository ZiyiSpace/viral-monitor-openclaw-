import { describe, it, expect, beforeEach } from 'bun:test';
import { RedditAdapter } from './adapter';

describe('RedditAdapter', () => {
  let adapter: RedditAdapter;

  beforeEach(() => {
    adapter = new RedditAdapter({
      clientId: process.env.REDDIT_CLIENT_ID || '',
      clientSecret: process.env.REDDIT_CLIENT_SECRET || '',
      userAgent: 'TestAgent/1.0',
    });
  });

  it('should have name "reddit"', () => {
    expect(adapter.name).toBe('reddit');
  });

  it('should detect viral content based on upvotes', () => {
    const viralContent: any = {
      id: '1',
      platform: 'reddit',
      text: 'test',
      author: { username: 'test' },
      url: 'https://reddit.com/r/test/1',
      createdAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      isViral: false,
      metrics: { upvotes: 150, comments: 25 },
    };

    expect(adapter.isViral(viralContent)).toBe(true);
  });

  it('should not detect non-viral content', () => {
    const nonViralContent: any = {
      id: '1',
      platform: 'reddit',
      text: 'test',
      author: { username: 'test' },
      url: 'https://reddit.com/r/test/1',
      createdAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      isViral: false,
      metrics: { upvotes: 50, comments: 5 },
    };

    expect(adapter.isViral(nonViralContent)).toBe(false);
  });
});

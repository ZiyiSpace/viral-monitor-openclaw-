import { describe, it, expect } from 'bun:test';
import { DiscordAdapter } from './adapter';

describe('DiscordAdapter', () => {
  it('should have name "discord"', () => {
    const adapter = new DiscordAdapter({ token: 'test' });
    expect(adapter.name).toBe('discord');
  });

  it('should detect viral content based on reactions', () => {
    const adapter = new DiscordAdapter({ token: 'test' });
    const viralContent: any = {
      id: '1',
      platform: 'discord',
      text: 'test',
      author: { username: 'test' },
      url: 'https://discord.com/1',
      createdAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      isViral: false,
      metrics: { reactions: 60 },
    };

    expect(adapter.isViral(viralContent)).toBe(true);
  });

  it('should not detect non-viral content', () => {
    const adapter = new DiscordAdapter({ token: 'test' });
    const nonViralContent: any = {
      id: '1',
      platform: 'discord',
      text: 'test',
      author: { username: 'test' },
      url: 'https://discord.com/1',
      createdAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      isViral: false,
      metrics: { reactions: 10 },
    };

    expect(adapter.isViral(nonViralContent)).toBe(false);
  });
});

import { describe, it, expect, beforeEach } from 'bun:test';
import { JsonContentRepository } from './repository';
import type { RawContent, ProcessedContent } from '../core/types';
import { rm } from 'fs/promises';

describe('JsonContentRepository', () => {
  const testDir = './data/test';
  let repo: JsonContentRepository;

  beforeEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    repo = new JsonContentRepository(testDir);
  });

  it('should save raw content', async () => {
    const content: RawContent = {
      id: 'test123',
      platform: 'twitter',
      text: 'test content',
      author: { username: 'testuser' },
      url: 'https://test.com/123',
      createdAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      isViral: false,
      metrics: {},
    };

    const filePath = await repo.saveRaw(content);
    expect(filePath).toContain('test123.json');
  });

  it('should list raw content by date', async () => {
    const content: RawContent = {
      id: 'test123',
      platform: 'twitter',
      text: 'test content',
      author: { username: 'testuser' },
      url: 'https://test.com/123',
      createdAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      isViral: false,
      metrics: {},
    };

    await repo.saveRaw(content);
    // Use the same date format as saved in the content
    const date = content.fetchedAt.split('T')[0];
    const contents = await repo.listRaw(date);
    expect(contents.length).toBe(1);
    expect(contents[0].id).toBe('test123');
  });

  it('should save processed content', async () => {
    const content: ProcessedContent = {
      sourceId: 'test123',
      sourcePlatform: 'twitter',
      processedAt: new Date().toISOString(),
      targetPlatform: 'xiaohongshu',
      title: 'Test Title',
      content: 'Test content body',
      media: [],
      hashtags: ['test', 'viral'],
    };

    const filePath = await repo.saveProcessed(content);
    expect(filePath).toContain('twitter_test123.json');
  });

  it('should list processed content by date', async () => {
    const content: ProcessedContent = {
      sourceId: 'test123',
      sourcePlatform: 'twitter',
      processedAt: new Date().toISOString(),
      targetPlatform: 'xiaohongshu',
      title: 'Test Title',
      content: 'Test content body',
      media: [],
      hashtags: ['test', 'viral'],
    };

    await repo.saveProcessed(content);
    // Use the same date format as saved in the content
    const date = content.processedAt.split('T')[0];
    const contents = await repo.listProcessed(date);
    expect(contents.length).toBe(1);
    expect(contents[0].sourceId).toBe('test123');
  });

  it('should return empty array when no content exists', async () => {
    const contents = await repo.listRaw('2024-01-01');
    expect(contents.length).toBe(0);
  });

  it('should filter raw content by platform', async () => {
    const twitterContent: RawContent = {
      id: 'twitter123',
      platform: 'twitter',
      text: 'twitter content',
      author: { username: 'twitteruser' },
      url: 'https://twitter.com/123',
      createdAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      isViral: false,
      metrics: {},
    };

    const redditContent: RawContent = {
      id: 'reddit123',
      platform: 'reddit',
      text: 'reddit content',
      author: { username: 'reddituser' },
      url: 'https://reddit.com/123',
      createdAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      isViral: false,
      metrics: {},
    };

    await repo.saveRaw(twitterContent);
    await repo.saveRaw(redditContent);

    // Use the same date format as saved in the content
    const date = twitterContent.fetchedAt.split('T')[0];
    const allContents = await repo.listRaw(date);
    expect(allContents.length).toBe(2);

    const twitterContents = await repo.listRaw(date, 'twitter');
    expect(twitterContents.length).toBe(1);
    expect(twitterContents[0].platform).toBe('twitter');
  });

  it('should handle malformed JSON files gracefully', async () => {
    const validContent: RawContent = {
      id: 'valid123',
      platform: 'twitter',
      text: 'valid content',
      author: { username: 'validuser' },
      url: 'https://test.com/123',
      createdAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      isViral: false,
      metrics: {},
    };

    await repo.saveRaw(validContent);

    // Create a malformed JSON file in the same directory
    const fs = await import('fs/promises');
    const path = await import('path');
    const date = validContent.fetchedAt.split('T')[0];
    const platformDir = path.join(testDir, 'raw', date, 'twitter');
    const malformedPath = path.join(platformDir, 'malformed.json');
    await fs.writeFile(malformedPath, '{ invalid json }', 'utf-8');

    // Should only return the valid content, ignoring the malformed file
    const contents = await repo.listRaw(date);
    expect(contents.length).toBe(1);
    expect(contents[0].id).toBe('valid123');
  });
});

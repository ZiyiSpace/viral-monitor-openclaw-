import { describe, it, expect } from 'bun:test';
import { BasePlatformAdapter } from './base';

describe('BasePlatformAdapter', () => {
  it('should have a name property', () => {
    class TestAdapter extends BasePlatformAdapter {
      readonly name = 'test';
    }
    const adapter = new TestAdapter();
    expect(adapter.name).toBe('test');
  });

  it('should throw error if fetchContent not implemented', async () => {
    class TestAdapter extends BasePlatformAdapter {
      readonly name = 'test';
    }
    const adapter = new TestAdapter();
    await expect(adapter.fetchContent('test')).rejects.toThrow('not implemented');
  });

  it('should throw error if isViral not implemented', () => {
    class TestAdapter extends BasePlatformAdapter {
      readonly name = 'test';
    }
    const adapter = new TestAdapter();
    expect(() => adapter.isViral({} as any)).toThrow('not implemented');
  });

  it('should implement default downloadMedia that returns empty array', async () => {
    class TestAdapter extends BasePlatformAdapter {
      readonly name = 'test';
    }
    const adapter = new TestAdapter();
    const result = await adapter.downloadMedia({} as any);
    expect(result).toEqual([]);
  });

  it('should validate content with required fields', () => {
    class TestAdapter extends BasePlatformAdapter {
      readonly name = 'test';
    }
    const adapter = new TestAdapter();

    const validContent = {
      id: '123',
      text: 'test',
      author: { username: 'testuser' },
      url: 'https://test.com/123',
      createdAt: new Date().toISOString(),
    };

    expect(adapter['validateContent'](validContent)).toBe(true);
  });

  it('should reject content without required fields', () => {
    class TestAdapter extends BasePlatformAdapter {
      readonly name = 'test';
    }
    const adapter = new TestAdapter();

    const invalidContent = {
      id: '123',
      // 缺少 text, author, url, createdAt
    };

    expect(adapter['validateContent'](invalidContent)).toBe(false);
  });
});

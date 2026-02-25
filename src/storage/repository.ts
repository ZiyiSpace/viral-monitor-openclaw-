import fs from 'fs/promises';
import path from 'path';
import type { ContentRepository, RawContent, ProcessedContent } from '../core/types.js';

export class JsonContentRepository implements ContentRepository {
  private rawDir: string;
  private processedDir: string;

  constructor(baseDir: string = './data') {
    this.rawDir = path.join(baseDir, 'raw');
    this.processedDir = path.join(baseDir, 'processed');
  }

  async saveRaw(content: RawContent): Promise<string> {
    const date = content.fetchedAt.split('T')[0];
    const platformDir = path.join(this.rawDir, date, content.platform);
    const filePath = path.join(platformDir, `${content.id}.json`);

    await fs.mkdir(platformDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(content, null, 2), 'utf-8');

    return filePath;
  }

  async saveProcessed(content: ProcessedContent): Promise<string> {
    const date = content.processedAt.split('T')[0];
    const platformDir = path.join(this.processedDir, date, content.targetPlatform);
    const fileName = `${content.sourcePlatform}_${content.sourceId}.json`;
    const filePath = path.join(platformDir, fileName);

    await fs.mkdir(platformDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(content, null, 2), 'utf-8');

    return filePath;
  }

  async listRaw(date: string, platform?: string): Promise<RawContent[]> {
    const searchDir = platform
      ? path.join(this.rawDir, date, platform)
      : path.join(this.rawDir, date);

    const contents: RawContent[] = [];

    try {
      const entries = await fs.readdir(searchDir, { recursive: true });

      for (const entry of entries) {
        if (entry.endsWith('.json')) {
          try {
            const filePath = path.join(searchDir, entry);
            const fileContent = await fs.readFile(filePath, 'utf-8');
            contents.push(JSON.parse(fileContent));
          } catch (readError) {
            console.warn(`[JsonContentRepository] Failed to read file ${entry}:`, readError);
            // 继续处理其他文件
          }
        }
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // 目录不存在，返回空数组
        return [];
      }
      // 其他错误（如权限问题）抛出
      throw error;
    }

    return contents;
  }

  async listProcessed(date: string): Promise<ProcessedContent[]> {
    const searchDir = path.join(this.processedDir, date);
    const contents: ProcessedContent[] = [];

    try {
      const entries = await fs.readdir(searchDir, { recursive: true });

      for (const entry of entries) {
        if (entry.endsWith('.json')) {
          try {
            const filePath = path.join(searchDir, entry);
            const fileContent = await fs.readFile(filePath, 'utf-8');
            contents.push(JSON.parse(fileContent));
          } catch (readError) {
            console.warn(`[JsonContentRepository] Failed to read file ${entry}:`, readError);
            // 继续处理其他文件
          }
        }
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // 目录不存在，返回空数组
        return [];
      }
      // 其他错误（如权限问题）抛出
      throw error;
    }

    return contents;
  }
}

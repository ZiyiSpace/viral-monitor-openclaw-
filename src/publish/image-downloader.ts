import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 图片下载模块
 */
export class ImageDownloader {
  private baseDir: string;

  constructor(baseDir: string = './data/images') {
    this.baseDir = path.resolve(baseDir);
  }

  /**
   * 下载内容中的所有图片
   */
  async downloadImages(content: any, date: string): Promise<string[]> {
    const media = content.media;
    if (!media || media.length === 0) {
      return [];
    }

    const platform = content.platform;
    const contentId = content.id;

    const downloadedPaths: string[] = [];

    for (let i = 0; i < media.length; i++) {
      const mediaItem = media[i];
      const url = mediaItem.url;

      try {
        const filePath = await this.downloadImage(url, date, platform, contentId, i);
        downloadedPaths.push(filePath);
      } catch (error) {
        console.warn(`Failed to download image ${url}:`, error);
      }
    }

    return downloadedPaths;
  }

  /**
   * 批量下载多个内容的图片
   */
  async downloadBatch(contents: any[], date: string): Promise<Map<string, string[]>> {
    const results = new Map<string, string[]>();

    for (const content of contents) {
      const paths = await this.downloadImages(content, date);
      results.set(content.id, paths);
    }

    return results;
  }

  /**
   * 下载单张图片
   */
  private async downloadImage(
    url: string,
    date: string,
    platform: string,
    contentId: string,
    index: number
  ): Promise<string> {
    // 确定文件扩展名
    let ext = '.jpg';
    if (url.includes('.png')) ext = '.png';
    else if (url.includes('.gif')) ext = '.gif';
    else if (url.includes('.webp')) ext = '.webp';

    // 构建文件路径：data/images/日期/平台/ID_0.jpg
    const dirPath = path.join(this.baseDir, date, platform);
    await fs.mkdir(dirPath, { recursive: true });

    const fileName = `${contentId}_${index}${ext}`;
    const filePath = path.join(dirPath, fileName);

    // 下载图片
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(buffer));

    return filePath;
  }

  /**
   * 清理旧图片（可选）
   */
  async cleanupOldImages(daysToKeep: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const entries = await fs.readdir(this.baseDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const entryDate = new Date(entry.name);
      if (entryDate < cutoffDate) {
        const entryPath = path.join(this.baseDir, entry.name);
        await fs.rm(entryPath, { recursive: true, force: true });
        console.log(`Cleaned up old images: ${entry.name}`);
      }
    }
  }
}

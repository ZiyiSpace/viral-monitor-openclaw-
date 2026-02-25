import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 图片下载器
 */
export class ImageDownloader {
  private outputDir: string;

  constructor(outputDir: string = './data/images') {
    this.outputDir = outputDir;
  }

  /**
   * 从 Tweet 提取图片 URL
   */
  extractImageUrls(media: any[]): string[] {
    if (!media || media.length === 0) return [];

    return media
      .filter(m => m.type === 'photo' || m.type === 'image')
      .map(m => m.url || m.mediaUrlHttps || m.media_url);
  }

  /**
   * 下载单张图片
   */
  async downloadImage(url: string, filename: string): Promise<string> {
    try {
      // 确保输出目录存在
      await fs.mkdir(this.outputDir, { recursive: true });

      // 下载图片
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      const filePath = path.join(this.outputDir, filename);

      await fs.writeFile(filePath, Buffer.from(buffer));

      return filePath;
    } catch (error) {
      console.error(`下载图片失败: ${url}`, error);
      throw error;
    }
  }

  /**
   * 下载推文的所有图片
   */
  async downloadTweetImages(tweetId: string, media: any[]): Promise<string[]> {
    const imageUrls = this.extractImageUrls(media);

    if (imageUrls.length === 0) {
      return [];
    }

    console.log(`   📸 下载 ${imageUrls.length} 张图片...`);

    const downloadedPaths: string[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      try {
        const ext = this.getImageExtension(imageUrls[i]);
        const filename = `${tweetId}_${i}${ext}`;
        const filePath = await this.downloadImage(imageUrls[i], filename);
        downloadedPaths.push(filePath);
      } catch (error) {
        console.error(`   ❌ 下载图片 ${i + 1} 失败`);
      }
    }

    return downloadedPaths;
  }

  /**
   * 获取图片扩展名
   */
  private getImageExtension(url: string): string {
    const match = url.match(/\.(jpg|jpeg|png|gif|webp)/i);
    return match ? `.${match[1]}` : '.jpg';
  }

  /**
   * 清理旧图片
   */
  async cleanupOldImages(daysToKeep: number = 7): Promise<void> {
    try {
      const files = await fs.readdir(this.outputDir);
      const now = Date.now();
      const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.outputDir, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
          console.log(`🗑️ 删除旧图片: ${file}`);
        }
      }
    } catch (error) {
      console.error('清理旧图片失败:', error);
    }
  }
}

/**
 * 创建下载器
 */
export function createDownloader(outputDir?: string): ImageDownloader {
  return new ImageDownloader(outputDir);
}

/**
 * 批量生成所有视频推文的配音脚本
 * 用法: node batch-voiceover.js
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const postsDir = './output/posts/2026-02-20';

/**
 * 查找所有视频推文文件夹
 */
async function findVideoFolders() {
  const entries = await fs.readdir(postsDir, { withFileTypes: true });
  const videoFolders = [];

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.endsWith('-视频')) {
      videoFolders.push(path.join(postsDir, entry.name));
    }
  }

  return videoFolders.sort();
}

/**
 * 执行命令
 */
function execPromise(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

/**
 * 主函数
 */
async function main() {
  console.log('🎬 批量生成视频推文配音脚本\n');

  const videoFolders = await findVideoFolders();
  console.log(`📹 找到 ${videoFolders.length} 个视频推文\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < videoFolders.length; i++) {
    const folder = videoFolders[i];
    const folderName = path.basename(folder);

    console.log(`[${i + 1}/${videoFolders.length}] 处理: ${folderName}`);

    try {
      await execPromise(`node generate-voiceover.js "${folder}"`);
      successCount++;
      console.log('   ✅ 完成\n');
    } catch (error) {
      failCount++;
      console.error(`   ❌ 失败: ${error.message}\n`);
    }

    // 避免API限流，延迟2秒
    if (i < videoFolders.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log('========================================================');
  console.log(`🎉 批量处理完成！`);
  console.log(`   ✅ 成功: ${successCount} 个`);
  console.log(`   ❌ 失败: ${failCount} 个`);
  console.log('========================================================');
}

main().catch(console.error);

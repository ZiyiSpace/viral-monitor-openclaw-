/**
 * 小红书发布模块
 * 通过小红书 MCP HTTP API 发布内容
 */

export interface XiaohongshuPost {
  title: string;
  content: string;
  images?: string[];  // 本地图片路径或 URL
  tags?: string[];
}

export interface PublishResult {
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
}

const MCP_BASE_URL = 'http://localhost:18060';
const MCP_TIMEOUT = 300000; // 5分钟

/**
 * 小红书发布器
 */
export class XiaohongshuPublisher {
  private baseUrl: string;
  private timeout: number;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = options?.baseUrl || MCP_BASE_URL;
    this.timeout = options?.timeout || MCP_TIMEOUT;
  }

  /**
   * 检查 MCP 服务器状态
   */
  async checkStatus(): Promise<{ loggedIn: boolean; username?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/login/status`, {
        signal: AbortSignal.timeout(this.timeout),
      });
      const data = await response.json();

      if (data.success) {
        const loginInfo = data.data || {};
        return {
          loggedIn: loginInfo.is_logged_in || false,
          username: loginInfo.username,
        };
      }

      return { loggedIn: false };
    } catch (error) {
      console.error('❌ 无法连接到 MCP 服务器');
      throw new Error('小红书 MCP 服务器未运行，请先启动 xiaohongshu-mcp');
    }
  }

  /**
   * 发布内容到小红书
   * @param post 要发布的内容
   * @returns 发布结果
   */
  async publish(post: XiaohongshuPost): Promise<PublishResult> {
    try {
      console.log('📱 准备发布到小红书...');
      console.log(`   标题: ${post.title}`);
      console.log(`   内容长度: ${post.content.length} 字`);
      console.log(`   图片数量: ${post.images?.length || 0}`);

      // 检查登录状态
      const status = await this.checkStatus();
      if (!status.loggedIn) {
        return {
          success: false,
          error: '未登录小红书，请先运行 xiaohongshu-login 扫码登录',
        };
      }
      console.log(`   已登录: ${status.username || '用户'}`);

      // 构建发布请求 - images 字段必须存在（MCP API 要求）
      const payload: any = {
        title: post.title,
        content: post.content,
        images: post.images && post.images.length > 0 ? post.images : [],
      };

      if (post.tags && post.tags.length > 0) {
        payload.tags = post.tags;
      }

      // 发送发布请求
      const response = await fetch(`${this.baseUrl}/api/v1/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeout),
      });

      const data = await response.json();

      if (data.success) {
        // MCP API doesn't return post_id, so we indicate success without URL
        console.log(`✅ 发布成功! (MCP未返回Post ID，请在小红书APP中查看)`);

        return {
          success: true,
          postId: undefined,
          url: undefined,
        };
      } else {
        const errorMsg = data.error || '未知错误';
        console.error(`❌ 发布失败: ${errorMsg}`);
        return {
          success: false,
          error: errorMsg,
        };
      }
    } catch (error) {
      console.error('❌ 发布失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 批量发布
   */
  async publishBatch(posts: XiaohongshuPost[]): Promise<PublishResult[]> {
    const results: PublishResult[] = [];

    // 先检查一次登录状态
    const status = await this.checkStatus();
    if (!status.loggedIn) {
      console.error('❌ 未登录小红书，请先运行 xiaohongshu-login 扫码登录');
      return posts.map(() => ({
        success: false,
        error: '未登录小红书',
      }));
    }

    for (const post of posts) {
      const result = await this.publish(post);
      results.push(result);

      // 延迟避免限流
      if (result.success) {
        await this.delay(10000); // 10秒延迟
      }
    }

    return results;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 创建发布器
 */
export function createPublisher(options?: { baseUrl?: string; timeout?: number }): XiaohongshuPublisher {
  return new XiaohongshuPublisher(options);
}

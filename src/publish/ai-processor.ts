/**
 * AI 内容处理模块
 * 支持多种 AI 提供商进行内容翻译、改写和格式化
 */

export interface AIProcessorConfig {
  provider: 'glm' | 'anthropic' | 'openai';
  apiKey: string;
  baseUrl?: string;
}

export interface ProcessedContent {
  original: {
    title: string;
    text: string;
    url: string;
    author: string;
  };
  xiaohongshu: {
    title: string;
    content: string;
    tags: string[];
  };
  douyin: {
    title: string;
    content: string;
    tags: string[];
  };
  kuaishou: {
    title: string;
    content: string;
    tags: string[];
  };
  recommendationScore: number; // 0-100
}

/**
 * AI 内容处理器
 */
export class AIContentProcessor {
  private config: AIProcessorConfig;

  constructor(config: AIProcessorConfig) {
    this.config = config;
  }

  /**
   * 处理单条内容
   */
  async processContent(rawContent: any): Promise<ProcessedContent> {
    const prompt = this.buildPrompt(rawContent);

    let aiResponse: string;
    if (this.config.provider === 'glm') {
      aiResponse = await this.callGLM(prompt);
    } else if (this.config.provider === 'anthropic') {
      aiResponse = await this.callAnthropic(prompt);
    } else {
      throw new Error(`Unsupported provider: ${this.config.provider}`);
    }

    return this.parseResponse(aiResponse, rawContent);
  }

  /**
   * 批量处理内容
   */
  async processBatch(contents: any[], onProgress?: (current: number, total: number) => void): Promise<ProcessedContent[]> {
    const results: ProcessedContent[] = [];

    for (let i = 0; i < contents.length; i++) {
      const processed = await this.processContent(contents[i]);
      results.push(processed);

      if (onProgress) {
        onProgress(i + 1, contents.length);
      }
    }

    return results;
  }

  /**
   * 构建 AI 提示词
   */
  private buildPrompt(content: any): string {
    const platform = content.platform;
    const text = content.text || '';
    const author = content.author?.username || '';
    const metrics = content.metrics || {};
    const url = content.url || '';

    // 提取标题（Reddit 有 title，Twitter 需要从 text 提取）
    const title = content.title || text.split('\n')[0].substring(0, 50);

    return `请将以下${platform}内容改写为适合中国社交媒体平台的格式。

【原始内容】
平台：${platform}
作者：@${author}
内容：${text}
${metrics.views ? `热度：${metrics.views}浏览` : ''}
${metrics.upvotes ? `热度：${metrics.upvotes}顶` : ''}
链接：${url}

请严格按以下JSON格式返回（注意：tags必须是字符串数组，不要在数组中使用#符号）：
{
  "xiaohongshu": {
    "title": "吸引人的小红书标题（带emoji）",
    "content": "小红书风格正文（emoji + 种草语气）",
    "tags": ["OpenClaw", "AI工具", "热门"]
  },
  "douyin": {
    "title": "抖音短标题（有悬念感）",
    "content": "短视频脚本风格（简洁有力）",
    "tags": ["OpenClaw", "AI"]
  },
  "kuaishou": {
    "title": "快手风格标题（接地气）",
    "content": "快手风格正文（简单直接）",
    "tags": ["OpenClaw", "AI"]
  },
  "recommendationScore": 85
}

重要：
1. 只返回JSON，不要其他内容
2. tags是字符串数组，不要加#符号
3. 确保JSON格式正确，可以正常解析`;
  }

  /**
   * 调用 GLM-4 API
   */
  private async callGLM(prompt: string): Promise<string> {
    const baseUrl = this.config.baseUrl || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'glm-4-plus',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GLM API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * 调用 Anthropic API
   */
  private async callAnthropic(prompt: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  /**
   * 解析 AI 响应
   */
  private parseResponse(response: string, rawContent: any): ProcessedContent {
    // 尝试提取 JSON（处理可能的 markdown 代码块）
    let jsonStr = response;
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }

    // 清理 JSON 字符串，移除标签中的 # 符号（常见的 GLM 输出问题）
    jsonStr = jsonStr.replace(/#([^\s"\],])/g, '"$1');

    let aiData: any;
    try {
      aiData = JSON.parse(jsonStr);
    } catch (error) {
      // 如果解析失败，尝试修复常见的 JSON 错误
      console.warn('JSON parse error, attempting to fix...');

      // 移除尾随逗号
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

      // 移除注释
      jsonStr = jsonStr.replace(/\/\/.*$/gm, '');

      // 再次尝试解析
      try {
        aiData = JSON.parse(jsonStr);
      } catch (error2) {
        // 如果还是失败，返回默认值
        console.warn('Could not parse AI response, using fallback');
        aiData = this.createFallbackContent(rawContent);
      }
    }

    // 提取标题
    const title = rawContent.title || rawContent.text?.split('\n')[0]?.substring(0, 50) || '';

    return {
      original: {
        title,
        text: rawContent.text || '',
        url: rawContent.url || '',
        author: rawContent.author?.username || '',
      },
      xiaohongshu: aiData.xiaohongshu || this.createFallbackFormat(rawContent, 'xiaohongshu'),
      douyin: aiData.douyin || this.createFallbackFormat(rawContent, 'douyin'),
      kuaishou: aiData.kuaishou || this.createFallbackFormat(rawContent, 'kuaishou'),
      recommendationScore: aiData.recommendationScore || 70,
    };
  }

  /**
   * 创建备用内容（当 AI 解析失败时）
   */
  private createFallbackContent(rawContent: any): any {
    return {
      xiaohongshu: this.createFallbackFormat(rawContent, 'xiaohongshu'),
      douyin: this.createFallbackFormat(rawContent, 'douyin'),
      kuaishou: this.createFallbackFormat(rawContent, 'kuaishou'),
      recommendationScore: 70,
    };
  }

  /**
   * 创建备用格式（当 AI 解析失败时）
   */
  private createFallbackFormat(content: any, platform: 'xiaohongshu' | 'douyin' | 'kuaishou'): any {
    const text = content.text || '';
    const author = content.author?.username || '';
    const url = content.url || '';

    if (platform === 'xiaohongshu') {
      return {
        title: `🔥关于OpenClaw的讨论来了！`,
        content: `关于OpenClaw的热门讨论：\n\n${text.substring(0, 200)}...\n\n来源: @${author}\n\n#OpenClaw #AI工具 #热门讨论`,
        tags: ['#OpenClaw', '#AI工具', '#热门讨论'],
      };
    } else if (platform === 'douyin') {
      return {
        title: `关于OpenClaw的热门讨论！`,
        content: `关于OpenClaw：\n${text.substring(0, 150)}...`,
        tags: ['#OpenClaw', '#AI工具', '#热门'],
      };
    } else {
      return {
        title: `OpenClaw热门讨论`,
        content: `${text.substring(0, 100)}...`,
        tags: ['#OpenClaw', '#AI'],
      };
    }
  }
}

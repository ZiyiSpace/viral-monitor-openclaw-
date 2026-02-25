/**
 * AI 内容处理模块
 * 用于翻译推文并总结重点
 */

export interface ProcessedContent {
  originalText: string;
  translatedText: string;
  summary: string;
  suggestedTags: string[];
  suggestedTitle: string;
}

export interface AIProcessorOptions {
  apiKey?: string;
  model?: string;
  provider?: 'anthropic' | 'glm' | 'auto';
}

/**
 * AI 内容处理器
 */
export class AIProcessor {
  private anthropicKey?: string;
  private glmKey?: string;
  private provider: 'anthropic' | 'glm' | 'local';

  constructor(options: AIProcessorOptions = {}) {
    this.anthropicKey = process.env.ANTHROPIC_API_KEY;
    this.glmKey = process.env.GLM_API_KEY || options.apiKey;
    this.provider = options.provider || 'auto';

    // 自动选择可用的 API
    if (this.provider === 'auto') {
      if (this.glmKey) {
        this.provider = 'glm';
      } else if (this.anthropicKey) {
        this.provider = 'anthropic';
      } else {
        this.provider = 'local';
      }
    }
  }

  /**
   * 处理推文内容：翻译 + 总结
   * @param tweetText 原始推文内容
   * @returns 处理后的内容
   */
  async processTweet(tweetText: string): Promise<ProcessedContent> {
    if (this.provider === 'glm' && this.glmKey) {
      return await this.processWithGLM(tweetText);
    }
    if (this.provider === 'anthropic' && this.anthropicKey) {
      return await this.processWithClaude(tweetText);
    }
    return this.processLocally(tweetText);
  }

  /**
   * 使用 GLM 处理 - 小红书科技博主风格（原文+解析）
   */
  private async processWithGLM(tweetText: string): Promise<ProcessedContent> {
    try {
      const prompt = `# Role
你是一名深谙互联网流量密码的小红书科技博主且你是openclaw的专业用户。你的任务是将用户输入的素材转化为一篇具有"爆款潜质"的关于openclaw的小红书帖子。

# Style & Tone
- **受众**：普通的男性科技爱好者大众，他们主要是看热闹，不懂具体的技术细节，有一些极客但不多。
- **口语化表达**：像和朋友聊天一样，拒绝由于AI生成的生硬书面语。
- **情绪饱满**：根据内容调整情绪（惊讶、兴奋、恐慌、沉思），多用Emoji来调节阅读节奏。
- **黄金三秒法则**：开头必须直接抛出结果、冲突或悬念。

# Structure Rules
1. **标题 (Title)**：
   - 必须包含Emoji。
   - 必须设置悬念或情绪反差。
   - 严格限制在 30 字以内。

2. **正文 (Body)** - 必须包含两部分：

   **第一部分：原文翻译**
   - 准确翻译推文的原始内容
   - 标注：转自 twitter @原作者名

   **第二部分：解析/点评**
   - 直接通过"我"的视角切入，展示一个具体的、量化的结果或强烈的冲突。
   - 简短介绍背景或过程，解释发生了什么，体现科技感。
   - **使用加粗字体**强调最核心的爆点、金句或转折。
   - 用一个通俗易懂的比喻或深度观点进行升华。
   - 结尾抛出一个引发评论区讨论的问题。

3. **标签 (Tags)**：
   - 必须包含：#OpenClaw
   - 另外生成 4-6 个与内容高度相关的流量标签。

# Example Format
标题：🔥真正的百倍工程师，根本不用靠爆款证明

所以说，OpenClaw 的创始人才是真正意义上、每个 CEO 都想招到的那种「百倍工程师」。
转自 twitter @Archie Sengupta

什么是百倍工程师？不是一次性写出完美代码，不是靠一个项目爆红全网。
是能搭建体系，能从 0 到 1 造出一整套工具，能把零散的想法，拼成能打仗的系统。
别人做一个项目，他布一个大局。别人追求星标，他解决真实问题。
43 个仓库不是失败，是他的技术底盘、武器库、护城河。
能单点突破，更能体系化作战，
这才是稀缺到极致的百倍工程师。
#百倍工程师 #程序员 #开源 #GitHub #技术干货 #AI开发 #职场成长

---
推文内容：
${tweetText}

请返回以下 JSON 格式（只返回 JSON，不要其他内容）：
{
  "title": "带emoji的标题（30字以内）",
  "originalAuthor": "推文作者用户名",
  "content": "完整的小红书文案：原文翻译 + 解析点评",
  "tags": ["#OpenClaw", "#AI", "#科技", ...],
  "translatedText": "原文的中文翻译（用于记录）"
}`;

      const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.glmKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'glm-4-flash',
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await response.json();
      const content = data.choices[0].message.content;

      // 尝试解析 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          originalText: tweetText,
          translatedText: parsed.translatedText || parsed.content || tweetText,
          summary: parsed.content || '• 原文内容',
          suggestedTags: parsed.tags || ['#OpenClaw', '#AI', '#科技'],
          suggestedTitle: parsed.title || 'OpenClaw 相关内容',
        };
      }

      throw new Error('无法解析 GLM 响应');
    } catch (error) {
      console.error('GLM 处理失败，使用本地处理:', error);
      return this.processLocally(tweetText);
    }
  }

  /**
   * 使用 Claude 处理
   */
  private async processWithClaude(tweetText: string): Promise<ProcessedContent> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: `请将以下 Twitter 推文翻译成中文，并提取重点。返回 JSON 格式：

推文：
${tweetText}

请返回以下格式（只返回 JSON，不要其他内容）：
{
  "translatedText": "完整的中文翻译",
  "summary": "3-5个重点，每点用emoji开头",
  "suggestedTags": ["标签1", "标签2", "标签3"],
  "suggestedTitle": "吸引人的中文标题（15字以内）"
}`,
            },
          ],
        }),
      });

      const data = await response.json();
      const content = data.content[0].text;

      // 尝试解析 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          originalText: tweetText,
          translatedText: parsed.translatedText || tweetText,
          summary: parsed.summary || '• 原文内容',
          suggestedTags: parsed.suggestedTags || ['AI', '科技'],
          suggestedTitle: parsed.suggestedTitle || 'OpenClaw 相关内容',
        };
      }

      throw new Error('无法解析 Claude 响应');
    } catch (error) {
      console.error('Claude 处理失败，使用本地处理:', error);
      return this.processLocally(tweetText);
    }
  }

  /**
   * 本地处理（备用方案）
   */
  private processLocally(tweetText: string): ProcessedContent {
    // 生成中文标题
    const title = this.generateTitle(tweetText);

    // 基本处理：保持原文，但添加中文说明
    const translatedText = `（英文原文）\n${tweetText}`;

    // 生成基本总结
    const summary = this.generateSummary(tweetText);

    return {
      originalText: tweetText,
      translatedText,
      summary,
      suggestedTags: ['OpenClaw', 'AI', '科技', 'LLM'],
      suggestedTitle: title,
    };
  }

  /**
   * 生成中文标题
   */
  private generateTitle(text: string): string {
    const lowerText = text.toLowerCase();

    // 关键词映射
    const keywords: Record<string, string> = {
      'openclaw': 'OpenClaw 热门话题',
      '2.54 billion': '花费25.4亿token训练',
      '100x engineer': '真正的100倍工程师',
      'sonnet': 'Claude Sonnet 更新',
      'kimi': 'Kimi AI相关',
      'gemini': 'Gemini AI相关',
      'agent': 'AI Agent相关',
      'llm': '大语言模型相关',
    };

    // 查找匹配的关键词
    for (const [key, value] of Object.entries(keywords)) {
      if (lowerText.includes(key)) {
        return value;
      }
    }

    // 默认标题
    return 'OpenClaw 热门推文分享';
  }

  /**
   * 生成基本总结
   */
  private generateSummary(text: string): string {
    const summaries: string[] = [];

    if (text.toLowerCase().includes('openclaw')) {
      summaries.push('🦞 关于OpenClaw项目');
    }
    if (text.toLowerCase().includes('ai') || text.toLowerCase().includes('llm')) {
      summaries.push('🤖 AI/LLM相关内容');
    }
    if (text.toLowerCase().includes('token') || text.match(/\d+\s*(billion|million|m|k)/)) {
      summaries.push('📊 包含数据信息');
    }

    if (summaries.length === 0) {
      summaries.push('📝 热门推文内容');
      summaries.push('🔗 值得关注的话题');
    }

    return summaries.join('\n');
  }

  /**
   * 批量处理
   */
  async processBatch(texts: string[]): Promise<ProcessedContent[]> {
    const results: ProcessedContent[] = [];

    for (const text of texts) {
      const result = await this.processTweet(text);
      results.push(result);

      // 延迟避免限流
      await this.delay(500);
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
 * 创建处理器
 */
export function createProcessor(options?: AIProcessorOptions): AIProcessor {
  return new AIProcessor(options);
}

import { Client, GatewayIntentBits } from 'discord.js';
import { BasePlatformAdapter } from '../base.js';
import type { RawContent, SourcePlatform } from '../../core/types.js';

export class DiscordAdapter extends BasePlatformAdapter {
  readonly name: SourcePlatform = 'discord';
  private client: Client | null = null;
  private token: string;
  private thresholds = {
    minReactions: 50,
  };

  constructor(config: { token: string }) {
    super();
    this.token = config.token;
    // 懒加载：只在需要时创建客户端
  }

  private getClient(): Client {
    if (!this.client) {
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
        ],
      });
    }
    return this.client;
  }

  async fetchContent(
    query: string,
    options: { maxResults?: number; channels?: string[] } = {}
  ): Promise<RawContent[]> {
    // Discord 需要连接后搜索历史消息
    // 这是简化版本，实际使用需要先 login
    // 返回空数组表示未实现
    return [];
  }

  isViral(content: RawContent): boolean {
    const reactions = content.metrics.reactions || 0;
    return reactions >= this.thresholds.minReactions;
  }
}

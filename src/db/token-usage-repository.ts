import { Database } from 'sql.js';
import { mapRows } from './conversation-repository';

export interface TokenUsage {
  id: string;
  message_id: string;
  conversation_id: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  prompt_cache_hit_tokens: number;
  prompt_cache_miss_tokens: number;
  created_at: string;
}

export interface TokenAggregates {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCacheHitTokens: number;
  totalCacheMissTokens: number;
  totalConversations: number;
}

export interface ModelDistribution {
  model: string;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  percentage: number;
}

export class TokenUsageRepository {
  constructor(private db: Database) {}

  create(
    messageId: string,
    conversationId: string,
    model: string,
    promptTokens: number,
    completionTokens: number,
    cacheHitTokens: number,
    cacheMissTokens: number
  ): TokenUsage {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db.run(
      'INSERT INTO token_usage (id, message_id, conversation_id, model, prompt_tokens, completion_tokens, prompt_cache_hit_tokens, prompt_cache_miss_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, messageId, conversationId, model, promptTokens, completionTokens, cacheHitTokens, cacheMissTokens, now]
    );
    const r = this.db.exec('SELECT * FROM token_usage WHERE id = ?', [id]);
    return mapRows<TokenUsage>(r)[0];
  }

  getByConversation(conversationId: string): TokenUsage[] {
    const r = this.db.exec('SELECT * FROM token_usage WHERE conversation_id = ? ORDER BY created_at ASC', [conversationId]);
    return mapRows<TokenUsage>(r);
  }

  getAggregates(): TokenAggregates {
    const totals = this.db.exec(`
      SELECT
        COALESCE(SUM(prompt_tokens), 0) as totalPromptTokens,
        COALESCE(SUM(completion_tokens), 0) as totalCompletionTokens,
        COALESCE(SUM(prompt_cache_hit_tokens), 0) as totalCacheHitTokens,
        COALESCE(SUM(prompt_cache_miss_tokens), 0) as totalCacheMissTokens
      FROM token_usage
    `);
    const convCount = this.db.exec('SELECT COUNT(*) as count FROM conversations');

    const totalsRow = mapRows<any>(totals)[0];
    const countRow = mapRows<any>(convCount)[0];
    return {
      totalPromptTokens: totalsRow?.totalPromptTokens || 0,
      totalCompletionTokens: totalsRow?.totalCompletionTokens || 0,
      totalCacheHitTokens: totalsRow?.totalCacheHitTokens || 0,
      totalCacheMissTokens: totalsRow?.totalCacheMissTokens || 0,
      totalConversations: countRow?.count || 0,
    };
  }

  getModelDistribution(): ModelDistribution[] {
    const r = this.db.exec(`
      SELECT
        model,
        SUM(prompt_tokens) as totalPromptTokens,
        SUM(completion_tokens) as totalCompletionTokens
      FROM token_usage
      GROUP BY model
      ORDER BY totalPromptTokens DESC
    `);
    const raw = mapRows<any>(r);
    const grandTotal = raw.reduce((sum, r) => sum + r.totalPromptTokens, 0);
    return raw.map(r => ({
      model: r.model,
      totalPromptTokens: r.totalPromptTokens,
      totalCompletionTokens: r.totalCompletionTokens,
      percentage: grandTotal > 0 ? (r.totalPromptTokens / grandTotal) * 100 : 0,
    }));
  }

  getDailyUsage(days: number): { date: string; promptTokens: number; completionTokens: number }[] {
    const dateLimit = new Date(Date.now() - days * 86400000).toISOString();
    const r = this.db.exec(`
      SELECT DATE(created_at) as date,
             SUM(prompt_tokens) as promptTokens,
             SUM(completion_tokens) as completionTokens
      FROM token_usage
      WHERE created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [dateLimit]);
    return mapRows<any>(r);
  }

  deleteByConversation(conversationId: string): void {
    this.db.run('DELETE FROM token_usage WHERE conversation_id = ?', [conversationId]);
  }
}

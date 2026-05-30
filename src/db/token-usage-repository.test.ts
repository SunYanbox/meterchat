import initSqlJs, { SqlJsStatic, Database } from 'sql.js';
import { createTables } from './schema';
import { TokenUsageRepository } from './token-usage-repository';

describe('TokenUsageRepository', () => {
  let SQL: SqlJsStatic;
  let db: Database;
  let repo: TokenUsageRepository;

  beforeAll(async () => {
    SQL = await initSqlJs();
  });

  beforeEach(() => {
    db = new SQL.Database();
    db.run('PRAGMA foreign_keys = ON');
    createTables(db);
    repo = new TokenUsageRepository(db);
    db.run("INSERT INTO conversations (id, title, system_prompt, created_at, updated_at) VALUES ('c1', 'Test', 'sys', 'now', 'now')");
    db.run("INSERT INTO messages (id, conversation_id, role, content, branch_id, created_at) VALUES ('m1', 'c1', 'user', 'hello', 'b1', 'now')");
    db.run("INSERT INTO messages (id, conversation_id, role, content, branch_id, created_at) VALUES ('m2', 'c1', 'assistant', 'hi', 'b1', 'now')");
  });

  afterEach(() => {
    db.close();
  });

  test('create inserts token usage record', () => {
    const usage = repo.create('m1', 'c1', 'deepseek-chat', 10, 20, 5, 5);
    expect(usage.prompt_tokens).toBe(10);
    expect(usage.completion_tokens).toBe(20);
  });

  test('getByConversation returns all records for a conversation', () => {
    repo.create('m1', 'c1', 'deepseek-chat', 10, 20, 5, 5);
    repo.create('m2', 'c1', 'deepseek-chat', 5, 10, 2, 3);
    const records = repo.getByConversation('c1');
    expect(records).toHaveLength(2);
  });

  test('getAggregates returns correct totals', () => {
    repo.create('m1', 'c1', 'deepseek-chat', 10, 20, 5, 5);
    repo.create('m2', 'c1', 'deepseek-chat', 5, 10, 2, 3);
    const aggr = repo.getAggregates();
    expect(aggr.totalPromptTokens).toBe(15);
    expect(aggr.totalCompletionTokens).toBe(30);
    expect(aggr.totalCacheHitTokens).toBe(7);
    expect(aggr.totalCacheMissTokens).toBe(8);
    expect(aggr.totalConversations).toBe(1);
  });

  test('getModelDistribution returns per-model breakdown', () => {
    repo.create('m1', 'c1', 'deepseek-chat', 100, 200, 50, 50);
    const dist = repo.getModelDistribution();
    expect(dist).toHaveLength(1);
    expect(dist[0].model).toBe('deepseek-chat');
    expect(dist[0].totalPromptTokens).toBe(100);
  });
});

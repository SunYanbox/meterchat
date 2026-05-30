import initSqlJs, { SqlJsStatic, Database } from 'sql.js';
import { createTables } from './schema';
import { ProviderRepository } from './provider-repository';

describe('ProviderRepository', () => {
  let SQL: SqlJsStatic;
  let db: Database;
  let repo: ProviderRepository;

  beforeAll(async () => {
    SQL = await initSqlJs();
  });

  beforeEach(() => {
    db = new SQL.Database();
    db.run('PRAGMA foreign_keys = ON');
    createTables(db);
    repo = new ProviderRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  test('createProvider creates a provider', () => {
    const provider = repo.createProvider('DeepSeek Official', 'https://api.deepseek.com/v1');
    expect(provider.name).toBe('DeepSeek Official');
    expect(provider.is_enabled).toBe(1);
  });

  test('getAllProviders returns all providers', () => {
    repo.createProvider('DeepSeek', 'https://api.deepseek.com/v1');
    repo.createProvider('SiliconFlow', 'https://api.siliconflow.cn/v1');
    expect(repo.getAllProviders()).toHaveLength(2);
  });

  test('setApiKey stores key', () => {
    const provider = repo.createProvider('DeepSeek', 'https://api.deepseek.com/v1');
    repo.setApiKey(provider.id, 'sk-encrypted-key', 'deepseek-chat', 0.7);
    const key = repo.getApiKey(provider.id);
    expect(key!.api_key).toBe('sk-encrypted-key');
    expect(key!.default_model).toBe('deepseek-chat');
    expect(key!.default_temperature).toBe(0.7);
  });

  test('deleteProvider removes provider and cascade deletes keys', () => {
    const provider = repo.createProvider('DeepSeek', 'https://api.deepseek.com/v1');
    repo.setApiKey(provider.id, 'sk-key', 'model', 0.7);
    repo.deleteProvider(provider.id);
    expect(repo.getAllProviders()).toHaveLength(0);
    expect(repo.getApiKey(provider.id)).toBeUndefined();
  });
});

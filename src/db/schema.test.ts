import initSqlJs, { SqlJsStatic, Database } from 'sql.js';
import { createTables, dropTables } from './schema';

describe('Database Schema', () => {
  let SQL: SqlJsStatic;
  let db: Database;

  beforeAll(async () => {
    SQL = await initSqlJs();
  });

  beforeEach(() => {
    db = new SQL.Database();
    db.run('PRAGMA foreign_keys = ON');
  });

  afterEach(() => {
    db.close();
  });

  function getTableNames(): string[] {
    const r = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    if (!r.length) return [];
    return r[0].values.map((v: any) => v[0] as string);
  }

  function getTableColumns(table: string): { name: string; type: string; pk: number }[] {
    const r = db.exec(`PRAGMA table_info('${table}')`);
    if (!r.length) return [];
    return r[0].values.map((v: any[]) => ({
      name: v[1] as string,
      type: v[2] as string,
      pk: v[5] as number,
    }));
  }

  function getForeignKeys(table: string): { table: string; from: string; to: string; on_delete: string }[] {
    const r = db.exec(`PRAGMA foreign_key_list('${table}')`);
    if (!r.length) return [];
    return r[0].values.map((v: any[]) => ({
      table: v[2] as string,
      from: v[3] as string,
      to: v[4] as string,
      on_delete: v[7] as string,
    }));
  }

  test('createTables creates all 6 required tables', () => {
    createTables(db);
    const tableNames = getTableNames();
    expect(tableNames).toEqual(
      expect.arrayContaining(['conversations', 'folders', 'messages', 'provider_keys', 'providers', 'token_usage'])
    );
  });

  test('folders table has correct schema', () => {
    createTables(db);
    const columns = getTableColumns('folders');
    expect(columns).toEqual([
      { name: 'id', type: 'TEXT', pk: 1 },
      { name: 'name', type: 'TEXT', pk: 0 },
      { name: 'sort_order', type: 'INTEGER', pk: 0 },
      { name: 'created_at', type: 'TEXT', pk: 0 },
      { name: 'updated_at', type: 'TEXT', pk: 0 },
    ]);
  });

  test('conversations table has correct schema with foreign key', () => {
    createTables(db);
    const columns = getTableColumns('conversations');
    expect(columns).toEqual([
      { name: 'id', type: 'TEXT', pk: 1 },
      { name: 'folder_id', type: 'TEXT', pk: 0 },
      { name: 'title', type: 'TEXT', pk: 0 },
      { name: 'system_prompt', type: 'TEXT', pk: 0 },
      { name: 'is_system_locked', type: 'INTEGER', pk: 0 },
      { name: 'created_at', type: 'TEXT', pk: 0 },
      { name: 'updated_at', type: 'TEXT', pk: 0 },
    ]);
    const fks = getForeignKeys('conversations');
    expect(fks).toContainEqual(
      expect.objectContaining({ table: 'folders', from: 'folder_id', to: 'id' })
    );
  });

  test('messages table has correct schema with foreign key', () => {
    createTables(db);
    const columns = getTableColumns('messages');
    expect(columns).toEqual([
      { name: 'id', type: 'TEXT', pk: 1 },
      { name: 'conversation_id', type: 'TEXT', pk: 0 },
      { name: 'role', type: 'TEXT', pk: 0 },
      { name: 'content', type: 'TEXT', pk: 0 },
      { name: 'model', type: 'TEXT', pk: 0 },
      { name: 'parent_id', type: 'TEXT', pk: 0 },
      { name: 'branch_id', type: 'TEXT', pk: 0 },
      { name: 'created_at', type: 'TEXT', pk: 0 },
    ]);
    const fks = getForeignKeys('messages');
    expect(fks).toContainEqual(
      expect.objectContaining({ table: 'conversations', from: 'conversation_id', to: 'id' })
    );
  });

  test('token_usage table has correct schema with foreign keys', () => {
    createTables(db);
    const columns = getTableColumns('token_usage');
    expect(columns).toEqual([
      { name: 'id', type: 'TEXT', pk: 1 },
      { name: 'message_id', type: 'TEXT', pk: 0 },
      { name: 'conversation_id', type: 'TEXT', pk: 0 },
      { name: 'model', type: 'TEXT', pk: 0 },
      { name: 'prompt_tokens', type: 'INTEGER', pk: 0 },
      { name: 'completion_tokens', type: 'INTEGER', pk: 0 },
      { name: 'prompt_cache_hit_tokens', type: 'INTEGER', pk: 0 },
      { name: 'prompt_cache_miss_tokens', type: 'INTEGER', pk: 0 },
      { name: 'created_at', type: 'TEXT', pk: 0 },
    ]);
    const fks = getForeignKeys('token_usage');
    expect(fks).toContainEqual(
      expect.objectContaining({ table: 'messages', from: 'message_id', to: 'id' })
    );
    expect(fks).toContainEqual(
      expect.objectContaining({ table: 'conversations', from: 'conversation_id', to: 'id' })
    );
  });

  test('providers table has correct schema', () => {
    createTables(db);
    const columns = getTableColumns('providers');
    expect(columns).toEqual([
      { name: 'id', type: 'TEXT', pk: 1 },
      { name: 'name', type: 'TEXT', pk: 0 },
      { name: 'base_url', type: 'TEXT', pk: 0 },
      { name: 'is_enabled', type: 'INTEGER', pk: 0 },
      { name: 'created_at', type: 'TEXT', pk: 0 },
    ]);
  });

  test('provider_keys table has correct schema with foreign key', () => {
    createTables(db);
    const columns = getTableColumns('provider_keys');
    expect(columns).toEqual([
      { name: 'id', type: 'TEXT', pk: 1 },
      { name: 'provider_id', type: 'TEXT', pk: 0 },
      { name: 'api_key', type: 'TEXT', pk: 0 },
      { name: 'default_temperature', type: 'REAL', pk: 0 },
      { name: 'default_model', type: 'TEXT', pk: 0 },
      { name: 'updated_at', type: 'TEXT', pk: 0 },
    ]);
    const fks = getForeignKeys('provider_keys');
    expect(fks).toContainEqual(
      expect.objectContaining({ table: 'providers', from: 'provider_id', to: 'id' })
    );
  });

  test('enforces CHECK constraint on messages.role', () => {
    createTables(db);
    db.run("INSERT INTO folders (id, name, created_at, updated_at) VALUES ('f1', 'Test', 'now', 'now')");
    db.run("INSERT INTO conversations (id, folder_id, title, created_at, updated_at) VALUES ('c1', 'f1', 'Test', 'now', 'now')");
    db.run("INSERT INTO messages (id, conversation_id, role, content, branch_id, created_at) VALUES ('m1', 'c1', 'user', 'hello', 'b1', 'now')");
    expect(() => {
      db.run("INSERT INTO messages (id, conversation_id, role, content, branch_id, created_at) VALUES ('m2', 'c1', 'invalid_role', 'hello', 'b1', 'now')");
    }).toThrow();
  });

  test('createTables is idempotent', () => {
    createTables(db);
    expect(() => createTables(db)).not.toThrow();
  });

  test('dropTables drops all tables', () => {
    createTables(db);
    dropTables(db);
    expect(getTableNames()).toHaveLength(0);
  });

  test('dropTables is idempotent', () => {
    createTables(db);
    dropTables(db);
    expect(() => dropTables(db)).not.toThrow();
  });

  test('insert and read back a folder record', () => {
    createTables(db);
    db.run("INSERT INTO folders (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      ['folder-1', 'My Folder', 1, '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z']);

    const r = db.exec("SELECT * FROM folders WHERE id = ?", ['folder-1']);
    expect(r.length).toBe(1);
    expect(r[0].values[0]).toEqual(['folder-1', 'My Folder', 1, '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z']);
  });
});

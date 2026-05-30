import initSqlJs, { SqlJsStatic, Database } from 'sql.js';
import { createTables } from './schema';
import { ConversationRepository } from './conversation-repository';

describe('ConversationRepository', () => {
  let SQL: SqlJsStatic;
  let db: Database;
  let repo: ConversationRepository;

  beforeAll(async () => {
    SQL = await initSqlJs();
  });

  beforeEach(() => {
    db = new SQL.Database();
    db.run('PRAGMA foreign_keys = ON');
    createTables(db);
    repo = new ConversationRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  test('createConversation creates a conversation in root', () => {
    const conv = repo.createConversation('My Chat', 'You are a helpful assistant.');
    expect(conv.title).toBe('My Chat');
    expect(conv.system_prompt).toBe('You are a helpful assistant.');
    expect(conv.folder_id).toBeNull();
    expect(conv.is_system_locked).toBe(0);
  });

  test('getRootConversations returns conversations with null folder_id', () => {
    repo.createConversation('Root Chat', 'sys');
    repo.createConversation('Another Root', 'sys');
    const rootConvs = repo.getRootConversations();
    expect(rootConvs).toHaveLength(2);
  });

  test('updateTitle changes conversation title', () => {
    const conv = repo.createConversation('Old Title', 'sys');
    const updated = repo.updateTitle(conv.id, 'New Title');
    expect(updated.title).toBe('New Title');
  });

  test('lockSystemPrompt sets is_system_locked to 1', () => {
    const conv = repo.createConversation('Test', 'sys');
    const updated = repo.lockSystemPrompt(conv.id);
    expect(updated.is_system_locked).toBe(1);
  });

  test('deleteConversation removes conversation', () => {
    const conv = repo.createConversation('Temp', 'sys');
    repo.deleteConversation(conv.id);
    expect(repo.getAllConversations()).toHaveLength(0);
  });
});

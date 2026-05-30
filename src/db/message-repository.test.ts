import initSqlJs, { SqlJsStatic, Database } from 'sql.js';
import { createTables } from './schema';
import { MessageRepository } from './message-repository';

describe('MessageRepository', () => {
  let SQL: SqlJsStatic;
  let db: Database;
  let repo: MessageRepository;
  let convId: string;

  beforeAll(async () => {
    SQL = await initSqlJs();
  });

  beforeEach(() => {
    db = new SQL.Database();
    db.run('PRAGMA foreign_keys = ON');
    createTables(db);
    repo = new MessageRepository(db);
    db.run("INSERT INTO conversations (id, title, system_prompt, created_at, updated_at) VALUES ('c1', 'Test', 'sys', 'now', 'now')");
    convId = 'c1';
  });

  afterEach(() => {
    db.close();
  });

  test('createRootMessage creates first message in a conversation', () => {
    const msg = repo.createRootMessage(convId, 'user', 'Hello');
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello');
    expect(msg.parent_id).toBeNull();
    expect(msg.branch_id).toBeTruthy();
  });

  test('createChildMessage creates a reply', () => {
    const root = repo.createRootMessage(convId, 'user', 'Hello');
    const reply = repo.createChildMessage(convId, 'assistant', 'Hi there!', 'deepseek-chat', root.id, root.branch_id);
    expect(reply.parent_id).toBe(root.id);
    expect(reply.branch_id).toBe(root.branch_id);
    expect(reply.model).toBe('deepseek-chat');
  });

  test('getBranchMessages returns messages in order', () => {
    const root = repo.createRootMessage(convId, 'user', 'Q1');
    repo.createChildMessage(convId, 'assistant', 'A1', 'model', root.id, root.branch_id);
    const msgs = repo.getBranchMessages(convId, root.branch_id);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].content).toBe('Q1');
    expect(msgs[1].content).toBe('A1');
  });

  test('createFork creates a new branch from a message', () => {
    const root = repo.createRootMessage(convId, 'user', 'Q1');
    const reply = repo.createChildMessage(convId, 'assistant', 'A1', 'model', root.id, root.branch_id);
    const forkMsg = repo.createFork(convId, reply.id, 'user', 'New question from fork');
    expect(forkMsg.parent_id).toBe(reply.id);
    expect(forkMsg.branch_id).not.toBe(reply.branch_id);
  });

  test('getBranches returns unique branch IDs for conversation', () => {
    const root = repo.createRootMessage(convId, 'user', 'Q1');
    repo.createChildMessage(convId, 'assistant', 'A1', 'model', root.id, root.branch_id);
    repo.createFork(convId, root.id, 'user', 'Fork Q');
    const branches = repo.getBranches(convId);
    expect(branches).toHaveLength(2);
  });

  test('deleteMessagesByConversation deletes all messages', () => {
    const root = repo.createRootMessage(convId, 'user', 'Q1');
    repo.createChildMessage(convId, 'assistant', 'A1', 'model', root.id, root.branch_id);
    repo.deleteMessagesByConversation(convId);
    expect(repo.getBranches(convId)).toHaveLength(0);
  });
});

import { Database } from 'sql.js';
import { mapRows } from './conversation-repository';

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string;
  parent_id: string | null;
  branch_id: string;
  created_at: string;
}

export class MessageRepository {
  constructor(private db: Database) {}

  private insert(id: string, conversationId: string, role: string, content: string, model: string, parentId: string | null, branchId: string): Message {
    const now = new Date().toISOString();
    this.db.run(
      'INSERT INTO messages (id, conversation_id, role, content, model, parent_id, branch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, conversationId, role, content, model, parentId, branchId, now]
    );
    return this.getById(id)!;
  }

  getById(id: string): Message | undefined {
    const r = this.db.exec('SELECT * FROM messages WHERE id = ?', [id]);
    if (!r.length || !r[0].values.length) return undefined;
    return mapRow<Message>(r[0].columns, r[0].values[0]);
  }

  createRootMessage(conversationId: string, role: string, content: string): Message {
    const branchId = crypto.randomUUID();
    return this.insert(crypto.randomUUID(), conversationId, role, content, '', null, branchId);
  }

  createChildMessage(conversationId: string, role: string, content: string, model: string, parentId: string, branchId: string): Message {
    return this.insert(crypto.randomUUID(), conversationId, role, content, model, parentId, branchId);
  }

  createFork(conversationId: string, parentId: string, role: string, content: string): Message {
    const newBranchId = crypto.randomUUID();
    return this.insert(crypto.randomUUID(), conversationId, role, content, '', parentId, newBranchId);
  }

  getBranchMessages(conversationId: string, branchId: string): Message[] {
    const r = this.db.exec(
      'SELECT * FROM messages WHERE conversation_id = ? AND branch_id = ? ORDER BY created_at ASC',
      [conversationId, branchId]
    );
    return mapRows<Message>(r);
  }

  getMessageChain(conversationId: string, branchId: string): Message[] {
    const lastMsg = this.db.exec(
      'SELECT * FROM messages WHERE conversation_id = ? AND branch_id = ? ORDER BY created_at DESC LIMIT 1',
      [conversationId, branchId]
    );
    if (!lastMsg.length || !lastMsg[0].values.length) return [];

    const ids: string[] = [lastMsg[0].values[0][0] as string];
    let current = mapRow<Message>(lastMsg[0].columns, lastMsg[0].values[0]);
    while (current.parent_id) {
      ids.unshift(current.parent_id);
      current = this.getById(current.parent_id)!;
    }

    const placeholders = ids.map(() => '?').join(',');
    const r = this.db.exec(
      `SELECT * FROM messages WHERE id IN (${placeholders}) ORDER BY created_at ASC`,
      ids
    );
    return mapRows<Message>(r);
  }

  getBranches(conversationId: string): string[] {
    const r = this.db.exec(
      'SELECT DISTINCT branch_id FROM messages WHERE conversation_id = ?',
      [conversationId]
    );
    if (!r.length) return [];
    return r[0].values.map(v => v[0] as string);
  }

  deleteMessagesByConversation(conversationId: string): void {
    this.db.run('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
  }
}

function mapRow<T>(columns: string[], row: any[]): T {
  const obj: any = {};
  columns.forEach((col, i) => { obj[col] = row[i]; });
  return obj as T;
}

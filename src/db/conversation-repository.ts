import { Database } from 'sql.js';

export interface Conversation {
  id: string;
  folder_id: string | null;
  title: string;
  system_prompt: string;
  is_system_locked: number;
  created_at: string;
  updated_at: string;
}

export class ConversationRepository {
  constructor(private db: Database) {}

  createConversation(title: string, systemPrompt: string, folderId?: string): Conversation {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db.run(
      'INSERT INTO conversations (id, folder_id, title, system_prompt, is_system_locked, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
      [id, folderId || null, title, systemPrompt, now, now]
    );
    return this.getById(id)!;
  }

  getById(id: string): Conversation | undefined {
    const r = this.db.exec('SELECT * FROM conversations WHERE id = ?', [id]);
    if (!r.length || !r[0].values.length) return undefined;
    return mapRow<Conversation>(r[0].columns, r[0].values[0]);
  }

  getAllConversations(): Conversation[] {
    const r = this.db.exec('SELECT * FROM conversations ORDER BY updated_at DESC');
    return mapRows<Conversation>(r);
  }

  getConversationsByFolder(folderId: string): Conversation[] {
    const r = this.db.exec('SELECT * FROM conversations WHERE folder_id = ? ORDER BY updated_at DESC', [folderId]);
    return mapRows<Conversation>(r);
  }

  getRootConversations(): Conversation[] {
    const r = this.db.exec('SELECT * FROM conversations WHERE folder_id IS NULL ORDER BY updated_at DESC');
    return mapRows<Conversation>(r);
  }

  updateTitle(id: string, title: string): Conversation {
    const now = new Date().toISOString();
    this.db.run('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?', [title, now, id]);
    return this.getById(id)!;
  }

  updateFolder(id: string, folderId: string | null): Conversation {
    const now = new Date().toISOString();
    this.db.run('UPDATE conversations SET folder_id = ?, updated_at = ? WHERE id = ?', [folderId, now, id]);
    return this.getById(id)!;
  }

  lockSystemPrompt(id: string): Conversation {
    this.db.run('UPDATE conversations SET is_system_locked = 1 WHERE id = ?', [id]);
    return this.getById(id)!;
  }

  deleteConversation(id: string): void {
    this.db.run('DELETE FROM conversations WHERE id = ?', [id]);
  }
}

function mapRow<T>(columns: string[], row: any[]): T {
  const obj: any = {};
  columns.forEach((col, i) => { obj[col] = row[i]; });
  return obj as T;
}

export function mapRows<T>(results: { columns: string[]; values: any[][] }[]): T[] {
  if (!results.length) return [];
  return results[0].values.map(row => mapRow<T>(results[0].columns, row));
}

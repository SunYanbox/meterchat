import { Database } from 'sql.js';

export interface Folder {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export class FolderRepository {
  constructor(private db: Database) {}

  createFolder(name: string, sortOrder: number = 0): Folder {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const params = [id, name, sortOrder, now, now];
    this.db.run(
      'INSERT INTO folders (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      params
    );
    return this.getById(id)!;
  }

  getById(id: string): Folder | undefined {
    const r = this.db.exec('SELECT * FROM folders WHERE id = ?', [id]);
    if (!r.length || !r[0].values.length) return undefined;
    const row = r[0].values[0] as any[];
    const cols = r[0].columns;
    return rowToObject<Folder>(cols, row);
  }

  getAllFolders(): Folder[] {
    const r = this.db.exec('SELECT * FROM folders ORDER BY sort_order ASC');
    return rowsToObjects<Folder>(r);
  }

  updateFolderName(id: string, name: string): Folder {
    const now = new Date().toISOString();
    this.db.run('UPDATE folders SET name = ?, updated_at = ? WHERE id = ?', [name, now, id]);
    return this.getById(id)!;
  }

  deleteFolder(id: string): void {
    this.db.run('DELETE FROM folders WHERE id = ?', [id]);
  }
}

function rowToObject<T>(cols: string[], row: any[]): T {
  const obj: any = {};
  cols.forEach((col, i) => { obj[col] = row[i]; });
  return obj as T;
}

function rowsToObjects<T>(results: { columns: string[]; values: any[][] }[]): T[] {
  if (!results.length) return [];
  return results[0].values.map(row => rowToObject<T>(results[0].columns, row));
}

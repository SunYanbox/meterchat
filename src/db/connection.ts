import initSqlJs, { SqlJsStatic, Database } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  return SQL;
}

export async function getDatabase(): Promise<Database> {
  if (db) return db;

  let dbPath: string;
  try {
    const { app } = require('electron');
    dbPath = path.join(app.getPath('userData'), 'meterchat.db');
  } catch {
    dbPath = path.join(process.cwd(), 'meterchat.db');
  }

  const sql = await getSqlJs();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new sql.Database(buffer);
  } else {
    db = new sql.Database();
  }

  (db as any).__dbPath = dbPath;
  return db;
}

export function closeDatabase(): void {
  if (db) {
    const dbPath = (db as any).__dbPath;
    const data = db.export();
    const buffer = Buffer.from(data);
    if (dbPath) {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(dbPath, buffer);
    }
    db.close();
    db = null;
  }
}

export async function createTestDatabase(): Promise<Database> {
  const sql = await getSqlJs();
  const testDb = new sql.Database();
  testDb.run('PRAGMA foreign_keys = ON');
  return testDb;
}

export function rowsToObjects(results: { columns: string[]; values: any[][] }[]): Record<string, any>[] {
  if (!results || results.length === 0) return [];
  return results[0].values.map(row =>
    results[0].columns.reduce((obj, col, i) => {
      obj[col] = row[i];
      return obj;
    }, {} as Record<string, any>)
  );
}

export function rowToObject(results: { columns: string[]; values: any[][] }[]): Record<string, any> | undefined {
  if (!results || results.length === 0 || results[0].values.length === 0) return undefined;
  return rowsToObjects(results)[0];
}

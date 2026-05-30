import initSqlJs, { SqlJsStatic, Database } from 'sql.js';
import { createTables } from './schema';
import { FolderRepository } from './folder-repository';

describe('FolderRepository', () => {
  let SQL: SqlJsStatic;
  let db: Database;
  let repo: FolderRepository;

  beforeAll(async () => {
    SQL = await initSqlJs();
  });

  beforeEach(() => {
    db = new SQL.Database();
    db.run('PRAGMA foreign_keys = ON');
    createTables(db);
    repo = new FolderRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  test('createFolder inserts a folder and returns it', () => {
    const folder = repo.createFolder('Work');
    expect(folder.name).toBe('Work');
    expect(folder.sort_order).toBe(0);
    expect(folder.id).toBeTruthy();
  });

  test('getAllFolders returns all folders ordered by sort_order', () => {
    repo.createFolder('Z Folder', 2);
    repo.createFolder('A Folder', 1);
    repo.createFolder('B Folder', 0);
    const folders = repo.getAllFolders();
    expect(folders).toHaveLength(3);
    expect(folders[0].name).toBe('B Folder');
    expect(folders[1].name).toBe('A Folder');
    expect(folders[2].name).toBe('Z Folder');
  });

  test('updateFolderName changes folder name', () => {
    const folder = repo.createFolder('Old Name');
    const updated = repo.updateFolderName(folder.id, 'New Name');
    expect(updated.name).toBe('New Name');
  });

  test('deleteFolder removes a folder', () => {
    const folder = repo.createFolder('Temp');
    repo.deleteFolder(folder.id);
    expect(repo.getAllFolders()).toHaveLength(0);
  });
});

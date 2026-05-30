import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { Database } from 'sql.js';
import { getDatabase, closeDatabase } from '../src/db/connection';
import { createTables } from '../src/db/schema';

let mainWindow: BrowserWindow | null = null;
let db: Database | null = null;

async function initDatabase(): Promise<void> {
  db = await getDatabase();
  createTables(db);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'MeterChat',
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'static', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handlers for database operations
ipcMain.handle('db:execute', (_event, query: string, params: any[]) => {
  if (!db) throw new Error('Database not initialized');
  db.run(query, params || []);
  return { success: true };
});

ipcMain.handle('db:get', (_event, query: string, params: any[]) => {
  if (!db) throw new Error('Database not initialized');
  const r = db.exec(query, params || []);
  if (!r.length || !r[0].values.length) return undefined;
  const row = r[0].values[0];
  const obj: Record<string, any> = {};
  r[0].columns.forEach((col, i) => { obj[col] = row[i]; });
  return obj;
});

ipcMain.handle('db:getAll', (_event, query: string, params: any[]) => {
  if (!db) throw new Error('Database not initialized');
  const r = db.exec(query, params || []);
  if (!r.length) return [];
  return r[0].values.map(row => {
    const obj: Record<string, any> = {};
    r[0].columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
});

// API streaming IPC handler
ipcMain.handle('api:send', async (event, { baseUrl, apiKey, body }) => {
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      event.sender.send('api:error', { status: response.status, body: errorText });
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let usage: any = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content || '';
          if (content) {
            event.sender.send('api:chunk', content);
          }
          if (parsed.usage) {
            usage = parsed.usage;
          }
        } catch { /* skip parse errors */ }
      }
    }

    reader.releaseLock();
    event.sender.send('api:done', usage || {});
  } catch (err: any) {
    event.sender.send('api:error', { message: err.message || 'Network error' });
  }
});

// Encryption IPC handlers
ipcMain.handle('encrypt:encrypt', (_event, plaintext: string) => {
  const { encrypt } = require('../src/encryption/crypto-utils');
  return encrypt(plaintext);
});

ipcMain.handle('encrypt:decrypt', (_event, ciphertext: string) => {
  const { decrypt } = require('../src/encryption/crypto-utils');
  return decrypt(ciphertext);
});

app.whenReady().then(async () => {
  await initDatabase();
  createWindow();
});

app.on('window-all-closed', () => {
  closeDatabase();
  db = null;
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

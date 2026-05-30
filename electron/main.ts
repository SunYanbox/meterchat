import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;

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
ipcMain.handle('db:execute', (_event, query: string, params?: unknown[]) => {
  const { getDatabase } = require('./src/db/connection');
  const db = getDatabase();
  return db.prepare(query).run(...(params || []));
});

ipcMain.handle('db:get', (_event, query: string, params?: unknown[]) => {
  const { getDatabase } = require('./src/db/connection');
  const db = getDatabase();
  return db.prepare(query).get(...(params || []));
});

ipcMain.handle('db:getAll', (_event, query: string, params?: unknown[]) => {
  const { getDatabase } = require('./src/db/connection');
  const db = getDatabase();
  return db.prepare(query).all(...(params || []));
});

// Encryption IPC handlers
ipcMain.handle('encrypt:encrypt', (_event, plaintext: string) => {
  const { encrypt } = require('./src/encryption/crypto-utils');
  return encrypt(plaintext);
});

ipcMain.handle('encrypt:decrypt', (_event, ciphertext: string) => {
  const { decrypt } = require('./src/encryption/crypto-utils');
  return decrypt(ciphertext);
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  db: {
    execute: (query: string, params?: unknown[]) => ipcRenderer.invoke('db:execute', query, params),
    get: (query: string, params?: unknown[]) => ipcRenderer.invoke('db:get', query, params),
    getAll: (query: string, params?: unknown[]) => ipcRenderer.invoke('db:getAll', query, params),
  },
  encrypt: {
    encrypt: (plaintext: string) => ipcRenderer.invoke('encrypt:encrypt', plaintext),
    decrypt: (ciphertext: string) => ipcRenderer.invoke('encrypt:decrypt', ciphertext),
  },
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
});

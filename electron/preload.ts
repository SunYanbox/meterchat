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
  api: {
    send: (params: { baseUrl: string; apiKey: string; body: any }, callbacks: {
      onChunk?: (text: string) => void;
      onDone?: (usage: any) => void;
      onError?: (err: any) => void;
    }) => {
      const { onChunk, onDone, onError } = callbacks;

      const cleanup = () => {
        ipcRenderer.removeAllListeners('api:chunk');
        ipcRenderer.removeAllListeners('api:done');
        ipcRenderer.removeAllListeners('api:error');
      };

      ipcRenderer.on('api:chunk', (_event, chunk: string) => {
        onChunk?.(chunk);
      });

      ipcRenderer.on('api:done', (_event, usage: any) => {
        onDone?.(usage);
        cleanup();
      });

      ipcRenderer.on('api:error', (_event, err: any) => {
        onError?.(err);
        cleanup();
      });

      ipcRenderer.invoke('api:send', params);
    },
  },
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
});

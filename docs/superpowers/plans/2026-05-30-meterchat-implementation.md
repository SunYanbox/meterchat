# MeterChat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build MeterChat, an Electron-based local chat desktop app with session management, message forking, token statistics, and encrypted API key storage.

**Architecture:** Electron main process manages window lifecycle; all business logic runs in the renderer process with Node.js access via preload script. SQLite (better-sqlite3) for local storage, Chart.js for dashboard visualization, AES-256-GCM for API key encryption. Pure HTML/CSS/TypeScript with manual DOM manipulation.

**Tech Stack:** Electron ^33.x, TypeScript ^5.x, better-sqlite3 ^11.x, Chart.js ^4.x, electron-builder ^25.x, Node.js crypto (built-in)

**Development Workflow:**
- Each phase = feature branch from `develop` → PR (squash merge) to `develop`
- After all phases complete: PR from `develop` → `main`
- TDD (Red-Green-Refactor) strictly followed

---

## Phase 1: Project Scaffold & Build Configuration

### Task 1.1: Initialize project with package.json and tsconfig

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "meterchat",
  "version": "1.0.0",
  "description": "Local chat desktop app with OpenAI-compatible API support",
  "main": "dist/electron/main.js",
  "scripts": {
    "build": "tsc",
    "start": "npm run build && electron .",
    "dev": "tsc && electron .",
    "test": "node --experimental-vm-modules node_modules/.bin/jest",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "better-sqlite3": "^11.7.0",
    "chart.js": "^4.4.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.0",
    "@types/jest": "^29.5.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022", "DOM"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "moduleResolution": "node"
  },
  "include": [
    "electron/**/*",
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts"
  ]
}
```

- [ ] **Step 3: Create jest.config.js**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/renderer.ts',
    '!src/ui/**/*.ts'
  ],
};
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
*.db
*.db-journal
.env
```

- [ ] **Step 5: Install dependencies and verify build**

Run: `cd /path/to/project && npm install`
Expected: All packages installed without errors

Run: `npx tsc --noEmit`
Expected: No compilation errors (or expected errors about missing source files which will be created in later phases)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: initialize project scaffold with TypeScript and dependencies"
```

---

### Task 1.2: Create Electron main process and preload script

**Files:**
- Create: `electron/main.ts`
- Create: `electron/preload.ts`

- [ ] **Step 1: Write Electron main process**

```typescript
import { app, BrowserWindow } from 'electron';
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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
```

- [ ] **Step 2: Write preload script**

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Database operations
  db: {
    execute: (query: string, params?: unknown[]) => ipcRenderer.invoke('db:execute', query, params),
    get: (query: string, params?: unknown[]) => ipcRenderer.invoke('db:get', query, params),
    getAll: (query: string, params?: unknown[]) => ipcRenderer.invoke('db:getAll', query, params),
  },
  // Encryption operations
  encrypt: {
    encrypt: (plaintext: string) => ipcRenderer.invoke('encrypt:encrypt', plaintext),
    decrypt: (ciphertext: string) => ipcRenderer.invoke('encrypt:decrypt', ciphertext),
  },
  // App info
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
});
```

- [ ] **Step 3: Run build to verify compilation**

Run: `npx tsc --noEmit`
Expected: TypeScript compilation succeeds

- [ ] **Step 4: Commit**

```bash
git add electron/ package.json tsconfig.json jest.config.js .gitignore
git commit -m "feat: add Electron main process and preload script"
```

---

### Task 1.3: Create static HTML entry point and CSS structure

**Files:**
- Create: `static/index.html`
- Create: `static/styles.css`

- [ ] **Step 1: Create static/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';">
  <title>MeterChat</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app">
    <aside id="sidebar">
      <div id="search-container">
        <input type="text" id="search-input" placeholder="Search conversations...">
      </div>
      <nav id="folder-tree"></nav>
      <div id="sidebar-footer">
        <button id="new-conversation-btn">+ New Conversation</button>
        <button id="dashboard-btn">Dashboard</button>
      </div>
    </aside>
    <main id="main-content">
      <div id="conversation-view">
        <div id="conversation-header">
          <h2 id="conversation-title" contenteditable="false">Conversation</h2>
          <div id="branch-switcher"></div>
        </div>
        <div id="system-prompt-banner"></div>
        <div id="message-list"></div>
        <div id="input-area">
          <textarea id="message-input" placeholder="Type your message..." rows="3"></textarea>
          <button id="send-btn">Send</button>
        </div>
      </div>
      <div id="new-conversation-view" class="hidden">
        <div id="new-conversation-form">
          <label for="system-prompt-input">System Prompt</label>
          <textarea id="system-prompt-input" rows="4">You are a helpful assistant.</textarea>
          <label for="first-message-input">Message</label>
          <textarea id="first-message-input" rows="4" placeholder="Type your first message..."></textarea>
          <button id="start-conversation-btn">Start Conversation</button>
        </div>
      </div>
      <div id="dashboard-view" class="hidden">
        <div id="dashboard-header">
          <h2>Dashboard</h2>
          <button id="back-to-conversation-btn">Back to Conversation</button>
        </div>
        <div id="dashboard-stats"></div>
        <div id="dashboard-charts">
          <div class="chart-container"><canvas id="pie-chart"></canvas></div>
          <div class="chart-container"><canvas id="line-chart"></canvas></div>
        </div>
        <div id="dashboard-details"></div>
      </div>
    </main>
  </div>
  <script src="../dist/src/renderer.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create static/styles.css**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --sidebar-width: 260px;
  --bg-primary: #1e1e2e;
  --bg-secondary: #181825;
  --bg-surface: #313244;
  --text-primary: #cdd6f4;
  --text-secondary: #a6adc8;
  --text-muted: #6c7086;
  --accent: #89b4fa;
  --accent-hover: #74c7ec;
  --border: #45475a;
  --danger: #f38ba8;
  --success: #a6e3a1;
  --warning: #f9e2af;
  --system-prompt-bg: #313244;
  --user-bubble: #89b4fa;
  --assistant-bubble: #313244;
  --hover-bg: #313244;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  height: 100vh;
  overflow: hidden;
}

#app {
  display: flex;
  height: 100vh;
}

/* Sidebar */
#sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
}

#search-container {
  padding: 12px;
}

#search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}

#search-input:focus {
  border-color: var(--accent);
}

#folder-tree {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px;
}

#sidebar-footer {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid var(--border);
}

#sidebar-footer button {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
}

#sidebar-footer button:hover {
  background: var(--accent);
  color: var(--bg-primary);
  border-color: var(--accent);
}

/* Main Content */
#main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Conversation View */
#conversation-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

#conversation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
}

#conversation-title {
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

#conversation-title:hover {
  background: var(--hover-bg);
}

#conversation-title[contenteditable="true"] {
  background: var(--bg-surface);
  outline: 1px solid var(--accent);
}

/* System Prompt Banner */
#system-prompt-banner {
  padding: 10px 20px;
  background: var(--system-prompt-bg);
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  color: var(--text-secondary);
  font-style: italic;
}

/* Message List */
#message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.5;
  position: relative;
  word-wrap: break-word;
}

.message.user {
  align-self: flex-end;
  background: var(--user-bubble);
  color: var(--bg-primary);
}

.message.assistant {
  align-self: flex-start;
  background: var(--assistant-bubble);
  border: 1px solid var(--border);
}

.message .message-header {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
  display: flex;
  justify-content: space-between;
}

.message .fork-btn {
  display: none;
  position: absolute;
  right: -36px;
  top: 50%;
  transform: translateY(-50%);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  font-size: 11px;
  color: var(--text-muted);
}

.message:hover .fork-btn {
  display: block;
}

.message .fork-btn:hover {
  background: var(--accent);
  color: var(--bg-primary);
}

/* Input Area */
#input-area {
  display: flex;
  padding: 12px 20px;
  gap: 10px;
  border-top: 1px solid var(--border);
  background: var(--bg-secondary);
}

#message-input {
  flex: 1;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 14px;
  resize: none;
  outline: none;
  font-family: inherit;
}

#message-input:focus {
  border-color: var(--accent);
}

#send-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: var(--bg-primary);
  font-size: 14px;
  cursor: pointer;
  font-weight: 600;
  align-self: flex-end;
  transition: background 0.15s;
}

#send-btn:hover {
  background: var(--accent-hover);
}

#send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* New Conversation View */
#new-conversation-view {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}

#new-conversation-form {
  width: 600px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px;
  background: var(--bg-surface);
  border-radius: 12px;
}

#new-conversation-form label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 600;
}

#new-conversation-form textarea {
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
  resize: vertical;
  outline: none;
  font-family: inherit;
}

#new-conversation-form textarea:focus {
  border-color: var(--accent);
}

#start-conversation-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: var(--bg-primary);
  font-size: 14px;
  cursor: pointer;
  font-weight: 600;
}

#start-conversation-btn:hover {
  background: var(--accent-hover);
}

/* Dashboard View */
#dashboard-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
  overflow-y: auto;
}

#dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

#dashboard-header h2 {
  font-size: 20px;
}

#back-to-conversation-btn {
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-primary);
  cursor: pointer;
}

#back-to-conversation-btn:hover {
  background: var(--hover-bg);
}

#dashboard-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  background: var(--bg-surface);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.stat-card .stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--accent);
}

.stat-card .stat-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

#dashboard-charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

.chart-container {
  background: var(--bg-surface);
  border-radius: 8px;
  padding: 16px;
  height: 250px;
}

/* Branch Switcher */
#branch-switcher {
  position: relative;
}

#branch-switcher-btn {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
}

#branch-switcher-btn:hover {
  background: var(--hover-bg);
}

#branch-dropdown {
  display: none;
  position: absolute;
  top: 100%;
  right: 0;
  width: 280px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  z-index: 100;
  margin-top: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

#branch-dropdown.open {
  display: block;
}

.branch-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
}

.branch-item:last-child {
  border-bottom: none;
}

.branch-item:hover {
  background: var(--hover-bg);
}

.branch-item.active {
  background: var(--accent);
  color: var(--bg-primary);
}

.branch-tokens {
  font-size: 11px;
  color: var(--text-muted);
}

/* Folder Tree */
.folder-item {
  padding: 6px 8px;
  cursor: pointer;
  font-size: 13px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
}

.folder-item:hover {
  background: var(--hover-bg);
}

.folder-item .folder-toggle {
  width: 16px;
  text-align: center;
  font-size: 10px;
}

.folder-children {
  margin-left: 16px;
}

.conversation-item {
  padding: 6px 8px 6px 24px;
  cursor: pointer;
  font-size: 13px;
  border-radius: 4px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.conversation-item:hover {
  background: var(--hover-bg);
}

.conversation-item.active {
  color: var(--accent);
  background: var(--hover-bg);
}

/* Hidden utility */
.hidden {
  display: none !important;
}

/* Context Menu */
.context-menu {
  position: fixed;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  z-index: 200;
  min-width: 160px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.context-menu-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
}

.context-menu-item:hover {
  background: var(--hover-bg);
}

.context-menu-item.danger {
  color: var(--danger);
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

/* Token usage summary in conversation */
.token-summary {
  font-size: 11px;
  color: var(--text-muted);
  padding: 4px 20px;
  text-align: right;
  border-top: 1px solid var(--border);
  background: var(--bg-secondary);
}
```

- [ ] **Step 3: Commit**

```bash
git add static/
git commit -m "feat: add HTML entry point and complete CSS styles"
```

---

## Phase 2: Database Layer (TDD)

### Task 2.1: Create database schema and connection module

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/connection.ts`
- Create: `src/db/schema.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/db/schema.test.ts
import { createTables, dropTables } from './schema';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

describe('Database Schema', () => {
  const testDbPath = path.join(__dirname, '..', '..', 'test-meterchat.db');
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new Database(testDbPath);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test('createTables creates all required tables', () => {
    createTables(db);

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[];
    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('folders');
    expect(tableNames).toContain('conversations');
    expect(tableNames).toContain('messages');
    expect(tableNames).toContain('token_usage');
    expect(tableNames).toContain('providers');
    expect(tableNames).toContain('provider_keys');
  });

  test('folders table has correct schema', () => {
    createTables(db);
    const columns = db.prepare("PRAGMA table_info('folders')").all() as any[];
    const colNames = columns.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('name');
    expect(colNames).toContain('sort_order');
    expect(colNames).toContain('created_at');
    expect(colNames).toContain('updated_at');
  });

  test('conversations table has correct schema', () => {
    createTables(db);
    const columns = db.prepare("PRAGMA table_info('conversations')").all() as any[];
    const colNames = columns.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('folder_id');
    expect(colNames).toContain('title');
    expect(colNames).toContain('system_prompt');
    expect(colNames).toContain('is_system_locked');
    expect(colNames).toContain('created_at');
    expect(colNames).toContain('updated_at');
  });

  test('messages table has correct schema', () => {
    createTables(db);
    const columns = db.prepare("PRAGMA table_info('messages')").all() as any[];
    const colNames = columns.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('conversation_id');
    expect(colNames).toContain('role');
    expect(colNames).toContain('content');
    expect(colNames).toContain('model');
    expect(colNames).toContain('parent_id');
    expect(colNames).toContain('branch_id');
    expect(colNames).toContain('created_at');
  });

  test('token_usage table has correct schema', () => {
    createTables(db);
    const columns = db.prepare("PRAGMA table_info('token_usage')").all() as any[];
    const colNames = columns.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('message_id');
    expect(colNames).toContain('conversation_id');
    expect(colNames).toContain('model');
    expect(colNames).toContain('prompt_tokens');
    expect(colNames).toContain('completion_tokens');
    expect(colNames).toContain('prompt_cache_hit_tokens');
    expect(colNames).toContain('prompt_cache_miss_tokens');
    expect(colNames).toContain('created_at');
  });

  test('providers table has correct schema', () => {
    createTables(db);
    const columns = db.prepare("PRAGMA table_info('providers')").all() as any[];
    const colNames = columns.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('name');
    expect(colNames).toContain('base_url');
    expect(colNames).toContain('is_enabled');
    expect(colNames).toContain('created_at');
  });

  test('provider_keys table has correct schema', () => {
    createTables(db);
    const columns = db.prepare("PRAGMA table_info('provider_keys')").all() as any[];
    const colNames = columns.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('provider_id');
    expect(colNames).toContain('api_key');
    expect(colNames).toContain('default_temperature');
    expect(colNames).toContain('default_model');
    expect(colNames).toContain('updated_at');
  });

  test('conversations table has foreign key to folders', () => {
    createTables(db);
    const foreignKeys = db.prepare("PRAGMA foreign_key_list('conversations')").all() as any[];
    const folderFk = foreignKeys.find(fk => fk.table === 'folders');
    expect(folderFk).toBeDefined();
  });

  test('insert and select folder works', () => {
    createTables(db);
    const id = 'test-folder-id';
    db.prepare('INSERT INTO folders (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, 'Test Folder', 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    const row = db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as any;
    expect(row.name).toBe('Test Folder');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/db/schema.test.ts --no-coverage`
Expected: FAIL - import errors (schema module doesn't exist yet)

- [ ] **Step 3: Write schema implementation**

```typescript
// src/db/schema.ts
import Database from 'better-sqlite3';

export function createTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      folder_id TEXT,
      title TEXT NOT NULL DEFAULT '',
      system_prompt TEXT NOT NULL DEFAULT 'You are a helpful assistant.',
      is_system_locked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      model TEXT DEFAULT '',
      parent_id TEXT,
      branch_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS token_usage (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT '',
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      prompt_cache_hit_tokens INTEGER NOT NULL DEFAULT 0,
      prompt_cache_miss_tokens INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS provider_keys (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      api_key TEXT NOT NULL,
      default_temperature REAL NOT NULL DEFAULT 0.7,
      default_model TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
    );

    -- Enable foreign keys
    db.pragma('foreign_keys = ON');
  `);
}

export function dropTables(db: Database.Database): void {
  db.exec(`
    DROP TABLE IF EXISTS provider_keys;
    DROP TABLE IF EXISTS providers;
    DROP TABLE IF EXISTS token_usage;
    DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS conversations;
    DROP TABLE IF EXISTS folders;
  `);
}
```

- [ ] **Step 4: Create connection module**

```typescript
// src/db/connection.ts
import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) return db;

  const dbPath = path.join(app.getPath('userData'), 'meterchat.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// For testing: create an in-memory database
export function createTestDatabase(): Database.Database {
  const testDb = new Database(':memory:');
  testDb.pragma('foreign_keys = ON');
  return testDb;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/db/schema.test.ts --no-coverage`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/db/
git commit -m "feat: implement database schema and connection module"
```

---

### Task 2.2: Create folder repository

**Files:**
- Create: `src/db/folder-repository.ts`
- Create: `src/db/folder-repository.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/db/folder-repository.test.ts
import Database from 'better-sqlite3';
import { createTables } from './schema';
import { FolderRepository } from './folder-repository';

describe('FolderRepository', () => {
  let db: Database.Database;
  let repo: FolderRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
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
    expect(folder.id).toBeDefined();
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
    const folders = repo.getAllFolders();
    expect(folders).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/db/folder-repository.test.ts --no-coverage`
Expected: FAIL

- [ ] **Step 3: Write folder repository implementation**

```typescript
// src/db/folder-repository.ts
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export interface Folder {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export class FolderRepository {
  constructor(private db: Database.Database) {}

  createFolder(name: string, sortOrder: number = 0): Folder {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO folders (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, name, sortOrder, now, now);
    return this.getById(id)!;
  }

  getById(id: string): Folder | undefined {
    return this.db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as Folder | undefined;
  }

  getAllFolders(): Folder[] {
    return this.db.prepare('SELECT * FROM folders ORDER BY sort_order ASC').all() as Folder[];
  }

  updateFolderName(id: string, name: string): Folder {
    const now = new Date().toISOString();
    this.db.prepare('UPDATE folders SET name = ?, updated_at = ? WHERE id = ?').run(name, now, id);
    return this.getById(id)!;
  }

  deleteFolder(id: string): void {
    this.db.prepare('DELETE FROM folders WHERE id = ?').run(id);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/db/folder-repository.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/folder-repository.ts src/db/folder-repository.test.ts
git commit -m "feat: implement folder repository with CRUD operations"
```

---

### Task 2.3: Create conversation repository

**Files:**
- Create: `src/db/conversation-repository.ts`
- Create: `src/db/conversation-repository.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/db/conversation-repository.test.ts
import Database from 'better-sqlite3';
import { createTables } from './schema';
import { ConversationRepository } from './conversation-repository';
import { FolderRepository } from './folder-repository';

describe('ConversationRepository', () => {
  let db: Database.Database;
  let repo: ConversationRepository;
  let folderRepo: FolderRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    createTables(db);
    repo = new ConversationRepository(db);
    folderRepo = new FolderRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  test('createConversation creates a conversation in root', () => {
    const conv = repo.createConversation('My Chat', 'You are a helpful assistant.');
    expect(conv.title).toBe('My Chat');
    expect(conv.system_prompt).toBe('You are a helpful assistant.');
    expect(conv.folder_id).toBeNull();
    expect(conv.is_system_locked).toBe(0);
  });

  test('createConversation in a folder', () => {
    const folder = folderRepo.createFolder('Work');
    const conv = repo.createConversation('Work Chat', 'You are helpful.', folder.id);
    expect(conv.folder_id).toBe(folder.id);
  });

  test('getConversationsByFolder returns conversations in a folder', () => {
    const folder = folderRepo.createFolder('Work');
    repo.createConversation('Chat 1', 'sys', folder.id);
    repo.createConversation('Chat 2', 'sys', folder.id);
    const convs = repo.getConversationsByFolder(folder.id);
    expect(convs).toHaveLength(2);
  });

  test('getRootConversations returns conversations with null folder_id', () => {
    repo.createConversation('Root Chat', 'sys');
    repo.createConversation('Another Root', 'sys');
    const folder = folderRepo.createFolder('Work');
    repo.createConversation('Folder Chat', 'sys', folder.id);
    const rootConvs = repo.getRootConversations();
    expect(rootConvs).toHaveLength(2);
  });

  test('updateTitle changes conversation title', () => {
    const conv = repo.createConversation('Old Title', 'sys');
    const updated = repo.updateTitle(conv.id, 'New Title');
    expect(updated.title).toBe('New Title');
  });

  test('lockSystemPrompt sets is_system_locked to 1', () => {
    const conv = repo.createConversation('Test', 'sys');
    const updated = repo.lockSystemPrompt(conv.id);
    expect(updated.is_system_locked).toBe(1);
  });

  test('deleteConversation removes conversation', () => {
    const conv = repo.createConversation('Temp', 'sys');
    repo.deleteConversation(conv.id);
    const all = repo.getAllConversations();
    expect(all).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/db/conversation-repository.test.ts --no-coverage`
Expected: FAIL

- [ ] **Step 3: Write conversation repository implementation**

```typescript
// src/db/conversation-repository.ts
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

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
  constructor(private db: Database.Database) {}

  createConversation(title: string, systemPrompt: string, folderId?: string): Conversation {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO conversations (id, folder_id, title, system_prompt, is_system_locked, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)'
    ).run(id, folderId || null, title, systemPrompt, now, now);
    return this.getById(id)!;
  }

  getById(id: string): Conversation | undefined {
    return this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Conversation | undefined;
  }

  getAllConversations(): Conversation[] {
    return this.db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all() as Conversation[];
  }

  getConversationsByFolder(folderId: string): Conversation[] {
    return this.db.prepare('SELECT * FROM conversations WHERE folder_id = ? ORDER BY updated_at DESC').all(folderId) as Conversation[];
  }

  getRootConversations(): Conversation[] {
    return this.db.prepare('SELECT * FROM conversations WHERE folder_id IS NULL ORDER BY updated_at DESC').all() as Conversation[];
  }

  updateTitle(id: string, title: string): Conversation {
    const now = new Date().toISOString();
    this.db.prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?').run(title, now, id);
    return this.getById(id)!;
  }

  updateFolder(id: string, folderId: string | null): Conversation {
    const now = new Date().toISOString();
    this.db.prepare('UPDATE conversations SET folder_id = ?, updated_at = ? WHERE id = ?').run(folderId, now, id);
    return this.getById(id)!;
  }

  lockSystemPrompt(id: string): Conversation {
    this.db.prepare('UPDATE conversations SET is_system_locked = 1 WHERE id = ?').run(id);
    return this.getById(id)!;
  }

  deleteConversation(id: string): void {
    this.db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/db/conversation-repository.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/conversation-repository.ts src/db/conversation-repository.test.ts
git commit -m "feat: implement conversation repository with CRUD operations"
```

---

### Task 2.4: Create message repository (with branch support)

**Files:**
- Create: `src/db/message-repository.ts`
- Create: `src/db/message-repository.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/db/message-repository.test.ts
import Database from 'better-sqlite3';
import { createTables } from './schema';
import { MessageRepository } from './message-repository';
import { ConversationRepository } from './conversation-repository';

describe('MessageRepository', () => {
  let db: Database.Database;
  let repo: MessageRepository;
  let convRepo: ConversationRepository;
  let convId: string;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    createTables(db);
    repo = new MessageRepository(db);
    convRepo = new ConversationRepository(db);
    const conv = convRepo.createConversation('Test', 'You are a helpful assistant.');
    convId = conv.id;
  });

  afterEach(() => {
    db.close();
  });

  test('createRootMessage creates first message in a conversation', () => {
    const msg = repo.createRootMessage(convId, 'user', 'Hello');
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello');
    expect(msg.parent_id).toBeNull();
    expect(msg.branch_id).toBeDefined();
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
    const reply = repo.createChildMessage(convId, 'assistant', 'A1', 'model', root.id, root.branch_id);
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
    const reply = repo.createChildMessage(convId, 'assistant', 'A1', 'model', root.id, root.branch_id);
    repo.deleteMessagesByConversation(convId);
    const msgs = repo.getBranchMessages(convId, root.branch_id);
    expect(msgs).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/db/message-repository.test.ts --no-coverage`
Expected: FAIL

- [ ] **Step 3: Write message repository implementation**

```typescript
// src/db/message-repository.ts
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

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
  constructor(private db: Database.Database) {}

  private insert(id: string, conversationId: string, role: string, content: string, model: string, parentId: string | null, branchId: string): Message {
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, model, parent_id, branch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, conversationId, role, content, model, parentId, branchId, now);
    return this.getById(id)!;
  }

  getById(id: string): Message | undefined {
    return this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Message | undefined;
  }

  createRootMessage(conversationId: string, role: string, content: string): Message {
    const branchId = randomUUID();
    return this.insert(randomUUID(), conversationId, role, content, '', null, branchId);
  }

  createChildMessage(conversationId: string, role: string, content: string, model: string, parentId: string, branchId: string): Message {
    return this.insert(randomUUID(), conversationId, role, content, model, parentId, branchId);
  }

  createFork(conversationId: string, parentId: string, role: string, content: string): Message {
    const newBranchId = randomUUID();
    return this.insert(randomUUID(), conversationId, role, content, '', parentId, newBranchId);
  }

  getBranchMessages(conversationId: string, branchId: string): Message[] {
    return this.db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? AND branch_id = ? ORDER BY created_at ASC'
    ).all(conversationId, branchId) as Message[];
  }

  /**
   * Builds the full message chain from root to a given message.
   * Walks the parent chain up to the root, then returns messages in order.
   */
  getMessageChain(conversationId: string, branchId: string): Message[] {
    // Get the last message in the branch
    const lastMsg = this.db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? AND branch_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(conversationId, branchId) as Message | undefined;

    if (!lastMsg) return [];

    // Walk up the parent chain to collect all ancestor message IDs
    const ids: string[] = [lastMsg.id];
    let current = lastMsg;
    while (current.parent_id) {
      ids.unshift(current.parent_id);
      current = this.getById(current.parent_id)!;
    }

    // Fetch all messages in order
    const placeholders = ids.map(() => '?').join(',');
    return this.db.prepare(
      `SELECT * FROM messages WHERE id IN (${placeholders}) ORDER BY created_at ASC`
    ).all(...ids) as Message[];
  }

  getBranches(conversationId: string): string[] {
    const rows = this.db.prepare(
      'SELECT DISTINCT branch_id FROM messages WHERE conversation_id = ?'
    ).all(conversationId) as { branch_id: string }[];
    return rows.map(r => r.branch_id);
  }

  deleteMessagesByConversation(conversationId: string): void {
    this.db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/db/message-repository.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/message-repository.ts src/db/message-repository.test.ts
git commit -m "feat: implement message repository with branch/fork support"
```

---

### Task 2.5: Create token_usage and provider repositories

**Files:**
- Create: `src/db/token-usage-repository.ts`
- Create: `src/db/token-usage-repository.test.ts`
- Create: `src/db/provider-repository.ts`
- Create: `src/db/provider-repository.test.ts`

- [ ] **Step 1: Write token-usage-repository test**

```typescript
// src/db/token-usage-repository.test.ts
import Database from 'better-sqlite3';
import { createTables } from './schema';
import { TokenUsageRepository } from './token-usage-repository';
import { ConversationRepository } from './conversation-repository';
import { MessageRepository } from './message-repository';

describe('TokenUsageRepository', () => {
  let db: Database.Database;
  let repo: TokenUsageRepository;
  let convRepo: ConversationRepository;
  let msgRepo: MessageRepository;
  let convId: string;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    createTables(db);
    repo = new TokenUsageRepository(db);
    convRepo = new ConversationRepository(db);
    msgRepo = new MessageRepository(db);
    const conv = convRepo.createConversation('Test', 'You are a helpful assistant.');
    convId = conv.id;
  });

  afterEach(() => {
    db.close();
  });

  test('create inserts token usage record', () => {
    const msg = msgRepo.createRootMessage(convId, 'user', 'Hello');
    const usage = repo.create(msg.id, convId, 'deepseek-chat', 10, 20, 5, 5);
    expect(usage.prompt_tokens).toBe(10);
    expect(usage.completion_tokens).toBe(20);
  });

  test('getByConversation returns all records for a conversation', () => {
    const msg1 = msgRepo.createRootMessage(convId, 'user', 'Hello');
    const msg2 = msgRepo.createChildMessage(convId, 'assistant', 'Hi', 'model', msg1.id, msg1.branch_id);
    repo.create(msg1.id, convId, 'deepseek-chat', 10, 20, 5, 5);
    repo.create(msg2.id, convId, 'deepseek-chat', 5, 10, 2, 3);
    const records = repo.getByConversation(convId);
    expect(records).toHaveLength(2);
  });

  test('getAggregates returns correct totals', () => {
    const msg1 = msgRepo.createRootMessage(convId, 'user', 'Hello');
    const msg2 = msgRepo.createChildMessage(convId, 'assistant', 'Hi', 'model', msg1.id, msg1.branch_id);
    repo.create(msg1.id, convId, 'deepseek-chat', 10, 20, 5, 5);
    repo.create(msg2.id, convId, 'deepseek-chat', 5, 10, 2, 3);
    const aggr = repo.getAggregates();
    expect(aggr.totalPromptTokens).toBe(15);
    expect(aggr.totalCompletionTokens).toBe(30);
    expect(aggr.totalCacheHitTokens).toBe(7);
    expect(aggr.totalCacheMissTokens).toBe(8);
  });

  test('getModelDistribution returns per-model breakdown', () => {
    const msg1 = msgRepo.createRootMessage(convId, 'user', 'Hello');
    repo.create(msg1.id, convId, 'deepseek-chat', 100, 200, 50, 50);
    const dist = repo.getModelDistribution();
    expect(dist).toHaveLength(1);
    expect(dist[0].model).toBe('deepseek-chat');
    expect(dist[0].totalPromptTokens).toBe(100);
  });
});
```

- [ ] **Step 2: Write token-usage-repository implementation**

```typescript
// src/db/token-usage-repository.ts
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export interface TokenUsage {
  id: string;
  message_id: string;
  conversation_id: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  prompt_cache_hit_tokens: number;
  prompt_cache_miss_tokens: number;
  created_at: string;
}

export interface TokenAggregates {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCacheHitTokens: number;
  totalCacheMissTokens: number;
  totalConversations: number;
}

export interface ModelDistribution {
  model: string;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  percentage: number;
}

export class TokenUsageRepository {
  constructor(private db: Database.Database) {}

  create(messageId: string, conversationId: string, model: string, promptTokens: number, completionTokens: number, cacheHitTokens: number, cacheMissTokens: number): TokenUsage {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO token_usage (id, message_id, conversation_id, model, prompt_tokens, completion_tokens, prompt_cache_hit_tokens, prompt_cache_miss_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, messageId, conversationId, model, promptTokens, completionTokens, cacheHitTokens, cacheMissTokens, now);
    return this.db.prepare('SELECT * FROM token_usage WHERE id = ?').get(id) as TokenUsage;
  }

  getByConversation(conversationId: string): TokenUsage[] {
    return this.db.prepare('SELECT * FROM token_usage WHERE conversation_id = ? ORDER BY created_at ASC').all(conversationId) as TokenUsage[];
  }

  getAggregates(): TokenAggregates {
    const totals = this.db.prepare(`
      SELECT 
        COALESCE(SUM(prompt_tokens), 0) as totalPromptTokens,
        COALESCE(SUM(completion_tokens), 0) as totalCompletionTokens,
        COALESCE(SUM(prompt_cache_hit_tokens), 0) as totalCacheHitTokens,
        COALESCE(SUM(prompt_cache_miss_tokens), 0) as totalCacheMissTokens
      FROM token_usage
    `).get() as any;

    const totalConversations = (this.db.prepare('SELECT COUNT(*) as count FROM conversations').get() as any).count;

    return { ...totals, totalConversations };
  }

  getModelDistribution(): ModelDistribution[] {
    const raw = this.db.prepare(`
      SELECT 
        model,
        SUM(prompt_tokens) as totalPromptTokens,
        SUM(completion_tokens) as totalCompletionTokens
      FROM token_usage 
      GROUP BY model 
      ORDER BY totalPromptTokens DESC
    `).all() as any[];

    const grandTotal = raw.reduce((sum, r) => sum + r.totalPromptTokens, 0);
    return raw.map(r => ({
      model: r.model,
      totalPromptTokens: r.totalPromptTokens,
      totalCompletionTokens: r.totalCompletionTokens,
      percentage: grandTotal > 0 ? (r.totalPromptTokens / grandTotal) * 100 : 0,
    }));
  }

  getDailyUsage(days: number): { date: string; promptTokens: number; completionTokens: number }[] {
    return this.db.prepare(`
      SELECT 
        DATE(created_at) as date,
        SUM(prompt_tokens) as promptTokens,
        SUM(completion_tokens) as completionTokens
      FROM token_usage 
      WHERE created_at >= DATE('now', ?)
      GROUP BY DATE(created_at) 
      ORDER BY date ASC
    `).all(`-${days} days`) as any[];
  }

  deleteByConversation(conversationId: string): void {
    this.db.prepare('DELETE FROM token_usage WHERE conversation_id = ?').run(conversationId);
  }
}
```

- [ ] **Step 3: Run token-usage tests**

Run: `npx jest src/db/token-usage-repository.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 4: Write provider-repository test**

```typescript
// src/db/provider-repository.test.ts
import Database from 'better-sqlite3';
import { createTables } from './schema';
import { ProviderRepository } from './provider-repository';

describe('ProviderRepository', () => {
  let db: Database.Database;
  let repo: ProviderRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    createTables(db);
    repo = new ProviderRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  test('createProvider creates a provider', () => {
    const provider = repo.createProvider('DeepSeek Official', 'https://api.deepseek.com/v1');
    expect(provider.name).toBe('DeepSeek Official');
    expect(provider.is_enabled).toBe(1);
  });

  test('getAllProviders returns all providers', () => {
    repo.createProvider('DeepSeek', 'https://api.deepseek.com/v1');
    repo.createProvider('SiliconFlow', 'https://api.siliconflow.cn/v1');
    const providers = repo.getAllProviders();
    expect(providers).toHaveLength(2);
  });

  test('setApiKey stores encrypted key', () => {
    const provider = repo.createProvider('DeepSeek', 'https://api.deepseek.com/v1');
    repo.setApiKey(provider.id, 'sk-encrypted-key', 'deepseek-chat', 0.7);
    const key = repo.getApiKey(provider.id);
    expect(key!.api_key).toBe('sk-encrypted-key');
    expect(key!.default_model).toBe('deepseek-chat');
    expect(key!.default_temperature).toBe(0.7);
  });

  test('deleteProvider removes provider and cascade deletes keys', () => {
    const provider = repo.createProvider('DeepSeek', 'https://api.deepseek.com/v1');
    repo.setApiKey(provider.id, 'sk-key', 'model', 0.7);
    repo.deleteProvider(provider.id);
    expect(repo.getAllProviders()).toHaveLength(0);
    expect(repo.getApiKey(provider.id)).toBeUndefined();
  });
});
```

- [ ] **Step 5: Write provider-repository implementation**

```typescript
// src/db/provider-repository.ts
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export interface Provider {
  id: string;
  name: string;
  base_url: string;
  is_enabled: number;
  created_at: string;
}

export interface ProviderKey {
  id: string;
  provider_id: string;
  api_key: string;
  default_temperature: number;
  default_model: string;
  updated_at: string;
}

export class ProviderRepository {
  constructor(private db: Database.Database) {}

  createProvider(name: string, baseUrl: string): Provider {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO providers (id, name, base_url, is_enabled, created_at) VALUES (?, ?, ?, 1, ?)'
    ).run(id, name, baseUrl, now);
    return this.db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as Provider;
  }

  getAllProviders(): Provider[] {
    return this.db.prepare('SELECT * FROM providers ORDER BY created_at ASC').all() as Provider[];
  }

  setApiKey(providerId: string, encryptedKey: string, defaultModel: string, defaultTemperature: number): ProviderKey {
    const now = new Date().toISOString();
    const existing = this.db.prepare('SELECT * FROM provider_keys WHERE provider_id = ?').get(providerId) as ProviderKey | undefined;
    if (existing) {
      this.db.prepare(
        'UPDATE provider_keys SET api_key = ?, default_model = ?, default_temperature = ?, updated_at = ? WHERE provider_id = ?'
      ).run(encryptedKey, defaultModel, defaultTemperature, now, providerId);
    } else {
      const id = randomUUID();
      this.db.prepare(
        'INSERT INTO provider_keys (id, provider_id, api_key, default_temperature, default_model, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, providerId, encryptedKey, defaultTemperature, defaultModel, now);
    }
    return this.db.prepare('SELECT * FROM provider_keys WHERE provider_id = ?').get(providerId) as ProviderKey;
  }

  getApiKey(providerId: string): ProviderKey | undefined {
    return this.db.prepare('SELECT * FROM provider_keys WHERE provider_id = ?').get(providerId) as ProviderKey | undefined;
  }

  deleteProvider(id: string): void {
    this.db.prepare('DELETE FROM provider_keys WHERE provider_id = ?').run(id);
    this.db.prepare('DELETE FROM providers WHERE id = ?').run(id);
  }
}
```

- [ ] **Step 6: Run provider tests**

Run: `npx jest src/db/provider-repository.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 7: Commit database layer**

```bash
git add src/db/
git commit -m "feat: implement token_usage and provider repositories"
```

---

## Phase 3: Encryption Module (TDD)

### Task 3.1: Implement encryption utilities

**Files:**
- Create: `src/encryption/crypto-utils.ts`
- Create: `src/encryption/crypto-utils.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/encryption/crypto-utils.test.ts
import { encrypt, decrypt, getMachineKey } from './crypto-utils';

describe('CryptoUtils', () => {
  test('encrypt and decrypt roundtrip', () => {
    const plaintext = 'sk-test-api-key-12345';
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  test('different encryptions produce different ciphertexts (random IV)', () => {
    const plaintext = 'same-key';
    const e1 = encrypt(plaintext);
    const e2 = encrypt(plaintext);
    expect(e1).not.toBe(e2);
  });

  test('getMachineKey returns a consistent key', () => {
    const key1 = getMachineKey();
    const key2 = getMachineKey();
    expect(key1).toEqual(key2);
  });

  test('decrypt with tampered data throws', () => {
    expect(() => decrypt('invalid:format:here')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/encryption/crypto-utils.test.ts --no-coverage`
Expected: FAIL

- [ ] **Step 3: Write encryption implementation**

```typescript
// src/encryption/crypto-utils.ts
import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const SALT = 'MeterChat-Static-Salt-v1';

function getKeyDerivationInput(): string {
  const hostname = require('os').hostname();
  const username = require('os').userInfo().username;
  return `${hostname}:${username}:${SALT}`;
}

export function getMachineKey(): Buffer {
  const input = getKeyDerivationInput();
  return scryptSync(input, SALT, KEY_LENGTH);
}

export function encrypt(plaintext: string): string {
  const key = getMachineKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');

  return `${iv.toString('base64')}:${ciphertext}:${authTag}`;
}

export function decrypt(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [ivB64, ciphertextB64, authTagB64] = parts;
  const key = getMachineKey();
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertextB64, 'base64', 'utf8');
  plaintext += decipher.final('utf8');
  return plaintext;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/encryption/crypto-utils.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/encryption/
git commit -m "feat: implement AES-256-GCM encryption with machine-derived key"
```

---

## Phase 4: API Client (TDD)

### Task 4.1: Implement API client with streaming support

**Files:**
- Create: `src/api/api-client.ts`
- Create: `src/api/api-client.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/api/api-client.test.ts
import { buildRequestBody, parseSSEChunk, extractUsage } from './api-client';

describe('ApiClient', () => {
  test('buildRequestBody creates proper OpenAI format', () => {
    const body = buildRequestBody(
      'You are helpful.',
      [{ role: 'user', content: 'Hi' }],
      'deepseek-chat',
      0.7
    );
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toBe('You are helpful.');
    expect(body.messages[1].role).toBe('user');
    expect(body.model).toBe('deepseek-chat');
    expect(body.temperature).toBe(0.7);
    expect(body.stream).toBe(true);
  });

  test('parseSSEChunk parses a data line', () => {
    const line = 'data: {"choices":[{"delta":{"content":"Hello"}}]}';
    const result = parseSSEChunk(line);
    expect(result).toEqual({ content: 'Hello', usage: undefined, done: false });
  });

  test('parseSSEChunk parses [DONE]', () => {
    const result = parseSSEChunk('data: [DONE]');
    expect(result.done).toBe(true);
  });

  test('parseSSEChunk parses usage data', () => {
    const line = 'data: {"usage":{"prompt_tokens":10,"completion_tokens":20,"prompt_cache_hit_tokens":5,"prompt_cache_miss_tokens":5}}';
    const result = parseSSEChunk(line);
    expect(result.usage).toBeDefined();
    expect(result.usage!.prompt_tokens).toBe(10);
  });

  test('extractUsage returns usage from chunk', () => {
    const chunk = { usage: { prompt_tokens: 10, completion_tokens: 20, prompt_cache_hit_tokens: 5, prompt_cache_miss_tokens: 5 } };
    const usage = extractUsage(chunk);
    expect(usage).toEqual({ prompt_tokens: 10, completion_tokens: 20, prompt_cache_hit_tokens: 5, prompt_cache_miss_tokens: 5 });
  });

  test('extractUsage returns null when no usage', () => {
    expect(extractUsage({})).toBeNull();
  });

  test('buildRequestBody throws if system prompt is too long', () => {
    // No explicit limit in design, so shouldn't throw
    const longPrompt = 'x'.repeat(10000);
    expect(() => buildRequestBody(longPrompt, [{ role: 'user', content: 'Hi' }], 'model', 0.7)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/api/api-client.test.ts --no-coverage`
Expected: FAIL

- [ ] **Step 3: Write API client implementation**

```typescript
// src/api/api-client.ts
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface RequestBody {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  stream: boolean;
}

export interface UsageData {
  prompt_tokens: number;
  completion_tokens: number;
  prompt_cache_hit_tokens: number;
  prompt_cache_miss_tokens: number;
}

export interface SSEChunk {
  content: string;
  usage: UsageData | undefined;
  done: boolean;
}

export function buildRequestBody(
  systemPrompt: string,
  messages: { role: string; content: string }[],
  model: string,
  temperature: number
): RequestBody {
  const fullMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role as ChatMessage['role'], content: m.content })),
  ];

  return {
    model,
    messages: fullMessages,
    temperature,
    stream: true,
  };
}

export function parseSSEChunk(line: string): SSEChunk {
  if (!line.startsWith('data: ')) {
    return { content: '', usage: undefined, done: false };
  }

  const data = line.slice(6).trim();

  if (data === '[DONE]') {
    return { content: '', usage: undefined, done: true };
  }

  try {
    const parsed = JSON.parse(data);
    const content = parsed.choices?.[0]?.delta?.content || '';
    const usage = parsed.usage ? extractUsage(parsed) : undefined;
    return { content, usage, done: false };
  } catch {
    return { content: '', usage: undefined, done: false };
  }
}

export function extractUsage(chunk: Record<string, any>): UsageData | null {
  if (!chunk.usage) return null;
  return {
    prompt_tokens: chunk.usage.prompt_tokens || 0,
    completion_tokens: chunk.usage.completion_tokens || 0,
    prompt_cache_hit_tokens: chunk.usage.prompt_cache_hit_tokens || 0,
    prompt_cache_miss_tokens: chunk.usage.prompt_cache_miss_tokens || 0,
  };
}

export async function* streamChat(
  baseUrl: string,
  apiKey: string,
  body: RequestBody
): AsyncGenerator<SSEChunk> {
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
    throw new ApiError(response.status, errorText);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        const chunk = parseSSEChunk(line);
        yield chunk;
        if (chunk.done) return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public body: string
  ) {
    super(`API Error (${statusCode})`);
    this.name = 'ApiError';
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/api/api-client.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/
git commit -m "feat: implement API client with streaming SSE support"
```

---

## Phase 5: Renderer & UI Integration

### Task 5.1: Create renderer entry point

**Files:**
- Create: `src/renderer.ts`

- [ ] **Step 1: Write renderer entry point**

```typescript
// src/renderer.ts
// Renderer process entry point — initializes all UI modules

import './ui/app';

// This file serves as the entry point for the Electron renderer process.
// The app module handles all UI initialization and event binding.
```

- [ ] **Step 2: Create UI app module**

```typescript
// src/ui/app.ts
// Main application controller that wires together all UI modules
// Phase 5 implementation covers the minimal wiring to verify the app loads

import { Sidebar } from './sidebar';
import { ConversationView } from './conversation-view';
import { Dashboard } from './dashboard';
// Note: Database and other services will be wired through the preload bridge

export class App {
  private sidebar: Sidebar;
  private conversationView: ConversationView;
  private dashboard: Dashboard;
  private currentView: 'conversation' | 'dashboard' = 'conversation';

  constructor() {
    this.sidebar = new Sidebar(this);
    this.conversationView = new ConversationView(this);
    this.dashboard = new Dashboard(this);

    this.init();
  }

  private init(): void {
    const dashboardBtn = document.getElementById('dashboard-btn');
    const backBtn = document.getElementById('back-to-conversation-btn');
    const newConvBtn = document.getElementById('new-conversation-btn');

    dashboardBtn?.addEventListener('click', () => this.showDashboard());
    backBtn?.addEventListener('click', () => this.showConversation());
    newConvBtn?.addEventListener('click', () => this.showNewConversation());

    // Initially show conversation view
    this.showConversation();
  }

  showConversation(): void {
    this.currentView = 'conversation';
    document.getElementById('conversation-view')?.classList.remove('hidden');
    document.getElementById('new-conversation-view')?.classList.add('hidden');
    document.getElementById('dashboard-view')?.classList.add('hidden');
  }

  showNewConversation(): void {
    document.getElementById('conversation-view')?.classList.add('hidden');
    document.getElementById('new-conversation-view')?.classList.remove('hidden');
    document.getElementById('dashboard-view')?.classList.add('hidden');
  }

  showDashboard(): void {
    this.currentView = 'dashboard';
    document.getElementById('conversation-view')?.classList.add('hidden');
    document.getElementById('new-conversation-view')?.classList.add('hidden');
    document.getElementById('dashboard-view')?.classList.remove('hidden');
    this.dashboard.refresh();
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
```

- [ ] **Step 3: Create sidebar module**

```typescript
// src/ui/sidebar.ts
import { App } from './app';

export class Sidebar {
  constructor(private app: App) {
    this.init();
  }

  private init(): void {
    // Sidebar initialization — will be expanded in Phase 6
    console.log('Sidebar initialized');
  }

  refresh(): void {
    // Will be implemented when folder/conversation data is connected
  }
}
```

- [ ] **Step 4: Create conversation view module**

```typescript
// src/ui/conversation-view.ts
import { App } from './app';

export class ConversationView {
  constructor(private app: App) {
    this.init();
  }

  private init(): void {
    // Wire up send button
    const sendBtn = document.getElementById('send-btn');
    const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;

    sendBtn?.addEventListener('click', () => this.handleSend());
    messageInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });
  }

  private handleSend(): void {
    const input = document.getElementById('message-input') as HTMLTextAreaElement;
    if (!input || !input.value.trim()) return;

    const content = input.value.trim();
    input.value = '';
    this.appendMessage('user', content);
  }

  appendMessage(role: string, content: string, model?: string): void {
    const messageList = document.getElementById('message-list');
    if (!messageList) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;
    msgDiv.innerHTML = `
      <div class="message-header">
        <span>${role === 'user' ? 'You' : (model || 'Assistant')}</span>
        <button class="fork-btn" title="Fork from here">Fork</button>
      </div>
      <div class="message-content">${this.escapeHtml(content)}</div>
    `;
    messageList.appendChild(msgDiv);
    messageList.scrollTop = messageList.scrollHeight;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
```

- [ ] **Step 5: Create dashboard module**

```typescript
// src/ui/dashboard.ts
import { App } from './app';

export class Dashboard {
  constructor(private app: App) {}

  refresh(): void {
    // Will be implemented with Chart.js in a later phase
    console.log('Dashboard refreshed');
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer.ts src/ui/
git commit -m "feat: add renderer entry point and UI module scaffolding"
```

---

## Phase 6: Core UI Logic — Sidebar, Folders, Conversations

### Task 6.1: Implement full sidebar with folder tree and conversation list

This task connects the sidebar to the database and implements folder/conversation display.

**Files:**
- Modify: `src/ui/sidebar.ts`

- [ ] **Step 1: Implement full sidebar with database integration**

```typescript
// src/ui/sidebar.ts
import { App } from './app';

interface Folder {
  id: string;
  name: string;
  sort_order: number;
}

interface Conversation {
  id: string;
  folder_id: string | null;
  title: string;
  updated_at: string;
}

// In-memory cache of loaded data
let folders: Folder[] = [];
let conversations: Conversation[] = [];

function getDb(): any {
  return (window as any).electronAPI?.db;
}

export async function loadSidebarData(): Promise<void> {
  const db = getDb();
  if (!db) return;

  folders = await db.getAll('SELECT * FROM folders ORDER BY sort_order ASC');
  conversations = await db.getAll('SELECT * FROM conversations ORDER BY updated_at DESC');
}

export function renderSidebar(app: App): void {
  const folderTree = document.getElementById('folder-tree');
  if (!folderTree) return;

  folderTree.innerHTML = '';

  // Render root conversations (no folder)
  const rootConvs = conversations.filter(c => c.folder_id === null);
  for (const conv of rootConvs) {
    const convEl = createConversationElement(conv, app);
    folderTree.appendChild(convEl);
  }

  // Render folders with their conversations
  for (const folder of folders) {
    const folderEl = createFolderElement(folder, app);
    folderTree.appendChild(folderEl);
  }
}

function createFolderElement(folder: Folder, app: App): HTMLElement {
  const container = document.createElement('div');

  const header = document.createElement('div');
  header.className = 'folder-item';
  header.innerHTML = `
    <span class="folder-toggle">▶</span>
    <span>📁 ${escapeHtml(folder.name)}</span>
  `;

  const childrenDiv = document.createElement('div');
  childrenDiv.className = 'folder-children';
  let expanded = true;

  header.addEventListener('click', (e) => {
    e.stopPropagation();
    expanded = !expanded;
    childrenDiv.style.display = expanded ? 'block' : 'none';
    header.querySelector('.folder-toggle')!.textContent = expanded ? '▼' : '▶';
  });

  // Right-click context menu
  header.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, [
      { label: 'Rename Folder', action: () => renameFolder(folder.id) },
      { label: 'Delete Folder', action: () => deleteFolder(folder.id, app), danger: true },
    ]);
  });

  const folderConvs = conversations.filter(c => c.folder_id === folder.id);
  for (const conv of folderConvs) {
    childrenDiv.appendChild(createConversationElement(conv, app));
  }

  container.appendChild(header);
  container.appendChild(childrenDiv);
  return container;
}

function createConversationElement(conv: Conversation, app: App): HTMLElement {
  const el = document.createElement('div');
  el.className = 'conversation-item';
  el.textContent = conv.title || 'Untitled';
  el.dataset.conversationId = conv.id;

  el.addEventListener('click', () => {
    document.querySelectorAll('.conversation-item').forEach(e => e.classList.remove('active'));
    el.classList.add('active');
    app.showConversation();
    // TODO: load conversation messages
  });

  // Right-click context menu
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, [
      { label: 'Rename', action: () => renameConversation(conv.id) },
      { label: 'Move to Folder', action: () => moveConversationToFolder(conv.id) },
      { label: 'Delete', action: () => deleteConversation(conv.id, app), danger: true },
    ]);
  });

  return el;
}

function showContextMenu(x: number, y: number, items: { label: string; action: () => void; danger?: boolean }[]): void {
  // Remove existing context menu
  document.querySelector('.context-menu')?.remove();

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  for (const item of items) {
    const itemEl = document.createElement('div');
    itemEl.className = `context-menu-item${item.danger ? ' danger' : ''}`;
    itemEl.textContent = item.label;
    itemEl.addEventListener('click', () => {
      menu.remove();
      item.action();
    });
    menu.appendChild(itemEl);
  }

  document.body.appendChild(menu);

  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', () => menu.remove(), { once: true });
  }, 0);
}

// Placeholder actions (will be implemented when data flows are complete)
async function renameFolder(id: string): Promise<void> {
  const newName = prompt('Enter new folder name:');
  if (!newName) return;
  const db = getDb();
  if (db) {
    await db.execute('UPDATE folders SET name = ?, updated_at = ? WHERE id = ?', [newName, new Date().toISOString(), id]);
  }
}

async function deleteFolder(id: string, app: App): Promise<void> {
  if (!confirm('Delete this folder and move its conversations to root?')) return;
  const db = getDb();
  if (db) {
    await db.execute('UPDATE conversations SET folder_id = NULL WHERE folder_id = ?', [id]);
    await db.execute('DELETE FROM folders WHERE id = ?', [id]);
  }
}

async function renameConversation(id: string): Promise<void> {
  const newTitle = prompt('Enter new title:');
  if (!newTitle) return;
  const db = getDb();
  if (db) {
    await db.execute('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?', [newTitle, new Date().toISOString(), id]);
  }
}

async function moveConversationToFolder(id: string): Promise<void> {
  // Simple prompt for folder selection — will be improved
  const folderId = prompt('Enter folder ID (leave empty for root):');
  const db = getDb();
  if (db) {
    await db.execute('UPDATE conversations SET folder_id = ?, updated_at = ? WHERE id = ?', [folderId || null, new Date().toISOString(), id]);
  }
}

async function deleteConversation(id: string, app: App): Promise<void> {
  if (!confirm('Delete this conversation and all its messages?')) return;
  const db = getDb();
  if (db) {
    await db.execute('DELETE FROM token_usage WHERE conversation_id = ?', [id]);
    await db.execute('DELETE FROM messages WHERE conversation_id = ?', [id]);
    await db.execute('DELETE FROM conversations WHERE id = ?', [id]);
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

- [ ] **Step 2: Update app.ts to integrate sidebar data loading**

Edit `src/ui/app.ts` — add imports and data loading to init:

```typescript
// Add at top of init():
import { loadSidebarData, renderSidebar } from './sidebar';
```

And add data loading call:

```typescript
private async init(): Promise<void> {
  // Load data
  await loadSidebarData();
  renderSidebar(this);
  
  // ... rest of init
}
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/
git commit -m "feat: implement sidebar with folder tree, conversations, and context menus"
```

---

## Phase 7: Core UI Logic — Conversation View & Message Forking

### Task 7.1: Implement conversation view with messages and forking

**Files:**
- Modify: `src/ui/conversation-view.ts`

- [ ] **Step 1: Rewrite conversation-view.ts with full implementation**

```typescript
// src/ui/conversation-view.ts
import { App } from './app';
import { renderSidebar, loadSidebarData } from './sidebar';

let currentConversationId: string | null = null;
let currentBranchId: string | null = null;

interface Message {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  model: string;
  parent_id: string | null;
  branch_id: string;
  created_at: string;
}

function getDb(): any {
  return (window as any).electronAPI?.db;
}

export class ConversationView {
  constructor(private app: App) {
    this.init();
  }

  private init(): void {
    const sendBtn = document.getElementById('send-btn');
    const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
    const startConvBtn = document.getElementById('start-conversation-btn');
    const titleEl = document.getElementById('conversation-title');

    sendBtn?.addEventListener('click', () => this.handleSend());
    messageInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    startConvBtn?.addEventListener('click', () => this.handleNewConversation());

    // Title editing
    titleEl?.addEventListener('dblclick', () => {
      titleEl!.contentEditable = 'true';
      titleEl!.focus();
    });

    titleEl?.addEventListener('blur', () => {
      titleEl!.contentEditable = 'false';
      this.updateTitle(titleEl!.textContent || '');
    });

    titleEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        titleEl!.blur();
      }
    });

    // Search
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      this.filterConversations(searchInput.value);
    });

    // Branch switcher
    const branchBtn = document.getElementById('branch-switcher-btn');
    branchBtn?.addEventListener('click', () => {
      document.getElementById('branch-dropdown')?.classList.toggle('open');
    });
  }

  private async handleNewConversation(): Promise<void> {
    const systemPromptInput = document.getElementById('system-prompt-input') as HTMLTextAreaElement;
    const firstMessageInput = document.getElementById('first-message-input') as HTMLTextAreaElement;

    const systemPrompt = systemPromptInput.value.trim() || 'You are a helpful assistant.';
    const firstMessage = firstMessageInput.value.trim();

    if (!firstMessage) return;

    const db = getDb();
    if (!db) {
      alert('Database not available');
      return;
    }

    const now = new Date().toISOString();
    const convId = crypto.randomUUID();
    const branchId = crypto.randomUUID();
    const msgId = crypto.randomUUID();

    // Create conversation
    await db.execute(
      'INSERT INTO conversations (id, folder_id, title, system_prompt, is_system_locked, created_at, updated_at) VALUES (?, NULL, ?, ?, 1, ?, ?)',
      [convId, firstMessage.slice(0, 50), systemPrompt, now, now]
    );

    // Create root message
    await db.execute(
      'INSERT INTO messages (id, conversation_id, role, content, model, parent_id, branch_id, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)',
      [msgId, convId, 'user', firstMessage, '', branchId, now]
    );

    currentConversationId = convId;
    currentBranchId = branchId;

    // Show conversation view
    this.loadConversation(convId, branchId);
    this.app.showConversation();

    // Update sidebar
    await loadSidebarData();
    renderSidebar(this.app);

    // Clear form
    systemPromptInput.value = 'You are a helpful assistant.';
    firstMessageInput.value = '';
  }

  async loadConversation(conversationId: string, branchId: string): Promise<void> {
    const db = getDb();
    if (!db) return;

    currentConversationId = conversationId;
    currentBranchId = branchId;

    // Load conversation data
    const conv = await db.get('SELECT * FROM conversations WHERE id = ?', [conversationId]);
    if (!conv) return;

    // Update title
    const titleEl = document.getElementById('conversation-title');
    if (titleEl) titleEl.textContent = conv.title || 'Untitled';

    // Show system prompt banner
    const banner = document.getElementById('system-prompt-banner');
    if (banner) {
      banner.textContent = `System: ${conv.system_prompt}`;
      banner.classList.remove('hidden');
    }

    // Load messages
    const messages = await db.getAll(
      'SELECT * FROM messages WHERE conversation_id = ? AND branch_id = ? ORDER BY created_at ASC',
      [conversationId, branchId]
    );

    const messageList = document.getElementById('message-list');
    if (!messageList) return;
    messageList.innerHTML = '';

    for (const msg of messages) {
      this.renderMessage(msg);
    }

    messageList.scrollTop = messageList.scrollHeight;

    // Load branches
    this.loadBranchSwitcher(conversationId, branchId);
  }

  private renderMessage(msg: Message): void {
    const messageList = document.getElementById('message-list');
    if (!messageList) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${msg.role}`;
    msgDiv.dataset.messageId = msg.id;
    msgDiv.dataset.branchId = msg.branch_id;

    const header = document.createElement('div');
    header.className = 'message-header';

    const roleSpan = document.createElement('span');
    roleSpan.textContent = msg.role === 'user' ? 'You' : (msg.model || 'Assistant');

    const forkBtn = document.createElement('button');
    forkBtn.className = 'fork-btn';
    forkBtn.textContent = 'Fork';
    forkBtn.title = 'Start new branch from this message';
    forkBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleFork(msg.id);
    });

    header.appendChild(roleSpan);
    header.appendChild(forkBtn);

    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = msg.content;

    msgDiv.appendChild(header);
    msgDiv.appendChild(content);
    messageList.appendChild(msgDiv);
  }

  private async handleFork(messageId: string): Promise<void> {
    const db = getDb();
    if (!db || !currentConversationId) return;

    const newMessage = prompt('Enter your message to fork from here:');
    if (!newMessage) return;

    const msg = await db.get('SELECT * FROM messages WHERE id = ?', [messageId]);
    if (!msg) return;

    const newBranchId = crypto.randomUUID();
    const msgId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.execute(
      'INSERT INTO messages (id, conversation_id, role, content, model, parent_id, branch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [msgId, currentConversationId, 'user', newMessage, '', messageId, newBranchId, now]
    );

    currentBranchId = newBranchId;
    await this.loadConversation(currentConversationId, newBranchId);
  }

  private async loadBranchSwitcher(conversationId: string, activeBranchId: string): Promise<void> {
    const db = getDb();
    if (!db) return;

    const branches = await db.getAll(
      'SELECT DISTINCT branch_id FROM messages WHERE conversation_id = ?',
      [conversationId]
    );

    const dropdown = document.getElementById('branch-dropdown');
    if (!dropdown) return;
    dropdown.innerHTML = '';

    for (const branch of branches) {
      const item = document.createElement('div');
      item.className = `branch-item${branch.branch_id === activeBranchId ? ' active' : ''}`;

      const labelSpan = document.createElement('span');
      labelSpan.textContent = `Branch ${branch.branch_id.slice(0, 8)}`;

      const tokensSpan = document.createElement('span');
      tokensSpan.className = 'branch-tokens';

      // Load token summary for this branch
      const tokenData = await db.getAll(
        `SELECT tu.* FROM token_usage tu 
         JOIN messages m ON tu.message_id = m.id 
         WHERE m.conversation_id = ? AND m.branch_id = ?`,
        [conversationId, branch.branch_id]
      );

      const totalPrompt = tokenData.reduce((s: number, t: any) => s + t.prompt_tokens, 0);
      const totalCompletion = tokenData.reduce((s: number, t: any) => s + t.completion_tokens, 0);
      tokensSpan.textContent = `${totalPrompt}↑ ${totalCompletion}↓`;

      item.appendChild(labelSpan);
      item.appendChild(tokensSpan);

      item.addEventListener('click', () => {
        dropdown.classList.remove('open');
        if (branch.branch_id !== activeBranchId) {
          currentBranchId = branch.branch_id;
          this.loadConversation(conversationId, branch.branch_id);
        }
      });

      dropdown.appendChild(item);
    }
  }

  async handleSend(): Promise<void> {
    const input = document.getElementById('message-input') as HTMLTextAreaElement;
    if (!input || !input.value.trim()) return;

    const content = input.value.trim();

    if (!currentConversationId) {
      alert('Please start a new conversation first');
      return;
    }

    input.value = '';

    const db = getDb();
    if (!db || !currentBranchId) return;

    // Get the last message in current branch
    const lastMsg = await db.get(
      'SELECT * FROM messages WHERE conversation_id = ? AND branch_id = ? ORDER BY created_at DESC LIMIT 1',
      [currentConversationId, currentBranchId]
    );

    // Save user message
    const userMsgId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.execute(
      'INSERT INTO messages (id, conversation_id, role, content, model, parent_id, branch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userMsgId, currentConversationId, 'user', content, '', lastMsg?.id || null, currentBranchId, now]
    );

    // Render user message
    this.renderMessage({
      id: userMsgId,
      conversation_id: currentConversationId,
      role: 'user',
      content,
      model: '',
      parent_id: lastMsg?.id || null,
      branch_id: currentBranchId,
      created_at: now,
    });

    // TODO: In Phase 8, this will trigger an API call
    // For now, simulate an assistant response
    this.simulateAssistantResponse();
  }

  private async simulateAssistantResponse(): Promise<void> {
    const db = getDb();
    if (!db || !currentConversationId || !currentBranchId) return;

    const lastMsg = await db.get(
      'SELECT * FROM messages WHERE conversation_id = ? AND branch_id = ? ORDER BY created_at DESC LIMIT 1',
      [currentConversationId, currentBranchId]
    );

    const assistantMsgId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.execute(
      'INSERT INTO messages (id, conversation_id, role, content, model, parent_id, branch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [assistantMsgId, currentConversationId, 'assistant', 'This is a simulated response. API integration will be added in a future phase.', 'simulated-model', lastMsg?.id || null, currentBranchId, now]
    );

    this.renderMessage({
      id: assistantMsgId,
      conversation_id: currentConversationId,
      role: 'assistant',
      content: 'This is a simulated response. API integration will be added in a future phase.',
      model: 'simulated-model',
      parent_id: lastMsg?.id || null,
      branch_id: currentBranchId,
      created_at: now,
    });
  }

  private async updateTitle(title: string): Promise<void> {
    if (!currentConversationId || !title.trim()) return;
    const db = getDb();
    if (!db) return;
    await db.execute(
      'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?',
      [title.trim(), new Date().toISOString(), currentConversationId]
    );
  }

  private async filterConversations(query: string): Promise<void> {
    // Simple client-side filter — will reload sidebar with search results
    // For now, a no-op that hides non-matching items
    document.querySelectorAll('.conversation-item').forEach(el => {
      const text = el.textContent?.toLowerCase() || '';
      el.classList.toggle('hidden', !text.includes(query.toLowerCase()));
    });
  }

  appendMessage(role: string, content: string, model?: string): void {
    // Synthetic append for external callers (e.g., streaming)
    const messageList = document.getElementById('message-list');
    if (!messageList) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;
    msgDiv.innerHTML = `
      <div class="message-header">
        <span>${role === 'user' ? 'You' : (model || 'Assistant')}</span>
      </div>
      <div class="message-content">${this.escapeHtml(content)}</div>
    `;
    messageList.appendChild(msgDiv);
    messageList.scrollTop = messageList.scrollHeight;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
```

- [ ] **Step 2: Add branch switcher button to conversation header**

Update `src/ui/app.ts` init to create branch switcher button if not in HTML:

```typescript
// In app.ts init, ensure branch switcher button exists
private ensureBranchSwitcher(): void {
  const container = document.getElementById('branch-switcher');
  if (container && !container.querySelector('#branch-switcher-btn')) {
    container.innerHTML = `
      <button id="branch-switcher-btn">Branches ▾</button>
      <div id="branch-dropdown"></div>
    `;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/
git commit -m "feat: implement conversation view with message display, forking, and branch switching"
```

---

## Phase 8: API Integration & Streaming

### Task 8.1: Wire API client to conversation view

**Files:**
- Modify: `src/ui/conversation-view.ts`
- Create: `src/ui/api-service.ts`

- [ ] **Step 1: Create API service**

```typescript
// src/ui/api-service.ts
import { streamChat, buildRequestBody, ApiError, SSEChunk } from '../api/api-client';

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
}

export class ApiService {
  private config: ApiConfig | null = null;

  setConfig(config: ApiConfig): void {
    this.config = config;
  }

  async *sendMessage(systemPrompt: string, messages: { role: string; content: string }[]): AsyncGenerator<SSEChunk> {
    if (!this.config) {
      throw new Error('API not configured. Please set API key in settings.');
    }

    const body = buildRequestBody(
      systemPrompt,
      messages,
      this.config.model,
      this.config.temperature
    );

    const generator = streamChat(this.config.baseUrl, this.config.apiKey, body);
    for await (const chunk of generator) {
      yield chunk;
    }
  }

  isConfigured(): boolean {
    return this.config !== null;
  }
}

export const apiService = new ApiService();
```

- [ ] **Step 2: Update conversation-view.ts to use real API instead of simulation**

Replace the `simulateAssistantResponse` method with real API calls:

```typescript
private async sendToApi(): Promise<void> {
  const db = getDb();
  if (!db || !currentConversationId || !currentBranchId) return;

  if (!apiService.isConfigured()) {
    // Fall back to simulation if API not configured
    this.simulateAssistantResponse();
    return;
  }

  // Get system prompt
  const conv = await db.get('SELECT * FROM conversations WHERE id = ?', [currentConversationId]);
  if (!conv) return;

  // Get full message chain
  const messages = await db.getAll(
    'SELECT * FROM messages WHERE conversation_id = ? AND branch_id = ? ORDER BY created_at ASC',
    [currentConversationId, currentBranchId]
  );

  // Prepare message array for API (without system prompt)
  const apiMessages = messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Create placeholder assistant message
  const assistantMsgId = crypto.randomUUID();
  const now = new Date().toISOString();
  const lastMsg = messages[messages.length - 1];
  let accumulatedContent = '';

  // Insert placeholder
  await db.execute(
    'INSERT INTO messages (id, conversation_id, role, content, model, parent_id, branch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [assistantMsgId, currentConversationId, 'assistant', '', '', lastMsg?.id || null, currentBranchId, now]
  );

  // Render empty assistant message
  const messageList = document.getElementById('message-list');
  const assistantDiv = document.createElement('div');
  assistantDiv.className = 'message assistant';
  assistantDiv.id = `msg-${assistantMsgId}`;
  assistantDiv.innerHTML = `
    <div class="message-header">
      <span>...</span>
    </div>
    <div class="message-content"></div>
  `;
  messageList?.appendChild(assistantDiv);
  messageList!.scrollTop = messageList!.scrollHeight;

  try {
    const generator = apiService.sendMessage(conv.system_prompt, apiMessages);
    let usage: any = null;

    for await (const chunk of generator) {
      if (chunk.content) {
        accumulatedContent += chunk.content;
        const contentDiv = assistantDiv.querySelector('.message-content');
        if (contentDiv) contentDiv.textContent = accumulatedContent;
        messageList!.scrollTop = messageList!.scrollHeight;
      }
      if (chunk.usage) {
        usage = chunk.usage;
      }
      if (chunk.done) break;
    }

    // Update message with final content and model
    await db.execute(
      'UPDATE messages SET content = ?, model = ? WHERE id = ?',
      [accumulatedContent, apiService.isConfigured() ? 'api-model' : 'simulated-model', assistantMsgId]
    );

    // Save token usage if available
    if (usage) {
      await db.execute(
        'INSERT INTO token_usage (id, message_id, conversation_id, model, prompt_tokens, completion_tokens, prompt_cache_hit_tokens, prompt_cache_miss_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          crypto.randomUUID(),
          assistantMsgId,
          currentConversationId,
          'deepseek-chat',
          usage.prompt_tokens || 0,
          usage.completion_tokens || 0,
          usage.prompt_cache_hit_tokens || 0,
          usage.prompt_cache_miss_tokens || 0,
          new Date().toISOString(),
        ]
      );
    }

    // Update header
    const headerSpan = assistantDiv.querySelector('.message-header span');
    if (headerSpan) headerSpan.textContent = apiService.isConfigured() ? 'deepseek-chat' : 'Simulated';

  } catch (err) {
    const contentDiv = assistantDiv.querySelector('.message-content');
    if (err instanceof ApiError) {
      const messages: Record<number, string> = {
        401: 'API Key is invalid. Please check your settings.',
        403: 'API Key is invalid. Please check your settings.',
        429: 'Too many requests. Please try again later.',
      };
      if (contentDiv) contentDiv.textContent = `Error: ${messages[err.statusCode] || `Server error (${err.statusCode})`}`;
    } else {
      if (contentDiv) contentDiv.textContent = `Error: Network connection failed. Please check your internet.`;
    }
    if (contentDiv) contentDiv.style.color = 'var(--danger)';
  }
}

// Update handleSend to call sendToApi
private async handleSend(): Promise<void> {
  const input = document.getElementById('message-input') as HTMLTextAreaElement;
  if (!input || !input.value.trim()) return;

  const content = input.value.trim();

  if (!currentConversationId) {
    alert('Please start a new conversation first');
    return;
  }

  input.value = '';

  const db = getDb();
  if (!db || !currentBranchId) return;

  const lastMsg = await db.get(
    'SELECT * FROM messages WHERE conversation_id = ? AND branch_id = ? ORDER BY created_at DESC LIMIT 1',
    [currentConversationId, currentBranchId]
  );

  const userMsgId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute(
    'INSERT INTO messages (id, conversation_id, role, content, model, parent_id, branch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [userMsgId, currentConversationId, 'user', content, '', lastMsg?.id || null, currentBranchId, now]
  );

  this.renderMessage({
    id: userMsgId,
    conversation_id: currentConversationId,
    role: 'user',
    content,
    model: '',
    parent_id: lastMsg?.id || null,
    branch_id: currentBranchId,
    created_at: now,
  });

  // Call API
  await this.sendToApi();
}
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/api-service.ts src/ui/conversation-view.ts
git commit -m "feat: integrate API client with streaming responses and token usage tracking"
```

---

## Phase 9: Dashboard with Chart.js

### Task 9.1: Implement full dashboard

**Files:**
- Modify: `src/ui/dashboard.ts`

- [ ] **Step 1: Rewrite dashboard with Chart.js**

```typescript
// src/ui/dashboard.ts
import { App } from './app';
import Chart from 'chart.js/auto';

function getDb(): any {
  return (window as any).electronAPI?.db;
}

export class Dashboard {
  private pieChart: Chart | null = null;
  private lineChart: Chart | null = null;
  private currentRange: '7' | '30' | 'all' = '7';

  constructor(private app: App) {}

  async refresh(): Promise<void> {
    const db = getDb();
    if (!db) return;

    // Load aggregates
    const stats = await db.get(`
      SELECT 
        COALESCE(SUM(prompt_tokens), 0) as totalPromptTokens,
        COALESCE(SUM(completion_tokens), 0) as totalCompletionTokens,
        COALESCE(SUM(prompt_cache_hit_tokens), 0) as totalCacheHitTokens,
        COALESCE(SUM(prompt_cache_miss_tokens), 0) as totalCacheMissTokens
      FROM token_usage
    `);

    const totalConversations = await db.get('SELECT COUNT(*) as count FROM conversations');

    this.renderStatsCards(stats, totalConversations.count);
    this.renderPieChart(db);
    this.renderLineChart(db, this.currentRange);
    this.renderDetailsTable(db);
  }

  private renderStatsCards(stats: any, totalConversations: number): void {
    const container = document.getElementById('dashboard-stats');
    if (!container) return;

    const cacheHitRate = (stats.totalPromptTokens + stats.totalCompletionTokens) > 0
      ? ((stats.totalCacheHitTokens / (stats.totalPromptTokens + stats.totalCompletionTokens)) * 100).toFixed(1)
      : '0.0';

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${totalConversations}</div>
        <div class="stat-label">Total Conversations</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${this.formatNumber(stats.totalPromptTokens)}</div>
        <div class="stat-label">Total Input Tokens</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${this.formatNumber(stats.totalCompletionTokens)}</div>
        <div class="stat-label">Total Output Tokens</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${cacheHitRate}%</div>
        <div class="stat-label">Cache Hit Rate</div>
      </div>
    `;
  }

  private async renderPieChart(db: any): Promise<void> {
    const modelData = await db.getAll(`
      SELECT model, SUM(prompt_tokens) as promptTokens, SUM(completion_tokens) as completionTokens
      FROM token_usage
      GROUP BY model
      ORDER BY promptTokens DESC
    `);

    const canvas = document.getElementById('pie-chart') as HTMLCanvasElement;
    if (!canvas) return;

    if (this.pieChart) {
      this.pieChart.destroy();
    }

    if (modelData.length === 0) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#6c7086';
        ctx.textAlign = 'center';
        ctx.fillText('No data yet', canvas.width / 2, canvas.height / 2);
      }
      return;
    }

    this.pieChart = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: modelData.map((d: any) => d.model),
        datasets: [{
          data: modelData.map((d: any) => d.promptTokens),
          backgroundColor: ['#89b4fa', '#a6e3a1', '#f9e2af', '#f38ba8', '#cba6f7', '#94e2d5'],
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#cdd6f4', font: { size: 11 } },
          },
          title: {
            display: true,
            text: 'Token Distribution by Model',
            color: '#cdd6f4',
            font: { size: 14 },
          },
        },
      },
    });
  }

  private async renderLineChart(db: any, days: string): Promise<void> {
    let usageData: any[];
    if (days === 'all') {
      usageData = await db.getAll(`
        SELECT DATE(created_at) as date,
               SUM(prompt_tokens) as promptTokens,
               SUM(completion_tokens) as completionTokens
        FROM token_usage
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `);
    } else {
      const numDays = parseInt(days);
      const dateLimit = new Date(Date.now() - numDays * 86400000).toISOString();
      usageData = await db.getAll(`
        SELECT DATE(created_at) as date,
               SUM(prompt_tokens) as promptTokens,
               SUM(completion_tokens) as completionTokens
        FROM token_usage
        WHERE created_at >= ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [dateLimit]);
    }

    const canvas = document.getElementById('line-chart') as HTMLCanvasElement;
    if (!canvas) return;

    if (this.lineChart) {
      this.lineChart.destroy();
    }

    // Add range buttons
    const chartContainer = canvas.parentElement;
    if (chartContainer) {
      const existingButtons = chartContainer.querySelector('.range-buttons');
      if (!existingButtons) {
        const btnContainer = document.createElement('div');
        btnContainer.className = 'range-buttons';
        btnContainer.style.cssText = 'text-align: center; margin-top: 8px; display: flex; gap: 8px; justify-content: center;';
        ['7', '30', 'all'].forEach(range => {
          const btn = document.createElement('button');
          btn.textContent = `${range === 'all' ? 'All' : range + 'd'}`;
          btn.style.cssText = `padding: 4px 12px; border: 1px solid var(--border); border-radius: 4px; background: ${range === days ? 'var(--accent)' : 'var(--bg-surface)'}; color: ${range === days ? 'var(--bg-primary)' : 'var(--text-primary)'}; cursor: pointer; font-size: 12px;`;
          btn.addEventListener('click', async () => {
            this.currentRange = range as '7' | '30' | 'all';
            this.renderLineChart(db, this.currentRange);
          });
          btnContainer.appendChild(btn);
        });
        chartContainer.appendChild(btnContainer);
      } else {
        // Update button styles
        existingButtons.querySelectorAll('button').forEach((btn: HTMLButtonElement, idx: number) => {
          const range = ['7', '30', 'all'][idx];
          btn.style.background = range === days ? 'var(--accent)' : 'var(--bg-surface)';
          btn.style.color = range === days ? 'var(--bg-primary)' : 'var(--text-primary)';
        });
      }
    }

    if (usageData.length === 0) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#6c7086';
        ctx.textAlign = 'center';
        ctx.fillText('No data yet', canvas.width / 2, canvas.height / 2);
      }
      return;
    }

    this.lineChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: usageData.map((d: any) => d.date),
        datasets: [
          {
            label: 'Input Tokens',
            data: usageData.map((d: any) => d.promptTokens),
            borderColor: '#89b4fa',
            backgroundColor: 'rgba(137, 180, 250, 0.1)',
            fill: true,
            tension: 0.3,
          },
          {
            label: 'Output Tokens',
            data: usageData.map((d: any) => d.completionTokens),
            borderColor: '#a6e3a1',
            backgroundColor: 'rgba(166, 227, 161, 0.1)',
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#cdd6f4', font: { size: 11 } },
          },
          title: {
            display: true,
            text: 'Token Usage Trend',
            color: '#cdd6f4',
            font: { size: 14 },
          },
        },
        scales: {
          x: {
            ticks: { color: '#a6adc8', font: { size: 10 } },
            grid: { color: 'rgba(69, 71, 90, 0.3)' },
          },
          y: {
            ticks: { color: '#a6adc8', font: { size: 10 } },
            grid: { color: 'rgba(69, 71, 90, 0.3)' },
          },
        },
      },
    });
  }

  private async renderDetailsTable(db: any): Promise<void> {
    const container = document.getElementById('dashboard-details');
    if (!container) return;

    const details = await db.getAll(`
      SELECT 
        DATE(tu.created_at) as date,
        c.title as conversationTitle,
        tu.model,
        tu.prompt_tokens,
        tu.completion_tokens,
        tu.prompt_cache_hit_tokens,
        tu.conversation_id
      FROM token_usage tu
      JOIN conversations c ON tu.conversation_id = c.id
      ORDER BY tu.created_at DESC
      LIMIT 100
    `);

    if (details.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">No token usage records yet.</p>';
      return;
    }

    let html = `
      <h3 style="margin-bottom:12px;font-size:16px;">Recent Usage Details</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="border-bottom:1px solid var(--border);color:var(--text-muted);">
            <th style="padding:8px;text-align:left;">Date</th>
            <th style="padding:8px;text-align:left;">Conversation</th>
            <th style="padding:8px;text-align:left;">Model</th>
            <th style="padding:8px;text-align:right;">Input</th>
            <th style="padding:8px;text-align:right;">Output</th>
            <th style="padding:8px;text-align:right;">Cache Hit</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const row of details) {
      html += `
        <tr style="border-bottom:1px solid var(--border);cursor:pointer;" data-conv-id="${row.conversation_id}">
          <td style="padding:8px;">${row.date}</td>
          <td style="padding:8px;">${this.escapeHtml(row.conversationTitle)}</td>
          <td style="padding:8px;">${row.model}</td>
          <td style="padding:8px;text-align:right;">${this.formatNumber(row.prompt_tokens)}</td>
          <td style="padding:8px;text-align:right;">${this.formatNumber(row.completion_tokens)}</td>
          <td style="padding:8px;text-align:right;">${this.formatNumber(row.prompt_cache_hit_tokens)}</td>
        </tr>
      `;
    }

    html += '</tbody></table>';
    container.innerHTML = html;

    // Click to navigate to conversation
    container.querySelectorAll('tr[data-conv-id]').forEach(row => {
      row.addEventListener('click', () => {
        const convId = (row as HTMLElement).dataset.convId;
        if (convId) {
          // TODO: navigate to conversation
          this.app.showConversation();
        }
      });
    });
  }

  private formatNumber(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/dashboard.ts
git commit -m "feat: implement dashboard with Chart.js stats, pie chart, line chart, and detail table"
```

---

## Phase 10: Settings & Encryption Integration

### Task 10.1: Implement settings UI for API key management

**Files:**
- Create: `src/ui/settings.ts`
- Modify: `static/index.html`
- Modify: `static/styles.css`

- [ ] **Step 1: Create settings module**

```typescript
// src/ui/settings.ts
function getDb(): any {
  return (window as any).electronAPI?.db;
}

function getEncrypt(): any {
  return (window as any).electronAPI?.encrypt;
}

export class Settings {
  static async loadProviders(): Promise<void> {
    const db = getDb();
    if (!db) return;

    // Seed default providers if none exist
    const count = await db.get('SELECT COUNT(*) as count FROM providers');
    if (count.count === 0) {
      const now = new Date().toISOString();
      const deepseekId = crypto.randomUUID();
      const siliconId = crypto.randomUUID();

      await db.execute(
        'INSERT INTO providers (id, name, base_url, is_enabled, created_at) VALUES (?, ?, ?, 1, ?)',
        [deepseekId, 'DeepSeek Official', 'https://api.deepseek.com/v1', now]
      );
      await db.execute(
        'INSERT INTO providers (id, name, base_url, is_enabled, created_at) VALUES (?, ?, ?, 1, ?)',
        [siliconId, 'SiliconFlow', 'https://api.siliconflow.cn/v1', now]
      );
    }
  }

  static async saveApiKey(providerId: string, apiKey: string, model: string, temperature: number): Promise<void> {
    const encrypt = getEncrypt();
    const db = getDb();
    if (!db || !encrypt) return;

    const encrypted = await encrypt.encrypt(apiKey);
    const now = new Date().toISOString();

    const existing = await db.get('SELECT * FROM provider_keys WHERE provider_id = ?', [providerId]);
    if (existing) {
      await db.execute(
        'UPDATE provider_keys SET api_key = ?, default_model = ?, default_temperature = ?, updated_at = ? WHERE provider_id = ?',
        [encrypted, model, temperature, now, providerId]
      );
    } else {
      const id = crypto.randomUUID();
      await db.execute(
        'INSERT INTO provider_keys (id, provider_id, api_key, default_temperature, default_model, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, providerId, encrypted, temperature, model, now]
      );
    }
  }

  static async getDecryptedKey(providerId: string): Promise<string | null> {
    const encrypt = getEncrypt();
    const db = getDb();
    if (!db || !encrypt) return null;

    const keyRecord = await db.get('SELECT * FROM provider_keys WHERE provider_id = ?', [providerId]);
    if (!keyRecord) return null;

    return await encrypt.decrypt(keyRecord.api_key);
  }

  static async showSettingsDialog(): Promise<void> {
    const db = getDb();
    if (!db) return;

    await Settings.loadProviders();
    const providers = await db.getAll('SELECT * FROM providers WHERE is_enabled = 1');

    let dialogHtml = `
      <div id="settings-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;z-index:1000;">
        <div style="background:var(--bg-surface);border-radius:12px;padding:24px;width:500px;max-height:80vh;overflow-y:auto;">
          <h2 style="margin-bottom:16px;">Settings</h2>
    `;

    for (const provider of providers) {
      const keyRecord = await db.get('SELECT * FROM provider_keys WHERE provider_id = ?', [provider.id]);
      dialogHtml += `
        <div style="margin-bottom:20px;padding:16px;background:var(--bg-secondary);border-radius:8px;">
          <h3 style="margin-bottom:12px;">${provider.name}</h3>
          <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;">API Key</label>
          <input type="password" id="api-key-${provider.id}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-surface);color:var(--text-primary);margin-bottom:8px;" placeholder="sk-..." ${keyRecord ? 'value="********"' : ''}>
          <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Default Model</label>
          <input type="text" id="model-${provider.id}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-surface);color:var(--text-primary);margin-bottom:8px;" placeholder="deepseek-chat" value="${keyRecord?.default_model || ''}">
          <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Temperature (0-2)</label>
          <input type="number" id="temp-${provider.id}" step="0.1" min="0" max="2" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-surface);color:var(--text-primary);margin-bottom:8px;" value="${keyRecord?.default_temperature ?? 0.7}">
        </div>
      `;
    }

    dialogHtml += `
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button id="settings-cancel-btn" style="padding:8px 16px;border:1px solid var(--border);border-radius:6px;background:var(--bg-surface);color:var(--text-primary);cursor:pointer;">Cancel</button>
            <button id="settings-save-btn" style="padding:8px 16px;border:none;border-radius:6px;background:var(--accent);color:var(--bg-primary);cursor:pointer;font-weight:600;">Save</button>
          </div>
        </div>
      </div>
    `;

    const overlay = document.createElement('div');
    overlay.innerHTML = dialogHtml;
    document.body.appendChild(overlay);

    document.getElementById('settings-cancel-btn')?.addEventListener('click', () => overlay.remove());
    document.getElementById('settings-save-btn')?.addEventListener('click', async () => {
      for (const provider of providers) {
        const keyInput = document.getElementById(`api-key-${provider.id}`) as HTMLInputElement;
        const modelInput = document.getElementById(`model-${provider.id}`) as HTMLInputElement;
        const tempInput = document.getElementById(`temp-${provider.id}`) as HTMLInputElement;

        if (keyInput.value && keyInput.value !== '********') {
          await Settings.saveApiKey(provider.id, keyInput.value, modelInput.value, parseFloat(tempInput.value) || 0.7);
        } else if (modelInput.value || tempInput.value) {
          // Update model/temperature without changing key
          const existing = await db.get('SELECT * FROM provider_keys WHERE provider_id = ?', [provider.id]);
          if (existing) {
            await db.execute(
              'UPDATE provider_keys SET default_model = ?, default_temperature = ?, updated_at = ? WHERE provider_id = ?',
              [modelInput.value, parseFloat(tempInput.value) || 0.7, new Date().toISOString(), provider.id]
            );
          }
        }
      }
      overlay.remove();
      alert('Settings saved successfully!');
    });
  }
}
```

- [ ] **Step 2: Add settings button to sidebar and connect**

Add settings button to index.html sidebar-footer:
```html
<button id="settings-btn">Settings</button>
```

And in app.ts:
```typescript
const settingsBtn = document.getElementById('settings-btn');
settingsBtn?.addEventListener('click', () => Settings.showSettingsDialog());
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/settings.ts
git commit -m "feat: add settings UI with encrypted API key management"
```

---

## Spec Coverage Check

| Spec Section | Task |
|---|---|
| Database schema (6 tables) | Task 2.1 |
| Folder CRUD | Task 2.2 |
| Conversation CRUD | Task 2.3 |
| Message branch/fork | Task 2.4 |
| Token usage tracking | Task 2.5 |
| Provider management | Task 2.5 |
| AES-256-GCM encryption | Task 3.1 |
| API client (OpenAI format) | Task 4.1 |
| Streaming SSE | Task 4.1 |
| System Prompt handling | Task 7.1 |
| Message forking | Task 7.1 |
| Branch switching | Task 7.1 |
| Token summary per branch | Task 7.1 |
| Dashboard stats & charts | Task 9.1 |
| UI sidebar + folder tree | Task 6.1 |
| Conversation view | Task 7.1 |
| Settings UI | Task 10.1 |
| Error handling (network, auth, rate limit) | Task 8.1 |

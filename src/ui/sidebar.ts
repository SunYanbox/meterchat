import { App } from './app';
import { ConversationView } from './conversation-view';

const db = () => (window as any).electronAPI?.db;

export class Sidebar {
  private convView: ConversationView;

  constructor(private app: App) {
    this.convView = new ConversationView(app);
  }

  async refresh(): Promise<void> {
    // Wire up new folder button
    const newFolderBtn = document.getElementById('new-folder-btn');
    if (newFolderBtn && !newFolderBtn.dataset.wired) {
      newFolderBtn.dataset.wired = '1';
      newFolderBtn.onclick = () => this.createNewFolder();
    }
    const folderTree = document.getElementById('folder-tree');
    if (!folderTree) return;

    const folders = (await db()?.getAll('SELECT * FROM folders ORDER BY sort_order ASC')) || [];
    const rootConvs = (await db()?.getAll('SELECT * FROM conversations WHERE folder_id IS NULL ORDER BY updated_at DESC')) || [];

    folderTree.innerHTML = '';

    for (const conv of rootConvs) {
      folderTree.appendChild(this.createConvEl(conv));
    }

    for (const folder of folders) {
      const folderConvs = (await db()?.getAll(
        'SELECT * FROM conversations WHERE folder_id = ? ORDER BY updated_at DESC',
        [folder.id]
      )) || [];
      folderTree.appendChild(this.createFolderEl(folder, folderConvs));
    }

    // Wire search
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.oninput = () => this.filter(searchInput.value);
    }
  }

  private createFolderEl(folder: any, convs: any[]): HTMLElement {
    const container = document.createElement('div');

    const header = document.createElement('div');
    header.className = 'folder-item';
    let expanded = true;

    const toggle = document.createElement('span');
    toggle.className = 'folder-toggle';
    toggle.textContent = '▼';
    header.appendChild(toggle);

    const nameSpan = document.createElement('span');
    nameSpan.textContent = `📁 ${folder.name}`;
    header.appendChild(nameSpan);

    const childrenDiv = document.createElement('div');
    childrenDiv.className = 'folder-children';

    header.onclick = (e) => {
      e.stopPropagation();
      expanded = !expanded;
      childrenDiv.style.display = expanded ? 'block' : 'none';
      toggle.textContent = expanded ? '▼' : '▶';
    };

    header.oncontextmenu = (e) => {
      e.preventDefault();
      this.showContextMenu(e.clientX, e.clientY, [
        { label: 'Rename', action: () => this.renameFolder(folder.id) },
        { label: 'Delete', danger: true, action: () => this.deleteFolder(folder.id) },
      ]);
    };

    for (const conv of convs) {
      childrenDiv.appendChild(this.createConvEl(conv));
    }

    container.appendChild(header);
    container.appendChild(childrenDiv);
    return container;
  }

  private createConvEl(conv: any): HTMLElement {
    const el = document.createElement('div');
    el.className = 'conversation-item';
    el.textContent = conv.title || 'Untitled';
    el.dataset.conversationId = conv.id;

    el.onclick = () => {
      document.querySelectorAll('.conversation-item').forEach(e => e.classList.remove('active'));
      el.classList.add('active');
      this.app.showConversation();
      this.convView.loadConversation(conv.id);
    };

    el.oncontextmenu = (e) => {
      e.preventDefault();
      this.showContextMenu(e.clientX, e.clientY, [
        { label: 'Rename', action: () => this.renameConv(conv.id) },
        { label: 'Move to Folder', action: () => this.moveConv(conv.id) },
        { label: 'Delete', danger: true, action: () => this.deleteConv(conv.id) },
      ]);
    };

    return el;
  }

  private showContextMenu(x: number, y: number, items: { label: string; action: () => void; danger?: boolean }[]): void {
    document.querySelector('.context-menu')?.remove();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.cssText = `position:fixed;left:${x}px;top:${y}px;`;
    for (const item of items) {
      const el = document.createElement('div');
      el.className = `context-menu-item${item.danger ? ' danger' : ''}`;
      el.textContent = item.label;
      el.onclick = () => { menu.remove(); item.action(); };
      menu.appendChild(el);
    }
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
  }

  private async renameFolder(id: string): Promise<void> {
    const name = prompt('Folder name:');
    if (!name) return;
    await db()?.execute('UPDATE folders SET name = ?, updated_at = ? WHERE id = ?', [name, new Date().toISOString(), id]);
    await this.refresh();
  }

  private async deleteFolder(id: string): Promise<void> {
    if (!confirm('Delete folder? Conversations will be moved to root.')) return;
    await db()?.execute('UPDATE conversations SET folder_id = NULL WHERE folder_id = ?', [id]);
    await db()?.execute('DELETE FROM folders WHERE id = ?', [id]);
    await this.refresh();
  }

  private async renameConv(id: string): Promise<void> {
    const title = prompt('Conversation title:');
    if (!title) return;
    await db()?.execute('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?', [title, new Date().toISOString(), id]);
    await this.refresh();
  }

  private async moveConv(id: string): Promise<void> {
    const folders = (await db()?.getAll('SELECT * FROM folders ORDER BY name ASC')) || [];
    const choices = ['(Root)'];
    for (const f of folders) {
      choices.push(`${f.name} (${f.id.slice(0, 8)})`);
    }
    const choice = prompt(`Move to folder:\n${choices.map((c, i) => `${i}: ${c}`).join('\n')}\n\nEnter number:`);
    if (choice === null) return;
    const idx = parseInt(choice);
    if (isNaN(idx) || idx < 0 || idx > folders.length) return;
    const folderId = idx === 0 ? null : folders[idx - 1].id;
    await db()?.execute('UPDATE conversations SET folder_id = ?, updated_at = ? WHERE id = ?', [folderId, new Date().toISOString(), id]);
    await this.refresh();
  }

  private async createNewFolder(): Promise<void> {
    const name = prompt('Folder name:');
    if (!name) return;
    const folders = (await db()?.getAll('SELECT MAX(sort_order) as max FROM folders')) || [{ max: 0 }];
    const nextOrder = (folders[0]?.max ?? 0) + 1;
    await db()?.execute(
      'INSERT INTO folders (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [crypto.randomUUID(), name, nextOrder, new Date().toISOString(), new Date().toISOString()]
    );
    await this.refresh();
  }

  private async deleteConv(id: string): Promise<void> {
    if (!confirm('Delete this conversation and all its messages?')) return;
    await db()?.execute('DELETE FROM token_usage WHERE conversation_id = ?', [id]);
    await db()?.execute('DELETE FROM messages WHERE conversation_id = ?', [id]);
    await db()?.execute('DELETE FROM conversations WHERE id = ?', [id]);
    await this.refresh();
  }

  private filter(query: string): void {
    document.querySelectorAll('.conversation-item').forEach(el => {
      const text = el.textContent?.toLowerCase() || '';
      (el as HTMLElement).style.display = text.includes(query.toLowerCase()) ? '' : 'none';
    });
  }
}

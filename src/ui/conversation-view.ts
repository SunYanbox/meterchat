import { App } from './app';

const db = () => (window as any).electronAPI?.db;

let currentConvId: string | null = null;
let currentBranchId: string | null = null;

export class ConversationView {
  constructor(private app: App) {
    this.init();
  }

  private init(): void {
    const sendBtn = document.getElementById('send-btn');
    const msgInput = document.getElementById('message-input') as HTMLTextAreaElement;
    const startBtn = document.getElementById('start-conversation-btn');
    const titleEl = document.getElementById('conversation-title');

    sendBtn?.addEventListener('click', () => this.sendMessage());
    msgInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    startBtn?.addEventListener('click', () => this.createConversation());

    // Branch switcher toggle
    const branchBtn = document.getElementById('branch-switcher-btn');
    branchBtn?.addEventListener('click', () => {
      document.getElementById('branch-dropdown')?.classList.toggle('open');
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#branch-switcher')) {
        document.getElementById('branch-dropdown')?.classList.remove('open');
      }
    });

    // Title editing
    titleEl?.addEventListener('dblclick', () => {
      titleEl.contentEditable = 'true';
      titleEl.focus();
    });
    titleEl?.addEventListener('blur', () => {
      titleEl.contentEditable = 'false';
      const text = titleEl.textContent?.trim();
      if (text && currentConvId) {
        db()?.execute('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?', [text, new Date().toISOString(), currentConvId]);
      }
    });
    titleEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); titleEl?.blur(); }
    });
  }

  async loadConversation(convId: string | null): Promise<void> {
    if (!convId) return;
    currentConvId = convId;

    const conv = await db()?.get('SELECT * FROM conversations WHERE id = ?', [convId]);
    if (!conv) return;

    // Get or create first branch
    const branches = (await db()?.getAll('SELECT DISTINCT branch_id FROM messages WHERE conversation_id = ?', [convId])) || [];
    if (branches.length === 0) {
      currentBranchId = null;
      this.renderEmptyConversation(conv);
      return;
    }

    currentBranchId = branches[0].branch_id;
    this.loadBranch(conv, currentBranchId);
  }

  private async loadBranch(conv: any, branchId: string | null): Promise<void> {
    const titleEl = document.getElementById('conversation-title');
    if (titleEl) titleEl.textContent = conv.title || 'Untitled';

    const banner = document.getElementById('system-prompt-banner');
    if (banner) {
      banner.textContent = `System: ${conv.system_prompt}`;
      banner.classList.remove('hidden');
    }

    const messages = (await db()?.getAll(
      'SELECT * FROM messages WHERE conversation_id = ? AND branch_id = ? ORDER BY created_at ASC',
      [currentConvId, branchId]
    )) || [];

    const msgList = document.getElementById('message-list');
    if (!msgList) return;
    msgList.innerHTML = '';

    for (const msg of messages) {
      this.renderMessage(msg);
    }
    msgList.scrollTop = msgList.scrollHeight;

    this.renderBranchSwitcher();
    this.renderTokenSummary();
  }

  private renderMessage(msg: any): void {
    const msgList = document.getElementById('message-list');
    if (!msgList) return;

    const div = document.createElement('div');
    div.className = `message ${msg.role}`;
    div.dataset.messageId = msg.id;

    const header = document.createElement('div');
    header.className = 'message-header';

    const label = document.createElement('span');
    label.textContent = msg.role === 'user' ? 'You' : (msg.model || 'Assistant');
    header.appendChild(label);

    if (msg.role !== 'user') {
      const forkBtn = document.createElement('button');
      forkBtn.className = 'fork-btn';
      forkBtn.textContent = 'Fork';
      forkBtn.onclick = () => this.forkMessage(msg.id);
      header.appendChild(forkBtn);
    }

    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = msg.content;

    div.appendChild(header);
    div.appendChild(content);
    msgList.appendChild(div);
  }

  private renderEmptyConversation(conv: any): void {
    const titleEl = document.getElementById('conversation-title');
    if (titleEl) titleEl.textContent = conv.title || 'Untitled';

    const banner = document.getElementById('system-prompt-banner');
    if (banner) {
      banner.textContent = `System: ${conv.system_prompt}`;
      banner.classList.remove('hidden');
    }

    const msgList = document.getElementById('message-list');
    if (msgList) msgList.innerHTML = '';

    document.getElementById('branch-switcher-btn')?.removeAttribute('data-has-branches');
  }

  private async createConversation(): Promise<void> {
    const systemInput = document.getElementById('system-prompt-input') as HTMLTextAreaElement;
    const firstMsgInput = document.getElementById('first-message-input') as HTMLTextAreaElement;

    const systemPrompt = systemInput?.value?.trim() || 'You are a helpful assistant.';
    const firstMessage = firstMsgInput?.value?.trim();
    if (!firstMessage) return;

    const convId = crypto.randomUUID();
    const branchId = crypto.randomUUID();
    const msgId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db()?.execute(
      'INSERT INTO conversations (id, title, system_prompt, is_system_locked, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)',
      [convId, firstMessage.slice(0, 50), systemPrompt, now, now]
    );
    await db()?.execute(
      'INSERT INTO messages (id, conversation_id, role, content, model, parent_id, branch_id, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)',
      [msgId, convId, 'user', firstMessage, '', branchId, now]
    );

    currentConvId = convId;
    currentBranchId = branchId;

    // Clear form
    systemInput.value = 'You are a helpful assistant.';
    firstMsgInput.value = '';

    this.app.showConversation();
    await this.loadConversation(convId);
    await this.app.refreshSidebar();
  }

  private async sendMessage(): Promise<void> {
    const input = document.getElementById('message-input') as HTMLTextAreaElement;
    if (!input || !input.value.trim() || !currentConvId) return;

    const content = input.value.trim();

    if (!currentBranchId) {
      // First message in conversation
      currentBranchId = crypto.randomUUID();
    }

    input.value = '';

    const lastMsg = (await db()?.get(
      'SELECT * FROM messages WHERE conversation_id = ? AND branch_id = ? ORDER BY created_at DESC LIMIT 1',
      [currentConvId, currentBranchId]
    ));

    const msgId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db()?.execute(
      'INSERT INTO messages (id, conversation_id, role, content, model, parent_id, branch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [msgId, currentConvId, 'user', content, '', lastMsg?.id || null, currentBranchId, now]
    );

    this.renderMessage({
      id: msgId,
      conversation_id: currentConvId,
      role: 'user',
      content,
      model: '',
      parent_id: lastMsg?.id || null,
      branch_id: currentBranchId,
      created_at: now,
    });

    // Call API instead of simulating
    this.callApi();
  }

  private async callApi(): Promise<void> {
    if (!currentConvId || !currentBranchId) return;

    const api = () => (window as any).electronAPI?.api;
    const encrypt = () => (window as any).electronAPI?.encrypt;

    // Get conversation info
    const conv = await db()?.get('SELECT * FROM conversations WHERE id = ?', [currentConvId]);
    if (!conv) return;

    // Get first enabled provider with API key
    const provider = await db()?.get(`
      SELECT p.*, pk.default_model, pk.default_temperature, pk.api_key as encrypted_key
      FROM providers p
      JOIN provider_keys pk ON pk.provider_id = p.id
      WHERE p.is_enabled = 1
      LIMIT 1
    `);

    if (!provider || !encrypt()) {
      this.fallbackResponse();
      return;
    }

    // Decrypt API key
    let apiKey: string;
    try {
      apiKey = await encrypt()!.decrypt(provider.encrypted_key);
    } catch {
      this.fallbackResponse();
      return;
    }

    // Get messages in current branch
    const messages = await db()?.getAll(
      'SELECT * FROM messages WHERE conversation_id = ? AND branch_id = ? ORDER BY created_at ASC',
      [currentConvId, currentBranchId]
    );
    if (!messages || messages.length === 0) return;

    // Create assistant message placeholder
    const assistantMsgId = crypto.randomUUID();
    const now = new Date().toISOString();
    const lastMsg = messages[messages.length - 1];

    await db()?.execute(
      'INSERT INTO messages (id, conversation_id, role, content, model, parent_id, branch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [assistantMsgId, currentConvId, 'assistant', '', provider.default_model || 'deepseek-chat', lastMsg?.id || null, currentBranchId, now]
    );

    // Render placeholder
    const msgList = document.getElementById('message-list');
    const assistantDiv = document.createElement('div');
    assistantDiv.className = 'message assistant';
    assistantDiv.dataset.messageId = assistantMsgId;
    assistantDiv.innerHTML = `<div class="message-header"><span>${provider.default_model || 'Assistant'}</span></div><div class="message-content"></div>`;
    msgList?.appendChild(assistantDiv);
    msgList!.scrollTop = msgList!.scrollHeight;

    const contentDiv = assistantDiv.querySelector('.message-content') as HTMLElement;
    let accumulated = '';

    // Build request body
    const apiMessages = messages.map((m: any) => ({ role: m.role, content: m.content }));
    const body = {
      model: provider.default_model || 'deepseek-chat',
      messages: [
        { role: 'system', content: conv.system_prompt },
        ...apiMessages,
      ],
      temperature: provider.default_temperature ?? 0.7,
      stream: true,
    };

    // Call API with streaming
    api()!.send(
      { baseUrl: provider.base_url, apiKey, body },
      {
        onChunk: (text: string) => {
          accumulated += text;
          if (contentDiv) contentDiv.textContent = accumulated;
          msgList!.scrollTop = msgList!.scrollHeight;
        },
        onDone: async (usage: any) => {
          // Update message with final content
          await db()?.execute(
            'UPDATE messages SET content = ? WHERE id = ?',
            [accumulated, assistantMsgId]
          );

          // Save token usage
          if (usage && usage.prompt_tokens != null) {
            await db()?.execute(
              'INSERT INTO token_usage (id, message_id, conversation_id, model, prompt_tokens, completion_tokens, prompt_cache_hit_tokens, prompt_cache_miss_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [
                crypto.randomUUID(), assistantMsgId, currentConvId,
                provider.default_model || 'deepseek-chat',
                usage.prompt_tokens || 0, usage.completion_tokens || 0,
                usage.prompt_cache_hit_tokens || 0, usage.prompt_cache_miss_tokens || 0,
                new Date().toISOString(),
              ]
            );
          }

          // Update header with model name
          const headerSpan = assistantDiv.querySelector('.message-header span');
          if (headerSpan) headerSpan.textContent = provider.default_model || 'Assistant';

          await this.renderBranchSwitcher();
          await this.renderTokenSummary();
        },
        onError: (err: any) => {
          if (contentDiv) {
            const statusMessages: Record<number, string> = {
              401: 'API Key is invalid. Check Settings.',
              403: 'API Key is invalid. Check Settings.',
              429: 'Too many requests. Try again later.',
            };
            contentDiv.textContent = statusMessages[err.status] || `Error: ${err.body || err.message || 'Network error'}`;
            contentDiv.style.color = 'var(--danger)';
          }
        },
      }
    );
  }

  private async fallbackResponse(): Promise<void> {
    if (!currentConvId || !currentBranchId) return;

    const lastMsg = await db()?.get(
      'SELECT * FROM messages WHERE conversation_id = ? AND branch_id = ? ORDER BY created_at DESC LIMIT 1',
      [currentConvId, currentBranchId]
    );

    const msgId = crypto.randomUUID();
    const now = new Date().toISOString();
    const fallbackContent = 'No API key configured. Go to Settings to add an API key.';

    await db()?.execute(
      'INSERT INTO messages (id, conversation_id, role, content, model, parent_id, branch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [msgId, currentConvId, 'assistant', fallbackContent, 'none', lastMsg?.id || null, currentBranchId, now]
    );

    this.renderMessage({
      id: msgId, conversation_id: currentConvId, role: 'assistant',
      content: fallbackContent, model: 'none',
      parent_id: lastMsg?.id || null, branch_id: currentBranchId, created_at: new Date().toISOString(),
    });
  }

  private async forkMessage(messageId: string): Promise<void> {
    const msg = prompt('Enter your message from this fork point:');
    if (!msg || !currentConvId) return;

    const branchId = crypto.randomUUID();
    const msgId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db()?.execute(
      'INSERT INTO messages (id, conversation_id, role, content, model, parent_id, branch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [msgId, currentConvId, 'user', msg, '', messageId, branchId, now]
    );

    currentBranchId = branchId;
    const conv = await db()?.get('SELECT * FROM conversations WHERE id = ?', [currentConvId]);
    if (conv) await this.loadBranch(conv, branchId);
  }

  private async renderBranchSwitcher(): Promise<void> {
    if (!currentConvId) return;

    const branches = (await db()?.getAll(
      'SELECT DISTINCT branch_id FROM messages WHERE conversation_id = ?',
      [currentConvId]
    )) || [];

    const dropdown = document.getElementById('branch-dropdown');
    if (!dropdown) return;
    dropdown.innerHTML = '';

    for (const branch of branches) {
      const item = document.createElement('div');
      item.className = `branch-item${branch.branch_id === currentBranchId ? ' active' : ''}`;

      const label = document.createElement('span');
      label.textContent = `Branch ${branch.branch_id.slice(0, 8)}`;
      item.appendChild(label);

      const tokens = document.createElement('span');
      tokens.className = 'branch-tokens';
      const tokenData = (await db()?.getAll(
        `SELECT tu.* FROM token_usage tu
         JOIN messages m ON tu.message_id = m.id
         WHERE m.conversation_id = ? AND m.branch_id = ?`,
        [currentConvId, branch.branch_id]
      )) || [];
      const totalP = tokenData.reduce((s: number, t: any) => s + (t.prompt_tokens || 0), 0);
      const totalC = tokenData.reduce((s: number, t: any) => s + (t.completion_tokens || 0), 0);
      tokens.textContent = totalP || totalC ? `${totalP}↑ ${totalC}↓` : '';
      item.appendChild(tokens);

      item.onclick = async () => {
        if (branch.branch_id !== currentBranchId) {
          currentBranchId = branch.branch_id;
          const conv = await db()?.get('SELECT * FROM conversations WHERE id = ?', [currentConvId]);
          if (conv) this.loadBranch(conv, currentBranchId);
        }
        dropdown.classList.remove('open');
      };

      dropdown.appendChild(item);
    }

    const branchBtn = document.getElementById('branch-switcher-btn');
    if (branchBtn) {
      (branchBtn as HTMLElement).dataset.hasBranches = String(branches.length > 1);
      branchBtn.textContent = branches.length > 1 ? `Branches (${branches.length}) ▾` : 'Branches ▾';
    }
  }

  private async renderTokenSummary(): Promise<void> {
    if (!currentConvId) return;
    const summary = document.querySelector('.token-summary');
    if (!summary) return;

    const tokenData = (await db()?.getAll(
      'SELECT SUM(prompt_tokens) as pt, SUM(completion_tokens) as ct FROM token_usage WHERE conversation_id = ?',
      [currentConvId]
    )) || [];

    if (tokenData.length && (tokenData[0].pt || tokenData[0].ct)) {
      summary.textContent = `Tokens: ${tokenData[0].pt}↑ ${tokenData[0].ct}↓`;
    } else {
      summary.textContent = '';
    }
  }
}

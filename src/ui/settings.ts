const db = () => (window as any).electronAPI?.db;
const encrypt = () => (window as any).electronAPI?.encrypt;

export class Settings {
  static async seedDefaultProviders(): Promise<void> {
    const count = await db()?.get('SELECT COUNT(*) as count FROM providers');
    if (!count || count.count > 0) return;

    const now = new Date().toISOString();
    await db()?.execute(
      'INSERT INTO providers (id, name, base_url, is_enabled, created_at) VALUES (?, ?, ?, 1, ?)',
      [crypto.randomUUID(), 'DeepSeek Official', 'https://api.deepseek.com/v1', now]
    );
    await db()?.execute(
      'INSERT INTO providers (id, name, base_url, is_enabled, created_at) VALUES (?, ?, ?, 1, ?)',
      [crypto.randomUUID(), 'SiliconFlow', 'https://api.siliconflow.cn/v1', now]
    );
  }

  static async showDialog(): Promise<void> {
    const providers = (await db()?.getAll('SELECT * FROM providers WHERE is_enabled = 1')) || [];
    const keys = (await db()?.getAll('SELECT * FROM provider_keys')) || [];

    let html = `<div id="settings-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;z-index:1000;">
      <div style="background:var(--bg-surface);border-radius:12px;padding:24px;width:500px;max-height:80vh;overflow-y:auto;">
        <h2 style="margin-bottom:16px;">Settings</h2>`;

    for (const p of providers) {
      const key = keys.find((k: any) => k.provider_id === p.id);
      html += `
        <div style="margin-bottom:20px;padding:16px;background:var(--bg-secondary);border-radius:8px;">
          <h3 style="margin-bottom:12px;">${this.esc(p.name)}</h3>
          <div style="margin-bottom:8px;font-size:12px;color:var(--text-muted);">${p.base_url}</div>
          <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;">API Key</label>
          <input type="password" id="key-${p.id}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-surface);color:var(--text-primary);margin-bottom:8px;" placeholder="sk-..." ${key ? 'value="********"' : ''}>
          <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Model</label>
          <input type="text" id="model-${p.id}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-surface);color:var(--text-primary);margin-bottom:8px;" placeholder="deepseek-chat" value="${key?.default_model || ''}">
          <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Temperature (0-2)</label>
          <input type="number" id="temp-${p.id}" step="0.1" min="0" max="2" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-surface);color:var(--text-primary);margin-bottom:8px;" value="${key?.default_temperature ?? 0.7}">
        </div>`;
    }

    html += `
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="settings-cancel" style="padding:8px 16px;border:1px solid var(--border);border-radius:6px;background:var(--bg-surface);color:var(--text-primary);cursor:pointer;">Cancel</button>
          <button id="settings-save" style="padding:8px 16px;border:none;border-radius:6px;background:var(--accent);color:var(--bg-primary);cursor:pointer;font-weight:600;">Save</button>
        </div>
      </div>
    </div>`;

    const overlay = document.createElement('div');
    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    document.getElementById('settings-cancel')!.onclick = () => overlay.remove();
    document.getElementById('settings-save')!.onclick = async () => {
      for (const p of providers) {
        const keyInput = document.getElementById(`key-${p.id}`) as HTMLInputElement;
        const modelInput = document.getElementById(`model-${p.id}`) as HTMLInputElement;
        const tempInput = document.getElementById(`temp-${p.id}`) as HTMLInputElement;

        if (keyInput.value && keyInput.value !== '********' && encrypt()) {
          const encryptedKey = await encrypt()!.encrypt(keyInput.value);
          await db()?.execute(
            'INSERT OR REPLACE INTO provider_keys (id, provider_id, api_key, default_temperature, default_model, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            [crypto.randomUUID(), p.id, encryptedKey, parseFloat(tempInput.value) || 0.7, modelInput.value || 'deepseek-chat', new Date().toISOString()]
          );
        }
      }
      overlay.remove();
    };
  }

  private static esc(s: string): string {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
}

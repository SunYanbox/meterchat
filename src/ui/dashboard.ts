import { App } from './app';

const db = () => (window as any).electronAPI?.db;

export class Dashboard {
  constructor(private app: App) {}

  async refresh(): Promise<void> {
    await this.renderStats();
    await this.renderDetails();
  }

  private async renderStats(): Promise<void> {
    const container = document.getElementById('dashboard-stats');
    if (!container) return;

    const totals = (await db()?.get(`
      SELECT
        COALESCE(SUM(prompt_tokens), 0) as pt,
        COALESCE(SUM(completion_tokens), 0) as ct,
        COALESCE(SUM(prompt_cache_hit_tokens), 0) as ch,
        COALESCE(SUM(prompt_cache_miss_tokens), 0) as cm
      FROM token_usage
    `)) || { pt: 0, ct: 0, ch: 0, cm: 0 };

    const convCount = (await db()?.get('SELECT COUNT(*) as count FROM conversations')) || { count: 0 };
    const cacheRate = (totals.pt + totals.ct) > 0
      ? ((totals.ch / (totals.pt + totals.ct)) * 100).toFixed(1)
      : '0.0';

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${convCount.count}</div>
        <div class="stat-label">Conversations</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${this.fmt(totals.pt)}</div>
        <div class="stat-label">Input Tokens</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${this.fmt(totals.ct)}</div>
        <div class="stat-label">Output Tokens</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${cacheRate}%</div>
        <div class="stat-label">Cache Hit Rate</div>
      </div>
    `;
  }

  private async renderDetails(): Promise<void> {
    const container = document.getElementById('dashboard-details');
    if (!container) return;

    const rows = (await db()?.getAll(`
      SELECT
        DATE(tu.created_at) as date,
        c.title,
        tu.model,
        tu.prompt_tokens,
        tu.completion_tokens,
        tu.prompt_cache_hit_tokens,
        tu.conversation_id
      FROM token_usage tu
      JOIN conversations c ON tu.conversation_id = c.id
      ORDER BY tu.created_at DESC
      LIMIT 100
    `)) || [];

    if (!rows.length) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">No token usage records yet.</p>';
      return;
    }

    let html = '<h3 style="margin-bottom:12px;">Recent Usage</h3><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="border-bottom:1px solid var(--border);color:var(--text-muted);"><th style="padding:8px;text-align:left;">Date</th><th style="padding:8px;text-align:left;">Conversation</th><th style="padding:8px;text-align:left;">Model</th><th style="padding:8px;text-align:right;">Input</th><th style="padding:8px;text-align:right;">Output</th><th style="padding:8px;text-align:right;">Cache</th></tr></thead><tbody>';
    for (const r of rows) {
      html += `<tr style="border-bottom:1px solid var(--border);">
        <td style="padding:8px;">${r.date}</td>
        <td style="padding:8px;">${this.esc(r.title)}</td>
        <td style="padding:8px;">${r.model}</td>
        <td style="padding:8px;text-align:right;">${this.fmt(r.prompt_tokens)}</td>
        <td style="padding:8px;text-align:right;">${this.fmt(r.completion_tokens)}</td>
        <td style="padding:8px;text-align:right;">${this.fmt(r.prompt_cache_hit_tokens)}</td>
      </tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  private fmt(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  }

  private esc(s: string): string {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
}

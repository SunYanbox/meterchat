import { App } from './app';

const db = () => (window as any).electronAPI?.db;
declare const Chart: any;

let pieChartInstance: any = null;
let lineChartInstance: any = null;
let currentRange: '7' | '30' | 'all' = '7';

export class Dashboard {
  constructor(private app: App) {}

  async refresh(): Promise<void> {
    await this.renderStats();
    this.renderPieChart();
    this.renderLineChart();
    await this.renderDetails();
  }

  private async renderStats(): Promise<void> {
    const container = document.getElementById('dashboard-stats');
    if (!container) return;

    const totals = (await db()?.get(`
      SELECT COALESCE(SUM(prompt_tokens), 0) as pt,
             COALESCE(SUM(completion_tokens), 0) as ct,
             COALESCE(SUM(prompt_cache_hit_tokens), 0) as ch,
             COALESCE(SUM(prompt_cache_miss_tokens), 0) as cm
      FROM token_usage
    `)) || { pt: 0, ct: 0, ch: 0, cm: 0 };

    const convCount = (await db()?.get('SELECT COUNT(*) as count FROM conversations')) || { count: 0 };
    const total = totals.pt + totals.ct;
    const cacheRate = total > 0 ? ((totals.ch / total) * 100).toFixed(1) : '0.0';

    container.innerHTML = `
      <div class="stat-card"><div class="stat-value">${convCount.count}</div><div class="stat-label">Conversations</div></div>
      <div class="stat-card"><div class="stat-value">${this.fmt(totals.pt)}</div><div class="stat-label">Input Tokens</div></div>
      <div class="stat-card"><div class="stat-value">${this.fmt(totals.ct)}</div><div class="stat-label">Output Tokens</div></div>
      <div class="stat-card"><div class="stat-value">${cacheRate}%</div><div class="stat-label">Cache Hit Rate</div></div>
    `;
  }

  private async renderPieChart(): Promise<void> {
    const canvas = document.getElementById('pie-chart') as HTMLCanvasElement;
    if (!canvas) return;

    const data = (await db()?.getAll(`
      SELECT model, SUM(prompt_tokens) as pt, SUM(completion_tokens) as ct
      FROM token_usage GROUP BY model ORDER BY pt DESC
    `)) || [];

    if (pieChartInstance) { pieChartInstance.destroy(); pieChartInstance = null; }

    if (!data.length) {
      const ctx = canvas.getContext('2d');
      if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); }
      return;
    }

    const colors = ['#89b4fa', '#a6e3a1', '#f9e2af', '#f38ba8', '#cba6f7', '#94e2d5'];

    pieChartInstance = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: data.map((d: any) => d.model),
        datasets: [{
          data: data.map((d: any) => d.pt),
          backgroundColor: data.map((_: any, i: number) => colors[i % colors.length]),
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#cdd6f4', font: { size: 11 } } },
          title: { display: true, text: 'Input Tokens by Model', color: '#cdd6f4', font: { size: 14 } },
        },
      },
    });
  }

  private async renderLineChart(): Promise<void> {
    const canvas = document.getElementById('line-chart') as HTMLCanvasElement;
    if (!canvas) return;

    const days = currentRange === 'all' ? 9999 : parseInt(currentRange);
    const dateLimit = new Date(Date.now() - days * 86400000).toISOString();

    const data = (await db()?.getAll(`
      SELECT DATE(created_at) as date,
             SUM(prompt_tokens) as pt,
             SUM(completion_tokens) as ct
      FROM token_usage
      WHERE created_at >= ?
      GROUP BY DATE(created_at) ORDER BY date ASC
    `, [dateLimit])) || [];

    if (lineChartInstance) { lineChartInstance.destroy(); lineChartInstance = null; }

    const chartContainer = canvas.parentElement;
    if (!chartContainer) return;

    // Range buttons
    let btnContainer = chartContainer.querySelector('.chart-range-btns') as HTMLElement;
    if (!btnContainer) {
      btnContainer = document.createElement('div');
      btnContainer.className = 'chart-range-btns';
      btnContainer.style.cssText = 'text-align:center;margin-top:8px;display:flex;gap:8px;justify-content:center;';
      chartContainer.appendChild(btnContainer);
    }

    btnContainer.innerHTML = '';
    for (const range of ['7', '30', 'all'] as const) {
      const btn = document.createElement('button');
      btn.textContent = range === 'all' ? 'All' : `${range}d`;
      btn.style.cssText = `padding:4px 12px;border:1px solid var(--border);border-radius:4px;background:${range === currentRange ? 'var(--accent)' : 'var(--bg-surface)'};color:${range === currentRange ? 'var(--bg-primary)' : 'var(--text-primary)'};cursor:pointer;font-size:12px;`;
      btn.onclick = () => {
        currentRange = range;
        this.renderLineChart();
      };
      btnContainer.appendChild(btn);
    }

    if (!data.length) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    lineChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.map((d: any) => d.date),
        datasets: [
          {
            label: 'Input',
            data: data.map((d: any) => d.pt),
            borderColor: '#89b4fa',
            backgroundColor: 'rgba(137,180,250,0.1)',
            fill: true, tension: 0.3,
          },
          {
            label: 'Output',
            data: data.map((d: any) => d.ct),
            borderColor: '#a6e3a1',
            backgroundColor: 'rgba(166,227,161,0.1)',
            fill: true, tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#cdd6f4', font: { size: 11 } } },
          title: { display: true, text: 'Token Usage Trend', color: '#cdd6f4', font: { size: 14 } },
        },
        scales: {
          x: { ticks: { color: '#a6adc8', font: { size: 10 } }, grid: { color: 'rgba(69,71,90,0.3)' } },
          y: { ticks: { color: '#a6adc8', font: { size: 10 } }, grid: { color: 'rgba(69,71,90,0.3)' } },
        },
      },
    });
  }

  private async renderDetails(): Promise<void> {
    const container = document.getElementById('dashboard-details');
    if (!container) return;

    const rows = (await db()?.getAll(`
      SELECT DATE(tu.created_at) as date, c.title, tu.model,
             tu.prompt_tokens, tu.completion_tokens,
             tu.prompt_cache_hit_tokens, tu.conversation_id
      FROM token_usage tu JOIN conversations c ON tu.conversation_id = c.id
      ORDER BY tu.created_at DESC LIMIT 100
    `)) || [];

    if (!rows.length) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">No data yet.</p>';
      return;
    }

    let html = '<h3 style="margin-bottom:12px;">Recent Usage</h3><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="border-bottom:1px solid var(--border);color:var(--text-muted);"><th style="padding:8px;text-align:left;">Date</th><th style="padding:8px;text-align:left;">Conversation</th><th style="padding:8px;text-align:left;">Model</th><th style="padding:8px;text-align:right;">Input</th><th style="padding:8px;text-align:right;">Output</th><th style="padding:8px;text-align:right;">Cache</th></tr></thead><tbody>';
    for (const r of rows) {
      html += `<tr style="border-bottom:1px solid var(--border);"><td style="padding:8px;">${r.date}</td><td style="padding:8px;">${this.esc(r.title)}</td><td style="padding:8px;">${r.model}</td><td style="padding:8px;text-align:right;">${this.fmt(r.prompt_tokens)}</td><td style="padding:8px;text-align:right;">${this.fmt(r.completion_tokens)}</td><td style="padding:8px;text-align:right;">${this.fmt(r.prompt_cache_hit_tokens)}</td></tr>`;
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

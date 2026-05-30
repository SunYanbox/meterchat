import { Sidebar } from './sidebar';
import { ConversationView } from './conversation-view';
import { Dashboard } from './dashboard';
import { Settings } from './settings';

export class App {
  private sidebar: Sidebar;
  private conversationView: ConversationView;
  private dashboard: Dashboard;

  constructor() {
    this.sidebar = new Sidebar(this);
    this.conversationView = new ConversationView(this);
    this.dashboard = new Dashboard(this);
    this.init();
  }

  private async init(): Promise<void> {
    const dashboardBtn = document.getElementById('dashboard-btn');
    const backBtn = document.getElementById('back-to-conversation-btn');
    const newConvBtn = document.getElementById('new-conversation-btn');
    const settingsBtn = document.getElementById('settings-btn');

    dashboardBtn?.addEventListener('click', () => this.showDashboard());
    backBtn?.addEventListener('click', () => this.showConversation());
    newConvBtn?.addEventListener('click', () => this.showNewConversation());
    settingsBtn?.addEventListener('click', () => Settings.showDialog());

    await Settings.seedDefaultProviders();
    await this.sidebar.refresh();
    this.showNewConversation();
  }

  showConversation(): void {
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
    document.getElementById('conversation-view')?.classList.add('hidden');
    document.getElementById('new-conversation-view')?.classList.add('hidden');
    document.getElementById('dashboard-view')?.classList.remove('hidden');
    this.dashboard.refresh();
  }

  async refreshSidebar(): Promise<void> {
    await this.sidebar.refresh();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App();
});

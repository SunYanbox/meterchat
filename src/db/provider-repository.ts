import { Database } from 'sql.js';
import { mapRows } from './conversation-repository';

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
  constructor(private db: Database) {}

  createProvider(name: string, baseUrl: string): Provider {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db.run(
      'INSERT INTO providers (id, name, base_url, is_enabled, created_at) VALUES (?, ?, ?, 1, ?)',
      [id, name, baseUrl, now]
    );
    const r = this.db.exec('SELECT * FROM providers WHERE id = ?', [id]);
    return mapRows<Provider>(r)[0];
  }

  getAllProviders(): Provider[] {
    const r = this.db.exec('SELECT * FROM providers ORDER BY created_at ASC');
    return mapRows<Provider>(r);
  }

  setApiKey(providerId: string, encryptedKey: string, defaultModel: string, defaultTemperature: number): ProviderKey {
    const now = new Date().toISOString();
    const existing = this.db.exec('SELECT * FROM provider_keys WHERE provider_id = ?', [providerId]);
    if (existing.length && existing[0].values.length) {
      this.db.run(
        'UPDATE provider_keys SET api_key = ?, default_model = ?, default_temperature = ?, updated_at = ? WHERE provider_id = ?',
        [encryptedKey, defaultModel, defaultTemperature, now, providerId]
      );
    } else {
      const id = crypto.randomUUID();
      this.db.run(
        'INSERT INTO provider_keys (id, provider_id, api_key, default_temperature, default_model, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, providerId, encryptedKey, defaultTemperature, defaultModel, now]
      );
    }
    const r = this.db.exec('SELECT * FROM provider_keys WHERE provider_id = ?', [providerId]);
    return mapRows<ProviderKey>(r)[0];
  }

  getApiKey(providerId: string): ProviderKey | undefined {
    const r = this.db.exec('SELECT * FROM provider_keys WHERE provider_id = ?', [providerId]);
    return mapRows<ProviderKey>(r)[0];
  }

  deleteProvider(id: string): void {
    this.db.run('DELETE FROM provider_keys WHERE provider_id = ?', [id]);
    this.db.run('DELETE FROM providers WHERE id = ?', [id]);
  }
}

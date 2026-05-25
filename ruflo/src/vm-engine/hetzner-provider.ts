import type { HetznerServer, HetznerServerCreateRequest } from './types.js';

const HETZNER_API_BASE = 'https://api.hetzner.cloud/v1';

export class HetznerProvider {
  private readonly headers: Record<string, string>;

  constructor(apiToken: string) {
    this.headers = {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    };
  }

  async createServer(req: HetznerServerCreateRequest): Promise<HetznerServer> {
    const response = await fetch(`${HETZNER_API_BASE}/servers`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(req),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Hetzner createServer failed [${response.status}]: ${body}`);
    }

    const data = await response.json() as { server: HetznerServer };
    return data.server;
  }

  async deleteServer(serverId: number): Promise<void> {
    const response = await fetch(`${HETZNER_API_BASE}/servers/${serverId}`, {
      method: 'DELETE',
      headers: this.headers,
    });

    if (!response.ok && response.status !== 404) {
      const body = await response.text();
      throw new Error(`Hetzner deleteServer [${serverId}] failed [${response.status}]: ${body}`);
    }
  }

  async listServers(labelSelector?: string): Promise<HetznerServer[]> {
    const url = new URL(`${HETZNER_API_BASE}/servers`);
    if (labelSelector) {
      url.searchParams.set('label_selector', labelSelector);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Hetzner listServers failed [${response.status}]: ${body}`);
    }

    const data = await response.json() as { servers: HetznerServer[] };
    return data.servers;
  }

  async getServer(serverId: number): Promise<HetznerServer> {
    const response = await fetch(`${HETZNER_API_BASE}/servers/${serverId}`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Hetzner getServer [${serverId}] failed [${response.status}]: ${body}`);
    }

    const data = await response.json() as { server: HetznerServer };
    return data.server;
  }
}

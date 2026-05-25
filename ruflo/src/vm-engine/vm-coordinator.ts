import { randomUUID } from 'crypto';
import {
  VmStatus,
  type HetznerServer,
  type VmInstance,
  type VmPoolConfig,
  type VmServerType,
  type VmTrigger,
} from './types.js';
import type { DecisionEngine } from './decision-engine.js';
import type { HetznerProvider } from './hetzner-provider.js';

const MANAGED_LABEL = 'getopscore/managed=true';
const CLOUD_INIT_SCRIPT = Buffer.from(
  `#!/bin/bash
set -e
apt-get update -qq
apt-get install -y -qq docker.io
systemctl enable --now docker
docker pull ruvnet/ruflo:latest
docker run -d --restart=unless-stopped ruvnet/ruflo:latest
`,
).toString('base64');

function hetznerToVmInstance(
  server: HetznerServer,
  serverType: VmServerType,
): VmInstance {
  return {
    id: randomUUID(),
    name: server.name,
    serverType,
    datacenter: server.datacenter.name as VmInstance['datacenter'],
    status: server.status === 'running' ? VmStatus.running : VmStatus.stopped,
    publicIp: server.public_net.ipv4.ip,
    privateIp: server.private_net?.[0]?.ip,
    createdAt: new Date(server.created),
    lastActiveAt: new Date(),
    taskCount: 0,
    hetznerServerId: server.id,
    labels: {},
  };
}

export class VmCoordinator {
  private readonly pool = new Map<string, VmInstance>();
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly provider: HetznerProvider,
    private readonly engine: DecisionEngine,
    private readonly config: VmPoolConfig,
  ) {}

  start(): void {
    this.reconcile().catch((err) =>
      console.error('[vm-coordinator] Initial reconcile error:', err),
    );
    this.intervalId = setInterval(() => {
      this.reconcile().catch((err) =>
        console.error('[vm-coordinator] Reconcile error:', err),
      );
    }, 60_000);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async reconcile(): Promise<void> {
    const servers = await this.provider.listServers(MANAGED_LABEL);
    const liveIds = new Set(servers.map((s) => s.id));

    // Remove pool entries that no longer exist in Hetzner
    for (const [id, vm] of this.pool) {
      if (!liveIds.has(vm.hetznerServerId)) {
        this.pool.delete(id);
      }
    }

    // Add Hetzner servers not yet tracked locally
    for (const server of servers) {
      const existing = [...this.pool.values()].find(
        (v) => v.hetznerServerId === server.id,
      );
      if (!existing) {
        const instance = hetznerToVmInstance(server, this.config.serverType);
        this.pool.set(instance.id, instance);
      }
    }

    // Destroy VMs that have been idle beyond the timeout
    const idleThresholdMs = this.config.idleTimeoutSeconds * 1000;
    const now = Date.now();
    for (const vm of this.pool.values()) {
      if (
        vm.taskCount === 0 &&
        now - vm.lastActiveAt.getTime() > idleThresholdMs
      ) {
        await this.requestDestroy(vm.id).catch((err) =>
          console.error(`[vm-coordinator] Failed to destroy idle VM ${vm.id}:`, err),
        );
      }
    }
  }

  async requestCreate(trigger: VmTrigger): Promise<VmInstance | null> {
    const metrics = this.getMetrics();
    const decision = this.engine.evaluate(
      metrics.queueDepth,
      metrics.totalVms,
      metrics.estimatedMonthlyCostEur,
    );

    if (decision.action !== 'create') {
      console.warn(`[vm-coordinator] Create denied: ${decision.reason}`);
      return null;
    }

    const serverReq = {
      name: `getopscore-agent-${Date.now()}`,
      server_type: this.config.serverType,
      location: this.config.datacenter,
      image: 'ubuntu-22.04',
      ssh_keys: [this.config.sshKeyName],
      networks: this.config.privateNetworkId
        ? [parseInt(this.config.privateNetworkId, 10)]
        : undefined,
      labels: {
        'getopscore/managed': 'true',
        'getopscore/created-by': 'vm-coordinator',
      },
      user_data: CLOUD_INIT_SCRIPT,
    };

    const server = await this.provider.createServer(serverReq);
    const instance: VmInstance = {
      id: randomUUID(),
      name: server.name,
      serverType: this.config.serverType,
      datacenter: this.config.datacenter,
      status: VmStatus.creating,
      publicIp: server.public_net.ipv4.ip,
      privateIp: server.private_net?.[0]?.ip,
      createdAt: new Date(server.created),
      lastActiveAt: new Date(),
      taskCount: 0,
      hetznerServerId: server.id,
      labels: server.labels ?? {},
    };

    this.pool.set(instance.id, instance);
    console.info(`[vm-coordinator] Created VM ${instance.name} (${instance.id})`);
    return instance;
  }

  async requestDestroy(vmId: string): Promise<void> {
    const vm = this.pool.get(vmId);
    if (!vm) {
      throw new Error(`VM ${vmId} not found in pool`);
    }

    vm.status = VmStatus.stopping;
    await this.provider.deleteServer(vm.hetznerServerId);
    this.pool.delete(vmId);
    console.info(`[vm-coordinator] Destroyed VM ${vm.name} (${vmId})`);
  }

  getPool(): VmInstance[] {
    return [...this.pool.values()];
  }

  getMetrics(): {
    totalVms: number;
    runningVms: number;
    estimatedMonthlyCostEur: number;
    queueDepth: number;
  } {
    const vms = this.getPool();
    const runningVms = vms.filter((v) => v.status === VmStatus.running).length;
    const estimatedMonthlyCostEur =
      vms.length * this.engine.estimateMonthlyCostEur(this.config.serverType);

    return {
      totalVms: vms.length,
      runningVms,
      estimatedMonthlyCostEur,
      // queueDepth is externally set; coordinator tracks it via reconcile context
      queueDepth: 0,
    };
  }
}

import express, { type Request, type Response } from 'express';
import { VmServerType, VmDatacenter, type VmTrigger } from './types.js';
import { HetznerProvider } from './hetzner-provider.js';
import { DecisionEngine } from './decision-engine.js';
import { VmCoordinator } from './vm-coordinator.js';
import { formatMetrics } from './metrics.js';

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const DRY_RUN = !process.env.HETZNER_API_TOKEN;

if (DRY_RUN) {
  console.warn('[vm-engine] WARNING: HETZNER_API_TOKEN not set — running in DRY-RUN mode. No Hetzner API calls will be made.');
}

function env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

const config = {
  maxMonthlyEur: parseFloat(env('HETZNER_MAX_MONTHLY_EUR', '100')),
  queueDepthThreshold: parseInt(env('VM_QUEUE_DEPTH_THRESHOLD', '10'), 10),
  complexityThreshold: parseFloat(env('VM_COMPLEXITY_THRESHOLD', '0.8')),
  slaBreachSeconds: parseInt(env('VM_SLA_BREACH_SECONDS', '30'), 10),
  warmPoolSize: parseInt(env('VM_WARM_POOL_SIZE', '1'), 10),
  idleTimeoutSeconds: parseInt(env('VM_IDLE_TIMEOUT_SECONDS', '300'), 10),
  serverType: (env('HETZNER_SERVER_TYPE', VmServerType.cx22)) as VmServerType,
  datacenter: (env('HETZNER_DATACENTER', VmDatacenter.fsn1)) as VmDatacenter,
  sshKeyName: env('HETZNER_SSH_KEY_NAME', 'default'),
  privateNetworkId: process.env.HETZNER_PRIVATE_NETWORK_ID,
};

// In dry-run mode, wrap HetznerProvider with a mock that never calls the real API
class DryRunProvider {
  async createServer(req: { name: string }): Promise<object> {
    console.warn(`[dry-run] createServer("${req.name}") — skipped`);
    return {
      id: Math.floor(Math.random() * 1_000_000),
      name: req.name,
      status: 'running',
      public_net: { ipv4: { ip: '0.0.0.0' } },
      private_net: [],
      created: new Date().toISOString(),
      server_type: { name: config.serverType },
      datacenter: { name: config.datacenter },
    };
  }
  async deleteServer(id: number): Promise<void> {
    console.warn(`[dry-run] deleteServer(${id}) — skipped`);
  }
  async listServers(): Promise<[]> {
    console.warn('[dry-run] listServers() — returning empty list');
    return [];
  }
  async getServer(id: number): Promise<never> {
    throw new Error(`[dry-run] getServer(${id}) — not available in dry-run mode`);
  }
}

const provider = DRY_RUN
  ? (new DryRunProvider() as unknown as HetznerProvider)
  : new HetznerProvider(process.env.HETZNER_API_TOKEN!);

const engine = new DecisionEngine(config);
const coordinator = new VmCoordinator(provider, engine, config);

coordinator.start();

const app = express();
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', dryRun: DRY_RUN, vms: coordinator.getPool().length });
});

app.get('/vms', (_req: Request, res: Response) => {
  res.json({ vms: coordinator.getPool() });
});

app.post('/vms/request', async (req: Request, res: Response) => {
  const trigger = req.body?.trigger as VmTrigger | undefined;

  if (!trigger) {
    res.status(400).json({ error: 'Request body must contain a trigger field' });
    return;
  }

  try {
    const vm = await coordinator.requestCreate(trigger);
    if (vm) {
      res.status(201).json({ vm });
    } else {
      res.json({ denied: true, reason: 'Decision engine rejected the scale-up request' });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.delete('/vms/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await coordinator.requestDestroy(id);
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(404).json({ error: message });
  }
});

app.get('/metrics', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(formatMetrics(coordinator.getMetrics()));
});

app.get('/decision', (req: Request, res: Response) => {
  const queueDepth = parseInt((req.query.queueDepth ?? req.body?.queueDepth ?? '0') as string, 10);
  const complexityScore = parseFloat((req.query.complexityScore ?? req.body?.complexityScore ?? '0') as string);
  const metrics = coordinator.getMetrics();

  const decision = complexityScore > 0
    ? engine.evaluateComplexity(complexityScore, metrics.totalVms, metrics.estimatedMonthlyCostEur)
    : engine.evaluate(queueDepth, metrics.totalVms, metrics.estimatedMonthlyCostEur);

  res.json({ decision });
});

app.listen(PORT, () => {
  console.info(`[vm-engine] Listening on port ${PORT}${DRY_RUN ? ' (DRY-RUN)' : ''}`);
});

process.on('SIGTERM', () => {
  console.info('[vm-engine] SIGTERM received — shutting down');
  coordinator.stop();
  process.exit(0);
});

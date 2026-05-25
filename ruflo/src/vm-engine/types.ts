export enum VmServerType {
  cx22 = 'cx22',
  cx32 = 'cx32',
  cx42 = 'cx42',
  cx52 = 'cx52',
}

export enum VmDatacenter {
  fsn1 = 'fsn1',
  nbg1 = 'nbg1',
  hel1 = 'hel1',
  ash = 'ash',
  hil = 'hil',
}

export enum VmStatus {
  creating = 'creating',
  running = 'running',
  stopping = 'stopping',
  stopped = 'stopped',
  error = 'error',
}

export interface VmInstance {
  id: string;
  name: string;
  serverType: VmServerType;
  datacenter: VmDatacenter;
  status: VmStatus;
  publicIp?: string;
  privateIp?: string;
  createdAt: Date;
  lastActiveAt: Date;
  taskCount: number;
  hetznerServerId: number;
  labels: Record<string, string>;
}

export interface VmTrigger {
  type: 'queue_depth' | 'complexity' | 'explicit_request' | 'sla_breach';
  reason: string;
  taskSpec?: {
    complexity: number;
    estimatedDurationMs: number;
    requiredMemoryMb: number;
  };
}

export interface VmDecision {
  action: 'create' | 'destroy' | 'noop';
  trigger?: VmTrigger;
  targetServerId?: string;
  reason: string;
}

export interface VmPoolConfig {
  maxMonthlyEur: number;
  queueDepthThreshold: number;
  complexityThreshold: number;
  slaBreachSeconds: number;
  warmPoolSize: number;
  idleTimeoutSeconds: number;
  serverType: VmServerType;
  datacenter: VmDatacenter;
  sshKeyName: string;
  privateNetworkId?: string;
}

export interface HetznerServerCreateRequest {
  name: string;
  server_type: string;
  location: string;
  image: string;
  ssh_keys: string[];
  networks?: number[];
  labels: Record<string, string>;
  user_data?: string;
}

export interface HetznerServer {
  id: number;
  name: string;
  status: string;
  public_net: {
    ipv4: { ip: string };
  };
  private_net?: Array<{ ip: string }>;
  created: string;
  server_type: { name: string };
  datacenter: { name: string };
}

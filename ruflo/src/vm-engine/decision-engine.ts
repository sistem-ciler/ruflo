import { VmServerType, type VmDecision, type VmPoolConfig, type VmTrigger } from './types.js';

const MONTHLY_COST_EUR: Record<VmServerType, number> = {
  [VmServerType.cx22]: 4,
  [VmServerType.cx32]: 8,
  [VmServerType.cx42]: 16,
  [VmServerType.cx52]: 30,
};

const HARD_CAP_VMS = 10;

export class DecisionEngine {
  constructor(private readonly config: VmPoolConfig) {}

  evaluate(
    queueDepth: number,
    activeVms: number,
    currentMonthlyCostEur: number,
  ): VmDecision {
    const projectedCost =
      currentMonthlyCostEur + this.estimateMonthlyCostEur(this.config.serverType);

    if (
      queueDepth > this.config.queueDepthThreshold &&
      projectedCost <= this.config.maxMonthlyEur &&
      activeVms < HARD_CAP_VMS
    ) {
      return {
        action: 'create',
        trigger: {
          type: 'queue_depth',
          reason: `Queue depth ${queueDepth} exceeds threshold ${this.config.queueDepthThreshold}`,
        },
        reason: `Scaling up: queue depth ${queueDepth}`,
      };
    }

    if (queueDepth === 0 && activeVms > 0) {
      return {
        action: 'destroy',
        reason: 'Queue empty and no active tasks; scaling down idle VMs',
      };
    }

    return { action: 'noop', reason: 'No scaling action required' };
  }

  evaluateComplexity(
    complexityScore: number,
    activeVms: number,
    currentMonthlyCostEur: number,
  ): VmDecision {
    const projectedCost =
      currentMonthlyCostEur + this.estimateMonthlyCostEur(this.config.serverType);

    if (
      complexityScore > this.config.complexityThreshold &&
      projectedCost <= this.config.maxMonthlyEur &&
      activeVms < HARD_CAP_VMS
    ) {
      return {
        action: 'create',
        trigger: {
          type: 'complexity',
          reason: `Complexity ${complexityScore} exceeds threshold ${this.config.complexityThreshold}`,
        },
        reason: `Scaling up: task complexity ${complexityScore}`,
      };
    }

    return {
      action: 'noop',
      reason: `Complexity ${complexityScore} does not require scaling`,
    };
  }

  evaluateExplicitRequest(
    taskSpec: VmTrigger['taskSpec'],
    activeVms: number,
    currentMonthlyCostEur: number,
  ): VmDecision {
    const projectedCost =
      currentMonthlyCostEur + this.estimateMonthlyCostEur(this.config.serverType);

    if (projectedCost > this.config.maxMonthlyEur) {
      return {
        action: 'noop',
        reason: `Explicit request denied: projected cost €${projectedCost.toFixed(2)} exceeds ceiling €${this.config.maxMonthlyEur}`,
      };
    }

    if (activeVms >= HARD_CAP_VMS) {
      return {
        action: 'noop',
        reason: `Explicit request denied: hard cap of ${HARD_CAP_VMS} VMs reached`,
      };
    }

    return {
      action: 'create',
      trigger: {
        type: 'explicit_request',
        reason: 'Agent explicitly requested a new VM',
        taskSpec,
      },
      reason: 'Honoring explicit agent VM request',
    };
  }

  evaluateSla(
    projectedCompletionMs: number,
    slaDeadlineMs: number,
    currentMonthlyCostEur: number,
  ): VmDecision {
    const remainingMs = slaDeadlineMs - Date.now();
    const breachThresholdMs = this.config.slaBreachSeconds * 1000;
    const projectedCost =
      currentMonthlyCostEur + this.estimateMonthlyCostEur(this.config.serverType);

    if (
      projectedCompletionMs > slaDeadlineMs &&
      remainingMs < breachThresholdMs &&
      projectedCost <= this.config.maxMonthlyEur
    ) {
      return {
        action: 'create',
        trigger: {
          type: 'sla_breach',
          reason: `SLA breach imminent: projected completion in ${projectedCompletionMs}ms, deadline in ${remainingMs}ms`,
        },
        reason: 'Scaling up to prevent SLA breach',
      };
    }

    return { action: 'noop', reason: 'SLA breach not imminent' };
  }

  estimateMonthlyCostEur(serverType: VmServerType): number {
    return MONTHLY_COST_EUR[serverType] ?? 4;
  }
}

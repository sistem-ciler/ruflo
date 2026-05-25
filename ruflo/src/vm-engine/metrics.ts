interface MetricsSnapshot {
  totalVms: number;
  runningVms: number;
  estimatedMonthlyCostEur: number;
  queueDepth: number;
}

export function formatMetrics(metrics: MetricsSnapshot): string {
  const lines: string[] = [
    '# HELP getopscore_vms_total Total number of managed VMs in the pool',
    '# TYPE getopscore_vms_total gauge',
    `getopscore_vms_total ${metrics.totalVms}`,
    '',
    '# HELP getopscore_vms_running Number of VMs currently in running state',
    '# TYPE getopscore_vms_running gauge',
    `getopscore_vms_running ${metrics.runningVms}`,
    '',
    '# HELP getopscore_cost_eur_monthly_estimate Estimated monthly cost in EUR for the current pool',
    '# TYPE getopscore_cost_eur_monthly_estimate gauge',
    `getopscore_cost_eur_monthly_estimate ${metrics.estimatedMonthlyCostEur.toFixed(2)}`,
    '',
    '# HELP getopscore_queue_depth Current number of tasks waiting in the queue',
    '# TYPE getopscore_queue_depth gauge',
    `getopscore_queue_depth ${metrics.queueDepth}`,
  ];

  return lines.join('\n') + '\n';
}

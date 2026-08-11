import { Queue, Worker } from "bullmq";
import { getConfig } from "./config.js";
import { logger } from "./logger.js";

const queues = new Map<string, Queue>();
const workers = new Map<string, Worker>();

function getRedisConnection() {
  const config = getConfig();
  const url = new URL(config.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
  };
}

export function getQueue(name: string): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
    queues.set(name, queue);
  }
  return queue;
}

export function createWorker(
  queueName: string,
  processor: (job: { data: Record<string, unknown>; name: string; id?: string }) => Promise<void>,
  concurrency = 5
): Worker {
  const worker = new Worker(queueName, processor, {
    connection: getRedisConnection(),
    concurrency,
    limiter: { max: 100, duration: 1000 },
  });

  worker.on("completed", (job) => {
    logger.debug({ jobId: job.id, queue: queueName }, "Job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, queue: queueName, err },
      "Job failed"
    );
  });

  workers.set(queueName, worker);
  return worker;
}

export async function closeQueues(): Promise<void> {
  for (const [name, worker] of workers) {
    await worker.close();
    logger.info({ queue: name }, "Worker closed");
  }
  for (const [name, queue] of queues) {
    await queue.close();
    logger.info({ queue: name }, "Queue closed");
  }
  workers.clear();
  queues.clear();
}

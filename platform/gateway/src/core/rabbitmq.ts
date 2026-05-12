import amqplib from "amqplib";
import type { Channel, Connection } from "amqplib";
import { getConfig } from "./config.js";
import { logger } from "./logger.js";

let connection: Connection | undefined;
let channel: Channel | undefined;

// Exchange and queue definitions
export const Exchanges = {
  EVENTS: "csaas.events",
  ALERTS: "csaas.alerts",
  COMMANDS: "csaas.commands",
} as const;

export const Queues = {
  CCTV_EVENTS: "cctv.events",
  CCTV_ALERTS: "cctv.alerts",
  SECURITY_EVENTS: "security.events",
  SECURITY_ALERTS: "security.alerts",
  BILLING_EVENTS: "billing.events",
  AGENT_TASKS: "agent.tasks",
  NOTIFICATIONS: "notifications",
} as const;

export async function connectRabbitMQ(): Promise<Channel> {
  if (channel) return channel;

  const config = getConfig();
  connection = await amqplib.connect(config.RABBITMQ_URL);

  connection.on("error", (err) => {
    logger.error({ err }, "RabbitMQ connection error");
  });

  connection.on("close", () => {
    logger.warn("RabbitMQ connection closed");
    channel = undefined;
    connection = undefined;
  });

  channel = await connection.createChannel();
  await channel.prefetch(10);

  // Declare exchanges
  for (const exchange of Object.values(Exchanges)) {
    await channel.assertExchange(exchange, "topic", { durable: true });
  }

  // Declare queues with dead-letter
  for (const queue of Object.values(Queues)) {
    await channel.assertQueue(queue, {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": `${Exchanges.EVENTS}.dlx`,
        "x-message-ttl": 86_400_000, // 24h
      },
    });
  }

  // Dead-letter exchange
  await channel.assertExchange(`${Exchanges.EVENTS}.dlx`, "fanout", {
    durable: true,
  });
  await channel.assertQueue(`${Exchanges.EVENTS}.dlq`, { durable: true });
  await channel.bindQueue(
    `${Exchanges.EVENTS}.dlq`,
    `${Exchanges.EVENTS}.dlx`,
    ""
  );

  logger.info("RabbitMQ connected, exchanges and queues declared");
  return channel;
}

export function getChannel(): Channel | undefined {
  return channel;
}

export async function publishEvent(
  exchange: string,
  routingKey: string,
  payload: Record<string, unknown>,
  tenantId: string
): Promise<void> {
  const ch = channel;
  if (!ch) {
    logger.error("RabbitMQ channel not available, event dropped");
    return;
  }

  const message = Buffer.from(
    JSON.stringify({
      ...payload,
      _meta: {
        tenantId,
        timestamp: new Date().toISOString(),
        source: getConfig().SERVICE_NAME,
      },
    })
  );

  ch.publish(exchange, routingKey, message, {
    persistent: true,
    contentType: "application/json",
  });
}

export async function checkRabbitMQHealth(): Promise<boolean> {
  try {
    return connection !== undefined && channel !== undefined;
  } catch {
    return false;
  }
}

export async function closeRabbitMQ(): Promise<void> {
  if (channel) {
    await channel.close();
    channel = undefined;
  }
  if (connection) {
    await connection.close();
    connection = undefined;
  }
  logger.info("RabbitMQ connection closed");
}

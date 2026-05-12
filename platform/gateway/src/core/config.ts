import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default("0.0.0.0"),

  // Database
  DATABASE_URL: z
    .string()
    .default("postgresql://csaas:csaas@localhost:5432/csaas"),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // RabbitMQ
  RABBITMQ_URL: z.string().default("amqp://csaas:csaas@localhost:5672"),

  // JWT
  JWT_SECRET: z.string().min(32).default("change-me-in-production-at-least-32-chars!!"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // CORS
  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  // Service Identity
  SERVICE_NAME: z.string().default("gateway"),
  SERVICE_VERSION: z.string().default("0.1.0"),
});

export type Config = z.infer<typeof envSchema>;

let _config: Config | undefined;

export function getConfig(): Config {
  if (!_config) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      const formatted = result.error.flatten().fieldErrors;
      throw new Error(
        `Invalid environment variables:\n${JSON.stringify(formatted, null, 2)}`
      );
    }
    _config = result.data;
  }
  return _config;
}

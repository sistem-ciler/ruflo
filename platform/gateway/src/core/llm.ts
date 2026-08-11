import { getConfig } from "./config.js";
import { logger } from "./logger.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmResponse {
  content: string;
  model: string;
  provider: "openrouter" | "ollama";
  usage?: { promptTokens: number; completionTokens: number };
}

type Provider = "openrouter" | "ollama";

function resolveProvider(): Provider {
  const cfg = getConfig();
  if (cfg.LLM_PROVIDER !== "auto") return cfg.LLM_PROVIDER;
  return cfg.OPENROUTER_API_KEY ? "openrouter" : "ollama";
}

async function callOpenRouter(
  messages: ChatMessage[],
  model?: string
): Promise<LlmResponse> {
  const cfg = getConfig();
  if (!cfg.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const response = await fetch(`${cfg.OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://godoman.net",
      "X-Title": "CSaaS Platform",
    },
    body: JSON.stringify({
      model: model ?? cfg.OPENROUTER_MODEL,
      messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenRouter ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
    model: string;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  const choice = data.choices[0];
  if (!choice) throw new Error("OpenRouter returned no choices");

  return {
    content: choice.message.content,
    model: data.model,
    provider: "openrouter",
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
        }
      : undefined,
  };
}

async function callOllama(
  messages: ChatMessage[],
  model?: string
): Promise<LlmResponse> {
  const cfg = getConfig();
  const ollamaModel = model ?? cfg.OLLAMA_MODEL;

  const response = await fetch(`${cfg.OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ollamaModel,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Ollama ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    message: { content: string };
    model: string;
    eval_count?: number;
    prompt_eval_count?: number;
  };

  return {
    content: data.message.content,
    model: data.model,
    provider: "ollama",
    usage:
      data.prompt_eval_count !== undefined
        ? {
            promptTokens: data.prompt_eval_count ?? 0,
            completionTokens: data.eval_count ?? 0,
          }
        : undefined,
  };
}

export async function chat(
  messages: ChatMessage[],
  opts?: { model?: string; provider?: Provider }
): Promise<LlmResponse> {
  const provider = opts?.provider ?? resolveProvider();

  logger.debug({ provider, model: opts?.model }, "LLM chat request");

  if (provider === "openrouter") {
    return callOpenRouter(messages, opts?.model);
  }
  return callOllama(messages, opts?.model);
}

export function getLlmStatus(): {
  provider: Provider;
  openrouter: { configured: boolean; baseUrl: string; model: string };
  ollama: { url: string; model: string };
} {
  const cfg = getConfig();
  return {
    provider: resolveProvider(),
    openrouter: {
      configured: !!cfg.OPENROUTER_API_KEY,
      baseUrl: cfg.OPENROUTER_BASE_URL,
      model: cfg.OPENROUTER_MODEL,
    },
    ollama: {
      url: cfg.OLLAMA_URL,
      model: cfg.OLLAMA_MODEL,
    },
  };
}

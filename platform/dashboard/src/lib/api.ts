const BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface ApiOptions extends RequestInit {
  token?: string;
}

async function request<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { token, headers: extra, ...rest } = opts;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extra as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { headers, ...rest });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error?.message || body.error || res.statusText, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const api = {
  get: <T>(path: string, token?: string) => request<T>(path, { token }),
  post: <T>(path: string, data: unknown, token?: string) =>
    request<T>(path, { method: "POST", body: JSON.stringify(data), token }),
  patch: <T>(path: string, data: unknown, token?: string) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data), token }),
  del: <T>(path: string, token?: string) =>
    request<T>(path, { method: "DELETE", token }),
};

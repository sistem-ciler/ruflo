/**
 * Result type — no unhandled throws.
 * Every service function returns Result<T> instead of throwing.
 */

export type Result<T, E = AppError> =
  | { ok: true; data: T }
  | { ok: false; error: E };

export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data };
}

export function err<E = AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}

export interface AppError {
  code: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

export const Errors = {
  notFound(resource: string, id?: string): AppError {
    return {
      code: "NOT_FOUND",
      message: id ? `${resource} '${id}' not found` : `${resource} not found`,
      statusCode: 404,
    };
  },

  unauthorized(message = "Authentication required"): AppError {
    return { code: "UNAUTHORIZED", message, statusCode: 401 };
  },

  forbidden(message = "Insufficient permissions"): AppError {
    return { code: "FORBIDDEN", message, statusCode: 403 };
  },

  validation(details: unknown): AppError {
    return {
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      statusCode: 400,
      details,
    };
  },

  conflict(message: string): AppError {
    return { code: "CONFLICT", message, statusCode: 409 };
  },

  internal(message = "Internal server error"): AppError {
    return { code: "INTERNAL_ERROR", message, statusCode: 500 };
  },

  rateLimited(message = "Too many requests"): AppError {
    return { code: "RATE_LIMITED", message, statusCode: 429 };
  },
} as const;

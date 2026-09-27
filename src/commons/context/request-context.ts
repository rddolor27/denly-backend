import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  readonly requestId: string;
  /** 32 lowercase hex chars from `traceparent` / `x-cloud-trace-context`, when the request had one. */
  readonly traceId?: string;
}

/**
 * Carries the per-request id (and trace id) across the async call chain without threading them
 * through every function signature, so the logger and the global exception filter can both read
 * them. Populated by `RequestIdMiddleware`, the first thing to run on every request.
 */
export const requestContextStorage =
  new AsyncLocalStorage<RequestContextStore>();

export function getRequestId(): string | undefined {
  return requestContextStorage.getStore()?.requestId;
}

export function getTraceId(): string | undefined {
  return requestContextStorage.getStore()?.traceId;
}

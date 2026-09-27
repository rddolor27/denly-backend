import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  readonly requestId: string;
}

/**
 * Carries the per-request id across the async call chain without threading it through every
 * function signature, so the Logger and the global exception filter can both read it. Populated
 * by `RequestIdMiddleware`, the first thing to run on every request.
 */
export const requestContextStorage =
  new AsyncLocalStorage<RequestContextStore>();

export function getRequestId(): string | undefined {
  return requestContextStorage.getStore()?.requestId;
}

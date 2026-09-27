import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import {
  type RequestContextStore,
  requestContextStorage,
} from '../context/request-context.js';
import { RequestIdMiddleware } from './request-id.middleware.js';

const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function run(headers: Record<string, string>): {
  store: RequestContextStore | undefined;
  setHeader: ReturnType<typeof vi.fn>;
} {
  const req = {
    header: (name: string): string | undefined => headers[name.toLowerCase()],
  } as unknown as Request;
  const setHeader = vi.fn();
  const res = { setHeader } as unknown as Response;
  let store: RequestContextStore | undefined;

  new RequestIdMiddleware().use(req, res, () => {
    store = requestContextStorage.getStore();
  });
  return { store, setHeader };
}

describe('RequestIdMiddleware', () => {
  it('generates a request id, echoes it and stores it without a trace id', () => {
    const { store, setHeader } = run({});

    expect(store?.requestId).toMatch(UUID);
    expect(store).not.toHaveProperty('traceId');
    expect(setHeader).toHaveBeenCalledWith('x-request-id', store?.requestId);
  });

  it('reuses an inbound x-request-id', () => {
    const { store, setHeader } = run({ 'x-request-id': 'client-id-1' });

    expect(store?.requestId).toBe('client-id-1');
    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'client-id-1');
  });

  it('stores the trace id from traceparent', () => {
    const { store } = run({
      traceparent: `00-${TRACE_ID}-00f067aa0ba902b7-01`,
    });

    expect(store?.traceId).toBe(TRACE_ID);
  });

  it('falls back to x-cloud-trace-context', () => {
    const { store } = run({ 'x-cloud-trace-context': `${TRACE_ID}/7;o=1` });

    expect(store?.traceId).toBe(TRACE_ID);
  });

  it('ignores malformed trace headers', () => {
    const { store } = run({
      traceparent: 'not-a-traceparent',
      'x-cloud-trace-context': 'nor-this',
    });

    expect(store).not.toHaveProperty('traceId');
    expect(store?.requestId).toMatch(UUID);
  });
});

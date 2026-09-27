import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  type RequestContextStore,
  requestContextStorage,
} from '../context/request-context.js';
import { extractTraceId } from '../context/trace-context.js';

const REQUEST_ID_HEADER = 'x-request-id';
const TRACEPARENT_HEADER = 'traceparent';
const CLOUD_TRACE_CONTEXT_HEADER = 'x-cloud-trace-context';

/**
 * Assigns (or reuses an inbound) request id and stores it — plus the trace id from `traceparent`
 * or `x-cloud-trace-context`, when valid — in `AsyncLocalStorage` for the lifetime of the
 * request, so logs and the error response can carry them without passing them explicitly.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const inbound = req.header(REQUEST_ID_HEADER);
    const requestId = inbound && inbound.length > 0 ? inbound : randomUUID();
    res.setHeader(REQUEST_ID_HEADER, requestId);

    const traceId = extractTraceId({
      traceparent: req.header(TRACEPARENT_HEADER),
      cloudTraceContext: req.header(CLOUD_TRACE_CONTEXT_HEADER),
    });
    const store: RequestContextStore =
      traceId === undefined ? { requestId } : { requestId, traceId };
    requestContextStorage.run(store, () => next());
  }
}

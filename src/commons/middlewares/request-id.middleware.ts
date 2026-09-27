import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { requestContextStorage } from '../context/request-context.js';

const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Assigns (or reuses an inbound) request id and stores it in `AsyncLocalStorage` for the
 * lifetime of the request, so logs and the error response can carry the same id without
 * passing it explicitly.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const inbound = req.header(REQUEST_ID_HEADER);
    const requestId = inbound && inbound.length > 0 ? inbound : randomUUID();
    res.setHeader(REQUEST_ID_HEADER, requestId);
    requestContextStorage.run({ requestId }, () => next());
  }
}

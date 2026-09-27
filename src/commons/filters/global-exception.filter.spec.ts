import type { ArgumentsHost } from '@nestjs/common';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainError } from '../errors/domain.error.js';
import { GlobalExceptionFilter } from './global-exception.filter.js';

class FixtureDomainError extends DomainError {
  constructor() {
    super('FIXTURE_ERROR', 'fixture message', HttpStatus.CONFLICT, {
      field: 'x',
    });
  }
}

function fixtureHost(): {
  host: ArgumentsHost;
  json: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'GET', url: '/v1/fixture' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, json, status };
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
  });

  it('maps a DomainError to its stable code, status and details', () => {
    const { host, json, status } = fixtureHost();

    filter.catch(new FixtureDomainError(), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.CONFLICT,
        code: 'FIXTURE_ERROR',
        message: 'fixture message',
        details: { field: 'x' },
      }),
    );
  });

  it('maps a Nest HttpException to VALIDATION_ERROR for a 400', () => {
    const { host, json, status } = fixtureHost();

    filter.catch(new BadRequestException('bad input'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
      }),
    );
  });

  it('maps an unknown error to a 500 with no internal details leaked', () => {
    const { host, json, status } = fixtureHost();

    filter.catch(new Error('driver stack trace with secrets'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const [body] = json.mock.calls[0] as [Record<string, unknown>];
    expect(body['code']).toBe('INTERNAL_ERROR');
    expect(body['message']).toBe('An unexpected error occurred');
    expect(JSON.stringify(body)).not.toContain('driver stack trace');
  });

  it('always includes a requestId and an ISO timestamp', () => {
    const { host, json } = fixtureHost();

    filter.catch(new FixtureDomainError(), host);

    const [body] = json.mock.calls[0] as [Record<string, unknown>];
    expect(typeof body['requestId']).toBe('string');
    expect(new Date(body['timestamp'] as string).toString()).not.toBe(
      'Invalid Date',
    );
  });
});

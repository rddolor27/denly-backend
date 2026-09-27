import type { DataSource } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseUnavailableError } from '@/commons/errors/database-unavailable.error.js';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  const dataSourceMockFactory = (): { query: ReturnType<typeof vi.fn> } => ({
    query: vi.fn(),
  });
  let dataSourceMock: ReturnType<typeof dataSourceMockFactory>;
  let service: HealthService;

  beforeEach(() => {
    dataSourceMock = dataSourceMockFactory();
    service = new HealthService(dataSourceMock as unknown as DataSource);
  });

  it('resolves when the database ping succeeds', async () => {
    dataSourceMock.query.mockResolvedValue([{ '?column?': 1 }]);

    await expect(service.checkDatabase()).resolves.toBeUndefined();
    expect(dataSourceMock.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('throws DatabaseUnavailableError without leaking the driver error when the ping fails', async () => {
    dataSourceMock.query.mockRejectedValue(new Error('connection refused'));

    await expect(service.checkDatabase()).rejects.toBeInstanceOf(
      DatabaseUnavailableError,
    );
  });
});

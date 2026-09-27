import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseUnavailableError } from '@/commons/errors/database-unavailable.error.js';
import { HealthController } from './health.controller.js';
import type { HealthService } from './health.service.js';

describe('HealthController', () => {
  const healthServiceMockFactory = (): {
    checkDatabase: ReturnType<typeof vi.fn>;
  } => ({
    checkDatabase: vi.fn(),
  });
  let serviceMock: ReturnType<typeof healthServiceMockFactory>;
  let controller: HealthController;

  beforeEach(() => {
    serviceMock = healthServiceMockFactory();
    controller = new HealthController(serviceMock as unknown as HealthService);
  });

  it('returns ok status with a timestamp when the database is reachable', async () => {
    serviceMock.checkDatabase.mockResolvedValue(undefined);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.db).toBe('ok');
    expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('propagates the domain error instead of swallowing it when the database is down', async () => {
    serviceMock.checkDatabase.mockRejectedValue(new DatabaseUnavailableError());

    await expect(controller.check()).rejects.toBeInstanceOf(
      DatabaseUnavailableError,
    );
  });
});

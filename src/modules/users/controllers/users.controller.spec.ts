import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvalidAccessTokenError } from '@/modules/auth/errors/auth.errors.js';
import { UserNotFoundError } from '../errors/users.errors.js';
import type { IUsersService } from '../interfaces/users-service.interface.js';
import type { UserModel } from '../models/user.model.js';
import { UsersController } from './users.controller.js';

const USER_ID = '6f1c1c2a-4a55-4f0e-9d0a-1b2c3d4e5f60';

describe('UsersController', () => {
  let usersServiceMock: { findById: ReturnType<typeof vi.fn> };
  let controller: UsersController;

  beforeEach(() => {
    usersServiceMock = { findById: vi.fn() };
    controller = new UsersController(
      usersServiceMock as unknown as IUsersService,
    );
  });

  it('returns the current user as a response DTO', async () => {
    const model: UserModel = {
      id: USER_ID,
      email: 'ana@example.com',
      displayName: null,
      createdAt: new Date('2026-09-23T10:00:00.000Z'),
    };
    usersServiceMock.findById.mockResolvedValue(model);

    const result = await controller.me({ id: USER_ID });

    expect(usersServiceMock.findById).toHaveBeenCalledWith(USER_ID);
    expect(result).toEqual({
      id: USER_ID,
      email: 'ana@example.com',
      displayName: null,
      createdAt: '2026-09-23T10:00:00.000Z',
    });
  });

  it('rejects the access token when its user no longer exists', async () => {
    usersServiceMock.findById.mockRejectedValue(new UserNotFoundError(USER_ID));

    await expect(controller.me({ id: USER_ID })).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('rethrows unexpected errors', async () => {
    const failure = new Error('connection lost');
    usersServiceMock.findById.mockRejectedValue(failure);

    await expect(controller.me({ id: USER_ID })).rejects.toBe(failure);
  });
});

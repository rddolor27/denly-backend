import { QueryFailedError, type Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../entities/user.entity.js';
import {
  EmailAlreadyRegisteredError,
  UserNotFoundError,
} from '../errors/users.errors.js';
import { UsersService } from './users.service.js';

const USER_ID = '6f1c1c2a-4a55-4f0e-9d0a-1b2c3d4e5f60';

function userEntity(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    email: 'ana@example.com',
    passwordHash: 'scrypt$15$8$3$salt$hash',
    displayName: 'Ana',
    createdAt: new Date('2026-09-23T00:00:00.000Z'),
    updatedAt: new Date('2026-09-23T00:00:00.000Z'),
    ...overrides,
  };
}

function driverError(code: string): Error {
  return Object.assign(new Error('duplicate key'), { code });
}

describe('UsersService', () => {
  let usersRepository: {
    existsBy: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOneBy: ReturnType<typeof vi.fn>;
  };
  let service: UsersService;

  beforeEach(() => {
    usersRepository = {
      existsBy: vi.fn().mockResolvedValue(false),
      create: vi.fn((input: Partial<User>) => ({ ...input })),
      save: vi.fn((input: Partial<User>) =>
        Promise.resolve(userEntity({ ...input })),
      ),
      findOneBy: vi.fn(),
    };
    service = new UsersService(usersRepository as unknown as Repository<User>);
  });

  describe('create', () => {
    const newUser = {
      email: 'ana@example.com',
      passwordHash: 'scrypt$15$8$3$salt$hash',
      displayName: null,
    };

    it('inserts the user and returns its model without the password hash', async () => {
      const model = await service.create(newUser);

      expect(usersRepository.existsBy).toHaveBeenCalledWith({
        email: 'ana@example.com',
      });
      expect(usersRepository.create).toHaveBeenCalledWith(newUser);
      expect(model).toEqual({
        id: USER_ID,
        email: 'ana@example.com',
        displayName: null,
        createdAt: new Date('2026-09-23T00:00:00.000Z'),
      });
      expect(model).not.toHaveProperty('passwordHash');
    });

    it('rejects an email that is already registered without inserting', async () => {
      usersRepository.existsBy.mockResolvedValue(true);

      await expect(service.create(newUser)).rejects.toBeInstanceOf(
        EmailAlreadyRegisteredError,
      );
      expect(usersRepository.save).not.toHaveBeenCalled();
    });

    it('translates a unique violation from a concurrent insert into EmailAlreadyRegisteredError', async () => {
      usersRepository.save.mockRejectedValue(
        new QueryFailedError('INSERT', [], driverError('23505')),
      );

      await expect(service.create(newUser)).rejects.toBeInstanceOf(
        EmailAlreadyRegisteredError,
      );
    });

    it('rethrows other database errors unchanged', async () => {
      const failure = new QueryFailedError('INSERT', [], driverError('23502'));
      usersRepository.save.mockRejectedValue(failure);

      await expect(service.create(newUser)).rejects.toBe(failure);
    });
  });

  describe('findCredentialsByEmail', () => {
    it('returns the user model and the stored password hash', async () => {
      usersRepository.findOneBy.mockResolvedValue(userEntity());

      const credentials =
        await service.findCredentialsByEmail('ana@example.com');

      expect(usersRepository.findOneBy).toHaveBeenCalledWith({
        email: 'ana@example.com',
      });
      expect(credentials?.passwordHash).toBe('scrypt$15$8$3$salt$hash');
      expect(credentials?.user.id).toBe(USER_ID);
      expect(credentials?.user).not.toHaveProperty('passwordHash');
    });

    it('returns null for an unknown email', async () => {
      usersRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.findCredentialsByEmail('nobody@example.com'),
      ).resolves.toBeNull();
    });
  });

  describe('findById', () => {
    it('returns the user model', async () => {
      usersRepository.findOneBy.mockResolvedValue(userEntity());

      const model = await service.findById(USER_ID);

      expect(usersRepository.findOneBy).toHaveBeenCalledWith({ id: USER_ID });
      expect(model.email).toBe('ana@example.com');
    });

    it('throws UserNotFoundError for an unknown id', async () => {
      usersRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findById(USER_ID)).rejects.toBeInstanceOf(
        UserNotFoundError,
      );
    });
  });
});

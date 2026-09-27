import { Injectable, Logger, type Provider } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { USERS_SERVICE } from '../constants/users.constants.js';
import { User } from '../entities/user.entity.js';
import {
  EmailAlreadyRegisteredError,
  UserNotFoundError,
} from '../errors/users.errors.js';
import type {
  IUsersService,
  NewUser,
  UserCredentials,
} from '../interfaces/users-service.interface.js';
import { UserModel } from '../models/user.model.js';

const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError: unknown = error.driverError;
  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    'code' in driverError &&
    driverError.code === UNIQUE_VIOLATION
  );
}

@Injectable()
export class UsersService implements IUsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(input: NewUser): Promise<UserModel> {
    if (await this.usersRepository.existsBy({ email: input.email })) {
      throw new EmailAlreadyRegisteredError();
    }
    try {
      const user = await this.usersRepository.save(
        this.usersRepository.create({
          email: input.email,
          passwordHash: input.passwordHash,
          displayName: input.displayName,
        }),
      );
      this.logger.log(`[create] user=${user.id}`);
      return UserModel.fromEntity(user);
    } catch (error) {
      if (isUniqueViolation(error)) throw new EmailAlreadyRegisteredError();
      throw error;
    }
  }

  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    const user = await this.usersRepository.findOneBy({ email });
    if (!user) return null;
    return {
      user: UserModel.fromEntity(user),
      passwordHash: user.passwordHash,
    };
  }

  async findById(id: string): Promise<UserModel> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) throw new UserNotFoundError(id);
    return UserModel.fromEntity(user);
  }
}

export const UsersProvider: Provider = {
  provide: USERS_SERVICE,
  useClass: UsersService,
};

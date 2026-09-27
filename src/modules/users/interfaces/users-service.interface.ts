import type { UserModel } from '../models/user.model.js';

export interface NewUser {
  readonly email: string;
  readonly passwordHash: string;
  readonly displayName: string | null;
}

export interface UserCredentials {
  readonly user: UserModel;
  readonly passwordHash: string;
}

export interface IUsersService {
  /** `email` must already be normalised; throws EmailAlreadyRegisteredError. */
  create(input: NewUser): Promise<UserModel>;
  findCredentialsByEmail(email: string): Promise<UserCredentials | null>;
  /** Throws UserNotFoundError. */
  findById(id: string): Promise<UserModel>;
}

import type { User } from '../entities/user.entity.js';

export class UserModel {
  readonly id!: string;
  readonly email!: string;
  readonly displayName!: string | null;
  readonly createdAt!: Date;

  static fromEntity(entity: User): UserModel {
    return Object.assign(new UserModel(), {
      id: entity.id,
      email: entity.email,
      displayName: entity.displayName,
      createdAt: entity.createdAt,
    });
  }
}

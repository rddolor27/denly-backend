import { ApiProperty } from '@nestjs/swagger';
import type { UserModel } from '../models/user.model.js';

export class ResponseUserDTO {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email', example: 'ana@example.com' })
  email!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Ana' })
  displayName!: string | null;

  @ApiProperty({ format: 'date-time', example: '2026-09-23T10:00:00.000Z' })
  createdAt!: string;

  static fromModel(model: UserModel): ResponseUserDTO {
    return Object.assign(new ResponseUserDTO(), {
      id: model.id,
      email: model.email,
      displayName: model.displayName,
      createdAt: model.createdAt.toISOString(),
    });
  }
}

import { ApiProperty } from '@nestjs/swagger';
import { ResponseUserDTO } from '@/modules/users/dtos/response-user.dto.js';
import { REFRESH_TOKEN_PATTERN } from '../constants/auth.constants.js';
import type { AuthSession, AuthTokens } from '../models/auth-session.model.js';

export class ResponseAuthTokensDTO {
  @ApiProperty({ enum: ['Bearer'], example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({
    description: 'JWT to send as `Authorization: Bearer <accessToken>`',
  })
  accessToken!: string;

  @ApiProperty({ format: 'date-time', example: '2026-09-23T10:15:00.000Z' })
  accessTokenExpiresAt!: string;

  @ApiProperty({
    pattern: REFRESH_TOKEN_PATTERN.source,
    description:
      'Opaque and single-use: POST /auth/refresh returns a new one; reusing an old one signs the session out',
  })
  refreshToken!: string;

  @ApiProperty({ format: 'date-time', example: '2026-10-23T10:00:00.000Z' })
  refreshTokenExpiresAt!: string;

  static fromModel(model: AuthTokens): ResponseAuthTokensDTO {
    return Object.assign(new ResponseAuthTokensDTO(), {
      tokenType: model.tokenType,
      accessToken: model.accessToken,
      accessTokenExpiresAt: model.accessTokenExpiresAt.toISOString(),
      refreshToken: model.refreshToken,
      refreshTokenExpiresAt: model.refreshTokenExpiresAt.toISOString(),
    });
  }
}

export class ResponseAuthSessionDTO {
  @ApiProperty({ type: ResponseUserDTO })
  user!: ResponseUserDTO;

  @ApiProperty({ type: ResponseAuthTokensDTO })
  tokens!: ResponseAuthTokensDTO;

  static fromModel(model: AuthSession): ResponseAuthSessionDTO {
    return Object.assign(new ResponseAuthSessionDTO(), {
      user: ResponseUserDTO.fromModel(model.user),
      tokens: ResponseAuthTokensDTO.fromModel(model.tokens),
    });
  }
}

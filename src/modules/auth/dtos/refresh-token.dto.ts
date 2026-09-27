import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { REFRESH_TOKEN_PATTERN } from '../constants/auth.constants.js';

export class RefreshTokenDTO {
  @ApiProperty({
    pattern: REFRESH_TOKEN_PATTERN.source,
    description: 'The refresh token from the latest login, register or refresh',
  })
  @IsString()
  @Matches(REFRESH_TOKEN_PATTERN)
  refreshToken!: string;
}

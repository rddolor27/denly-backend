import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { Trim } from '@/commons/transforms/trim.transform.js';
import {
  DISPLAY_NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
} from '@/modules/users/constants/users.constants.js';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../constants/auth.constants.js';

export class RegisterDTO {
  @ApiProperty({
    format: 'email',
    maxLength: EMAIL_MAX_LENGTH,
    example: 'ana@example.com',
    description: 'Case-insensitive; stored trimmed and lower-cased',
  })
  @Trim()
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email!: string;

  @ApiProperty({
    format: 'password',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
    description: 'Used exactly as sent (never trimmed)',
  })
  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  password!: string;

  @ApiPropertyOptional({
    maxLength: DISPLAY_NAME_MAX_LENGTH,
    example: 'Ana',
    description: 'Trimmed; blank is stored as null',
  })
  @IsOptional()
  @IsString()
  @MaxLength(DISPLAY_NAME_MAX_LENGTH)
  displayName?: string;
}

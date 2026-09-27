import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { Trim } from '@/commons/transforms/trim.transform.js';
import { EMAIL_MAX_LENGTH } from '@/modules/users/constants/users.constants.js';
import { PASSWORD_MAX_LENGTH } from '../constants/auth.constants.js';

export class LoginDTO {
  @ApiProperty({
    format: 'email',
    maxLength: EMAIL_MAX_LENGTH,
    example: 'ana@example.com',
  })
  @Trim()
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email!: string;

  @ApiProperty({
    format: 'password',
    minLength: 1,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @Length(1, PASSWORD_MAX_LENGTH)
  password!: string;
}

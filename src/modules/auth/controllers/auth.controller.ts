import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '@/commons/auth/public.decorator.js';
import { ErrorResponseDto } from '@/commons/dtos/error-response.dto.js';
import { InjectAuthService } from '../constants/auth.constants.js';
import { LoginDTO } from '../dtos/login.dto.js';
import { RefreshTokenDTO } from '../dtos/refresh-token.dto.js';
import { RegisterDTO } from '../dtos/register.dto.js';
import {
  ResponseAuthSessionDTO,
  ResponseAuthTokensDTO,
} from '../dtos/response-auth.dto.js';
import type { IAuthService } from '../interfaces/auth-service.interface.js';

@Public()
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    @InjectAuthService() private readonly authService: IAuthService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Create an account and start a session' })
  @ApiCreatedResponse({ type: ResponseAuthSessionDTO })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'EMAIL_ALREADY_REGISTERED',
  })
  async register(@Body() dto: RegisterDTO): Promise<ResponseAuthSessionDTO> {
    const session = await this.authService.register({
      email: dto.email,
      password: dto.password,
      displayName: dto.displayName ?? null,
    });
    return ResponseAuthSessionDTO.fromModel(session);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiOkResponse({ type: ResponseAuthSessionDTO })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'INVALID_CREDENTIALS',
  })
  async login(@Body() dto: LoginDTO): Promise<ResponseAuthSessionDTO> {
    const session = await this.authService.login({
      email: dto.email,
      password: dto.password,
    });
    return ResponseAuthSessionDTO.fromModel(session);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Exchange a refresh token for a new access and refresh token',
  })
  @ApiOkResponse({ type: ResponseAuthTokensDTO })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'INVALID_REFRESH_TOKEN',
  })
  async refresh(@Body() dto: RefreshTokenDTO): Promise<ResponseAuthTokensDTO> {
    const tokens = await this.authService.refresh(dto.refreshToken);
    return ResponseAuthTokensDTO.fromModel(tokens);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'End the session that owns this refresh token' })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async logout(@Body() dto: RefreshTokenDTO): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }
}

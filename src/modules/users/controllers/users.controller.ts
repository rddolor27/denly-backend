import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@/commons/auth/authenticated-user.js';
import { CurrentUser } from '@/commons/auth/current-user.decorator.js';
import { ErrorResponseDto } from '@/commons/dtos/error-response.dto.js';
import { InvalidAccessTokenError } from '@/modules/auth/errors/auth.errors.js';
import { InjectUsersService } from '../constants/users.constants.js';
import { ResponseUserDTO } from '../dtos/response-user.dto.js';
import { UserNotFoundError } from '../errors/users.errors.js';
import type { IUsersService } from '../interfaces/users-service.interface.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    @InjectUsersService() private readonly usersService: IUsersService,
  ) {}

  @Get('me')
  @ApiOkResponse({ type: ResponseUserDTO })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<ResponseUserDTO> {
    try {
      return ResponseUserDTO.fromModel(
        await this.usersService.findById(user.id),
      );
    } catch (error) {
      // A valid token for a deleted account: the token outlived the user, not a missing resource.
      if (error instanceof UserNotFoundError) {
        throw new InvalidAccessTokenError();
      }
      throw error;
    }
  }
}

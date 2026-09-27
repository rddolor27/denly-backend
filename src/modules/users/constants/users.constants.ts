import { Inject } from '@nestjs/common';

export const USERS_SERVICE = Symbol('USERS_SERVICE');
export const InjectUsersService = (): ParameterDecorator =>
  Inject(USERS_SERVICE);

export const EMAIL_MAX_LENGTH = 254;
export const DISPLAY_NAME_MAX_LENGTH = 80;

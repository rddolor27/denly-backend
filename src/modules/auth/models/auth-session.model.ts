import type { UserModel } from '@/modules/users/models/user.model.js';

export interface AuthTokens {
  readonly tokenType: 'Bearer';
  readonly accessToken: string;
  readonly accessTokenExpiresAt: Date;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
}

export interface AuthSession {
  readonly user: UserModel;
  readonly tokens: AuthTokens;
}

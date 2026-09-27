import type { AuthSession, AuthTokens } from '../models/auth-session.model.js';

export interface RegisterInput {
  readonly email: string;
  readonly password: string;
  readonly displayName: string | null;
}

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export interface IAuthService {
  /** Throws EmailAlreadyRegisteredError. */
  register(input: RegisterInput): Promise<AuthSession>;
  /** Throws InvalidCredentialsError for an unknown email and a wrong password alike. */
  login(input: LoginInput): Promise<AuthSession>;
  /** Rotates the token; throws InvalidRefreshTokenError (and revokes the family on reuse). */
  refresh(refreshToken: string): Promise<AuthTokens>;
  /** Revokes the token's family; unknown tokens are ignored. */
  logout(refreshToken: string): Promise<void>;
}

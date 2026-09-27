export interface AuthenticatedUser {
  readonly id: string;
}

export interface AccessTokenPayload {
  readonly sub: string;
  readonly typ: 'access';
}

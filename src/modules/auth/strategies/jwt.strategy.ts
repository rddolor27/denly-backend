import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '@/commons/auth/authenticated-user.js';
import { AppConfigService } from '@/config/app-config.service.js';
import {
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from '../constants/auth.constants.js';
import { InvalidAccessTokenError } from '../errors/auth.errors.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.auth.accessTokenSecret,
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      ignoreExpiration: false,
    });
  }

  validate(payload: unknown): AuthenticatedUser {
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'typ' in payload &&
      payload.typ === 'access' &&
      'sub' in payload &&
      typeof payload.sub === 'string' &&
      UUID_PATTERN.test(payload.sub) &&
      'exp' in payload &&
      typeof payload.exp === 'number'
    ) {
      return { id: payload.sub };
    }
    throw new InvalidAccessTokenError();
  }
}

import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { AppConfigService } from './app-config.service.js';
import { validateEnv } from './env.validation.js';

/**
 * The one place `.env*` files are read. `validate` runs `validateEnv` at boot so missing or
 * malformed config fails fast instead of surfacing later as a broken query. `NODE_ENV=test` loads
 * `.env.test` first (e2e's separate local database), everything else loads `.env`; real env files
 * are never committed or read by anyone but this module.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath:
        process.env['NODE_ENV'] === 'test' ? ['.env.test', '.env'] : ['.env'],
      validate: validateEnv,
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class ConfigModule {}

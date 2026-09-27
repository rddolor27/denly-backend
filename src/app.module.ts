import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from '@/config/app-config.service.js';
import { ConfigModule } from '@/config/config.module.js';
import { SnakeNamingStrategy } from '@/commons/database/snake-naming.strategy.js';
import { RequestIdMiddleware } from '@/commons/middlewares/request-id.middleware.js';
import { AuthModule } from '@/modules/auth/auth.module.js';
import { IngredientIntelligenceModule } from '@/modules/ingredient-intelligence/ingredient-intelligence.module.js';
import { IngredientsModule } from '@/modules/ingredients/ingredients.module.js';
import { ModelRegistryModule } from '@/modules/model-registry/model-registry.module.js';
import { ScansModule } from '@/modules/scans/scans.module.js';
import { UsersModule } from '@/modules/users/users.module.js';
import { MIGRATIONS } from '@/migrations/index.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        type: 'postgres' as const,
        ...config.database,
        namingStrategy: new SnakeNamingStrategy(),
        uuidExtension: 'pgcrypto' as const,
        installExtensions: false,
        synchronize: false,
        migrations: MIGRATIONS,
        migrationsRun: false,
        // No query logging: parameters include emails, password hashes and token hashes.
        logging: ['error', 'warn', 'migration'],
        autoLoadEntities: true,
      }),
    }),
    UsersModule,
    AuthModule,
    IngredientsModule,
    ModelRegistryModule,
    IngredientIntelligenceModule,
    ScansModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Every route. Express 5 (path-to-regexp v8) rejects a bare `*`; `{*splat}` is the named
    // optional wildcard Nest 12 expects (becomes `/api/{*splat}` under the global prefix).
    consumer.apply(RequestIdMiddleware).forRoutes('{*splat}');
  }
}

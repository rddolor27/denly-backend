import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from './commons/database/snake-naming.strategy.js';
import { MIGRATIONS } from './migrations/index.js';

// Used only by the TypeORM CLI and the seed/import scripts, always from the compiled dist/ build
// (ts-node cannot resolve the `@/` alias). Real process env vars win over the file.
loadEnv({
  path: process.env['NODE_ENV'] === 'test' ? '.env.test' : '.env',
  quiet: true,
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var ${name} for the TypeORM CLI (see .env.example)`,
    );
  }
  return value;
}

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env['DB_HOST'] ?? 'localhost',
  port: Number(process.env['DB_PORT'] ?? 5432),
  username: requireEnv('DB_USERNAME'),
  password: requireEnv('DB_PASSWORD'),
  database: requireEnv('DB_NAME'),
  namingStrategy: new SnakeNamingStrategy(),
  uuidExtension: 'pgcrypto',
  installExtensions: false,
  synchronize: false,
  logging: ['error', 'warn', 'migration'],
  entities: [join(import.meta.dirname, '**/*.entity.js')],
  migrations: MIGRATIONS,
};

export default new DataSource(dataSourceOptions);

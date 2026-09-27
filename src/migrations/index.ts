import type { MigrationInterface } from 'typeorm';
import { CreateCatalogRegistryScans1790165417374 } from './1790165417374-CreateCatalogRegistryScans.js';
import { AddUsersAndRefreshTokens1790171843379 } from './1790171843379-AddUsersAndRefreshTokens.js';

// Every migration is listed here (oldest first) so the CLI, the app and the e2e suite run the same set.
export const MIGRATIONS: (new () => MigrationInterface)[] = [
  CreateCatalogRegistryScans1790165417374,
  AddUsersAndRefreshTokens1790171843379,
];

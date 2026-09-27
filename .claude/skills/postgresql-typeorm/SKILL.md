---
name: postgresql-typeorm
description: PostgreSQL 17 + TypeORM 1.x conventions for denly-backend — entities with SnakeNamingStrategy, uuid PKs, timestamptz, relations with explicit FK columns and onDelete, generated-then-trimmed migrations, indexes (FK, composite, partial, GIN), constraints, transactions via DataSource, QueryBuilder with named parameters, keyset pagination, EXPLAIN, locking and online-safe schema changes, the expected Denly tables (ingredients, aliases, model registry, scans, device-reported detections, analyses, offline data packs), and exporting canonical data to the SQLite packs. Use when writing or changing an entity, repository query, migration, seeder, index, or diagnosing a slow query.
paths:
  - "denly-backend/src/**/*.entity.ts"
  - "denly-backend/src/migrations/**"
  - "denly-backend/src/seeders/**"
  - "denly-backend/src/data-source.ts"
---

# PostgreSQL + TypeORM (denly-backend)

House conventions carried from the user's other NestJS backends, minus their product specifics.
Written 2026-09-19 before the schema exists; the table sketch below is the expected shape, not a
migration. Pair with `db-migration-reviewer` before running anything destructive and with
`ingredient-intelligence` for the canonical-data tables.

## Data source and CLI

- Runtime: `TypeOrmModule.forRootAsync` reading the validated config; CLI: `src/data-source.ts`
  with `synchronize: false` **always**, `namingStrategy: new SnakeNamingStrategy()`,
  `migrations: [...]`, `logging` on locally.
- Commands: `pnpm migration:generate src/migrations/<VerbSubject>` (builds first), then
  `pnpm migration:run | migration:revert | migration:show`, `pnpm seed`, `pnpm registry:import` —
  all run the compiled `dist/` build (ts-node cannot resolve the `@/` alias). Add every new
  migration class to `src/migrations/index.ts`. Never edit a migration that has run outside
  local; add a new one.
- UUID defaults use core `gen_random_uuid()` (`uuidExtension: 'pgcrypto'`,
  `installExtensions: false`) — the app role never needs `CREATE EXTENSION`.
- `jsonb`/array defaults are written `default: () => "'{}'"` so `migration:generate` sees no drift.

## Entities

```ts
@Entity()                                          // table: ingredient
export class Ingredient {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'text', unique: true }) canonicalName!: string;   // canonical_name
  @Column({ type: 'text', unique: true }) slug!: string;
  @Column({ type: 'enum', enum: IngredientCategory }) category!: IngredientCategory;
  @Column({ type: 'jsonb', default: {} }) metadata!: IngredientMetadata;
  @Column({ type: 'text', array: true, default: [] }) dietaryFlags!: string[];
  @OneToMany(() => IngredientAlias, (a) => a.ingredient) aliases!: IngredientAlias[];
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}
```

- **camelCase in TS, snake_case in the DB** via `SnakeNamingStrategy`; never write
  `@Column({ name: 'snake_case' })` by hand. Raw SQL/QueryBuilder strings use snake_case.
- `uuid` PKs, `timestamptz` never `timestamp`, `text` over `varchar(n)` unless the limit is a
  business rule, `numeric(p,s)` for anything money/precise, `jsonb` for flexible metadata with a
  typed TS shape and validated input, `boolean` not flags-as-strings, enums via `enum` columns.
- Relations: declare the relation **and** the raw FK column (`@Column('uuid') ingredientId`) with
  `@Index()`; `eager: false` by default; `onDelete` explicit on every FK; `cascade` only for true
  composition (aliases belong to an ingredient; detections belong to a scan).
- `@Index([...])`, `@Unique([...])`, and `@Check(...)` on the entity so `migration:generate`
  emits them. Soft delete only when a decision records why.
- Images are **not** stored anywhere on the backend — they stay on the phone (ADR 0002). If an
  upload is ever decided, images go to object storage and the row stores a reference, dimensions
  and a content hash at most.

## Expected Denly tables (sketch)

| Table | Purpose | Key indexes / constraints |
|---|---|---|
| `ingredient` | canonical ingredient (name, slug, category, metadata, dietary flags) | unique `slug`, unique `canonical_name`, GIN on `metadata` if queried |
| `ingredient_alias` | alternative names / model class labels → ingredient | unique `(alias_normalized)`, index `ingredient_id`; `source` (`model_class`, `synonym`, `manual`) |
| `model_version` | registry of model versions an app build may submit: id (e.g. `yolov8n-ingredients-0.3.0`), status (`supported`/`retired`) | PK on the version string, index `status` |
| `model_class` | each version's taxonomy from `classes.yaml`: class id → class name | PK `(model_version_id, class_id)`, unique `(model_version_id, class_name)` |
| `app_user` | account (ADR 0012): normalised `email`, scrypt `password_hash`, `display_name` (`user` is reserved) | unique `email` |
| `refresh_token` | rotating refresh tokens: `token_hash` (SHA-256), `family_id`, `expires_at`, `revoked_at`, `replaced_by_id` | unique `token_hash`, index `user_id`, index `family_id`; FK `user_id` cascade |
| `scan` | one submission: `user_id` (required, ADR 0012), versions (`model_version` device-reported and registry-checked, `rules_version`, `prompt_version`), `created_at` at millisecond precision (keyset cursor) | index `(user_id, created_at, id)` for history, FK `model_version_id`, FK `user_id` cascade |
| `detection` | device-reported detections per scan (validated): class id/name, bbox (normalised), confidence, `source = 'device'` | index `scan_id`, `CHECK (confidence BETWEEN 0 AND 1)`, `CHECK` bbox within 0..1 and `x1 < x2`, `y1 < y2` |
| `scan_ingredient` | *not built (ADR 0011)*: the structured result is a `jsonb` snapshot on `scan.result`; add this table when a query needs "scans containing X" | PK `(scan_id, ingredient_id)`, index `ingredient_id` |
| `analysis` | LLM output per scan: validated JSON, prompt version, provider, token counts, latency | unique `scan_id`, index `prompt_version` |
| `data_pack` | one built offline pack: `rules_version`, tier (`small`/`medium`/`large`), `pack_schema_version`, size, SHA-256, storage key, published at | unique `(rules_version, tier)`, index `published_at` |

Names are illustrative; keep one concept per table and keep raw detections separate from
normalised results so the intelligence layer can be re-run against stored detections — the only
re-run possible, since the backend never has the image.

## Queries

- Simple reads: `findOne({ where })`, `find({ where, relations, select, order, skip, take })`.
- Filters/lists: QueryBuilder with **named parameters only**; escape `%`/`_` in `ILIKE`;
  allow-list sort columns; `getManyAndCount()` for offset pages, keyset
  (`(created_at, id) < (:ts, :id)`) for scan history feeds.
- Writes: `repository.merge(existing, dto)` + `save()` for updates; `insert()`/`upsert(values,
  ['conflictColumn'])` for bulk alias loads; `update()`/`delete()` with criteria for set-based changes.
- Transactions: `dataSource.transaction(async (manager) => …)` when more than one write must be
  atomic (scan + detections + scan_ingredients). **External calls (LLM, storage) never run
  inside a transaction.** `pessimistic_write` locks only for counters/queues.
- Alias lookups from the intelligence layer are batched (`WHERE alias_normalized = ANY(:names)`),
  never one query per detection, and cached in memory with a version key when hot.

## Migrations

- Generate from entities, then **read and trim** the SQL; commit the migration separately from
  feature code; `down()` truly reverses `up()`.
- Online-safe on populated tables: add nullable → backfill in batches → `SET NOT NULL`;
  `CREATE INDEX CONCURRENTLY` outside the per-migration transaction (own migration, documented);
  avoid `ALTER COLUMN TYPE` rewrites; enum additions via `ALTER TYPE … ADD VALUE`.
- Every FK column indexed (Postgres does not do it for you); composite indexes ordered
  equality → range → sort; partial indexes for status flags (`WHERE status = 'processing'`).
- Seed the canonical ingredient and alias data from versioned files (`seeders/data/*.json` or
  CSV) with an idempotent upsert; the seed's data version is the `rulesVersion` input.
- Seed the model registry (`model_version`, `model_class`) the same way from each model version's
  `classes.yaml`; it must be in production before the app build carrying that model is released.
- **Offline packs are exports of these tables** (ADR 0003): the pack builder reads one data release
  in a single read-only snapshot (`REPEATABLE READ`) and writes SQLite. Keep what the pack needs
  export-friendly: map jsonb to JSON text and arrays to rows in the builder, never let a
  Postgres-only behaviour (collation, `ILIKE`, array operators) decide a lookup result the app
  must reproduce — normalise keys before storing them.

## Performance and integrity

- `EXPLAIN (ANALYZE, BUFFERS)` before and after an index; `Seq Scan` on a hot large table means
  a missing or unusable index (casts, `LOWER()` without an expression index, leading wildcards).
- Pool size small and explicit; `statement_timeout` for reports; short transactions.
- Constraints carry integrity, not application code alone: `NOT NULL` + defaults, `UNIQUE` on
  natural keys, `CHECK` on ranges, FKs with explicit `ON DELETE`.
- Never run DDL or data changes against a shared/prod database by hand from Claude; write a
  migration, get it reviewed, let the deploy run it. Never read env files for a connection string.

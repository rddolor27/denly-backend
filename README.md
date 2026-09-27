# denly-backend

Denly's HTTP API: NestJS + TypeScript + TypeORM + PostgreSQL. Consumed only by `../denly-mobile`
over HTTP (OpenAPI at `/api/docs` outside production) — no shared code, no monorepo. See the workspace
root `../.claude/CLAUDE.md` and `../.claude/rules/architecture-rules.md` for the product context
and boundaries this repo has to keep.

## Stack

- **NestJS 12** (Express) — Nest's own core packages are ESM-only as of this major version, so
  the app is ESM (`"type": "module"`, `moduleResolution: nodenext`); relative and `@/`-aliased
  imports use an explicit `.js` specifier (resolved by TypeScript against the co-located `.ts`
  file — the standard NodeNext authoring convention).
- **TypeScript 6**, strict: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `exactOptionalPropertyTypes`, plus `noFallthroughCasesInSwitch`.
- **TypeORM 1.x** + `pg`, `SnakeNamingStrategy` implemented locally in
  `src/commons/database/snake-naming.strategy.ts` (the community `typeorm-naming-strategies`
  package only declares a `typeorm@^0.2 || ^0.3` peer range, which this repo's TypeORM 1.x would
  violate).
- **class-validator** / **class-transformer** for DTOs and the typed env config.
- **@nestjs/swagger** for the OpenAPI document served at `/api/docs` outside production.
- **@nestjs/jwt + @nestjs/passport + passport-jwt** for access tokens (one Passport strategy);
  passwords hashed with `node:crypto` scrypt (no extra dependency).
- **winston** behind Nest's `Logger` facade (`src/commons/logging/`, a small in-repo adapter —
  not `nest-winston`); JSON to stdout for Cloud Logging, no GCP logging SDK.
- **Vitest** (not Jest — see "Deviation from the skill" below), **ESLint 10** flat config +
  `typescript-eslint` (not oxlint — the coding-rules' "ESLint" house convention), Prettier.
- **pnpm 10**, **Node 24** (pinned in `engines` and `.nvmrc`).

## Deviation from the skill: Vitest, not Jest

The `nestjs`/`testing` skills name Jest as the house default. At scaffold time (2026-09-23),
`@nestjs/common` and friends ship as **ESM-only**: requiring them from a CommonJS Jest transform
fails outright (`ERR_REQUIRE_ESM`), and making Jest itself run ESM needs `ts-jest`'s experimental
ESM mode plus `NODE_OPTIONS=--experimental-vm-modules` — exactly the ceremony Nest's own `nest new`
now avoids by defaulting to Vitest (verified: a from-scratch `nest new` on this machine generates
`vitest.config.ts`/`vitest.config.e2e.ts`, not Jest config). Vitest resolves the `@/` alias
natively via `vite-tsconfig-paths` and needed no extra plugin for Nest's decorator metadata
(`emitDecoratorMetadata`) — verified with a throwaway scaffold before committing to this. ESLint
(vs. the CLI's own new oxlint default) was kept, since that swap has no such technical blocker.
**If the root `testing`/`nestjs` skills should be updated to reflect this, that's a call for
whoever owns the workspace root — this repo did not touch `../.claude/`.**

## Layout

```
src/
  main.ts               bootstrap: logger (AppLogger) -> configureHttpApp -> swagger -> helmet -> body
                         parsers -> CORS -> shutdown hooks -> throttler (deferred)
  app.setup.ts           configureHttpApp: /api prefix, URI versioning, global filter + pipe;
                         configureCors (both shared with e2e)
  app.module.ts          ConfigModule, TypeOrmModule.forRootAsync, feature modules, RequestIdMiddleware
  health.controller.ts   GET /api/health (public, version-neutral) -> status + db ping
  health.service.ts      DataSource.query('SELECT 1'), throws DatabaseUnavailableError on failure
  health-response.dto.ts
  data-source.ts         TypeORM DataSource for the CLI (migration:*, seed)
  config/                 env.validation.ts (class-validator schema, fail-fast), app-config.service.ts,
                         config.module.ts (@Global, loads .env / .env.test)
  commons/
    errors/               DomainError base + DatabaseUnavailableError
    filters/               GlobalExceptionFilter -> { statusCode, code, message, details?, requestId, timestamp }
    context/, middlewares/ AsyncLocalStorage request id + trace id, RequestIdMiddleware, trace headers
    logging/                AppLogger (winston behind the Nest Logger facade), JSON / pretty formats
    http/                   buildCorsOptions (origin callback over CORS_ORIGINS)
    database/               SnakeNamingStrategy
    dtos/                   ErrorResponseDto (Swagger)
    auth/                   @Public(), @CurrentUser(), AuthenticatedUser
    transforms/             @Trim()
  modules/
    auth/                 register/login/refresh/logout, JwtStrategy, global JwtAuthGuard, refresh tokens
    users/                app_user, GET /users/me
    ingredients/          canonical ingredients + aliases, normalizeAlias, taxonomy importer
    model-registry/       model versions + classes, DetectionRun checks, classes.yaml importer
    ingredient-intelligence/  deterministic pipeline (pure) + rules bundle (data/rules-bundle.json)
    scans/                user-owned scans: registry check -> intelligence -> one transaction; history
  migrations/             generated migrations + index.ts (the list the CLI, app and e2e run)
  seeders/                run-seed.ts, import-model-version.ts, data/ (taxonomy snapshot, overlay)
test/
  support/e2e-app.ts      boots AppModule via configureHttpApp, resets + seeds the *_test database
  *.e2e-spec.ts           health, auth, catalog (ingredients + registry), scans, cors
```

Not built yet: `analysis` (LLM port — provider undecided) and `data-packs` (offline SQLite packs).

## Commands

```bash
pnpm start:dev          # watch mode
pnpm build               # nest build (tsc) + tsc-alias (rewrites the @/ alias in dist)
pnpm start:prod          # node dist/main.js

pnpm lint                # eslint --fix
pnpm test                 # vitest run (unit — src/**/*.spec.ts)
pnpm test:watch
pnpm test:cov
pnpm test:e2e             # vitest run --config vitest.config.e2e.ts (needs the local Postgres — see below)

pnpm migration:generate src/migrations/<VerbSubject>   # builds first; then add the class to src/migrations/index.ts
pnpm migration:run | migration:revert | migration:show  # run `pnpm build` first
pnpm seed                                              # taxonomy snapshot -> ingredients + aliases (idempotent)
pnpm registry:import --model-version <id> --classes <classes.yaml> [--status supported|retired] [--taxonomy-version <v>]
```

The migration, seed and import CLIs run the compiled `dist/` build — ts-node cannot resolve the
`@/` alias.

## denly-ml integration

denly-ml is never imported; the backend reads its files.

1. **Canonical ingredients.** `src/seeders/data/taxonomy.yaml` is a copy of
   `../denly-ml/taxonomy.yaml`. `pnpm seed` upserts one ingredient per class (slug = class name,
   category = taxonomy `group`) and its aliases: `model_class` (the class name), `synonym`
   (display name, `en`), `regional` (`tl`, `ceb`). Display-name overrides and allergen tags come
   from `src/seeders/data/ingredient-overlay.json`. To refresh: copy the new taxonomy over the
   snapshot (or `pnpm seed --taxonomy ../denly-ml/taxonomy.yaml`) and reseed.
2. **Model registry.** Before an app build ships a model, register it from that model's
   `classes.yaml`: `pnpm registry:import --model-version yolov8n-ingredients-0.1.0 --classes
   <path>/classes.yaml --taxonomy-version 2026.09.2`. The import refuses a version whose classes do
   not all map to an ingredient, and a re-import that changes an existing version's classes.
   Re-running with `--status retired` retires it. For local testing before a model exists, any
   dataset release works: `--classes ../denly-ml/data/releases/2026.09.2/classes.yaml`.
3. **Rules.** `src/modules/ingredient-intelligence/data/rules-bundle.json` (`rulesVersion`,
   confidence floor, bands, rules) is validated at boot; every scan stores the `rulesVersion` used.

## API

Everything is under `/api` (ADR 0012). Every route needs `Authorization: Bearer <accessToken>`
except the ones marked public.

| Route | Auth | What |
|---|---|---|
| `GET /api/health` | public | status + db ping (version-neutral) |
| `POST /api/v1/auth/register` | public | `{ email, password (8–128), displayName? }` → `201 { user, tokens }`; `409 EMAIL_ALREADY_REGISTERED` |
| `POST /api/v1/auth/login` | public | `{ email, password }` → `200 { user, tokens }`; `401 INVALID_CREDENTIALS` |
| `POST /api/v1/auth/refresh` | public | `{ refreshToken }` → `200 tokens` (rotated); `401 INVALID_REFRESH_TOKEN` → sign in again |
| `POST /api/v1/auth/logout` | public | `{ refreshToken }` → `204`, revokes that sign-in |
| `GET /api/v1/users/me` | token | the current user |
| `POST /api/v1/scans` | token | the phone's `DetectionRun` → `201` with detections, structured ingredients, unknowns, flags, `analysisStatus` (`unavailable` until the LLM stage exists). `422 UNSUPPORTED_MODEL_VERSION` / `INVALID_DETECTION`, `400 VALIDATION_ERROR` |
| `GET /api/v1/scans?limit=&cursor=` | token | the caller's history, newest first; pass `nextCursor` back as `cursor` |
| `GET /api/v1/scans/:id` | token | one of the caller's scans (someone else's → `404`) |
| `GET /api/v1/model-versions`, `/:id` | public | registered versions (+ classes) |
| `GET /api/v1/ingredients?q=&category=&limit=&offset=` | public | search by any alias prefix (`q=kamatis`) |
| `GET /api/v1/ingredients/:slug` | public | one ingredient with aliases and allergens |

`tokens` = `{ tokenType: 'Bearer', accessToken, accessTokenExpiresAt, refreshToken,
refreshTokenExpiresAt }`. Access tokens last 15 minutes; a sign-in (refresh-token family) lasts
30 days from sign-in, rotating on every refresh. Replaying an already-used refresh token — or two
parallel refreshes of the same token — revokes the whole sign-in, so the app refreshes one at a
time. 401 codes: `AUTHENTICATION_REQUIRED` (no token), `ACCESS_TOKEN_EXPIRED` (refresh, retry),
`INVALID_ACCESS_TOKEN`.

OpenAPI at `/api/docs` (JSON at `/api/docs-json`) outside production is the mobile contract.

## Environment

Copy `.env.example` to `.env` for local dev (never commit `.env`). Names:

| Var | Meaning | Local default |
|---|---|---|
| `NODE_ENV` | `development` \| `test` \| `production` | `development` |
| `PORT` | HTTP port | `3000` |
| `DB_HOST` | Postgres host | `localhost` |
| `DB_PORT` | Postgres port | `5432` (the local PostgreSQL 17 Windows service) |
| `DB_USERNAME` / `DB_PASSWORD` / `DB_NAME` | Postgres credentials | dev-only placeholders, see `.env.example` |
| `JWT_ACCESS_SECRET` | **required**, ≥ 32 chars, random, different per environment; placeholders are rejected at boot | generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `JWT_ACCESS_TTL_SECONDS` | access-token lifetime | `900` |
| `REFRESH_TOKEN_TTL_DAYS` | how long one sign-in lasts | `30` |
| `LOG_LEVEL` | optional: `error` \| `warn` \| `info` \| `debug` | unset → `info` in production, `warn` in test, `debug` in development |
| `LOG_FORMAT` | optional: `json` (Cloud Logging) \| `pretty` | unset → `json` in production, `pretty` otherwise |
| `CORS_ORIGINS` | optional: comma-separated exact browser origins, e.g. `https://admin.example.com,http://localhost:8081` | unset/empty → no browser origin allowed |
| `GCP_PROJECT_ID` | optional: GCP project id; lets JSON logs carry the Cloud Trace field | unset → no trace field |

Config is validated at boot (`src/config/env.validation.ts`) — missing or malformed vars fail
fast with one clear error instead of a broken query later. The four optional vars above are
either unset or valid: an empty `LOG_LEVEL=` is rejected, not treated as unset.

## Logging

Code logs through Nest's facade (`new Logger(MyService.name)`, `[methodName]` prefixes);
`main.ts` installs `AppLogger` (`src/commons/logging/`, winston) with `app.useLogger` right after
config loads, and `bufferLogs` holds Nest's boot logs until then. Everything goes to stdout, one
entry per line.

- **`json`** — one object per line, shaped for Cloud Logging (Cloud Run ships stdout for free, so
  there is no logging API transport):

  ```json
  {"severity":"ERROR","message":"[ping] sample failure","time":"2026-09-27T13:26:39.154Z","context":"PingController","requestId":"smoke-req-1","logging.googleapis.com/trace":"projects/denly-smoke/traces/4bf92f3577b34da6a3ce929d0e0e4736","stack_trace":"Error: sample failure\n    at PingController.ping (...)"}
  ```

  `severity`: fatal → `CRITICAL`, error → `ERROR`, warn → `WARNING`, log → `INFO`, debug/verbose
  → `DEBUG`. `time` (RFC 3339) becomes the entry's timestamp. `requestId` comes from `RequestIdMiddleware` (inside a request only).
  `logging.googleapis.com/trace` is added when the request carried a valid `traceparent` (or,
  failing that, `x-cloud-trace-context`) **and** `GCP_PROJECT_ID` is set — Cloud Run does not set
  it for you. `stack_trace` (read by Error Reporting) stays inside the one JSON line. A
  non-string message goes under `data` (depth/size-bounded, binary replaced by its length,
  password/token/secret/cookie/authorization/email keys redacted).
- **`pretty`** — `timestamp LEVEL [Context] message requestId=…`, coloured on a TTY, stack on the
  following lines.

Levels: `LOG_LEVEL` is the threshold (Nest `log` = `info`, `verbose` = `debug`; `fatal` always
passes). No HTTP access log (Cloud Run writes request logs) and no TypeORM query logging. Never log
tokens, passwords, emails, full request bodies or image bytes; log ids instead.

## CORS

Only browsers send `Origin`; the mobile app, curl and health probes don't and are always let
through. `CORS_ORIGINS` lists the exact browser origins allowed (scheme + host + non-default
port, lowercase, no path, query or trailing slash; `*` is rejected at boot). A listed origin gets
`Access-Control-Allow-Origin` (reflected), methods `GET POST PATCH PUT DELETE OPTIONS`, headers
`Authorization`, `Content-Type`, `x-request-id`, exposed `x-request-id`, max-age 600 s, and no
credentials (auth is a bearer header, not cookies). Any other origin gets no CORS headers, so the
browser blocks the response; the server does not turn it into an error.

### e2e's separate database

`pnpm test:e2e` sets `NODE_ENV=test`, which makes `ConfigModule` load `.env.test` before `.env`
(`src/config/config.module.ts`). Copy `.env.example` to `.env.test` and set `DB_NAME=denly_test`.
Each suite **drops and re-migrates** that database, then seeds it; the helper refuses any
database whose name does not end in `_test`.

## Local database (the Windows PostgreSQL 17 service, port 5432)

Development uses the PostgreSQL 17 service already installed on the workstation (ADR 0008 —
no Docker database). One-time setup, as the `postgres` superuser (psql prompts for its password):

```bash
psql -U postgres -h localhost -p 5432 -c "CREATE ROLE denly_dev LOGIN PASSWORD 'choose-a-dev-password';"
psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE denly OWNER denly_dev;"
psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE denly_test OWNER denly_dev;"
```

Then put the same user/password in your `.env` and `.env.test` (never committed).

## Hosting and deployment

Cloud Run + Cloud SQL for PostgreSQL 17 on GCP (ADR 0008, 0013), built from the `Dockerfile`.
GitHub Actions: `CI` on pull requests and `main`, `Deploy Staging (manual)` for any ref,
`Deploy Production (release)` for a published `vX.Y.Z` release. One-time GCP and GitHub setup,
releasing and rollback: [`docs/deployment.md`](docs/deployment.md).

## Error response shape

Every error response (nestjs skill § HTTP layer):

```json
{ "statusCode": 404, "code": "SCAN_NOT_FOUND", "message": "...", "details": {}, "requestId": "...", "timestamp": "..." }
```

`code` is a stable, UPPER_SNAKE string. Domain errors extend `DomainError`
(`src/commons/errors/domain.error.ts`); `GlobalExceptionFilter` maps them, Nest's own
`HttpException`s, and anything unknown (500, no internals leaked) to this one shape.

## Notes

- No rate limiting or LLM code yet — `main.ts` marks where the throttler plugs in.
  **Rate limiting on `/api/v1/auth/*` is needed before any public deploy.**
- `GET /api/health` is version-neutral since infra probes hit it without a version; every other
  route defaults to `/v1`. Paths outside `/api` get Express's plain 404.
- UUID defaults use core `gen_random_uuid()`; TypeORM installs no Postgres extensions at connect
  and logs no queries (parameters would include emails and hashes).
- Migration `AddUsersAndRefreshTokens` makes `scan.user_id` required; it fails on a database that
  still holds scans from before accounts existed.

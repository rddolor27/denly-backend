# Denly — Backend (denly-backend)

NestJS + TypeScript + TypeORM + PostgreSQL REST API consumed by `../denly-mobile`. This repo is
independent of the mobile app — the HTTP API (OpenAPI at `/docs` in non-prod) is the only contract.
Never import from it; never add a monorepo.

Hosting is GCP (ADR 0008 — Cloud Run + Cloud SQL assumed). The only GCP-shaped code is the JSON
log format (stdout lines Cloud Logging parses, trace field via `GCP_PROJECT_ID`); no GCP SDK, no
deploy config yet. Local development uses the Windows PostgreSQL 17 service on `localhost:5432`
(databases `denly` and `denly_test`) — no Docker database.

## Stack

- NestJS 12 (Express) · TypeScript 6 strict · TypeORM 1.x · PostgreSQL 17 · `pnpm` 10 · Node 24 (pinned)
- **ESM, not CommonJS**: Nest 12's own core packages are ESM-only. `"type": "module"`,
  `moduleResolution: nodenext`; relative and `@/`-aliased imports use an explicit `.js` specifier
  (TS resolves it against the co-located `.ts` file). `tsc-alias` rewrites the `@/` alias to a real
  relative path at build time; Vitest resolves it via `vite-tsconfig-paths`.
- Validation: class-validator + class-transformer via the global `ValidationPipe`
  (`whitelist`, `forbidNonWhitelisted`, `transform`, implicit conversion)
- Port: `3000` (`PORT` env var) · env files: `.env` (dev), `.env.test` (e2e — `NODE_ENV=test`
  loads it first); names documented in `.env.example`, values validated at boot
  (`src/config/env.validation.ts`), never read outside `src/config/`
- **Test runner: Vitest, not Jest** — see "Deviations from the skills" below
- **Lint: ESLint 10 flat config + typescript-eslint**, not the Nest CLI's new oxlint default —
  matches the coding-rules "ESLint" house convention
- **Logging: winston behind the Nest `Logger` facade** via the in-repo `AppLogger`
  (`src/commons/logging/`, installed in `main.ts` with `app.useLogger`) — not `nest-winston`, not
  `@google-cloud/logging-winston`. `LOG_FORMAT=json` (default in production) = Cloud Logging
  lines on stdout; `pretty` otherwise. Keep calling `new Logger(X.name)`.
- **CORS** (bootstrap step 6, `configureCors` in `app.setup.ts`): origin callback over the exact
  origins in `CORS_ORIGINS`; no `Origin` header passes, unlisted origins get no CORS headers

## Commands

```bash
pnpm start:dev · pnpm build · pnpm lint · pnpm test · pnpm test:e2e
pnpm migration:generate src/migrations/<Name> · migration:run · migration:revert · migration:show
pnpm seed · pnpm registry:import --model-version <id> --classes <classes.yaml>
```

Migration/seed/import CLIs run from `dist/` (ts-node cannot resolve `@/`); every migration class is
listed in `src/migrations/index.ts`. e2e drops and re-migrates the `*_test` database each suite.

One-time DB setup (role + `denly` + `denly_test` on the local 5432 service): `README.md`.

Full details, env var table and the e2e database setup: `README.md`.

## Layout

```
src/
  main.ts  app.module.ts  health.controller.ts  health.service.ts  data-source.ts
  config/                    typed, validated env access (env.validation.ts, app-config.service.ts,
                             config.module.ts)
  commons/                   errors/ (DomainError, DatabaseUnavailableError), filters/
                             (GlobalExceptionFilter), context/ + middlewares/ (request id + trace
                             id via AsyncLocalStorage), logging/ (AppLogger over winston), http/
                             (buildCorsOptions), database/ (SnakeNamingStrategy — implemented
                             locally, not the `typeorm-naming-strategies` package, which only
                             declares a typeorm@^0.2||^0.3 peer range), dtos/ (ErrorResponseDto)
  migrations/                generated migrations + index.ts
  seeders/                   run-seed.ts, import-model-version.ts, data/ (denly-ml taxonomy snapshot,
                             ingredient-overlay.json)
  modules/
    auth/                    register/login/refresh/logout, JwtStrategy, global JwtAuthGuard (ADR 0012)
    users/                   app_user, GET /api/v1/users/me
    scans/                   user-owned scans: registry check -> intelligence -> one transaction; history
    model-registry/          model versions + classes (from denly-ml classes.yaml); validates runs
    ingredients/             canonical ingredients + aliases (from the taxonomy), normalizeAlias
    ingredient-intelligence/ pure pipeline + data/rules-bundle.json (rulesVersion)
    (not built) analysis/    LanguageModel port + the single provider adapter, prompts (versioned)
    (not built) data-packs/  small / medium / large offline SQLite packs, manifest
```

How denly-ml feeds this repo (ADR 0011): README § denly-ml integration.

Routes live under `/api` (`/api/health`, `/api/v1/...`, Swagger `/api/docs`); `configureHttpApp`
in `src/app.setup.ts` is shared by `main.ts` and the e2e suite. Every route requires a bearer
token unless marked `@Public()` (`src/commons/auth/`); services scope user data by `userId` from
`@CurrentUser()`. `JWT_ACCESS_SECRET` is required at boot. Never enable TypeORM query logging
(parameters include emails and hashes). Edit files with the Edit tool, never PowerShell
`Get-Content`/`Set-Content` (Windows PowerShell 5.1 misreads UTF-8 and adds a BOM).

## Deviations from the skills (recorded here; the root `.claude/` was not touched)

- **Vitest instead of Jest.** The `nestjs`/`testing` skills name Jest as the house default. At
  scaffold time, `@nestjs/common` and its siblings are ESM-only: a CommonJS Jest transform can't
  `require()` them (`ERR_REQUIRE_ESM`), and ESM-mode Jest needs `ts-jest`'s experimental ESM
  support plus `NODE_OPTIONS=--experimental-vm-modules` — the exact ceremony Nest's own `nest new`
  now sidesteps by generating Vitest config by default (verified with a throwaway scaffold before
  committing to this, including that Nest's decorator metadata / DI works under Vitest's default
  transform with no extra plugin needed). ESLint (vs. the CLI's new oxlint default) was kept —
  that swap had no equivalent technical blocker.
- **TypeORM 1.x, not 0.3.** The skills anticipated 0.3 (written before this repo existed); 1.x was
  the current stable release at scaffold time and nothing pins this app to 0.3.
- **`GET /health` is version-neutral** (`/health`, not `/v1/health`) — infra probes and load
  balancers hit it without a version prefix; every other route defaults to `/v1`.

## Rules that matter most here

- Load the `nestjs`, `postgresql-typeorm`, `computer-vision`, `ingredient-intelligence` and
  `llm-architecture` skills for the matching areas; `architecture-rules.md` is binding.
- Entity → Model → DTO; controllers adapt only; services own logic; DTOs validated.
- YOLOv8 runs on the phone (ADR 0002): no model runtime here and no image uploads. Submitted
  detections are untrusted — DTO validation plus the model registry before anything is persisted.
- A model version is registered here (registry + `model_class` alias rows) before an app build
  that ships it is released.
- Ingredient intelligence also runs in the app offline (ADR 0003): keep rules, thresholds and
  mappings in data, and ship the conformance fixtures with every data release; a pack only reaches
  the manifest after its build checks pass.
- Only the analysis adapter imports the LLM SDK. Everything else depends on the ports.
- Every stored detection/analysis records `modelVersion`, `rulesVersion`, `promptVersion`.
- Migrations are generated from entities, read, trimmed and reviewed (`db-migration-reviewer`).

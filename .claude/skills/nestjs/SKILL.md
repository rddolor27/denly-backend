---
name: nestjs
description: NestJS + TypeScript conventions for denly-backend — modular layout, Entity → Model → DTO flow with static factories, constructor DI against interfaces/tokens, class-validator DTOs with Swagger, exception taxonomy and error response contract, bootstrap order (versioning, validation pipe, CORS callback, throttling — implemented later), logging, the model registry that validates device-reported detections, offline data-pack builds and the manifest endpoint, the LLM port/adapter, REST design, security defaults, testing shape. Use when adding or changing any backend module, controller, service, DTO, guard, pipe, interceptor, config, or API contract.
paths:
  - "denly-backend/src/**"
---

# NestJS (denly-backend)

Inherits the house conventions the user applies to every NestJS backend (Entity → Model → DTO,
direct TypeORM repository injection, one Passport strategy, Nest `Logger` over Winston,
explicit bootstrap order, dynamic CORS callback, strict TypeScript). Written 2026-09-19 before the
repo exists — "expected" module names are a guide, the boundaries are the rule. Copy-paste
templates in `references/patterns.md`. Pair with `postgresql-typeorm`, `security`, `testing`.

## Layout

```
src/
  main.ts  app.module.ts  health.controller.ts  data-source.ts
  config/                     typed env access, validated at boot (fail fast)
  commons/                    decorators, dtos (pagination), errors, interceptors, middlewares,
                              naming-strategy, transformers, types, utils
  modules/<feature>/
    <feature>.module.ts
    controllers/  services/  dtos/  entities/  models/  interfaces/  constants/  (strategies/)
    <feature>.service.spec.ts   (or next to each service)
  migrations/  seeders/
```

Expected modules: `scans` (accepts the device's `DetectionRun`, orchestrates), `model-registry`
(supported model versions + taxonomies; validates submissions), `ingredients` (canonical data),
`ingredient-intelligence` (deterministic pipeline), `analysis` (LLM port + adapter + prompts),
`data-packs` (builds the offline SQLite packs per tier at each data release, their checksums and
conformance fixtures; serves the manifest — ADR 0003), `health`, `auth` + `users` (built, ADR
0012). There is no `detection` module in v1: YOLOv8 runs on the phone (ADR 0002) and no model
runtime is installed here.

## Auth (built — ADR 0012)

- `AuthModule` registers the global `JwtAuthGuard` (`APP_GUARD`, extends `AuthGuard('jwt')`, one
  Passport JWT strategy). Everything is protected unless the controller or handler has
  `@Public()` from `src/commons/auth/`. Handlers read the actor with `@CurrentUser()` →
  `AuthenticatedUser { id }` and pass `user.id` to the service; services scope queries by it.
- `POST /api/v1/auth/{register,login,refresh,logout}`, `GET /api/v1/users/me`. 401 codes:
  `AUTHENTICATION_REQUIRED`, `ACCESS_TOKEN_EXPIRED`, `INVALID_ACCESS_TOKEN`,
  `INVALID_CREDENTIALS`, `INVALID_REFRESH_TOKEN`.
- Config: `JWT_ACCESS_SECRET` (required, ≥ 32 chars), `JWT_ACCESS_TTL_SECONDS` (900),
  `REFRESH_TOKEN_TTL_DAYS` (30) — via `AppConfigService.auth`.

## Entity → Model → DTO (core convention)

- **Entity** (`entities/*.entity.ts`): TypeORM only. Never leaves a service.
- **Model** (`models/*.model.ts`): immutable domain object (`readonly` fields) with
  `static fromEntity(e)`, `fromCreateDTO(dto)` as needed. The service's return type.
- **DTO** (`dtos/*.dto.ts`): request DTOs with class-validator + `@ApiProperty`/
  `@ApiPropertyOptional`; response DTOs with `static fromModel(m)`. Controllers return DTOs —
  never entities, never models.
- Controllers adapt only: guard, validate, call one service method, map the response. No business
  logic, no repository access, no try/catch that hides errors.

## Dependency injection

- Constructor injection. Services inject TypeORM repositories directly
  (`@InjectRepository(Entity) private readonly repo: Repository<Entity>`); a hand-written
  `*Repository` class is the exception for heavy read aggregation.
- Cross-module dependencies go through an **interface + token**: `constants/<feature>.constants.ts`
  exports `const X_SERVICE = Symbol('X_SERVICE')`; the service file exports
  `InjectXService = () => Inject(X_SERVICE)` and `XProvider: Provider = { provide, useClass }`;
  modules register and export the Provider; consumers depend on `IXService`.
- **Ports for the AI boundaries** use the same mechanism: `LANGUAGE_MODEL` → `ILanguageModel`.
  Exactly one adapter is bound per port in the module; the adapter is the only file importing the
  provider SDK. (A server-side detector, if ever decided, would get `INGREDIENT_DETECTOR` the same
  way.)
- Never `new` a service; `forwardRef()` only with a comment explaining why.

## HTTP layer

- Global prefix `/api` + URI versioning, default `v1` (ADR 0012). Resource nouns, plural, kebab-case: `POST /api/v1/scans`,
  `GET /api/v1/scans/:id`, `GET /api/v1/ingredients/:slug`. Verbs only for non-CRUD actions as sub-resources
  (`POST /api/v1/scans/:id/questions`).
- Status codes: 201 on create (including `POST /api/v1/scans`, which returns the structured result),
  200 on read/update, 204 on delete, 202 only for work that has no result yet.
- Global `ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } })`
  with an `exceptionFactory` that yields the error contract below. `ParseUUIDPipe` on id params.
- **Error contract** (one shape everywhere):
  `{ statusCode, code, message, details?, requestId, timestamp }`. `code` is a stable
  UPPER_SNAKE string (`VALIDATION_ERROR`, `SCAN_NOT_FOUND`, `UNSUPPORTED_MODEL_VERSION`,
  `ANALYSIS_UNAVAILABLE`). Domain errors are typed classes with a `code`; a global exception filter
  maps them to Nest exceptions; unknown errors become 500 with no internals leaked.
- Submissions: `POST /api/v1/scans` takes the device's `DetectionRun` as JSON — nested DTOs with
  `@ValidateNested`, `@ArrayMaxSize`, numeric ranges — then the model registry check before
  anything is persisted (`computer-vision` § Model registry). No image uploads in v1; if one is
  ever decided: `limits.fileSize`, MIME sniffed from bytes, re-encode and strip metadata.
- Offline data: `GET /api/v1/data-packs` returns the manifest (per tier: `rulesVersion`,
  `packSchemaVersion`, compatible model versions, size, SHA-256, download URL). Pack files are
  static and served from storage/CDN, not streamed through Nest (GCP Cloud Storage, ADR 0008; delivery details open).
  Publishing a data release = seed → build packs → checksums → conformance fixtures → manifest,
  in that order; the manifest never points at a pack that failed its build checks.
- Swagger: `@ApiTags`, `@ApiOkResponse({ type })`, `@ApiBearerAuth()` on guarded controllers;
  served at `/api/docs` outside production. The
  OpenAPI output *is* the mobile contract, including the `DetectionRun` and manifest shapes.

## Bootstrap order (`main.ts`) — implement when the repo exists

1. Logger (Nest `Logger` facade over Winston, JSON in deployed envs, request id from
   `AsyncLocalStorage`) + process-level `uncaughtException`/`unhandledRejection` handlers.
2. `configureHttpApp` (`src/app.setup.ts`, shared with the e2e suite): `/api` prefix, URI
   versioning, global exception filter, global `ValidationPipe`. 3. Swagger at `/api/docs`
   (non-prod, bearer auth). 4. `helmet()`. 5. Body parsers with explicit limits.
6. CORS via a dynamic origin callback reading `CORS_ORIGINS` (mobile apps send no `Origin`; allow
   the empty origin) — deferred. 7. Shutdown hooks.
8. Throttler tiers, overridable per route with `@Throttle()`, strict on `/api/v1/auth/*`;
   `@SkipThrottle()` only on `/api/health` — deferred.

CORS, rate limiting and observability are conventions until the user asks for them.

## Pipeline orchestration (scans)

Built (ADR 0011): `ScansService.submit(run)` = model registry check → ingredient intelligence
(synchronous, deterministic) → one transaction inserting the `scan` (structured result as a
`jsonb` snapshot + `rules_version`) and its device-reported `detection` rows → `201` with the full
result. No LLM stage exists yet, so `analysisStatus: 'unavailable'`. When the analysis module
lands it runs outside the request (queue vs background job is open #13), the submit response
carries `analysisStatus: 'pending'`, and the client polls `GET /api/v1/scans/:id`. The LLM stage may
fail soft; the intelligence stage may not. External calls never run inside a database
transaction. A scan first resolved offline arrives later as an ordinary `POST /api/v1/scans`.

Registry and catalog data arrive as files, not HTTP writes (no admin role exists): `pnpm seed`
(taxonomy snapshot → ingredients + aliases) and `pnpm registry:import --model-version <v>
--classes <classes.yaml>` (refuses a version whose classes do not all map to an ingredient).

## Cross-cutting

- Config: one `ConfigService`-backed module with a validated schema; `NODE_ENV` values and env-file
  layout decided at scaffold; `.env.example` always current; never read real env files.
- Logging: `new Logger(X.name)`, `[methodName]` prefixes, never tokens/prompts-with-user-content/
  image bytes. `warn` for security events.
- Bound everything: pagination `limit` max, JSON body size, detections per submission,
  concurrent LLM calls, LLM timeout.
- Formatting: Prettier single quotes + trailing commas; ESLint with explicit return types, no
  `any`, no non-null assertions.

## Adding a feature — order

module → entity + migration (`postgresql-typeorm`) → model → DTOs → service (+ interface, token,
Provider) → controller → register in module/`app.module.ts` → `*.spec.ts` (`testing`) → OpenAPI
check → mobile hook (`react-native`) → `/verify backend`.

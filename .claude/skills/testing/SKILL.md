---
name: testing
description: Testing conventions for Denly by layer — React Native (components, domain logic, flows, API hooks), NestJS (services with plain mocks, controllers, e2e against a local Postgres), ingredient intelligence (normalization, mapping, dedupe, confidence, rules, determinism, the backend/app conformance suite, data-pack build and install), YOLOv8 on the phone (coordinate/threshold units, adapter contract with a mocked native module, on-device checks, Core ML parity, golden-set regression, backend model-registry validation), LLM (recorded-response adapter tests, schema validation, golden-set prompt evaluation, version tracking). Use when writing or running tests, deciding what to test, or setting up a test layer in either repo.
---

# Testing (Denly)

Conventions only — no runner is installed anywhere yet. When a repo is scaffolded, pick the
runner (**Vitest** for NestJS — Nest 12 is ESM-only, so the backend is ESM and Jest was dropped at scaffold; Jest via `jest-expo` + React Native Testing Library for mobile),
record it, and replace "expected" wording here. A red test is never "done".

## Ground rules

- Test behaviour, name tests by it ("returns unknowns for unmapped classes"), one `describe` per
  unit. Mock at the boundary (repositories, HTTP, model runtime, provider SDK), never the thing
  under test. No real network, no real DB in unit tests.
- Fixtures over factories for pipeline data: a folder of `DetectionResult[]` and
  `StructuredIngredientData` JSON used across backend units, LLM evals and mobile component tests.
- Run tests from inside the repo; prefer targeting the specs involved; cap workers (`--maxWorkers=3`)
  on this machine; never `--watch` in a Claude session (it never exits).
- Paste failing output verbatim when reporting; fix before continuing.

## React Native (`denly-mobile`)

- **Components**: React Native Testing Library — render with providers (QueryClient, navigation,
  safe area), assert by accessibility role/label (this doubles as an a11y check), cover each
  state (loading, empty, error, partial). Snapshot tests only for stable primitives.
- **Domain logic**: pure functions in `lib/` and feature `utils/` (grouping, band labels, image
  size maths) get plain unit tests.
- **Hooks / API**: mock the API client module; test query keys, `enabled` gating, polling stop
  condition, mutation success/error effects with a fresh `QueryClient` per test.
- **Detection**: component and flow tests mock the detector port with `DetectionRun` fixtures;
  the adapter's TS wrapper is unit-tested against a mocked native module (see YOLOv8 below).
- **Offline data**: pack install with a fixture pack — checksum mismatch, unknown schema version,
  incompatible model version and an interrupted download all keep the previous pack; the online →
  offline fallback on network failure/timeout; an offline result replaced by the online one.
- **Flows**: end-to-end on a device (Detox or Maestro — open decision) for scan → detecting →
  analysing → results, permission denied, unsupported model version, offline with and without a
  pack (airplane mode); keep them few and stable. Real-model runs need a physical iPhone.

## NestJS (`denly-backend`)

- **Services**: plain constructor injection with hand-written mocks (house style) — no
  `Test.createTestingModule` unless DI itself is under test. Assert thrown domain errors by class
  and `code`; assert returned Models by shape.
- **Controllers**: thin — a few tests that DTO validation rejects bad input and the response DTO
  mapping is applied; the rest is covered by e2e.
- **Submission**: the `DetectionRun` DTO and the model registry reject out-of-range boxes,
  oversize lists, unknown/retired versions and class pairs from another version's taxonomy —
  before anything is persisted.
- **e2e**: boot the real `AppModule` with the same globals as `main.ts`, `supertest`, a local
  seeded Postgres (never shared/prod), clean up what you create, `maxWorkers: 1` documented as a
  crutch not a guarantee. An OpenAPI snapshot test locks the route inventory once routes exist.
- **Migrations**: `migration:generate` on a clean branch must produce an empty diff (drift check).

## Ingredient intelligence

Cheapest layer to test, so test it hardest: normalisation table, alias mapping (known / unknown /
collision), dedupe, band edges, each rule alone and in combination, determinism (shuffled input →
identical output), and full-pipeline snapshots from the shared fixtures. Rules ship with tests or
they do not ship.

**Conformance (ADR 0003)** — the fixture set published with each data release runs in *both*
repos: the backend against Postgres, the app's offline evaluator against the large pack; outputs
must match exactly. Small and medium packs: same shape, fewer optional fields, never a
contradiction. The pack builder is tested for coverage (every model class of the supported
versions resolves in every tier), checksum/manifest agreement and idempotence.

## YOLOv8 / computer vision (on the phone)

- **Unit**: coordinate conversion (Vision bottom-left → top-left, un-letterbox, orientation),
  clamping, threshold application with numeric fixtures — Jest or XCTest, wherever the code lives.
- **Adapter contract** (Jest): mocked native module → `DetectionRun` shape, empty result,
  timeout, model-load failure.
- **On-device** (physical iPhone 13, not the unit suite): fixture images through the bundled
  model → expected classes within tolerance, plus latency and memory for the model card; a timed
  live session (ADR 0004 — e.g. five minutes of continuous scanning) records sustained FPS,
  thermal state and battery drain, and checks the processor stops when the screen loses focus.
  The simulator has no camera and no Neural Engine; its numbers do not count.
- **Model evaluation** (opt-in job): golden-set mAP50/mAP50-95, per-class PR, confusion matrix;
  compare candidate vs current on the same set; **Core ML parity** against the PyTorch model
  within tolerance; report stored with the model card. **Detection regression**: a fixed set of
  images → expected class sets with tolerance; fails promotion on regressions. **Threshold
  evaluation**: sweep conf/IoU on val and record the chosen values in version config.

## LLM

- **Adapter units** with recorded responses: valid output, invalid JSON → retry → failure, ids
  outside input filtered, timeout/429 mapping, degradation path.
- **Structured output validation** tests for the schema and the post-validation checks.
- **Prompt evaluation** (opt-in job): golden `StructuredIngredientData` fixtures → hard checks
  (valid schema, only input ids, length caps, no forbidden claims) + reviewed samples for tone;
  run on every prompt version, model id or provider change; report stored with `promptVersion`.
- **Failure cases** are first-class fixtures: empty ingredient set, unknowns-only, injection
  attempt inside the data block.

## What deserves a test first

Ownership/auth checks (when they exist) · submission validation against the model registry ·
coordinate conversion in the detector adapter · every intelligence stage · the conformance suite
in both repos · pack install failure paths · adapter error mapping
and degradation · mobile processing → results state handling · anything that has already broken
once.

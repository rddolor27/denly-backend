# Architecture rules (binding)

## The shape

```
denly-mobile (React Native + TypeScript, iOS)
   capture ─▶ image prep ─▶ YOLOv8 (Core ML, on the phone) ─▶ DetectionRun
   offline: ingredient intelligence over the installed data pack (SQLite, read-only)
        │  online: HTTP API (JSON — detections, never images)  ·  data pack download
        ▼
denly-backend (NestJS + TypeScript + TypeORM)
   validation + model registry ─▶ ingredient intelligence ─▶ single LLM
   data release ─▶ offline data packs (small / medium / large) + manifest
        │
        ▼
PostgreSQL
```

```
Image ─▶ image prep ─▶ YOLOv8 ─▶ DetectionRun                                         (phone)
  online:  ══ HTTP ══▶ validation + model registry ─▶ ingredient intelligence
           ─▶ StructuredIngredientData ─▶ single LLM ─▶ AnalysisResult                 (backend)
  offline: ─▶ ingredient intelligence over the data pack ─▶ StructuredIngredientData   (phone, no LLM)
```

Vision always runs on the phone (ADR 0002). Online, everything after detection runs behind the
backend API. Offline, the phone runs ingredient intelligence against the data pack the user
downloaded and shows results without the AI summary (ADR 0003). The app never calls an LLM
provider and never uploads the image in v1.

## Ownership — who does what

| Layer | Owns | Never does |
|---|---|---|
| **YOLOv8** (vision, on the phone) | visual detection, detection classes, bounding boxes, confidence scores, relevant image regions | explain, normalize names, look things up, produce user-facing text |
| **Ingredient intelligence** (deterministic; backend online, phone offline) | normalization, canonical ingredient ids and names, deduplication, confidence thresholds and bands, metadata, categorization, rules, database lookups, the structured analysis input | call an LLM, guess a mapping it does not have, interpret pixels |
| **Single LLM** (language, backend) | explanations, summaries, natural-language analysis, suggestions, contextual answers to the user's questions about *detected* ingredients | detect ingredients from images, replace deterministic rules, invent ingredients absent from its input, write to the database unvalidated |

Where deterministic logic is possible, it is deterministic code and data — not a prompt.

## Boundary contracts

- **Detector port (mobile).** One interface in `denly-mobile` (conceptually
  `IngredientDetector.detect(image) → DetectionRun`; `DetectionRun` = `{ detections, imageSize,
  latencyMs, modelVersion }`, each `DetectionResult` = `{ classId, className, bbox, confidence,
  modelVersion }`). Only the adapter behind it — the native module and its TypeScript wrapper —
  knows about YOLO, Core ML or Ultralytics. Swapping YOLOv8 for a successor changes the adapter
  and the bundled model; the backend only registers the new version.
- **Detection submission.** A `DetectionRun` is the only vision data that crosses the API. The
  backend treats it as untrusted: DTO validation (ranges, count cap), then the **model registry**
  (supported `modelVersion`s and their taxonomies) checks the version is known and supported and
  every `classId`/`className` pair belongs to it. Unknown or retired versions fail with a stable
  error code. A model version is registered on the backend before an app build that ships it is
  released.
- **Ingredient intelligence** consumes the validated `DetectionResult[]` and emits
  `StructuredIngredientData` (canonical ingredients with provenance, confidence band, metadata,
  unknowns). Pure functions plus repository lookups behind an interface; no network, no LLM,
  fully unit-testable. It runs in two places with one contract (ADR 0003): the backend online
  (Postgres) and the app offline (SQLite data pack). Rules, thresholds and mappings are data; the
  pipeline evaluator is the only duplicated code, and each data release's conformance suite must
  pass in both repos. Nowhere else in the app maps, normalises or applies rules.
- **Offline data packs.** At each data release the backend builds versioned, read-only SQLite
  packs (small / medium / large) from the canonical data and publishes a manifest (tier,
  `rulesVersion`, pack schema version, compatible model versions, size, SHA-256). The app
  downloads the tier the user picks, verifies it and swaps it in atomically. Every tier resolves
  every class of the supported model versions; tiers differ in depth.
- **LLM port.** One interface (conceptually `LanguageModel.analyze(StructuredIngredientData,
  question?) → AnalysisResult`) with structured input and schema-validated structured output.
  Exactly one provider adapter is active. Prompts are versioned in code. Provider SDK imports live
  only in the adapter.
- **Graceful degradation**, best first: online with AI summary → online without it (the LLM
  failed or timed out; the explanation is marked unavailable) → offline over the data pack
  (labelled offline with the pack's `rulesVersion`, no summary) → detections only (offline, no
  compatible pack installed). Structured ingredient data is always a complete result.
- **Reading printed text** (an ingredient label) is not a YOLO task and not an LLM task. If it
  becomes necessary, OCR is a second deterministic vision-stage adapter beside the detector; the
  LLM still receives structured, post-processed data.
- Every persisted detection/analysis records `modelVersion` (device-reported, registry-checked),
  `rulesVersion` and `promptVersion` so results can be reproduced and compared across upgrades.
  Offline results record `modelVersion`, the pack's `rulesVersion` and `mode: 'offline'`.

## Validation boundaries

```
Phone:   model output → adapter shape/range checks → DetectionRun
         pack download → SHA-256 + schema version + model compatibility → atomic install
Backend: mobile request → API → DTO validation → model registry → application logic → database
```

- TypeScript types vanish at runtime; validate at every boundary that receives outside data:
  API requests (DTO validation + model registry), LLM output (schema validation before use), model
  output (shape and range checks in the on-device adapter), downloaded data packs (checksum,
  schema, compatibility before use), mobile API responses (validate at the client boundary).
- Backend DTO validation follows the inherited NestJS house convention (`nestjs` skill). Mobile and
  LLM-output schema tooling is undecided — an open decision, not something to pick in passing.

## Data and state

- The backend owns all shared, authoritative persistence. The phone keeps exactly two local
  stores (ADR 0003): the read-only offline data pack, and offline scan results waiting to be sent
  or discarded (a separate local database, never mixed into the pack). Server state lives only in
  TanStack Query; other client state (including a `DetectionRun` not yet submitted) stays in React
  state/context unless a store is justified.
- Raw images are personal data and stay on the phone: used for detection, then deleted when the
  scan is submitted or discarded. Any upload or retention is a recorded decision with a purpose
  and a lifetime.

## Accounts and the API surface (ADR 0012)

- Every route lives under `/api` (`/api/health`, `/api/v1/...`, Swagger at `/api/docs`).
- Email + password accounts; HS256 access JWT (short-lived) + opaque rotating refresh tokens
  stored hashed in `refresh_token`. A global guard denies every route not marked `@Public()`
  (health, auth, ingredients, model versions). Online scanning requires an account; scans are
  owned by `user_id` and read only by their owner. Offline scanning on the phone needs no account.
- The app keeps the refresh token in the Keychain, the access token in memory.

## Deployment (ADR 0013) and what is still deferred

The backend runs on **Cloud Run** with **Cloud SQL for PostgreSQL 17**, one GCP project each for
staging and production (ADR 0008), built from the repo `Dockerfile` and deployed by GitHub
Actions: `Deploy Staging (manual)` for any ref, `Deploy Production (release)` for a published
`vX.Y.Z` release. The app builds on EAS: `Build Preview (manual)` and `Build Production
(release)`, never submitted to the stores until #2 is decided. GitHub reaches GCP only through
Workload Identity Federation (no service-account keys); runtime secrets live in Secret Manager.
Backend logs are Winston JSON lines for Cloud Logging; CORS allows only `CORS_ORIGINS`. No Helm or
GKE. Local development stays on the Windows PostgreSQL 17 service on `localhost:5432`.

Still deferred until the user asks: rate limiting (required before a public launch, #14),
metrics/tracing beyond logs, Cloud Storage for packs and models, and the LLM provider.

## Ask before deciding

The YOLOv8 licence route for a distributed app, the on-device runtime integration, over-the-air
model updates, the LLM provider, the schema-validation library, whether images ever leave the
phone, data-pack tier contents, the SQLite library (`expo-sqlite` assumed), pack delivery details,
a shared package vs conformance-tested duplication, any GCP service beyond ADR 0013. (Settled:
detection taxonomy 0006, Expo dev build + Expo Router + pnpm 0007, GCP 0008, CI/CD 0013.) These change what
gets built — surface them, do not settle
them silently. `documentations/decisions/open-decisions.md` tracks the list.

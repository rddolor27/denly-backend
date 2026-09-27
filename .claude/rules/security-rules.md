# Security rules (always on)

- **Secrets never enter the repo, the chat, or the logs.** API keys, database URLs, LLM provider
  keys, Apple signing material, push certificates: env vars or a secret manager only, with
  `.env.example` listing names, never values. The scope guard denies reading them; a denial is final.
- **Credentials per environment.** Local, staging and production never share a database, an LLM
  key or a signing identity.
- **Images are personal data and stay on the phone** (ADR 0002). Detection runs on the device;
  the capture is deleted when the scan is submitted or discarded; no image bytes in requests, logs
  or crash reports. If an upload path is ever decided, it enforces size limits, allow-lists MIME by
  content, re-encodes and strips metadata (EXIF, GPS), and keeps images only as long as recorded.
- **Device-reported detections are untrusted input.** A submitted `DetectionRun` cannot be proven
  genuine: validate every field, check `modelVersion` and every class pair against the model
  registry before persisting, and let class names reach the LLM only after taxonomy check and
  canonical mapping.
- **Validate at every boundary.** API DTOs, LLM output, model output, mobile responses. Types are
  not validation.
- **The LLM is untrusted too.** Its input can carry injected instructions (label text, user
  questions); keep system instructions separate, cap lengths, schema-validate output, and never
  let output trigger side effects or writes without validation.
- **Auth and authz deny by default** (ADR 0012): the global JWT guard covers every route not
  marked `@Public()`; ownership is checked in the service (`where: { id, userId }`), not just token
  validity. Passwords only as scrypt hashes, refresh tokens only as SHA-256; neither, nor emails,
  in logs (TypeORM query logging stays off). Token responses carry `Cache-Control: no-store`.
- **Logging hygiene.** Log ids and request ids, never tokens, prompts with user content at info
  level, image bytes, or full request bodies. Security events (auth failures, rejected
  submissions, validation storms) at `warn`.
- **Model artifacts are supply chain.** Pin the model version and checksum; the iOS build fetches
  the pinned model and verifies its SHA-256 before bundling it; the app loads it only from its own
  bundle, never from a user-supplied path. A bundled model can be extracted from the app — never
  embed anything secret in it or its config.
- **Offline data packs are verified before use** (ADR 0003): SHA-256 from the manifest fetched
  over TLS, schema version and model compatibility checked, opened read-only, swapped atomically
  with the old pack kept until the new one passes. Packs are public data — nothing secret or
  personal in them, and every source's licence must allow redistribution.
- **Mobile.** No secrets in the bundle; offline scan results stay in the app sandbox and are
  deleted when sent or discarded; the app talks only to the Denly API over TLS; tokens (if
  any) in the Keychain, never `AsyncStorage`; permission prompts only when the feature needs them.
- Full checklists live in the `security` skill and the `security-auditor` agent.

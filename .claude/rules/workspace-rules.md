# Workspace conventions

## Two separate repos

- The workspace root (`denly/`) is **not** a git repository and never becomes one. `denly-mobile/`
  and `denly-backend/` are (will be) independent repos with their own history, CI and releases.
- Always run git against the right repo: `git -C denly-backend status` (or `cd` into it first).
  Never `git init` at the workspace root. A feature that spans both repos gets one commit series
  per repo.
- No shared `package.json`, no workspace file, no `packages/` folder, no cross-repo imports. The
  only contract between the repos is the HTTP API (documented from the backend's OpenAPI output
  once it exists).
- Both app repos were scaffolded on 2026-09-23 (each `git init` on `main`, no commits yet). After
  any root `.claude` change, run `node .claude/sync-claude-config.js` from the root so every repo
  receives the shared config; each repo keeps its own `.claude/CLAUDE.md`.
- `denly-ml/` (ADR 0005) is a third, independent repo for ML tooling — Python, `uv`. It is never
  imported by or deployed with the app repos; its outputs reach them as versioned artifacts
  (dataset releases, weights, `classes.yaml`, model cards) through object storage and lock files.
  `data/`, `runs/`, weights and exports are never committed.

## Tooling defaults (confirm at scaffold time, record in `documentations/decisions/`)

- Backend: `pnpm`, Node LTS pinned in `engines` + `.nvmrc`, NestJS CLI layout, port and env-file
  layout decided at scaffold.
- Mobile: package manager and Expo-vs-bare are open decisions (`open-decisions.md`). Xcode and
  CocoaPods are required either way; the camera needs a physical iPhone, the simulator has none.
- Before considering a change done: `tsc --noEmit`, lint and the relevant tests must pass in every
  repo touched (`/verify`). The `post-edit-check` hook already runs `tsc` after each `.ts/.tsx`
  edit — fix what it reports immediately.

## Files

- Never read or edit `.env*`, `configs/*.env`, `secrets/`, keys, certificates, provisioning
  profiles or service-account JSON (enforced by deny rules and the scope guard). If an env var is
  needed, ask the user for its *name*, or read `.env.example`, which every repo must keep current.
- Never commit with a `Co-Authored-By` or "Generated with Claude Code" line (enforced by the
  `block-coauthor` hook).
- Rule files in `.claude/rules/` are named `{topic}-rules.md`, one topic per file, kept short.

## Language

- Reply in English — chat, commit messages, PR text, review notes and documentation — whatever
  language the prompt uses. App-facing copy follows the `ui-ux` skill, not this rule.

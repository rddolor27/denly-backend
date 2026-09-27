---
name: verify
description: Run the Denly "done" checklist — tsc, lint and the relevant tests — on the touched repo(s), then report. Invoke as /verify [mobile|backend|all]; with no argument, detect touched repos from git status.
argument-hint: "[mobile|backend|all] [--build]"
allowed-tools: Bash, PowerShell, Read, Grep, Glob
---

# /verify $ARGUMENTS

Run the "done" checklist from `.claude/rules/workspace-rules.md` on the repos named in
`$ARGUMENTS`. If none is named, detect touched repos from `git -C <repo> status --porcelain` for
both and verify each one with changes. `all` = both. `--build` also runs the production build.

If a named repo does not exist yet, say so and stop — nothing to verify before scaffolding.

## Steps (per repo, in this order — stop and report at the first failure)

| Repo | Type check | Lint | Tests | Build (`--build`) |
|---|---|---|---|---|
| `denly-backend` | `pnpm exec tsc --noEmit` | `pnpm lint` (auto-fixes; re-stage if files changed) | `pnpm test --maxWorkers=3` — only specs related to the change unless the change is cross-cutting | `pnpm build` |
| `denly-mobile` | `<pm> exec tsc --noEmit` | `<pm> lint` | `<pm> test --maxWorkers=3` (RNTL/unit) | iOS build only when asked (needs Xcode; slow) |

`<pm>` is the mobile package manager recorded at scaffold (see the repo's `CLAUDE.md`). Always
run each command from inside that repo directory (one Bash call with `cd "<abs path>" && ...`).
Never `--watch`.

## Extras

- Backend: if any file under `src/migrations/` changed, print `migration:show` output and remind
  that the migration has not been run; hand destructive migrations to `db-migration-reviewer`.
  If a controller/DTO changed, note that the OpenAPI snapshot (when it exists) may need updating.
- Mobile: if `ios/` changed (Info.plist, Podfile), remind that `pod install` and a device build are
  needed. If a new screen was added, remind of the `ui-ux` state checklist.
- Either: if `.env.example` names changed, confirm the config module and docs were updated.

## Report

A compact table: repo → tsc / lint / tests / build (✅ / ❌ / skipped). Paste the first 30 lines
of any failure verbatim in a code block, fix, and re-run before declaring the change done.

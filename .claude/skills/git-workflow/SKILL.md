---
name: git-workflow
description: Git conventions for the two separate Denly repos (denly-mobile, denly-backend) — Conventional Commits, scopes, commit splitting by related change, NO Co-Authored-By trailers, branch names, PR flow, what never gets committed (secrets, model weights, raw images, env files). Use whenever committing, branching, opening a PR, or writing a commit message in this workspace.
---

# Git workflow (Denly)

The workspace root is **not** a repo. `denly-mobile` and `denly-backend` are (will be) two
independent repos. Always target the right one: `git -C denly-backend status` or `cd` into it.
Never `git init` at the root. Neither repo exists yet; `git init` inside a new repo folder is
part of the scaffolding task the user asks for.

## Commit messages — Conventional Commits

```
<type>(<optional scope>): <imperative, lowercase, no trailing period>

<optional body: what and why, wrapped ~72 cols>
```

- Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`.
- Scopes are the module/feature: `feat(scans):`, `fix(detection):`, `feat(results-screen):`,
  `chore(deps):`, `docs(decisions):`.
- **No `Co-Authored-By:` trailer, ever. No "Generated with Claude Code" line.** The
  `block-coauthor.js` hook denies such commits and PR bodies.
- Subject ≤ 72 chars; body explains the why when it is not obvious (link the ADR when one exists).

## Split commits by related change

Backend feature: `feat(x): add entity + model` → `feat(x): add migration` → `feat(x): add dtos`
→ `feat(x): add service + controller` → `test(x): …` → `docs: …`. Mobile: hooks/api → components
→ screen → navigation. A change spanning both repos = one commit series per repo, each buildable
on its own (the API contract change lands in the backend first).

Stage precisely (`git add -p` or explicit paths); never `git add -A` across unrelated work.

## Never commit

`.env*` (except `.env.example`), `secrets/`, keys/certs/provisioning profiles, model weights or
exports (`.pt`, `.onnx`, `.mlpackage`, `.mlmodel` — they live in storage with a checksum; commit
the model card, `classes.yaml` and the mobile model lock file), raw or
user images, datasets, generated `ios/build`/`Pods` (per the scaffold's `.gitignore`), lockfile
churn from a different package manager.

## Branches and PRs

- `feat/<kebab>`, `fix/<kebab>`, `refactor/<kebab>`, `chore/<kebab>` off `main`.
- PR title = the main commit subject; body: summary, why, test plan (`/verify` output), screenshots
  for UI, the ADR link for architectural changes. No generated-with footer.
- Rebase on `main` before merging; squash only when the branch is one logical change. Never
  force-push shared branches (`git push --force` is denied). `--force-with-lease` only on your own
  feature branch and only when the user asks.

## Before committing

1. `/verify` passes for every repo touched.
2. Nothing from the "never commit" list is staged; `.env.example` updated if config changed.
3. Migrations committed separately from code; OpenAPI snapshot updated if routes changed.
4. Decision recorded in `documentations/decisions/` if the change settles an open decision.

Commit only when the user asks.

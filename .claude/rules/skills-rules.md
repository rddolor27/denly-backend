# Skills, agents, hooks and sync

The `.claude/` folder is **identical** in the workspace root and each repo inside it
(`denly-mobile`, `denly-backend`, `denly-ml`) once they exist. Edit the root copy, then run
`node .claude/sync-claude-config.js` from the workspace root (`--check` reports drift, `--prune`
removes strays; repos that do not exist yet are skipped). Never edit a repo copy directly. Only
`CLAUDE.md`, `plan.md` and `settings.local.json` are per-repo; `templates/` stays at the root.

## Layout

```
.claude/
  CLAUDE.md              workspace overview (root) — each repo keeps its own CLAUDE.md
  settings.json          permissions (deny secrets/destructive git) + hook wiring
  rules/*-rules.md       always-loaded short rules: scope, workspace, architecture, coding,
                         security, docs, design, skills
  skills/<name>/         SKILL.md (+ references/) — auto-loaded by description/paths, or /name
  agents/*.md            code-reviewer, security-auditor, db-migration-reviewer (read-only)
  hooks/*.js             scope-guard, block-coauthor (PreToolUse); post-edit-check (PostToolUse)
  templates/             starter CLAUDE.md for denly-mobile and denly-backend
  sync-claude-config.js  copies the root .claude tree into the repos
```

## Skills

| Skill | Load when |
|---|---|
| `react-native` | anything in `denly-mobile`: screens, components, navigation, camera/image capture, the on-device detection feature (native module, bundled model), scan submission, offline mode (data-pack download, local SQLite, offline evaluator wiring), TanStack Query hooks, performance, accessibility, iOS specifics |
| `nestjs` | any backend module, controller, service, DTO, guard, pipe, config, bootstrap, API contract, error shape |
| `postgresql-typeorm` | entities, relations, migrations, indexes, constraints, transactions, query performance, seed data |
| `computer-vision` | YOLOv8, datasets, training, evaluation, Core ML export and on-device inference, model versioning and bundling, the detector port/adapter (mobile), the model registry (backend) |
| `ingredient-intelligence` | normalization, canonical ingredients, dedupe, confidence handling, metadata, rules, the structured data contract, offline data packs (tiers, build, schema), the conformance suite shared by the backend and the app |
| `llm-architecture` | the LLM port, provider adapter, prompts and versions, structured output, validation, evaluation, degradation |
| `ui-ux` | any screen, flow, wireframe, mockup, design-system, copy or state (loading/empty/error/offline) decision for Denly — built on the widely used community design skills (Anthropic `frontend-design`, Vercel Web Interface Guidelines, UI/UX Pro Max, Impeccable) distilled for native mobile in `references/community-guidelines.md` |
| `security` | scan submission, auth, validation, secrets, logging, on-device model integrity, LLM input handling, reviews |
| `testing` | writing or running tests in either repo; what to test per layer, including model and prompt evaluation |
| `git-workflow` | commits, branches, PRs in either repo |
| `verify` | `/verify [mobile|backend|all]` — tsc + lint + tests per touched repo |

Conventions: SKILL.md < 500 lines, standing instructions not one-off steps, details in
`references/`, project facts win over generic advice. When a skill contradicts the code, fix the
skill (root copy) and re-sync. Skills describe *future* repos today; when a repo is scaffolded,
replace "expected" wording with what was actually built.

## Agents

Read-only reviewers with no edit tools: `code-reviewer` (conventions, boundaries, tests),
`security-auditor` (OWASP + LLM/model checklist), `db-migration-reviewer` (TypeORM migrations
before they run). They report findings with `path:line` and never change files.

## Hooks

- `scope-guard.js` — allow inside workspace/scratchpad/`~/.claude`; deny outside; **deny any secret
  file** (`.env*`, `configs/.*.env`, `secrets/`, keys, certificates, provisioning profiles,
  service-account JSON) even inside. Denials are final.
- `block-coauthor.js` — denies `git commit` / `gh pr create` containing `Co-Authored-By` or
  "Generated with Claude Code".
- `post-edit-check.js` — after editing a `.ts/.tsx` file, finds the nearest `tsconfig.json` with an
  installed `tsc` and runs `tsc --noEmit` there (exit 2 with errors → fix immediately; debounced
  45 s per project). Silent until a repo with TypeScript exists.

Test a hook by piping `{ "tool_name", "tool_input", "cwd" }` JSON into `node .claude/hooks/<hook>.js`.

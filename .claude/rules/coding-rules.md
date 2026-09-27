# Coding conventions (both repos)

## TypeScript

- `strict: true` plus `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`
  where the toolchain allows. Explicit return types on exported functions and every backend method.
- No `any` — use `unknown` and narrow. No non-null assertions (`!`); guard, throw or narrow. No
  `@ts-ignore`; `@ts-expect-error` with a reason only. Enums: PascalCase name, UPPER_CASE members.
- Types that cross a boundary (API DTOs, detection results, structured ingredient data, LLM
  output) are declared once, next to the boundary, and validated at runtime there.

## Naming and files

- Files: `kebab-case.ts`; suffix by role — `*.controller.ts`, `*.service.ts`, `*.entity.ts`,
  `*.dto.ts`, `*.model.ts`, `*.spec.ts`; React Native screens `*.screen.tsx`, components
  `PascalCase.tsx`, hooks `use-*.ts`.
- Code: `PascalCase` classes/components/types, `camelCase` functions/variables, `UPPER_SNAKE`
  module constants, `I`-prefixed names only for DI interfaces that a token resolves to.
- Feature-first directories: `modules/<feature>/` (backend), `src/features/<feature>/` (mobile).
  Shared code goes in `commons/` (backend) or `src/lib/`, `src/components/ui/` (mobile) only after a
  second real user exists.

## Imports and modules

- Path alias `@/` to the source root in both repos; relative imports only inside a feature folder.
- Order: node/framework → third-party → `@/` → relative. No circular imports; no barrel files that
  hide cycles. Import provider SDKs (LLM, model runtime) only in their adapter.
- Small modules with one reason to change. A function longer than a screen is two functions.

## Errors and logging

- Throw typed errors with a stable `code`; never strings, never bare `Error` in domain code. The HTTP
  edge maps them to Nest exceptions and the documented error response shape.
- Never swallow an error silently. Catch only to add context, translate, or degrade on purpose
  (the LLM step may degrade; the detector step may not).
- Backend logs go through the Nest `Logger` facade (structured JSON in deployed envs); no
  `console.log`. Mobile logs go through one small `logger` module. Never log secrets, tokens,
  image bytes, or user content at info level.

## Tests, docs, dependencies, config

- Every meaningful behaviour gets a test at the right layer (`testing` skill). A red test is not done.
- Each repo has a `README.md` (run, build, test, env names) and keeps `.env.example` current.
  JSDoc only where the *why* is not obvious. Architecture decisions go to `documentations/decisions/`.
- New dependency = stated reason, pinned major, lockfile committed, `audit` clean of high/critical.
  Nothing installed "just in case".
- Env vars are read in one config module per repo, validated at startup, and typed. Missing
  required config fails fast at boot, not at first use.

## Prefer / avoid

Prefer explicit code, strong types, small modules, clear boundaries, testable pure logic,
composition over inheritance, data-driven rules over branching.

Avoid `any`, speculative abstractions, premature optimization, microservices before there is a
second service, dependencies that duplicate what the stack has, business logic hidden in
controllers/components/prompts, and duplicated logic across the two repos (share the *contract*,
not the code). The one recorded exception is the ingredient-intelligence evaluator (ADR 0003):
its behaviour lives in data and a conformance suite that both repos must pass.

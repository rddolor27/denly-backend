# Scope lock

- The workspace root (`denly/`) and every future repo inside it (`denly-mobile/`, `denly-backend/`)
  carry an identical `.claude` configuration: the same `settings.json` and the same
  `.claude/hooks/scope-guard.js` PreToolUse hook.
- Allowed locations: anywhere under `D:\Coding_Projects\Personal-Projects\denly` — so the two
  repos may reference each other's API contract while staying separate repos — plus the Claude
  scratchpad temp dir and `C:\Users\PC\.claude`.
- Anything outside the workspace root is denied. `..` traversal is resolved against the session
  cwd: hops that stay inside the workspace (e.g. `cd ../denly-backend` from the mobile repo) are
  allowed; hops that escape it are denied. The maid-in-doha and kulay workspaces are **not**
  reachable from here — their reusable conventions were copied into this tree on 2026-09-19.
- Denials from the "denly scope guard" are intentional, not errors. Do not retry or work around them.
- The guard auto-approves in-scope calls, so Claude works without permission prompts; destructive
  commands are still blocked by the `deny` rules in `settings.json` (force push, hard reset,
  `rm -rf`, recursive Remove-Item, and any read/write of `.env` files, keys, certificates,
  provisioning profiles, service-account JSON or a `secrets/` folder).
- To widen the scope, the user edits `ALLOWED_PREFIXES` in `scope-guard.js` (root copy, then sync).

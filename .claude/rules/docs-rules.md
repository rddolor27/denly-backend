# Documentation and decisions — edit freely, decide, don't ask

- Everything under `documentations/`, every `CLAUDE.md`, every `.claude/rules/*.md` and
  `.claude/skills/**/*.md` is Claude's to create, edit, rename and delete **without asking first**.
  Permission-wise it is already auto-allowed; this rule removes the conversational asking too.
- **Architecture decisions** are recorded as short ADRs in `documentations/decisions/NNNN-slug.md`
  (Context · Decision · Consequences, a screen or less). Record a decision when it is *made*, not
  when it is discussed. `open-decisions.md` in the same folder lists what is still undecided;
  move an item out of it in the same edit that records the ADR.
- Routine calls (wording, file placement, ids, which repo a doc belongs to) are made by Claude and
  noted in the doc. Product or architecture questions that change what gets built are surfaced to
  the user — listed once, briefly — never silently decided.
- Do not end a documentation turn with a list of questions. State the assumptions made in one or
  two lines and move on; the user overrides in the doc.
- Keep `documentations/README.md` in sync with the folders it indexes as part of the same edit.
- Design output (flows, wireframes, mockups) goes to `documentations/design/` — see
  `design-rules.md`. Plans with open items go to `documentations/planning/`; a fully shipped plan
  is deleted, and leftovers become a new plan item or decision.
- When an architectural decision changes, update the rule or skill that states it in the same
  change (root copy, then sync). Code changes still follow `workspace-rules.md`.

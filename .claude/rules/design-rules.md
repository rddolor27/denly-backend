# Design and UI/UX sessions: no code

- When the ask is user flows, wireframes, mockups, screen inventories, references, copy, or a
  design plan, load the `ui-ux` skill and put the output in `documentations/design/` (and a design
  artifact when a visual is wanted). It never goes to app code.
- In those sessions do not create or edit components, styles, tokens or config in `denly-mobile/`,
  do not launch agents that edit code, and do not prototype and then revert.
- Code changes happen only on an explicit instruction to implement. If the wording is ambiguous
  ("adjust", "improve", "make the scan screen nicer"), ask before touching code.
- Every design deliverable starts with the six questions from the `ui-ux` skill (goal, what the
  user has, what they need, next action, what can go wrong, what feedback the UI gives) and covers
  the loading, empty, error and offline states of each screen it proposes.
- Usability and clarity beat decoration. iOS conventions are the baseline, not a ceiling: a custom
  Denly pattern is fine when it serves the scan → understand flow better than the stock one.
- Palette, type, icons and light/dark are decided (ADR 0009; tokens in `planning/0003` §2 and
  `denly-mobile/src/global.css`): Sibuyas pink actions, black hero card, extra colours with fixed
  jobs, green/amber reserved for confidence, Bricolage Grotesque display, lucide icons. Mockups use
  these tokens. Logo and app icon are still open (#16).

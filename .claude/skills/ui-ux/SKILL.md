---
name: ui-ux
description: Denly UI/UX skill — how to design and review interfaces, user flows, wireframes and high-fidelity mockups for an Android + iOS ingredient-scanning app (iPhone 13 design floor). Built on the widely used community design skills (Anthropic frontend-design, Vercel Web Interface Guidelines, UI/UX Pro Max, Impeccable) distilled for native mobile. Covers the six questions every concept starts with, the design-direction workflow and generated-design tells to avoid, the priority order when rules conflict, iOS conventions vs custom Denly patterns, the core scan → results → analysis flow, information hierarchy for detection and AI results, confidence language, camera/capture UX, the design-system starter (tokens, type, spacing, components), loading/empty/error/offline/detection states, copy voice, accessibility, review modes (audit, critique, polish, harden, distill), deliverable formats and a checklist. Use whenever asked to design, wireframe, mock up, review or write copy for any Denly screen or flow.
paths:
  - "denly-mobile/src/**"
  - "documentations/design/**"
---

# UI/UX — Denly

Written 2026-09-19; palette, type, icons and light/dark decided 2026-09-23 (ADR 0009, §7). Logo and app icon are still open;
this skill supplies the method, the flow, the states and the decided tokens so design work can
start and stay consistent. `rules/design-rules.md` applies: design sessions produce documents and
artifacts, not code.

| Reference | What |
|---|---|
| `references/community-guidelines.md` | The famous community design skills distilled for mobile: priority order, design-direction workflow, generated-design tells, Vercel audit rules, UI/UX Pro Max UX set and React Native stack rules, Impeccable review modes, merged checklist |
| `references/screen-states.md` | Core flow with exits, the per-screen state matrix, starter copy bank |

Denly's rules below win where a community rule differs; the reference wins over habit.

## 0. Start every concept with the six questions

1. What is the user trying to accomplish on this screen?
2. What information do they already have (in hand, on screen, in memory)?
3. What information do they need to get to the next step?
4. What is the one action they should take next?
5. What could go wrong (permission, light, network, model, LLM, their own input)?
6. What feedback must the interface give — before, during and after the action?

Write the answers at the top of the design doc. A screen that cannot answer 4 is two screens.

## 1. Denly principles

- **Clarity over decoration.** The result screen must be understood in five seconds: what was
  found, how sure we are, what it means, what to do.
- **Scanning is the hero.** Capture is one tap from launch; everything else is secondary.
- **Honest about confidence.** Detected / Likely / Uncertain / Couldn't identify are visible,
  labelled words, never colour alone and never hidden.
- **Deterministic first, AI second.** The ingredient list stands on its own; the AI summary is a
  clearly labelled layer on top and the screen works when it is missing.
- **One job per screen, one primary action.** Secondary actions are text buttons or sheets.
- **iOS conventions are the floor, not a costume.** Use native navigation, sheets, haptics, safe
  areas and Dynamic Type. Invent a Denly pattern only where the stock one serves the scan →
  understand flow worse (the viewfinder, the confidence rows, the stage progress).
- **Grounded in the subject.** Food, labels, kitchens, groceries — distinctive choices come from
  Denly's world, not from an app template (`community-guidelines.md` §2).
- **Nothing fake.** No invented percentages, counts or claims; no medical promises.

## 2. Priority order when rules conflict

Accessibility → touch and interaction → perceived performance → layout and safe areas →
typography and colour → motion → forms and feedback → navigation → style. A prettier option never
beats a more usable one. (Adapted from UI/UX Pro Max; detail in `community-guidelines.md` §1.)

## 3. Design-direction workflow (brand sessions and any new surface)

1. Ground in the subject (§1) and the recorded product truths in `documentations/decisions/`.
2. Plan tokens before pixels: 4–6 named colours, type roles, layout concept with alignment,
   3–5 principles that make Denly recognisable. Compare options with ASCII wireframes.
3. Review the plan against the generic default: would this come out for any similar brief? If
   so, change it and say why. Refuse the generated-design tells (`community-guidelines.md` §2)
   unless the brief asks for one by name.
4. Build the mockup, then critique it: remove one thing; spend boldness in one place; hit the
   quality floor (safe areas, VoiceOver, reduced motion, contrast) without announcing it.
5. Record the direction in `documentations/design/` and mirror the tokens into §7.

## 4. Device and platform baseline

- Design at **iPhone 13**: 390 × 844 pt, 3×, notch, safe-area insets 47 pt top / 34 pt bottom,
  home indicator. Larger phones inherit; nothing is designed only for them.
- Portrait only in v1 (assumption; revisit if the camera UX needs landscape).
- Light and dark mode from the first mockup (assumption; tokens are roles, so both cost the same).
- Test layouts at Dynamic Type "Large" (default) and "AX2" — text wraps, nothing truncates a name.
- Touch targets ≥ 44 × 44 pt with ≥ 8 pt between them; primary actions in the thumb zone (bottom
  third), above the home indicator (`bottom: 34 pt + 16 pt`).

## 5. Core flow

```
Launch → (first run: value + camera priming) → Scan (viewfinder)
      → Capture / Import → Processing (detecting on the phone → analysing online | resolving offline)
      → Results (ingredients + AI summary online; "Offline result" without summary offline)
      → Ingredient detail | Ask (later) | Rescan
      → History (later) · Settings → Offline data (tier picker: small / medium / large)
```

Back never loses a capture or a fetched result. Processing is cancellable. Results are reachable
again from history without re-scanning (when history exists). Full flow with exits in
`references/screen-states.md`.

## 6. Information hierarchy — results

1. **What was found** — grouped ingredient rows (by category or by confidence band; pick one per
   design and record it). Row: name · category chip · confidence label with icon · chevron.
2. **What it means** — the AI summary card, labelled "AI summary", 2–4 sentences, with an
   "unavailable" state when the LLM step failed. A feedback affordance (helpful / not) is a
   later decision.
3. **Suggestions** — at most three, each actionable.
4. **Cautions and unknowns** — flags from rules; "Couldn't identify N items" with a rescan hint.
5. **Actions** — Rescan (primary when results are poor), Save/Share (later), Ask (later).

Confidence language: **Detected** (high) · **Likely** (medium) · **Uncertain** (low, collapsed
by default with a count) · **Couldn't identify** (unknown). Each band has a word and an icon;
colour is reinforcement only.

## 7. Design system (decided in ADR 0009, 2026-09-23)

- **Tokens are roles** (shadcn variables, `denly-mobile/src/global.css` + `lib/theme.ts`, table in
  `planning/0003` §2), light and dark: `background` `#F4F5F0`/`#111410`, `card`, `foreground`,
  `muted(-foreground)`, **`primary` Sibuyas pink `#A1305A`/`#F09AB9`**, `secondary` tinted pink,
  `accent` (pressed), `destructive`, `border`/`input`/`ring`; Denly extras: **`hero` black card**,
  `camera` (always dark), `detected`/`likely` (confidence only), `info` (offline), and extra
  colours with fixed jobs: `dish` orange, `leafy` teal (greens, citrus), `fish` blue. Produce
  tiles use per-ingredient colours from the mobile map. All text ≥ 4.5:1, large text ≥ 3:1, in
  both modes (a unit test enforces it); never grey text on a coloured surface; confidence is
  word + icon, colour only reinforces.
- **Type**: **Bricolage Grotesque** (700/500) for display — large titles, section heads, the hero;
  system font for body so Dynamic Type works. Scale: Large Title 34 · Title 1 28 · Title 2 22 ·
  Title 3 20 · Headline 17 semibold · Body 17 · Callout 16 · Subhead 15 · Footnote 13 ·
  Caption 12. Sentence case everywhere; no tracked ALL-CAPS labels; no single accent word in a
  heading; body line-height ~1.4.
- **Spacing**: 4-pt grid — 4 · 8 · 12 · 16 · 24 · 32 · 48. Screen gutter 16; card padding 16;
  list row min height 56.
- **Radius**: 8 inputs/chips · 12 cards/rows · 16 sheets · full pills — radius encodes role, not
  one value on everything. **Elevation**: one soft tinted shadow for cards on `bg`, none in dark
  mode (use `bgElevated`). Never a card inside a card.
- **Icons**: `lucide-react-native`, stroke 2 (ADR 0009; SF Symbols do not exist on Android); 20–24 pt; always with a label
  or an accessibility label; no emoji as icons.
- **Motion**: 200–300 ms ease-out; transform/opacity only; 1–2 animated elements per view;
  stage transitions and result reveal only; interruptible; honour Reduce Motion; no bounce.

## 8. Component inventory (design these once, reuse everywhere)

Capture control · Viewfinder guide + hint · Live detection overlay (box + label) · Stage progress (3 steps) · Ingredient row · Group
header · Confidence label (word + icon) · AI summary card (with label and unavailable state) ·
Suggestion item · Caution banner · Unknown list · Empty state (illustration optional, one action)
· Error state (title, what happened, primary retry, secondary) · Offline banner · Offline result
label (with data version) · Offline data tier picker (size, what each tier includes) · Download
progress row · Skeletons that
mirror the geometry · Bottom action bar (safe-area aware) · Sheet · Permission priming screen.

## 9. Camera and scanning UX

- Permission priming screen before the system prompt: one sentence of why, one button. Denied
  state links to Settings and offers gallery import.
- Viewfinder: full-bleed preview with **live detection** (ADR 0004) — boxes and short labels that
  follow the food, calm rather than flickering (hold a label briefly before hiding it), a guidance
  frame with a one-line hint ("Fill the frame with the food"), torch toggle, gallery import, one
  large capture control centred at the bottom. Live labels are a preview; the capture produces
  the result. Hints and a spoken count of what is in view ("2 items in view") exist for VoiceOver
  users; honour Reduce Motion (static labels, no box animation).
- Capture feedback: haptic + brief frame flash; move to Processing immediately.
- Processing: named stages with a step indicator and "…" copy ("Detecting ingredients…"),
  elapsed-time awareness (after ~8 s show "Still working…", after the timeout offer retry),
  cancel always available. Never a bare spinner.
- Empty detection: it is the product's problem, not the user's — "Nothing recognised. Try closer,
  in better light, with the label flat." plus Rescan and Import.
- Low-confidence-only results: show them under Uncertain and lead with Rescan.

## 10. States every screen must define

Loading (skeleton, `busy`) · Empty (what to do next) · Error — user-fixable (specific, how to
fix) · Error — ours (own it, retry) · Offline (banner + what still works: capture, on-phone
detection and ingredient results from the downloaded offline data, labelled "Offline result" with
no AI summary; without offline data, detections only + "Download offline data") · Update required (the app's model version is no longer supported) · Partial (results without AI summary; results with unknowns) · Slow (progress with
reassurance) · Permission denied · Success (one word). The matrix per screen is in
`references/screen-states.md`; a design doc is incomplete without it.

## 11. Copy voice

Plain, second person, present tense, sentence case, one idea per sentence. Buttons name outcomes
("Scan", "Rescan", "Import photo", "Try again"), never "OK"/"Submit"; the action keeps its name
through the flow ("Scan" → "Scanning…" → results). Errors say what went wrong and what to do; no
apology theatre. Empty states invite one action. AI content is always labelled "AI summary" and
never presented as fact; unknowns are stated plainly. No health or medical claims; "may contain"
and "commonly used as" over "is bad for you". Numbers only when real (counts from data; confidence
as a band word, percentages only in a detail view if the product wants them). Typography of copy:
"…" not "...", non-breaking space between number and unit.

## 12. Accessibility (design side)

Labels for every icon and control · logical VoiceOver order (results read as a list) · state
changes announced (scan complete, failed) · non-colour indicators everywhere · 44-pt targets with
8-pt gaps · Dynamic Type-safe layouts · captions/text for camera guidance · Reduce Motion
variants · contrast checked in both modes · focus returns sensibly after sheets and errors ·
every gesture has a tap alternative.

## 13. Review modes

When the ask is a review rather than a new design, use the vocabulary from
`community-guidelines.md` §6: **audit** (a11y, performance, states), **critique** (hierarchy and
clarity), **polish** (rhythm and token discipline, no new elements), **harden** (every failure
and edge), **distill** (remove), **shape** (plan before pixels). Name the mode in the output.

## 14. Deliverables and where they go

- **User flow**: numbered steps with state branches (happy path + each failure exit).
- **Screen inventory**: table of screens → purpose → primary action → states.
- **Wireframe**: low-fidelity (ASCII in the doc or a simple HTML artifact at 390 × 844 with safe
  areas drawn) — structure and hierarchy only.
- **High-fidelity mockup**: HTML artifact at 390 × 844 pt, both modes, real copy, real states;
  link recorded in the doc.
- All go to `documentations/design/NNNN-<topic>.md` (with the six answers at the top). Brand
  decisions, when made, are recorded there and mirrored into §7 of this skill.

## 15. Review checklist (run on any design or UI diff)

- [ ] Six questions answered; one primary action per screen
- [ ] Loading, empty, both error kinds, offline, partial and permission states defined
- [ ] Results readable without the AI summary; AI summary labelled; unknowns visible
- [ ] Confidence shown as word + icon, colour only reinforcing
- [ ] iPhone 13 safe areas respected; primary action in the thumb zone; targets ≥ 44 pt, 8 pt apart
- [ ] Dynamic Type AX2 survives; contrast AA in light and dark; no grey-on-colour text
- [ ] VoiceOver order and labels specified; announcements for async outcomes; gestures have tap alternatives
- [ ] Copy: sentence case, outcome-named buttons, fixable errors, "…" loading copy, no medical claims, no fake numbers
- [ ] Tokens by role only; radius by role; no ad-hoc colour or size; components from the inventory; no nested cards
- [ ] No generated-design tells unless the recorded direction asked for them; motion ≤ 2 elements, reduced-motion variant
- [ ] Doc saved under `documentations/design/`, artifact link recorded

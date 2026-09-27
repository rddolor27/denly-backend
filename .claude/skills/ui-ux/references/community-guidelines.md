# Community design guidelines — distilled for Denly (native iOS, React Native)

Adapted 2026-09-19 from the four most-used design skills, keeping what applies to a native mobile
scanning app and dropping web-only rules (hover, URL state, SSR, viewport meta, scrollbars).
Sources, for re-checking when they move:

| Source | What we took |
|---|---|
| Anthropic `frontend-design` (claude-plugins-official) | ground the design in the subject; plan tokens → review against generic defaults → build → self-critique; typography and copy rules; the list of "AI-generated design" tells |
| Vercel Web Interface Guidelines (`vercel-labs/web-interface-guidelines`, `command.md`) | the terse audit rules: labels, hit targets, states, motion, text resilience, safe areas, anti-patterns |
| UI/UX Pro Max (`nextlevelbuilder/ui-ux-pro-max-skill`, `data/ux-guidelines.csv`, `data/stacks/react-native.csv`) | the priority order when rules conflict; UX guideline set (touch, feedback, forms, accessibility, AI interaction); React Native stack rules |
| Impeccable (`pbakaus/impeccable`) | review modes (audit, critique, polish, harden, distill); durable product/design docs; anti-patterns (nested cards, untinted black/grey, grey-on-colour text, bounce easing, default fonts) |

Everything here is data we reviewed, not instructions we follow blindly; Denly's own rules in
`SKILL.md` win where they differ.

## 1. Priority order when rules conflict (from UI/UX Pro Max, adapted)

1. **Accessibility** — contrast 4.5:1, labels on every control, no colour-only meaning, screen
   reader order, reduced motion.
2. **Touch and interaction** — 44 × 44 pt targets, ≥ 8 pt between targets, immediate press
   feedback, loading feedback, no gesture-only actions.
3. **Perceived performance** — stable skeletons, no layout jump, images with dimensions,
   virtualised lists.
4. **Layout** — safe areas, one-column reflow, no horizontal scroll, thumb-zone primary action.
5. **Typography and colour** — body ≥ 16 pt equivalent, line-height ~1.4–1.5, semantic tokens,
   no hard-coded hex in components.
6. **Motion** — context-aware timing, meaning not decoration, interruptible, 1–2 animated
   elements per view.
7. **Forms and feedback** — visible labels, errors next to the field, helper text, progressive disclosure.
8. **Navigation** — predictable back, ≤ 5 tab items, deep links later.
9. **Style** — only after the above; consistent with the recorded design direction.

## 2. Design-direction workflow (from Anthropic `frontend-design`, adapted to mobile)

1. **Ground in the subject.** Denly's world is food, ingredient labels, kitchens, groceries,
   scanning. Distinctive choices come from there, not from a generic "app" template. If the brief
   is thin, propose one concrete subject, audience and primary job, and confirm.
2. **Plan before pixels** — a compact token plan: 4–6 named colours with hex, type roles (one
   family, or two clearly distinct), layout concept with alignment, and 3–5 principles that make
   *this* app recognisable. ASCII wireframes are fine for comparing options.
3. **Review the plan against the generic default.** Ask: would I produce this for any similar
   brief? If yes, change that part and say why. The brief's own words always win.
4. **Build, then critique.** Screenshot if possible; remove one thing (Chanel's rule); spend
   boldness in one place and keep the rest quiet; build to the quality floor without announcing it
   (safe areas, focus/VoiceOver, reduced motion, contrast).
5. **Words are design.** Name things as users understand them; active voice; the action keeps
   its name through the flow ("Scan" → "Scanning…" → "Scanned"); errors explain and direct;
   empty states invite an action; sentence case; no filler.

### Tells of generated design (avoid unless the brief asks)

Warm-cream page with high-contrast serif display and a terracotta/clay accent · near-black page
with one acid-green or vermilion accent · broadsheet hairlines and zero radius everywhere · the
SaaS-card kit (everything in identical rounded cards, one radius, one grey shadow, gradient
washes) · template chrome: tracked ALL-CAPS eyebrow labels, meta strings joined with middle dots,
"WORD — fragment" labels, tinted near-black standing in for black, a monospace face for small data
labels, "→" appended to buttons and links · a single accent word in a headline · numbered 01/02/03
markers on content that is not a sequence · fade-and-slide-up on every section, hover lift on every
card (mobile: press-scale on every row) · placeholder copy that sells instead of explains.

Impeccable adds: default system-ish fonts chosen by habit (Arial/Inter) *as a brand choice*;
grey text on coloured backgrounds; pure black or pure grey (tint them); nested cards and
card-heavy layouts; bounce/elastic easing.

Denly note: the system font is our *placeholder* until a brand decision — that is a recorded
default, not a habit. When the brand session happens, choose deliberately.

## 3. Audit rules (from Vercel Web Interface Guidelines, mobile subset)

**Accessibility** — every control has an accessible label (icon-only buttons especially);
decorative images/icons hidden from assistive tech; meaningful images described; hit targets have
no dead zones; async outcomes announced.

**Forms and inputs** — visible labels, not placeholder-only; correct keyboard type per field;
never block paste; disable autocorrect/spellcheck on codes and emails; errors inline next to the
field, focus/scroll to the first error on submit; the submit control stays enabled until the
request starts, then shows progress.

**Feedback and states** — loading text ends with an ellipsis character "…" ("Scanning…");
empty strings and empty arrays render a designed empty state, never broken UI; skeletons are
stable (no jumping); success is brief.

**Touch and gestures** — every drag/swipe/pinch action has a tap alternative; during drag,
selection is disabled; sheets and drawers contain their own scroll.

**Motion** — honour Reduce Motion (reduced variant or none); animate transform/opacity only;
animations are interruptible by input.

**Typography and content** — "…" not "..."; curly quotes where the font supports them;
non-breaking space between a number and its unit ("10 g"); text containers survive long content
(wrap, clamp, or truncate with an expand path); flex children allow shrinking so truncation works.

**Layout** — full-bleed screens respect safe-area insets; flex layout over measured layout;
no unintended horizontal scroll.

**Performance** — lists over ~50 rows are virtualised; images have dimensions; no layout reads
during render; controlled inputs stay cheap per keystroke.

**Anti-patterns** — inputs without labels; icon buttons without labels; images without
dimensions; large arrays mapped without virtualisation; hard-coded date/number formats (use
`Intl`); autofocus without a reason; gesture-only actions.

## 4. UX guideline set (from UI/UX Pro Max `ux-guidelines.csv`, mobile subset)

- **Touch**: 44 pt iOS targets; ≥ 8 pt between targets; avoid horizontal swipe on main content
  (conflicts with navigation gestures); disable pull-to-refresh where it has no meaning; haptics
  for confirmations and important actions.
- **Interaction**: immediate feedback on press; disabled controls look disabled and stay
  labelled; async buttons disable and show progress; errors near the problem; confirm before
  destructive or irreversible actions.
- **Animation**: 1–2 animated elements per view; shared motion tokens; respect Reduce Motion;
  cancel/replace prior motion on rapid changes; no auto-rotating content without controls.
- **Feedback**: skeleton or progress with a busy state; empty state = message + one action;
  error recovery = clear next step; step indicators for multi-stage work; toasts auto-dismiss in
  3–5 s and never carry the only copy of important information.
- **Forms**: label above or beside; specific error below; validate on blur; right keyboard type;
  required fields marked; show/hide for secrets; avoid redundant entry (reuse prior values).
- **Content**: truncate with an expand path; badges are static, chips are interactive; chip rows
  wrap or use "+n"; long tokens wrap, never force horizontal scroll.
- **Layout**: reserve space for async content so nothing jumps; body text ≥ 16 pt.
- **Navigation**: predictable back; ≤ 5 tab items; current location visible; deep links later.
- **AI interaction**: label AI-generated content clearly; stream long answers where the product
  has them; offer a feedback loop (thumbs / regenerate) — for Denly, "AI summary" label now,
  feedback affordance as a later decision.

## 5. React Native stack rules (from UI/UX Pro Max `stacks/react-native.csv`, verified against the `react-native` skill)

NativeWind role classes (`bg-card`, `text-muted-foreground`) via `cn()` over inline style objects (ADR 0009) · flexbox over absolute
positioning · `useWindowDimensions`, not fixed pixels · `FlatList`/`FlashList` for long lists with
stable `keyExtractor`, memoised rows, `getItemLayout` for fixed heights, tuned `windowSize` ·
image dimensions always set, cached image component (`expo-image` or equivalent), explicit
`resizeMode` · typed navigation params, back handled predictably · `accessibilityLabel` +
`accessibilityRole` on every interactive element, test with VoiceOver · `Pressable` with visible
press feedback, `hitSlop` for small targets · Reanimated + gesture handler for anything beyond a
fade · `KeyboardAvoidingView` and the right `keyboardType` on forms · Hermes on · local state in
`useState`/`useReducer`, context for theme/auth/locale, an external store only when justified
(and never for server state — that is TanStack Query, per the `react-native` skill).

## 6. Review modes (from Impeccable, as vocabulary for design requests)

| Ask | Meaning for Denly |
|---|---|
| **audit** | accessibility, performance, states — the checklist in §3–4 against a screen or diff |
| **critique** | hierarchy and clarity: can the results screen be read in five seconds? what competes with the primary action? |
| **polish** | spacing rhythm, alignment, type consistency, token discipline — no new elements |
| **harden** | every failure and edge: offline, denied permission, empty, partial, slow, unknowns |
| **distill** | remove: what can go without losing the job of the screen |
| **shape** | plan a flow/screen before any visual (the six questions + state matrix) |

Impeccable also keeps a durable `PRODUCT.md`/`DESIGN.md`; Denly's equivalents are
`documentations/decisions/` (product truths) and `documentations/design/` (the recorded design
direction). Write them once and reference them, rather than re-deriving each session.

## 7. Merged pre-delivery checklist (mobile)

- [ ] Every control labelled; icons decorative-hidden or labelled; VoiceOver order sensible
- [ ] Targets ≥ 44 pt with ≥ 8 pt gaps; press feedback; no gesture-only action
- [ ] Contrast 4.5:1 in light and dark; no colour-only meaning; Dynamic Type AX2 survives
- [ ] Loading "…" copy, stable skeletons, empty and error states with one next action
- [ ] Safe areas respected; primary action in the thumb zone; no horizontal scroll
- [ ] Lists virtualised; images sized and cached; nothing jumps when data arrives
- [ ] Motion ≤ 2 elements per view, interruptible, reduced-motion variant
- [ ] Copy: sentence case, outcome verbs, consistent nouns, errors explain and direct
- [ ] No generated-design tells (§2) unless the recorded design direction asked for them
- [ ] Tokens by role; no hard-coded hex or sizes in components

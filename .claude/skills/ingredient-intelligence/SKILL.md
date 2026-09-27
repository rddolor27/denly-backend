---
name: ingredient-intelligence
description: The deterministic layer between YOLOv8 detections and the LLM in Denly — the StructuredIngredientData contract, the ordered pipeline (filter → map to canonical ingredient → dedupe → enrich → confidence bands → rules → unknowns → stable ordering → version stamp), alias normalisation, canonical ingredient data and metadata, data-driven rules, provenance, versioning, the two implementations (backend online, app offline) and their conformance suite, offline data packs (small/medium/large SQLite tiers, manifest, schema), and what to unit-test. Use for any normalization, canonical naming, ingredient id/alias, deduplication, confidence handling, categorization, ingredient metadata, rule, data-pack, conformance or structured-analysis-input work. Deterministic code and data — never a prompt.
---

# Ingredient intelligence (Denly)

The layer that turns raw detections into something the product and the LLM can trust. Written
2026-09-19 before any code; the contract below is what the backend, the mobile app and the LLM
prompt are built against. Binding boundary text: `rules/architecture-rules.md`. Pair with
`postgresql-typeorm` (canonical tables), `computer-vision` (input), `llm-architecture` (consumer).

## Position and principle

```
DetectionResult[] (device-reported, registry-checked) ─▶ ingredient intelligence ─▶ StructuredIngredientData ─▶ LLM / API / app
```

Detections are produced on the phone (ADR 0002). This layer then runs in **two places with one
contract** (ADR 0003):

| Where | When | Data | Input check |
|---|---|---|---|
| backend (`denly-backend`) | online | Postgres canonical tables — the full data | model registry validates the submitted `DetectionRun` |
| app (`denly-mobile`) | offline | the installed SQLite data pack (small / medium / large) | the pack's compatible model versions include the bundled model |

Same stages, same order, same output shape. Everything that could differ — aliases, rules,
thresholds, bands, metadata — is **data** that ships in the pack, so the only code written twice
is the small evaluator, and the conformance suite (below) keeps the two identical.

Planned, not yet contract (`documentations/planning/0001`): **recipe matching** — the detected
canonical ingredients are looked up against a recipe database (`recipe` → `recipe_ingredient`,
with a data-driven pantry-staples list counted as available) to produce ranked candidate recipes
with coverage and missing ingredients (`recipeMatches: RecipeMatch[]` on the output). The LLM
turns those candidates into suggestions; it never proposes a recipe absent from its input. This
stage is a database lookup in this layer, not a prompt. Until an ADR lands, build against the
contract below.

Where deterministic logic can decide, it decides — in code and data, with tests. The LLM is not
asked to normalise names, map classes, deduplicate, categorise or apply rules. Unknown stays
unknown; nothing here guesses.

## Output contract

```ts
interface StructuredIngredientData {
  scanId: string;
  rulesVersion: string;                       // data + rules bundle version, e.g. 'rules-2026.09.1'
  ingredients: StructuredIngredient[];        // deterministic order: confidence desc, canonicalName asc
  unknowns: UnknownDetection[];               // detector classes with no canonical mapping
  flags: string[];                            // set-level tags produced by rules (e.g. 'contains_added_sugar')
}
interface StructuredIngredient {
  ingredientId: string; canonicalName: string; slug: string; category: IngredientCategory;
  confidence: number;                         // max over merged detections
  confidenceBand: 'high' | 'medium' | 'low';  // thresholds from config, per rulesVersion
  detectionIds: string[];                     // provenance
  metadata: IngredientMetadata;               // typed subset of the canonical row (allergen tags, additive code, notes)
  dietaryFlags: string[];
  ruleHits: string[];                         // ids of rules that touched this row
}
interface UnknownDetection { className: string; confidence: number; detectionIds: string[] }
```

Stable shape, stable order, everything traceable back to a detection or a rule id.

## Pipeline (ordered, pure)

1. **Filter** — drop detections below the configured floor (per class override allowed); keep a
   count of what was dropped for logging.
2. **Map** — `className` → canonical ingredient through `ingredient_alias` where
   `source = 'model_class'`. Batch the lookup (one query per scan). Unmapped classes go to
   `unknowns`, never invented.
3. **Dedupe** — group by `ingredientId`: confidence = max, `detectionIds` = all, count kept.
4. **Enrich** — attach category, metadata, dietary flags from the canonical row (typed subset only).
5. **Band** — map confidence to high/medium/low using thresholds from the rules bundle config
   (`>= high` → high, `>= medium` → medium, else low; lower edges inclusive).
6. **Rules** — apply the versioned rule set over the whole structured set (see below); runs after
   banding so a rule can lower a band (ADR 0011).
7. **Order** — ingredients by confidence desc then `canonicalName` asc, unknowns by confidence
   desc then `className` asc, flags sorted; strings compared by code unit, never `localeCompare`.
8. **Stamp** — set `rulesVersion`; return.

Backend implementation (ADR 0011): `denly-backend/src/modules/ingredient-intelligence/pipeline/`
(pure) + `data/rules-bundle.json` (`rules-2026.09.1`). Alias keys use `normalizeAlias` in
`src/modules/ingredients/utils/` — `_` becomes a space, so class `sweet_potato` → `sweet potato`.

Implementation: pure functions per stage (`filterDetections`, `mapToCanonical`, …) composed by one
`build(detections, ctx)`; the only I/O is the alias/ingredient lookup, behind a repository
interface — a Postgres repository on the backend, a SQLite repository over the pack in the app, an
in-memory map in tests. Thresholds, bands and rules are read from the data bundle, never from code
constants, so both implementations stay data-driven.

## Canonical data

- **Ingredient**: `canonicalName` (display), `slug` (stable id for URLs/keys), `category` (enum:
  e.g. sweetener, fat_oil, preservative, colour, flavour, protein, grain, dairy, fruit_veg,
  additive, other — finalise with the product), `metadata` (jsonb, typed), `dietaryFlags`.
- **Alias**: `alias` (as written), `aliasNormalized` (the lookup key), `source`
  (`model_class` | `synonym` | `regional` | `manual`), `ingredientId`. `aliasNormalized` is
  unique — one alias maps to one ingredient; ambiguity is resolved in data, not at runtime.
- **Normalisation** (`normalizeAlias`): NFKC → lowercase → trim → collapse whitespace → fold
  diacritics → strip punctuation except internal hyphens → singularise only through an explicit
  table (no stemming heuristics). Deterministic and unit-tested against a fixture list.
- Data ships as versioned seed files (JSON/CSV) loaded by an idempotent upsert; the bundle
  version becomes `rulesVersion` together with the rules file.

## Rules

- Rules are data plus a tiny evaluator: `{ id, reason, when: { kind, values }, then: [actions] }`.
  Implemented predicates: `anySlug`, `allSlugs`, `anyCategory`, `anyAllergen`; actions: `addFlag`,
  `lowerBand` (one step, on the matched ingredients). Every matched ingredient records the rule id
  in `ruleHits`. Add a predicate (count threshold, band comparison) only when a real rule needs it.
- Rules may **lower** a band or add flags; they never add ingredients or raise confidence.
- Each rule has an id, a one-line reason, and at least one test. Rules are versioned with the data.
- Product-level interpretation ("is this healthy for me") is not a rule; it is the LLM's
  narrative over the flags and metadata this layer produced.

## Offline data packs

- **Built by the backend at every data release**, one file per tier, from the same canonical data
  that the backend serves online. `rulesVersion` of a pack = the data release it was built from.
- **Tiers** (contents are an open decision; default): every tier resolves every class of the
  supported model versions, so any detection maps offline. *Small* — canonical names, categories,
  allergen and dietary flags, rules, bands, pantry staples, and a compact recipe index (the most
  common recipes → required ingredients) so offline scans still get suggestions. *Medium* — plus
  many more recipes and ingredient detail text. *Large* — the full server dataset; it is the
  conformance tier.
- **Schema**: a documented SQLite layout with its own `packSchemaVersion` (bumped when the layout
  changes; the app declares which schema versions it reads). Postgres-only types are mapped in the
  builder (jsonb → JSON text, arrays → rows). Indexes for the lookup keys (`alias_normalized`).
- **Manifest**: per tier — `rulesVersion`, `packSchemaVersion`, compatible model versions, size,
  SHA-256, download location. The app installs only a pack that passes all four checks.
- A smaller tier returns the same shape with less depth: missing optional fields are absent,
  never guessed; a class resolved online but not in the pack's depth still maps to its canonical
  ingredient.
- Packs are public data. Every source's licence must allow redistribution (ODbL data makes the
  pack data share-alike); nothing personal or secret goes in.

## Conformance suite (both repos)

- Each data release ships fixture cases: `DetectionRun` in → expected `StructuredIngredientData`
  out, computed on the backend against the full data. Cover every rule, band edge, unknowns,
  duplicates, and one case per model class.
- The backend runs them against Postgres; the app runs them against the **large** pack. Both must
  match exactly (deterministic order makes this possible). Small and medium are tested for the
  subset behaviour above.
- A contract change goes: update the contract and the fixtures → backend → app. Never let one
  implementation lead silently.

## Serialisation for the LLM

One `serializeForAnalysis(data)` function produces the compact, stable representation the LLM
receives: ingredients (id, name, category, band, flags, key metadata), unknowns (explicitly, so
the model says "couldn't identify" instead of guessing), set-level flags, and caps (max items,
max chars). No detection coordinates, no image data, no free text from labels unless sanitised
and delimited as data.

## Tests (the layer is cheap to test — test it thoroughly)

- Normalisation: casing, whitespace, diacritics, punctuation, plural table, idempotence.
- Mapping: known class, unknown class, alias collision fixtures, batch lookup shape.
- Dedupe: multiple detections of one ingredient → one row, max confidence, all ids kept.
- Bands: threshold edges (inclusive/exclusive) per config.
- Rules: each rule in isolation plus interplay; a rule can never add an ingredient.
- Determinism: same input twice → deep-equal output; shuffled input → same output.
- Snapshot: a handful of full `DetectionResult[]` fixtures → expected `StructuredIngredientData`.
- Conformance: the release's fixture set passes in both repos (backend on Postgres, app on the
  large pack); smaller tiers keep the shape and never contradict the large tier.
- Pack build: each tier contains every model class of the supported versions; checksum and
  manifest match the file; the builder is idempotent for the same data release.

## Don't

Call an LLM from this module · guess a mapping · mutate inputs · depend on YOLO types (use
`DetectionResult`) · order by insertion order · hide thresholds in code · change one
implementation without the fixtures and the other · put mapping or rule logic anywhere in the app
outside the offline evaluator · put product copy here (display text belongs to the app and the
`ui-ux` skill).

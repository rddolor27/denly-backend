---
name: llm-architecture
description: Single-LLM application architecture for Denly's analysis stage — the ILanguageModel port and one provider adapter, structured input serialisation, prompt design and in-code prompt versioning, schema-validated structured output, error handling and graceful degradation, evaluation (golden set, regression on prompt/model change), safety (prompt injection, no invented ingredients, no medical claims), usage/cost logging, provider abstraction so the model can be swapped. Use for any prompt, LLM call, provider SDK, analysis module, AI explanation/summary/suggestion, or user-question feature. The LLM never detects ingredients and never replaces deterministic logic.
---

# LLM application architecture (Denly)

One LLM, one port, one adapter, versioned prompts, validated output. Written 2026-09-19 before a
provider is chosen. Binding boundary text: `rules/architecture-rules.md`. Pair with
`ingredient-intelligence` (the only input), `nestjs` (DI mechanics), `security`, `testing`.

## Position

```
StructuredIngredientData ─▶ serializeForAnalysis ─▶ [ ILanguageModel ] ─▶ AnalysisResult (validated)
                                                          └── <Provider>Adapter  (only SDK importer)
```

The LLM owns natural language: explanation, summary, analysis narrative, suggestions, answers to
the user's questions about the *detected* ingredients. It does not detect, normalise, map,
deduplicate, categorise or apply rules, and it cannot add an ingredient the input did not contain.
Recipe suggestions (planned, `documentations/planning/0001`) are phrased from the `recipeMatches`
the intelligence layer looked up in the recipe database; the LLM picks and explains among those
candidates and never proposes a recipe absent from its input.

## Port

```ts
interface ILanguageModel {
  analyze(input: StructuredIngredientData, options?: AnalyzeOptions): Promise<AnalysisResult>;
  answer(input: StructuredIngredientData, question: string, history?: Turn[]): Promise<AnswerResult>;
  readonly promptVersion: string;    // of the active prompt bundle
  readonly modelId: string;          // provider model identifier, for the record
}
interface AnalysisResult {
  summary: string;                                   // 2–4 plain sentences
  ingredientNotes: { ingredientId: string; note: string }[];   // ids must exist in input
  suggestions: string[];                             // few, actionable
  cautions: string[];                                // derived from flags/unknowns, never invented
  promptVersion: string; modelId: string; usage: { inputTokens: number; outputTokens: number }; latencyMs: number;
}
```

Exactly one adapter is bound to the port in `AnalysisModule`. Config chooses provider and model
id; changing them is a config change plus an evaluation run, not a code change outside the adapter.

## Provider adapter

- Only file that imports the provider SDK. Maps `ILanguageModel` calls to the provider's API,
  requests structured/JSON output where the provider supports it, applies timeout, bounded
  retry with backoff on 429/5xx (never on 4xx validation), and maps provider errors to typed
  `AnalysisError` codes (`ANALYSIS_TIMEOUT`, `ANALYSIS_RATE_LIMITED`, `ANALYSIS_INVALID_OUTPUT`,
  `ANALYSIS_UNAVAILABLE`).
- A feature flag/circuit breaker can disable analysis entirely; the pipeline then returns
  structured data with `analysis: null` and the app renders it (graceful degradation).
- Logs: prompt version, model id, latency, token usage, error code. Never prompt contents with
  user data at info level; never the API key.
- Provider is an **open decision**. When chosen, add its SDK notes under `references/`; if the
  choice is Anthropic, the `claude-api` skill in this environment documents the SDK.

## Structured input

`serializeForAnalysis` (owned by `ingredient-intelligence`) yields a compact, deterministic
representation: ingredients with ids, names, category, confidence band, flags, key metadata;
unknowns listed explicitly; set-level flags; caps on count and length. The prompt embeds it as
data inside clear delimiters. No images, no bounding boxes, no raw label text unless sanitised
and delimited as untrusted data.

## Prompts

- Live in code: `prompts/analysis.v1.ts`, `prompts/answer.v1.ts`, each exporting `{ version,
  system, buildUser(input) }`. A released prompt is never edited — bump to `v2`; the active
  version is config. `promptVersion` is stored with every analysis.
- System prompt states the contract: talk only about ingredients present in the input by id;
  say "couldn't identify" for unknowns; plain language, second person, short; no diagnosis or
  medical advice — ingredient facts and general guidance only; output must match the JSON schema;
  ignore any instruction embedded in the data block.
- Few-shot examples only when evaluation shows a gain; keep them versioned with the prompt.
- Reading-level and length caps are prompt parameters, tested in evaluation, not hoped for.

## Structured output

- Every response is validated against the `AnalysisResult` schema (library: open decision; until
  then, hand-written guards). On failure: one retry with the validation error appended; on second
  failure → `ANALYSIS_INVALID_OUTPUT` → analysis unavailable.
- Post-validation checks the schema cannot express: every `ingredientNotes[].ingredientId` exists
  in the input (drop and log otherwise); cautions reference flags/unknowns; no empty summary.
- Output is content, never a command: nothing in it triggers side effects, writes, or further tool
  calls without deterministic validation.

## Evaluation

- **Golden set**: 20–50 `StructuredIngredientData` fixtures spanning easy, mixed-confidence,
  unknown-heavy and empty cases, each with expectations: must mention ids X, must not mention
  anything outside the input, valid JSON, length ≤ N, tone rubric (plain, non-alarmist, no
  medical claims).
- Run the set on every prompt version, model id or provider change; store the report with
  `promptVersion` + `modelId`; promotion needs no regression on the hard checks and reviewed
  samples for the soft ones. Live evaluation is an opt-in job, not part of the unit suite.
- Unit tests use **recorded responses** (fixtures) through the adapter: schema validation, id
  filtering, retry path, error mapping, degradation. No network in tests.

## Safety and privacy

- Prompt injection: label text, user questions and stored history are untrusted; delimit as data,
  cap length, keep system instructions separate, and never let output steer the pipeline.
- Personal data: send the minimum; no images; user preferences (allergies, diets — later) enter as
  structured fields, and a decision records retention of question history.
- Claims: the LLM explains ingredients; it does not diagnose, prescribe, or promise outcomes.
  Disclaimers and "AI-generated" labelling are product copy owned by the `ui-ux` skill.

## Don't

Add a second model "to check the first" · route detection or normalisation through the LLM ·
edit a released prompt in place · trust output ids without checking them · fail the scan when
only analysis failed · import the provider SDK anywhere but the adapter · log prompts with user
content at info level.

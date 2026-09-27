---
name: react-native
description: React Native + TypeScript conventions for denly-mobile (Android + iOS, iPhone 13 design floor, NativeWind + React Native Reusables) — feature-first architecture, typed navigation, camera/image capture, on-device ingredient detection (embedded YOLOv8 via a Core ML native module, bundled model) and scan submission, online/offline mode with downloadable small/medium/large SQLite data packs and the offline evaluator, TanStack Query as the only server-state layer, component architecture, performance for image-heavy screens, accessibility, iOS specifics. Use for any screen, component, hook, navigation, camera, detection, submission, data-fetching, performance or accessibility work in the mobile repo.
paths:
  - "denly-mobile/src/**"
  - "denly-mobile/app/**"
  - "denly-mobile/ios/**"
---

# React Native (denly-mobile)

Written 2026-09-19 for a repo that does not exist yet; carries the TanStack Query and UI habits
from the user's earlier React projects, adapted to native. When the repo is scaffolded, replace
"expected" statements below with what was built and record library choices in
`documentations/decisions/`. Pair with `ui-ux` (screens, states, copy) and `testing`.

## Non-negotiables

- **Android and iOS** (ADR 0010): the near-term deliverable is an installable Android APK built on
  this Windows box; iOS config stays. **iPhone 13 (390 × 844 pt) is the design floor**; every
  screen respects safe areas (`react-native-safe-area-context`) on both platforms.
- **Styling is NativeWind + React Native Reusables** (ADR 0009): components in `components/ui/`
  (RNR, owned and restyled), Denly components in `components/denly/`, tokens as shadcn CSS
  variables in `src/global.css` mirrored in `lib/theme.ts` (a sync test and a contrast test guard
  both). Use role classes (`bg-card`, `text-muted-foreground`, `bg-hero`, `text-detected`) merged
  with `cn()`; never hex in components; `StyleSheet` only for values a class cannot express.
  Icons: `lucide-react-native` via `components/ui/icon`.
- TypeScript strict (`coding-rules.md`). Route params, API responses, query keys are all typed.
- **TanStack Query owns server state.** Every API read is a `useQuery`, every write a
  `useMutation`. No `useEffect`+`fetch`, no hand-rolled caches, no mirroring responses into
  `useState` or a store. Details in `references/data-layer.md`.
- The app runs the embedded YOLOv8 detector on the phone (ADR 0002). **Online** it submits the
  `DetectionRun` as JSON and reads structured results + AI summary from the Denly API. **Offline**
  it runs the ingredient-intelligence evaluator over the downloaded data pack (ADR 0003) and shows
  results without a summary. It never calls an LLM provider and never uploads the image
  (`architecture-rules.md`).
- Accessibility is a requirement, not polish (§ Accessibility).

## Architecture

```
src/
  navigation/  or app/     root navigator, typed param lists, deep-link config (later)
  features/<feature>/      screens/ components/ hooks/ api/ types/   — scan, results, analysis, history, settings
  features/scan/detection/ detector port, Core ML adapter (TS wrapper over the native module), bundled model config
                           — the only code that knows YOLO / Core ML exist (`computer-vision`)
  features/scan/intelligence/  offline evaluator + SQLite repository over the pack — the only app code
                           that maps, dedupes, bands or applies rules (`ingredient-intelligence`)
  features/offline-data/   manifest, tier picker, download, verify, install, update, delete
  lib/db/                  SQLite access: the read-only pack + the local offline-scan store (separate files)
  components/ui/           React Native Reusables (shadcn for RN), restyled: Button, Text, Input, ToggleGroup, AlertDialog…
  components/denly/        Denly components: ProduceTile, ConfidenceLabel, rows, HeroCounterCard, TabBar, Screen…
  features/demo/           example data + DemoProvider for the frontend-only build (removed when real data lands)
  lib/api/                 one typed HTTP client, error normalisation, request id, base URL from config
  lib/query/               QueryClient defaults, query-key factory, persistence (if adopted)
  lib/image/               downscale, compress, strip metadata, orientation — pure functions over URIs
  lib/logger.ts            single logger; no console.* elsewhere
  global.css + lib/theme.ts  shadcn CSS variables (light `:root`, dark `.dark:root`) + TS mirror, NAV_THEME
  lib/use-appearance.ts    System · Light · Dark preference, persisted with expo-sqlite/kv-store
```

- A **screen** composes feature components and hooks; it holds no business logic and no fetch code.
- **Hooks** wrap TanStack Query per endpoint (`useScanResult(scanId)`, `useSubmitScan()`); a
  component never calls the API client directly.
- **Business logic** that is not server-side (e.g. grouping ingredients for display, confidence
  band labels) lives in pure functions under the feature's `lib/` or `utils/` with unit tests.
- Named exports for components and hooks; one component per file; props typed with an explicit
  `Props` type; no `React.FC`.

## Navigation

- Typed param lists per navigator (`RootStackParamList`); `useNavigation<...>()` and `useRoute`
  typed via the list — no `any` routes. Expo Router (ADR 0007), routes under `src/app/`, typed routes on.
- Core flow is a stack: Home/Scan → Capture → Processing → Results → Analysis (detail). Tabs only
  if a second top-level area (history, settings) exists. Modals/sheets for edits and secondary
  actions; a full screen for anything the user reads.
- Back always works and never loses a captured image or a result already fetched.

## Camera and image workflow

1. **Permission priming** — explain why before the system prompt; handle "denied" with a screen
   that deep-links to Settings. `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription`
   strings are user-facing copy (`ui-ux`).
2. **Viewfinder** — live detection overlay (boxes + labels, ADR 0004), guidance frame, torch
   toggle, gallery import, one large capture control. Keep the preview component lean; the overlay
   updates on the UI thread, never through React re-renders of the camera view.
3. **Post-capture** — in `lib/image`: fix orientation; downscale only as far as detection accuracy
   allows (the model letterboxes to its input size; tune with `computer-vision`). The image stays
   on the device and is deleted when the scan is submitted or discarded.
4. **Detect on the phone** — a feature hook (`useDetectIngredients`) calls the detector port and
   exposes idle / detecting / done / error. It is local work, not server state: nothing goes into
   the query cache. The resulting `DetectionRun` lives in React state for the flow.
5. **Resolve — online or offline** (chosen automatically, ADR 0003):
   - *Online* (`onlineManager` online): `useSubmitScan()` is a `useMutation` posting the
     `DetectionRun` JSON; cancellation on unmount/back; retry once on network failure;
     `UNSUPPORTED_MODEL_VERSION` → an "update the app" state. Stages: detecting → analysing.
   - *Offline*, or the submission fails on the network or times out: run the offline evaluator
     over the installed pack and save the result to the local offline-scan store, labelled
     offline with the pack's `rulesVersion`. No compatible pack → detections only + "Download
     offline data".
   - Back online, an offline result offers "Get AI summary": the same `DetectionRun` goes to
     `useSubmitScan()` and the online result replaces the offline one.
6. **Results** — render structured ingredient data immediately; the LLM explanation arrives with
   it or is marked unavailable. Bounding-box overlays are optional and use the contract's
   normalised coordinates, never the model's pixel space.

Camera: **`react-native-vision-camera`** (ADR 0004 — real-time detection needs its frame
processors; `expo-camera` has none). Wrap it in one feature-local component so the rest of the
app never imports it.

## On-device detection

- The detector is a native module (Swift, Core ML) behind the port; Expo Go cannot load it, so the
  app is an Expo dev build with Continuous Native Generation (ADR 0007): `ios/` is generated by prebuild, native code arrives via config plugins / local Expo modules. Runtime integration is also open
  (`computer-vision`); the port stays the same either way.
- The model is bundled: the iOS build fetches the pinned version from the lock file and verifies
  its SHA-256; weights are never committed. The adapter loads it only from the app bundle.
- Load and warm up the model once (when the scan feature mounts), run inference off the JS thread,
  one at a time, with a timeout; release it on memory warnings.
- **Live frames** (ADR 0004): a native frame-processor plugin runs the model at a capped rate
  (start around 10–15 per second; preview stays at camera rate) and drops frames while busy; only
  small result arrays reach JS (worklet → shared value / `runOnJS`), never pixel data. The overlay
  draws from normalised boxes on the UI thread (Skia or Reanimated — chosen at implementation)
  without re-rendering the camera view. Stop the camera and the processor when the screen loses
  focus or the app backgrounds; lower the rate when `thermalState` rises. Frames are never stored.
- **Capture** runs one full-quality inference on the captured frame; that `DetectionRun` is the
  result. Live boxes are guidance only.
- Latency, memory and accuracy are measured on a physical iPhone 13 — the simulator runs Core ML
  without the Neural Engine. `ios/` and native-module changes are reviewed like code.

## Offline mode and data packs

- **Manifest** via `useQuery` (server state): tiers with size, `rulesVersion`, schema version,
  compatible model versions, SHA-256. The picker shows the real download size and free space.
- **Download** is user-started from Settings → Offline data (and offered on the first offline
  scan): progress, cancel, Wi-Fi recommended (not forced), resumable if the library supports it.
- **Install**: verify SHA-256, `packSchemaVersion` the app reads, and that the bundled model
  version is compatible; then swap atomically. The previous pack stays until the new one passes;
  a failed or interrupted download never leaves the app without its old pack.
- The pack is opened **read-only**. Offline scan results live in a separate local database and
  are deleted when sent for an online result or discarded. Pack data is read through the
  intelligence repository only — never queried ad hoc from screens.
- Update, switch tier or delete from Settings; show the installed tier, version and size. When
  the manifest has a newer `rulesVersion`, show "Update available" — no silent background
  downloads by default.
- SQLite library: `expo-sqlite` assumed (open decision #23, installed with offline mode); wrap it in `lib/db`
  so nothing else imports it.

## Performance (image-heavy app)

- Lists: `FlatList`/`FlashList` with stable `keyExtractor`, `getItemLayout` where rows are fixed,
  memoised row components, no inline closures in hot rows.
- Images: never full-resolution images in lists, cached, `resizeMode` explicit; delete captured
  image files when a scan completes.
- Keep JS-thread work off the capture and detection path; image maths and inference run native.
  Measure first (Perf Monitor, Flipper/Hermes profiler, Xcode Instruments for the model);
  optimise second.
- Respect poor networks: timeouts, connectivity wired to TanStack Query's `onlineManager`, and a
  retry affordance on every network-dependent screen.
- Battery: stop the camera when the screen loses focus; no polling loops — refetch on focus/interval only where needed.

## Accessibility

- Every interactive element: `accessibilityLabel`, `accessibilityRole`, `accessibilityState`;
  minimum 44 × 44 pt hit area (`hitSlop` when the visual is smaller).
- Dynamic Type: use `allowFontScaling` (default) and layouts that survive 200 % text; never fixed
  heights on text containers.
- Contrast ≥ 4.5:1 for text; state is never colour-only (confidence bands get an icon or label).
- Announce async outcomes (`AccessibilityInfo.announceForAccessibility`) for scan complete / failed;
  `accessibilityLiveRegion` where supported; loading views expose `accessibilityState={{ busy: true }}`.
- Honour Reduce Motion (`AccessibilityInfo.isReduceMotionEnabled`) for transitions and overlays.
- Camera and result screens are usable with VoiceOver: focus order, labelled capture control,
  results readable as a list.

## iOS specifics

- Real device required for camera and detection work; simulator for layout only. Xcode +
  CocoaPods installed; `ios/` changes (Info.plist strings, capabilities, the native detector
  module, the model fetch build step) are reviewed like code.
- Safe areas via the safe-area context provider; keyboard avoidance on any form; haptic feedback
  on capture and on result ready (light, not decorative).
- Minimum iOS version, bundle id, and signing are scaffold-time decisions; signing material is a
  secret (`security-rules.md`).

## Stack-level rules from the community skills

The React Native rules distilled from UI/UX Pro Max and the Vercel guidelines (`Pressable` +
`hitSlop`, NativeWind role classes over inline objects, `FlatList` windowing, sized and cached images,
`KeyboardAvoidingView` + keyboard types, Reanimated for anything beyond a fade, Hermes on) live in
`../ui-ux/references/community-guidelines.md` §3–5 and are checked by the `code-reviewer`.

## Done means

`tsc --noEmit`, lint and tests pass (`/verify mobile`); the screen has loading/empty/error/offline
states; VoiceOver walk-through done on any new screen; no new dependency without a stated reason.

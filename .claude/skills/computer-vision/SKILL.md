---
name: computer-vision
description: Computer-vision conventions for Denly's on-device ingredient detection with YOLOv8 — the detector port/adapter inside denly-mobile, detection classes as a versioned taxonomy, the DetectionRun contract the app submits, the backend model registry that validates it, dataset format and hygiene, training/fine-tuning, Core ML export and parity, evaluation (mAP, per-class PR, thresholds, golden regression set), on-device inference (orientation, letterbox, NMS, normalised output, Neural Engine, latency on iPhone 13), model bundling, versioning, model cards and licensing. Use for anything involving YOLOv8, datasets, labels, training, evaluation, Core ML, on-device inference, model files, detection thresholds, the detection feature in the app, or the model registry in the backend. YOLOv8 owns visual detection; the LLM never does.
---

# Computer vision — YOLOv8 on the phone (Denly)

Written 2026-09-19 and updated the same day by ADR 0002: **the detector is embedded in the iOS app
and runs on the device.** No model, dataset or adapter exists yet. This skill fixes the *shape* of
the vision stage so everything else can be built against it. Binding boundary text is in
`rules/architecture-rules.md`. Pair with `react-native` (native module, camera), `nestjs` (model
registry, submission DTO), `ingredient-intelligence` (consumes detections), `testing`.

## The boundary, restated

```
denly-mobile                                                          denly-backend
photo ─▶ [ IIngredientDetector ] ─▶ DetectionRun ══ HTTP JSON ══▶ DTO + model registry ─▶ ingredient intelligence
               └── CoreMlYolov8Detector   (native module + TS wrapper — the only code that knows YOLO / Core ML exist)
```

- YOLOv8 owns: visual recognition, detection classes, bounding boxes, confidence scores, relevant
  image regions. Nothing else. It runs on the phone; in v1 the backend runs no detection and never
  receives the image.
- The LLM never sees pixels, never "double-checks" a detection, never fills gaps in detections.
- Reading printed text (label panels) is OCR — a separate deterministic adapter if ever needed —
  not YOLO and not the LLM.
- Replaceability is a requirement: swapping YOLOv8 for YOLO11, RT-DETR or another on-device
  detector changes the adapter, the bundled model, the model card and one registry entry on the
  backend. No backend service, DTO shape, intelligence code or screen changes. A server-side
  detector (reprocessing, devices that cannot run the model) would implement the same contract
  behind a backend port — a new decision, not v1.

## Licence (blocking)

Ultralytics YOLOv8 is AGPL-3.0. Shipping it inside a distributed app — TestFlight included — needs
a recorded licence route (Ultralytics Enterprise licence, an AGPL-compliant app, or a permissively
licensed detector behind the same port). Open decision; no build leaves the team until it is an ADR.

## Detection contract

```ts
interface DetectionResult {
  classId: number;          // stable id from the taxonomy (append-only, never renumbered)
  className: string;        // taxonomy label, e.g. 'egg', 'tomato', 'garlic' — maps to ingredient_alias(source='model_class')
  bbox: { x1: number; y1: number; x2: number; y2: number };  // normalised 0..1, top-left origin, upright original image
  confidence: number;       // 0..1 after NMS
  modelVersion: string;     // e.g. 'yolov8n-ingredients-0.3.0'
}
interface DetectionRun { detections: DetectionResult[]; imageSize: { w: number; h: number }; latencyMs: number; modelVersion: string }
```

- Declared once in the mobile repo next to the port and once in the backend as the submission DTO
  (class-validator); the OpenAPI output is the shared contract, not shared code. On the wire the
  run carries `modelVersion` once; the backend stamps it on every stored detection.
- An empty array is a valid result (nothing found), not an error. Coordinates are normalised so
  overlays and the backend never need the model's input size.

## Taxonomy = detection classes

- `classes.yaml` (versioned with the model) is the single list of class ids and names. Ids are
  append-only; retired classes keep their id and are marked retired. Names are lowercase
  snake_case and must exist as `ingredient_alias` rows with `source = 'model_class'` — the
  intelligence layer maps them, the model never emits canonical ingredient ids.
- Adding a class = dataset change + new model version + registry entry + alias rows + a data
  release whose offline packs resolve the new classes + evaluation on the golden set + an app release.

## Model registry (backend)

- The backend knows every model version a supported app build can send: `modelVersion`, status
  (`supported` | `retired`) and its taxonomy (from `classes.yaml`), seeded from versioned files by
  an idempotent upsert (`postgresql-typeorm`).
- Checks on every submitted `DetectionRun`: version exists and is `supported`; each
  `classId`/`className` pair is in that version's taxonomy; confidence and bbox in 0..1 with
  `x1 < x2`, `y1 < y2`; detection count ≤ cap; `imageSize` positive and bounded. Failures → `422`
  with `UNSUPPORTED_MODEL_VERSION` (the app asks the user to update) or `VALIDATION_ERROR`.
- **Release order:** registry entry and alias rows reach production before the app build carrying
  the model is submitted for review. Retire a version only when no supported app build ships it.
- Device-reported detections cannot be proven genuine. Store them as device-reported; nothing
  downstream treats them as more than "what the app said it saw".

## Dataset

- YOLO format: images + one `.txt` per image (`class cx cy w h`, normalised). Splits
  train/val/test by *product or scene*, never by frame, to avoid leakage. A held-out **golden test
  set** never changes except by additive, documented updates.
- Collect with the target: iPhone camera photos at the distances, lighting and angles the scan
  screen guides people to; the golden set includes iPhone 13 captures.
- Labelling guidelines live with the dataset (what counts as an instance, occlusion rules, minimum
  box size). Class balance is reported per version; long-tail classes need targeted collection,
  not weight hacks alone.
- Augmentation: standard (HSV, scale, mosaic) is fine; **no horizontal flips** if label text or
  orientation matters for the class. Never augment the test set.
- Privacy: images never leave users' phones in v1, so user photos are not a data source unless a
  consented contribution flow is decided (open decision). Strip metadata; no faces.
- Track the dataset with a manifest hash (or DVC); the model card cites it.

## Training, fine-tuning and export

- Start from Ultralytics pretrained weights. On the phone the size is chosen by **sustained**
  performance on an iPhone 13 (the floor) with live frames (ADR 0004): frames per second held over
  several minutes, heat, battery, memory — plus the app-size cost of bundling. `yolov8n` is the
  starting point; `yolov8s` only if it holds the target rate. Rough sizes (FP16 Core ML ≈ 2 bytes
  per parameter): n ≈ 6 MB (3.2 M params), s ≈ 22 MB (11.2 M), m ≈ 50 MB (25.9 M); INT8 roughly
  halves them. Measure, don't guess.
- One config file per run (imgsz — 640 default, epochs, batch, lr, seed, augmentations); runs are
  reproducible from config + dataset hash. Log every run; keep the best by val mAP50-95 **and**
  by per-class recall on the classes the product cares about most.
- Export to Core ML (`.mlpackage`) with a fixed input size. FP16 weights by default; INT8 only if
  the golden-set loss is within tolerance. NMS either embedded in the export (`nms=True`) or done
  in the adapter — one of the two, recorded in the model card.
- **Parity before promotion:** the Core ML export against the PyTorch model on the golden set
  (desktop `coremltools` on macOS), then once on a physical iPhone 13 through the real adapter.

## Evaluation and thresholds

- Report mAP50, mAP50-95, precision, recall, per-class AP and the confusion matrix on the golden
  set for every candidate version; compare against the current version on the *same* set.
- Confidence floor and NMS IoU are **per model version config**, tuned on val (never test),
  shipped in the app bundle next to the model and applied by the adapter: a global floor (e.g.
  0.25) plus per-class overrides where a class is precision- or recall-critical. The intelligence
  layer applies its own bands on top.
- Keep a failure gallery (false positives/negatives) per version; it drives the next dataset iteration.
- Promotion gate: no regression on golden mAP50-95 beyond a stated tolerance, no per-class recall
  collapse, Core ML parity within tolerance, iPhone 13 sustained live FPS, thermal state, battery
  drain and memory within budget, app-size delta accepted. Record the decision in the model card.

## Inference pipeline (the on-device adapter)

Two paths through the same model and the same post-processing (ADR 0004):

- **Live** — a VisionCamera frame-processor plugin runs the model on camera frames at a capped
  rate (start around 10–15 per second), returns only small result arrays to JS for the overlay,
  skips frames while an inference is running, stops when the screen loses focus, and backs off
  when the device reports thermal pressure. Live results are guidance, never persisted or logged.
- **Capture** — on capture (or gallery import) one full-quality inference on that frame produces
  the `DetectionRun` that is resolved online or offline. The steps below describe this path; the
  live path applies steps 2–5 to each frame.

1. Input: the captured frame or imported photo from the camera wrapper; check it decodes and
   meets the minimum resolution. The image never leaves the device.
2. Orientation: apply the photo's orientation so the model sees it upright; `imageSize` is
   reported in upright pixels.
3. Pre-process to match training: letterbox to `imgsz` (aspect preserved, padded), RGB. If Vision's
   `VNCoreMLRequest` does the scaling, choose the crop/scale option that matches the training
   letterbox and prove it with the parity fixture — a stretch instead of a letterbox silently
   costs accuracy.
4. Run: Core ML with compute units that allow the Neural Engine; load and warm up the model once
   (the first prediction is slow), off the JS thread; one inference at a time; a timeout.
5. Post-process: NMS (if not in the export), confidence floor and per-class overrides from the
   bundled version config; convert to the contract — Vision boxes are normalised with a
   **bottom-left** origin, so flip to top-left; undo the letterbox; clamp to 0..1.
6. Return `DetectionRun` with `modelVersion` and `latencyMs`; log counts and latency through the
   app logger, never image data.

The runtime integration is open: a custom Swift frame-processor plugin (Core ML + Vision,
default) vs `react-native-fast-tflite` (which needs a TFLite export instead of Core ML). The port
and the contract above stay the same either way.

## Model versioning and delivery

- Name: `yolov8<size>-ingredients-<semver>`; bump minor for taxonomy/dataset changes, patch for
  retrains on the same taxonomy, major for architecture/runtime/export changes.
- Artifacts (weights, Core ML export, `classes.yaml`, thresholds) live in object storage with a
  checksum — never in git. The mobile repo commits a small lock file (version, location, SHA-256);
  the iOS build fetches and verifies the model before bundling it.
- Bundled means: model updates ride app releases, several versions are live at once (users update
  slowly), and rollback is a build that pins the previous version. Over-the-air delivery is an
  open decision.
- The bundled model and taxonomy can be extracted from the app — treat them as public.
- **Model card** per version: dataset hash and size, training config, metrics vs previous,
  thresholds, export format and precision, NMS placement, Core ML parity report, single-inference
  latency, sustained live FPS, thermal state and battery drain over a timed session, and memory on
  iPhone 13, app-size delta, known failure modes, promotion decision.
- Every persisted detection carries `modelVersion`; results from different versions are never
  merged silently — compare them per version.

## Testing

- Unit: coordinate conversion (bottom-left → top-left, un-letterbox, orientation), clamping,
  threshold application — fixtures in, exact numbers out, in TS or XCTest wherever the code lives.
- Adapter contract (Jest): mocked native module → `DetectionRun` shape, empty result, timeout,
  model-load failure.
- On-device: fixture images through the bundled model on a physical iPhone 13 → expected classes
  within tolerance, plus latency and memory for the model card; a timed live session (e.g. five
  minutes of continuous scanning) records sustained FPS, thermal state and battery drain. The
  simulator runs Core ML without the Neural Engine, so its numbers do not count.
- Regression: the golden-set evaluation and the Core ML parity check run as a separate, opt-in job
  (not on every commit) and gate promotion; store the report with the model card.
- Backend registry: each supported version accepts its own taxonomy and rejects foreign class
  pairs, unknown and retired versions. Stored scans cannot be re-detected (no images on the
  server); version comparison happens on the golden set.

## Don't

Ask the LLM to detect, verify or "sanity check" images · upload the image to "double-check" on
the server · map classes to ingredients inside the detector (that is the intelligence layer's job,
online on the backend or offline in the app's evaluator) · ship a model version that no offline
data pack resolves · hard-code
class names outside the taxonomy · import Core ML/Ultralytics/ONNX types outside the adapter ·
tune thresholds in code instead of version config · ship an app build whose model version the
backend registry does not know · commit weights · train or evaluate on user images without a
recorded consent decision · treat an empty detection as a failure.

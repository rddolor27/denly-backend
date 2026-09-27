# Screen states and the core flow — Denly v1

Reference for design docs. Every screen in a proposal gets a row set like these; copy and adapt.

## Core flow with exits

```
1. Launch
   ├─ first run → 2. Value + camera priming
   └─ returning  → 3. Scan
2. Priming ── "Allow camera" → system prompt ─┬─ allowed → 3
                                             └─ denied  → 3 (denied state)
3. Scan (viewfinder) ── capture / import → 4
   ├─ camera unavailable → error (ours) + import
   └─ low light hint (non-blocking)
4. Processing ── detecting (on the phone) → online: analysing · offline: resolving from offline data → 5
   ├─ image rejected (too small / unreadable) → error (user-fixable) → back to 3 with hint
   ├─ detection failed / timeout on the phone → error (ours) → retry
   ├─ offline, or submit fails / times out → offline data installed? → 5 (offline result)
   │                                         no offline data → 5 (detections only + "Download offline data")
   ├─ model version no longer supported → "Update Denly to keep scanning"
   ├─ analysis failed → 5 (partial: no AI summary)
   └─ cancel → 3, image and detections discarded
5. Results ── row tap → 6 · Rescan → 3 · (later) Ask → 7 · (later) Save → history
   ├─ offline result → "Offline result" label + data version; back online → "Get AI summary" → online result replaces it
   ├─ none detected → empty (tips + Rescan + Import)
   ├─ uncertain only → results with Rescan primary
   └─ unknowns present → "Couldn't identify N" section
6. Ingredient detail ── back → 5 (offline: depth depends on the installed tier)
7. Ask (later) ── question → answer (AI, labelled) · unavailable state · offline: disabled with reason
8. Settings → Offline data ── pick small / medium / large → download → verify → installed
   ├─ update available → Update · switch tier · delete
   └─ failures keep the previous data (see matrix)
```

## State matrix

| Screen | Loading | Empty | Error (user) | Error (ours) | Offline | Partial / special |
|---|---|---|---|---|---|---|
| Priming | — | — | — | — | — | Denied: explain + "Open Settings" + "Import a photo instead" |
| Scan | Camera warming (and model loading): dimmed preview, no capture | Nothing in view: no boxes, hint "Point at the food" | Low light hint (non-blocking) | Camera unavailable: message + Import | Banner: "Offline — results use your offline data" (with pack) · "Offline — download offline data to see ingredients" (without) | Torch on/off; import sheet |
| Processing | Stage list online: Detecting → Analysing · offline: Detecting → Checking offline data; cancel | — | Image rejected: what to fix + "Retake" | Failed at stage X: "Try again" keeps the image; second failure offers Import/Retake | Falls back to offline data without asking; no pack → detections only | Slow: after 8 s "Still working…"; after timeout: offline fallback or retry · Update required: "Update Denly to keep scanning" + **Update** |
| Results | Skeleton rows mirroring group headers + rows + summary card | "Nothing recognised" + 3 tips + Rescan + Import | — | Load failed (returning from history): "Try again" | Offline result: label + data version; AI summary card replaced by "AI summary needs a connection" | No AI summary: card says "Summary unavailable — the ingredient list is complete"; unknowns section; uncertain group collapsed with count · Back online on an offline result: **Get AI summary** |
| Settings → Offline data | Manifest loading: skeleton tier rows | No pack installed: three tiers with size and what each includes + **Download** | Not enough storage: how much is needed + choose a smaller tier | Download failed / checksum mismatch: "Couldn't install — your previous data is still in use" + **Try again** | Manifest unavailable: shows the installed tier and version; download disabled with reason | Downloading: progress %, cancel · Verifying · Installed: tier, version, size, **Update** when newer, **Delete** |
| Ingredient detail | Skeleton title + metadata | — | — | "Couldn't load details" + retry | Cached if present | Low confidence: banner "Uncertain — rescan to confirm" |
| Ask (later) | Typing indicator with label | Prompt suggestions | Question too long / empty | "Couldn't answer right now" + retry | Disabled with reason | Answer labelled AI; unknowns acknowledged |
| History (later) | Skeleton list | "No scans yet" + Scan | — | "Couldn't load history" + retry | Cached list | Items with failed status show retry |

## Copy bank (starter)

- Priming: "Denly uses the camera to read the product you're holding." → **Allow camera**
- Denied: "Camera access is off. Turn it on in Settings, or import a photo." → **Open Settings** · Import photo
- Viewfinder hint: "Fill the frame with the product"
- Stages: "Detecting ingredients" · "Writing your summary"
- Update required: "This version of Denly is out of date. Update to keep scanning." → **Update**
- Slow: "Still working…" · Timeout: "This is taking longer than usual." → **Try again** · Cancel
- Empty: "Nothing recognised. Try closer, in better light, with the label flat." → **Rescan** · Import photo
- Partial: "Summary unavailable right now. Your ingredient list is complete." → Try again
- Offline (with data): "You're offline. Results use your offline data." (banner)
- Offline (no data): "You're offline. Download offline data to see ingredients without a connection." → **Download offline data** (when back online)
- Offline result label: "Offline result · data from <date>" · summary card: "AI summary needs a connection." → **Get AI summary** (once online)
- Offline data tiers: "Small — the essentials" · "Medium — more detail" · "Large — everything we have" (each with its download size)
- Unknowns: "Couldn't identify 2 items" → Rescan
- AI label: "AI summary" (caption above the card, always)
- Success: "Saved"

# Asset credits

Machine-readable source of truth: [`manifest.json`](./manifest.json).
The public page at `/credits/` is generated from it.

## The rule

An asset is not "downloaded" until it has a manifest entry. No exceptions.
In a year you will not remember whether a model was CC0 or CC-BY, and the
difference is whether you owe someone a credit line.

Every entry records:

| Field | Why |
|---|---|
| `name` | What it is |
| `author` | Who to credit |
| `licence` | The **exact string** from the licence page, not your paraphrase |
| `source` | The URL you got it from |
| `downloaded` | ISO date — licences change, this pins which one you accepted |
| `usedIn` | Which zones, so you can find every use if a licence turns sour |

## Known licence traps

- **Quaternius** is no longer CC0. It is now the Quaternius Asset License v1.0 —
  still free for commercial use with no attribution required, but it forbids
  redistributing the assets as a standalone pack. Keep source `.blend` files
  out of a public repo; commit only merged scene GLBs.
- **Poly Pizza** is a mix of CC0 and CC-BY. It is per-model, not per-site.
  Check each one.
- **Sketchfab** licences are per-model and frequently CC-BY. The Merdeka 118
  model in the plan is CC-BY — it needs a credit line.
- **Kenney** is genuinely CC0 and is the safe default. Prefer it.
- Screenshot the licence page on the day you download. Pages get edited.

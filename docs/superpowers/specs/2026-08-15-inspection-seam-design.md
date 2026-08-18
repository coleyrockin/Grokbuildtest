# Aesther — Inspection Seam

**Date:** 2026-08-15
**Status:** Design, pending implementation plan

## Goal

Aesther is a portfolio piece. Its audience is a hiring engineer who spends
roughly ten seconds on the page. Today that engineer sees a dim blob on black
and has no way to tell the work apart from a forked shader.

This design adds one interaction that makes the renderer's internals visible:
a draggable vertical seam splitting the screen between the finished orb and a
raymarch step-count heatmap of the same frame.

Success is a single reaction — *that is not a shader someone downloaded* —
reached without reading anything.

## What ships

1. **The inspection seam.** A draggable divider. Left of it, the orb as it
   renders today. Right of it, the same frame as a step-count heatmap.
2. **Idle attract state.** The orb perturbs itself at rest so the piece is not
   invisible to a visitor who never touches it.
3. **README rebuild.** The seam as hero image, plus two technical writeups
   drawn from real defects in this codebase.
4. **A minimal capture harness**, rebuilt, because it no longer exists and
   nothing else can verify shader work here.

## Non-goals

Explicitly not built, to keep this one moment rather than a control panel:

- Additional inspect channels (SDF distance, normals, ripple field, stress field)
- A live telemetry readout of the simulation snapshot
- Seeded deterministic replay
- Any change to the orb's authored look on the left side of the seam
- Generalising the seam to the other four portfolio projects (see Rollout)

The seam is built as its own module so a second channel is cheap later, but
one channel ships.

## Architecture

### Why the split happens in the post stack, not the material

The obvious implementation mixes the heatmap into `finalColor` at the end of
`raymarch()` in `jellyOrbMaterial.ts`. That is wrong here. Everything the
material emits passes through `TslBloom.tsx`: bloom, an inline colour grade
(black point, contrast pivot, saturation), a peak-ratio compressor, chromatic
aberration, film grain, and ACES tone mapping at exposure ~0.50. A heatmap run
through that chain is no longer a heatmap — the colour mapping is destroyed, so
the picture stops being evidence.

The step count must therefore reach the post stack as its own signal and be
composited *after* grading.

### Data path

1. **Count in the march.** `raymarch()` is already a `Fn()` with `finalColor`
   declared via `.toVar()` at its top scope. A step counter follows exactly that
   proven pattern: declare `steps` as a `.toVar()` in the same scope, increment
   it at the top of the `RaymarchingBox` callback, read it after the loop.

   This specifically avoids the failure documented in
   `2026-07-24-aesther-material-physics-design.md`: `.toVar()` and `Loop()` emit
   *statements*, and a helper that emits statements must be a real `Fn()` with
   `.setLayout()` or the variable is read outside the scope that fills it. The
   counter introduces no new helper, so that trap does not apply — but any
   refactor that moves it into a JS arrow helper reintroduces it.

2. **Normalise against the existing uniform.** `stepCount` is already a uniform
   on the material and is already returned from `createJellyOrbMaterial`. The
   heatmap value is `steps / stepCount`, so it stays correct across the high /
   medium / low quality tiers (128 / 96 / 48 steps) instead of hardcoding a
   maximum.

3. **Carry it out via MRT.** The material writes the normalised count to a
   second render-target attachment. `TslBloom.tsx` builds its `pass(scene,
   camera)` and reads that attachment as a separate texture node, untouched by
   bloom and grade.

4. **Composite after grading.** In `TslBloom.tsx`, `pipeline.outputNode`
   currently ends at `grained`. It becomes a mix between `grained` and the
   heatmap colour, selected by `screenUV.x` against a seam-position uniform.

### The discard

`raymarch()` ends with `finalColor.a.lessThan(0.01).discard()`. Rays that miss
the surface march every step, so miss pixels are the *most* expensive and the
most informative region of the heatmap — and discard erases exactly those.

When inspection is active the discard must be suppressed by a uniform so the
step count is written for missed rays. When inspection is off, behaviour is
byte-identical to today.

### Coverage limit (accepted)

The material renders on a bounding box with `side: FrontSide`. No fragments
exist outside that box, so the heatmap covers the orb's bounding box footprint
and nothing else. This is accepted, not worked around: the framed patch reads as
deliberate, and full-screen coverage would require a separate pass for no gain.

### Seam interaction

A new module owns seam position as a normalised 0–1 value, kept out of the 120 Hz
controller and out of React's render path where it would cause per-frame
re-renders. Position is pushed straight to the uniform.

Requirements, matching patterns already established in `InterfaceOverlay.tsx`
and `styles.css`:

- Pointer drag, including touch, with a 44px minimum target
- Keyboard accessible: focusable handle, arrow keys step the seam, Home/End jump
  to the edges
- A visible focus ring consistent with the existing sound and info controls
- Respects `prefers-reduced-motion`: no entrance animation, no easing flourish
- Parked fully off-screen at rest so the default view is the untouched orb
- Some persistent affordance for discovery, since a fully hidden seam is never
  found; exact treatment decided during implementation against a capture

The pure position logic (clamping, pointer-to-position mapping, keyboard steps)
lives in its own module and is unit-tested, following the existing precedent of
`contactGesture.ts` / `contactGesture.test.ts`.

### Idle attract state

At rest the frame measures mean luma 2.5/255, coverage 4.3%, edge luma 0. The
authored optics — dispersion, thin-film iridescence, Beer-Lambert absorption,
caustics — are suppressed by the energy gating until a contact arrives.

`organismController` gains a low-amplitude autonomous excitation applied only
while genuinely idle, feeding the impulse path that already exists. It must:

- decay out immediately when a real contact arrives, and not fight user input
- never latch the post stack into a permanently bright state
- scale down under `prefers-reduced-motion` like every other motion source
- leave the fixed 120 Hz step and its determinism untouched

Target is a rest state that is *quiet*, not *invisible*. The exact amplitude is
set by measurement against the capture harness, not by eye.

## Verification

`~/agents/aether-verify/` no longer exists — `orb.mjs`, `tiers.mjs`, `perf.mjs`
and the paused-audit probes are all gone. It is rebuilt minimally under
`~/agents/aether-verify/`, per the repo convention that agent output lives
outside the project tree.

The pixel-readback constraint still holds and is not negotiable: native and CDP
screenshots come back black on this project. The only reliable readback is
`canvas.toDataURL('image/jpeg', q)` called directly on the canvas, taking the
brightest of N grabs. Playwright must run headed with real GPU; the Playwright
MCP crashes after roughly twenty heavy navigations here and is not used.

Probes needed:

- `seam.mjs` — drives the seam across the viewport, confirms the left side is
  unchanged against a baseline and the right side shows a real gradient rather
  than a flat fill
- `orb.mjs` — rest / press / drag / release / settle luma and coverage stats,
  to prove the idle attract raised the rest floor and that driven states did not
  change

The gate stays `npm run test && npm run lint && npm run build`. `tsc -b` runs
only in `build`, never in dev, so a TSL change can look correct in the browser
and still break the build — typecheck before claiming any shader change works.

## Risks

1. **MRT support in three 0.184 TSL + `RenderPipeline`.** The whole data path
   depends on it. This is spiked first, before any other work; if it does not
   hold, the fallback is compositing inside the material and pre-compensating
   for the grade, which is worse and must be re-approved rather than adopted
   silently.
2. **Cost of the counter.** An increment per march step per pixel in the
   scene's heaviest shader. Expected to be negligible, but "expected" is how the
   existing unmeasured perf claim got written — so it is measured on the low
   tier, where the margin is thinnest.
3. **Suppressed discard.** Only active during inspection, but it changes
   transparency behaviour and needs a visual check rather than assumption.
4. **`jellyOrbMaterial.ts` is 983 lines**, already past the repo's 800-line
   flag. The seam adds to it. Extraction is not bundled into this work, but
   nothing new should be added to that file beyond the counter itself.

## README

Rebuilt around evidence rather than description:

- The seam mid-drag as the hero image
- **The full-screen cyan bug** — `.toVar()` and `Loop()` emit statements, so a
  plain JS helper called from inside `map()` (invoked per march step, and again
  for the central-difference normal) left the variable read outside the scope
  that filled it. At loop count 0 the SDF went negative everywhere and the orb
  rendered as a flat full-screen cyan fill, coverage 1.0, while non-zero counts
  rendered correctly. Fixed by wrapping in a real `Fn()` with `.setLayout()`.
- **The overstep speckles** — displacement gradient scales with amplitude ×
  wavenumber; overstepping punched black speckles through the orb, visible on
  the 48-step tier long before the 128-step tier. Fixed by normalising amplitude
  against the effective wavenumber and against the original reference value, plus
  a `min(1, 2/sqrt(N))` factor because N superposed waves grow as sqrt(N).
- Failure images beside fixed images for both, captured via the harness
- Architecture and run instructions, kept

Both stories are illustrated by the heatmap the seam already produces.

## Rollout beyond Aesther

The seam gesture is intended to become a through-line across the portfolio —
polished surface on one side, real substrate on the other. The step-count
heatmap is specific to a raymarcher and ports to none of the others, so each
project needs its own substrate decision and its own spec:

| Project | Behind the seam |
| --- | --- |
| CherryTree | wireframe / overdraw / LOD |
| World Asset Prices | projection grid + raw pin data |
| Weather Feather | live API payload driving each cell |
| POWO | raw health samples behind the charts |

Out of scope here. The seam module is kept free of Aesther-specific assumptions
so it can be lifted, but it is not prematurely generalised into a package.

## Open items not addressed

Carried forward from the paused audit, deliberately untouched:

- `snapshot.shearRate` is written but never read — **resolved 2026-08-17**: the
  public snapshot field was removed; the internal `JellyDynamicsState.shearRate`
  stayed, since it still feeds `effectiveCompliance`/`effectiveDamping` in
  `jellyDynamics.ts`.
- `RIPPLE_SLOTS` and `WAVE_COUNT` are coupled only by a comment — **resolved
  2026-08-17**: `rippleField.ts` now imports `WAVE_COUNT` from
  `organismController.ts` and derives `RIPPLE_SLOTS` from it, with a coupling
  test guarding against future drift.
- The `rippleSum` docblock's "bit-for-bit" claim is stale since dispersion landed
  — **resolved 2026-08-17**: docblock rewritten to describe only what the
  normalization bounds (summed amplitude), not the per-wave shape, which the
  dispersion constants (`K_BASE`, `ENVELOPE`) already changed independent of it.
- `jellyOrbMaterial.ts` exceeds the 800-line flag — still open, out of scope for
  the 2026-08-17 pass.

The unmeasured "rest costs zero" perf claim was resolved 2026-08-17 by removal
rather than measurement: no perf harness was built. The docblock in
`rippleField.ts` now states the zero-cost claim as instruction-count reasoning
about the generated shader (the loop body doesn't execute at `liveCount` 0),
not as a measured frame-time or GPU-profiler result.

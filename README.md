# Aesther

One interactive organism made from raymarched water-glass, modal physics, and
responsive light. Deliberately a single screen: no chapters, no scroll
narrative, no hidden destinations.

**[Live](https://aether-five-liard.vercel.app)** · built solo by Boyd Roberts

![The inspection seam: the finished orb on the left, its raymarch cost per pixel on the right](docs/seam.jpg)

The image above is a single frame, split. Left is what the renderer draws.
Right is what that frame **cost** — every pixel coloured by how many raymarch
steps it took to resolve the surface. Cool where the march lands almost at once;
hot where grazing rays at the rim crawl across the bounding volume first.

Drag the handle in the running piece and you move that split yourself.

## The inspection seam

There is no mesh here. The organism is an implicit surface, marched per pixel,
every frame. That claim is easy to make and hard to see, so the seam shows the
work instead of describing it.

Three details make it honest rather than decorative:

**It composites after the colour grade.** Everything the material emits passes
through bloom, a black point, contrast, saturation, a peak compressor,
chromatic aberration and film grain — a stack tuned to flatter the orb. A cost
ramp pushed through that chain stops being a ramp, so the heat side takes the
raw scene texture and the grade is skipped on that half only.

**It counts real steps, not an estimate.** The counter lives inside the actual
march loop, and normalises against the live step budget — 128 / 96 / 48 across
the quality tiers — so the picture stays correct on hardware that never runs the
high tier.

**It shows cost where the surface is.** An earlier version also mapped the cost
of empty space. It was accurate and useless: the bounding box interior marched
to the limit, blew out to white, and buried the orb inside a bright rectangle.
Cost is now gated on an actual surface hit, and the void stays black.

The window mapped onto the ramp (`costLo`/`costHi`) was measured, not guessed.
Surface hits occupy roughly 0.24–0.46 of the step budget; mapping the raw 0–1
fraction instead collapsed the whole orb into one flat colour.

## Two bugs worth writing down

### The full-screen cyan fill

In TSL, `.toVar()` and `Loop()` **emit statements**, not expressions. A helper
that uses them and is called from inside `map()` — the SDF, invoked once per
march step and again for each axis of the central-difference normal — leaves
its statement in one scope while the value is read from another. The variable is
read outside the loop that fills it.

The symptom was spectacular and misleading: at loop count 0 the SDF went
negative *everywhere* and the orb rendered as a flat full-screen cyan fill,
coverage 1.0, while every non-zero loop count rendered correctly. Nothing about
the picture pointed at variable scoping.

The fix is that any helper emitting statements must be a real `Fn()` with an
explicit `.setLayout({ name, type, inputs })`. Pure-expression helpers stay safe
anywhere; the moment you add `toVar`/`Loop`, it has to be wrapped.

The same trap is why the seam's step counter is declared in `raymarch()`'s own
scope, next to `finalColor`, and never extracted into a helper.

### Overstep speckles and the √N problem

Displacement gradient scales with amplitude × wavenumber. Push it far enough and
the march oversteps the surface, punching black speckles through the body —
visible on the 48-step tier long before the 128-step tier, so it hides from a
desktop check entirely.

Two things were needed. Amplitude has to be normalised against the *effective*
wavenumber and against the original reference value, not the new base. And
superposing N waves grows as **√N**, not N, so the sum needs its own
`min(1, 2/√N)` factor or every added wave quietly eats march headroom.

## What a resting orb looks like

Every authored optic — dispersion, thin-film iridescence, Beer–Lambert
absorption, caustics — is gated behind organism energy. Measured at rest, the
frame was mean luma **4.16/255** at 9.3% coverage against 12.4 under drag: a
visitor who never touched the orb saw a flat navy ball and left.

While genuinely untouched the controller now sends a soft wave through the shell
every couple of seconds, lifting energy through the existing wave path rather
than special-casing the renderer. Rest sits at **6.57 luma / 17.5% coverage** —
clearly awake, still about half a real drag, so being touched stays
unmistakably different from being watched. Any live contact resets both the
timer and the cooldown, so a real interaction always owns the orb.

## Controls

- Press directly on the orb to compress its surface.
- Drag across it to pull the shell and internal mass.
- On iPad, use two or more fingers to pinch, spread, and twist. Aesther combines
  up to five simultaneous contacts into one bounded physical response.
- Release a drag to send momentum, spin, and outward waves through the organism.
  Flick velocity decays naturally if the orb is held still before release.
- Tap for a shallow compression and a single radial wave.
- `Enter` or `Space` for a center touch; arrow keys issue bounded directional
  impulses.
- **Inspect** (upper right) opens the seam. Drag the handle, or use arrows,
  Shift+arrows, `Home`/`End`, and `Escape` to close.
- Sound is off by default.

## Architecture

- `src/simulation/organismController.ts` — the 120 Hz fixed-step modal
  simulation. Aggregates simultaneous contacts into compression, stretch, shear
  and torsion, and exposes a read-only `OrganismSnapshot`. Single physical
  authority; nothing else integrates state.
- `src/visuals/jellyOrbMaterial.ts` — the TSL raymarcher. Volume-preserving
  strain, local pressure, surface waves, liquid veils, wet optics, and the
  step-count instrumentation behind the seam.
- `src/visuals/rippleField.ts` — the 8-slot touch-memory ring buffer, uploaded
  compacted so an idle orb loops zero times.
- `src/visuals/TslBloom.tsx` — the post stack, and where the seam composites.
- `src/interface/seam.ts` — seam geometry as pure functions, unit-tested without
  a GPU.
- `src/visuals/contactGesture.ts` — samples pointer motion, turns release timing
  into bounded, time-decayed momentum.
- `src/experience/useAetherAudio.ts` — deterministic, opt-in contact tones and a
  liquid drone from that same snapshot.
- Zustand holds only low-frequency application state: readiness, sound,
  reduced-motion preference, quality profile, renderer failure, seam.

## Performance and accessibility

- Fixed simulation step: 120 Hz, clamped and damped to settle safely.
- Adaptive DPR and high/medium/low profiles scale raymarch steps, stress-field
  density, postprocessing and audio detail.
- Reduced motion scales simulation, shader phase, postprocessing and camera
  together, and weakens the idle attract rather than switching it off. It never
  enables sound automatically.
- The seam handle is keyboard operable with a 44px target and a visible focus
  ring; opening the seam moves focus to it.
- Loading clears only after a completed frame. Renderer errors and context loss
  show a designed static fallback instead of a blank page.

## Development

```bash
npm ci
npm run dev          # http://127.0.0.1:5182/
npm run test
npm run lint
npm run build        # tsc -b runs ONLY here
```

**`tsc -b` does not run in dev.** A TSL change can look perfect in the browser
and still fail the build, so typecheck before believing a shader change works.

The default renderer is Three's TSL **WebGL** backend (`forceWebGL: true`) —
that is what ships, so verify shader work there. Add `?webgpu` to request the
WebGPU backend where supported.

Shader work cannot be verified by screenshot: native and CDP captures come back
black on this project. The only reliable readback is `canvas.toDataURL()` called
directly on the canvas and decoded through an `<img>`, taking the brightest of
several grabs. The capture harness that does this lives outside the repo in
`~/agents/aether-verify/` (`orb.mjs`, `seam.mjs`, `hero.mjs`).

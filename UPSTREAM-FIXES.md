# Upstream changes required by parametric enclosures

This log separates general tscircuit platform changes from the optional
`pcb-enclosure` package. Core, Circuit JSON, props, evaluation, inference, and
viewer changes remain useful and safe when `pcb-enclosure` is not installed.

### Current publication status

| Fix | Repo | Status |
|---|---|---|
| #1, #8, #10 | core | [`addibble/core:enclosure-support`](https://github.com/addibble/core/tree/enclosure-support) |
| #2 | eval | [`addibble/eval:enclosure-support`](https://github.com/addibble/eval/tree/enclosure-support); [tscircuit/eval#2996](https://github.com/tscircuit/eval/pull/2996) is a closed draft |
| #3, #4, #6 | runframe | [`addibble/runframe:enclosure-support`](https://github.com/addibble/runframe/tree/enclosure-support); [#3751](https://github.com/tscircuit/runframe/pull/3751) and [#3752](https://github.com/tscircuit/runframe/pull/3752) are closed drafts |
| #5 | 3d-viewer | [`addibble/3d-viewer:enclosure-support`](https://github.com/addibble/3d-viewer/tree/enclosure-support) |
| #7 | jscad-electronics | [`addibble/jscad-electronics:fix/connected-right-angle-pinrow`](https://github.com/addibble/jscad-electronics/tree/fix/connected-right-angle-pinrow) |
| #8 | circuit-json | [`addibble/circuit-json:feature/cutout-aperture`](https://github.com/addibble/circuit-json/tree/feature/cutout-aperture) |
| #8 | props | [`addibble/props:feature/cutout-aperture`](https://github.com/addibble/props/tree/feature/cutout-aperture) |
| #9 | infer-cable-insertion-point | [`addibble/infer-cable-insertion-point:fix/explicit-insertion-direction`](https://github.com/addibble/infer-cable-insertion-point/tree/fix/explicit-insertion-direction) |

The closed eval/runframe drafts remain historical references; they are not open
merge requests. Local package-manager rewrites and generated dependency artifacts
must remain excluded from upstream commits.

---

## 1. core — export the catalogue extensibility API

**Repo/file:** `tscircuit/core` · `lib/index.ts`

**Problem.** `extendCatalogue` (and `catalogue`) is how components are registered
with the React reconciler, but it is only used internally
(`lib/register-catalogue.ts`) and never re-exported from the package entry.

**Why it's a real bug.** `docs/CATALOGUE.md` states the catalogue exists "to make
tscircuit **more extensible** (because new components can be registered)", yet the
API to do so is unreachable from outside core. The reconciler resolves a lowercase
JSX tag (`<resistor>`, `<board>`) by looking it up in `catalogue[type]` and throws
`Unsupported component type` otherwise. So **no third-party package can provide a
new intrinsic component** (a `Renderable` that participates in the render phases) —
today the only way to add one is to edit core itself, which contradicts the
documented design. This blocks the entire "components shipped as packages" story,
not just enclosures.

**Fix.**
```ts
// after: export { createElement } from "react"
export { extendCatalogue, catalogue } from "./fiber/catalogue"
```

**Risk.** Negligible — a one-line export of an already-internal, designed-to-be-
public API. No behavior change for existing code.

---

## 2. eval — handle `.cjs` node_modules entries

**Repo/file:** `tscircuit/eval` · `lib/eval/import-local-file.ts`

**Problem.** The local-file importer handles `.ts/.tsx`, `.js/.mjs`, `.json`, and
static assets, but **throws `Unsupported file extension "cjs"`** for `.cjs`.

**Why it's a real bug.** Dual-package npm modules commonly ship a CommonJS build
as `dist/index.cjs` and set `"main": "dist/index.cjs"`. eval already transpiles
`.js`/`.mjs` with sucrase (which handles CJS), so `.cjs` should be treated
identically. As written, **any tscircuit project that imports a dependency whose
resolved entry is `.cjs` fails to evaluate** — a broad class of packages (e.g.
`jscad-planner`). Reproducible with any board that imports such a dep.

**Fix.**
```ts
// } else if (fsPath.endsWith(".js") || fsPath.endsWith(".mjs")) {
} else if (fsPath.endsWith(".js") || fsPath.endsWith(".mjs") || fsPath.endsWith(".cjs")) {
```

**Risk.** Negligible — `.cjs` goes through the exact same sucrase path as `.js`.

**Test.** `tests/node-resolution/node-module-resolution-cjs-entry.test.tsx` resolves
a dependency whose `main` is `dist/index.cjs` (CommonJS `module.exports`). Verified
it fails before the dispatch change and passes after.

---

## 3. runframe — treat `.cjs` as a dynamic (source) file, not a static asset

**Repo/file:** `tscircuit/runframe` · `lib/components/RunFrameWithApi/isDynamicFilePath.ts`

**Problem.** The store decides which uploaded files get their real text content
vs. a `"__STATIC_ASSET__"` placeholder via `isDynamicFilePath`. Its
`DYNAMIC_FILE_EXTENSIONS` lists `.tsx/.ts/.jsx/.js/.mjs/.json` (+ kicad) but **omits
`.cjs`**. So a `.cjs` source file is treated as binary: its content is replaced
with `"__STATIC_ASSET__"`, and when eval then imports it as code the worker throws
`ReferenceError: __STATIC_ASSET__ is not defined`.

**Why it's a real bug.** This is the runframe-side twin of fix #2. Both are needed
for `.cjs` deps to work in `tsci dev`: #2 lets eval *transpile* `.cjs`; #3 ensures
runframe *delivers its source* instead of a placeholder. Note `tsci build` (Node)
is unaffected — this only manifests in the browser/dev path, which makes it easy to
miss. (We pinpointed it by rebuilding eval's worker with one log line and capturing
the **web-worker console** via Playwright, which named `jscad-planner/dist/index.cjs`
as "served as `__STATIC_ASSET__` but treated as code".)

**Fix.** Add `".cjs"` to `DYNAMIC_FILE_EXTENSIONS` (next to `.mjs`).

**Test.** `tests/runframe-dynamic-file-path.test.ts` extended with a `.cjs` case.

**Risk.** Negligible — `.cjs` is source, not a binary asset; it belongs in the list.

---

## 4. runframe — CLI standalone ignores the embedded eval worker (prop mismatch)

**Repo/file:** `tscircuit/runframe` · `lib/components/RunFrameWithApi/standalone.tsx`

**Problem.** The CLI branch renders `<RunFrameForCli {...runframeStandaloneProps} />`.
`runframeStandaloneProps` carries the embedded eval-worker blob under
**`evalWebWorkerBlobUrl`**, but `RunFrameForCli` reads **`workerBlobUrl`** — a
different name — so the blob is silently dropped. `RunFrameForCli` then computes
`forceLatestEvalVersion={!props.workerBlobUrl && shouldLoadLatestEval}` → `true`,
and **fetches eval from the CDN** instead of using the embedded worker.

**Why it's a real bug.** Whenever an eval worker is embedded into the standalone
(the tscircuit umbrella build fills that placeholder), CLI mode ignores it and
silently downloads a *different* eval from the network. This breaks **offline /
air-gapped / pinned-eval / locally-built-eval** usage of `tsci dev`: the embedded
worker should be authoritative. It is a no-op for the default flow (when no worker
is embedded, `evalWebWorkerBlobUrl` is `undefined`, so behavior is unchanged and it
still loads the latest eval from the CDN) — so there is no regression for normal
users.

**Fix (call-site form, what we applied).**
```tsx
root.render(
  <RunFrameForCli
    workerBlobUrl={runframeStandaloneProps.evalWebWorkerBlobUrl}
    enableFetchProxy={runframeStandaloneProps.enableFetchProxy}
  />,
)
```

We kept the **call-site form** (not the alias-at-the-component form floated
earlier). Spreading `runframeStandaloneProps` — typed as the wide
`ComponentProps<typeof RunFrameWithApi>` — onto `RunFrameForCli` would pass it an
`evalWebWorkerBlobUrl` prop it doesn't accept; an alias (`props.workerBlobUrl ??
props.evalWebWorkerBlobUrl`) would only reintroduce that or add a second name for
the same thing. Forwarding by name keeps `RunFrameForCli`'s API single-named. The
one trade-off (future standalone props must be wired in here explicitly rather
than flowing through the spread) is documented with a comment at the call site.

**Risk.** Low — only changes behavior when a worker blob is actually embedded
(which is the case it's meant to handle); the default CDN path is unchanged.

---

## How they interlock

- #1 lets `pcb-enclosure` register `<enclosure>` at all.
- #2 + #3 together let the `.cjs` dependency (`jscad-planner`) load in the browser
  worker (transpile + delivery).
- #4 lets a locally-built/embedded eval actually be used (so #2/#3 take effect in
  `tsci dev`, and any offline/pinned-eval workflow works).

End-to-end verification (post-fix): a macropad + `<enclosure>` rendered in
`tsci dev` with **no execution error** and the 3D scene drawing (Playwright:
`Execution Error: false`, canvas elements present).

---

## 5. 3d-viewer — per-part opacity (FEATURE, not a bugfix)

**Repo:** `tscircuit/3d-viewer` · new `PartAppearanceContext`, per-part opacity in
`JscadModel`, wired through `AnyCadComponent`, with the UI in the right-click
context menu's **Appearance** submenu (`AppearanceMenu`).

**What it adds.** Each enclosure part gets a tri-state opacity control under
right-click → **Appearance**: clicking an enclosure-part item cycles its opacity
visible (1) → 50% (0.5) → hidden (0) → visible. Enclosure parts **default to 50%
on load** (`getDefaultOpacity` / `DEFAULT_ENCLOSURE_PART_OPACITY`) so a closed
shell reveals the PCB immediately; an explicit, persisted choice always overrides
the default. Parts are keyed by `enc:${enclosure_part_id}` (the context also
supports `BOARD_PART_KEY` / `cad:${cad_component_id}`); opacity persists to
`localStorage`. Only enclosure parts (cad_components tagged with
`enclosure_part_id`) are listed; the PCB board keeps its existing on/off
**Board Body** toggle. *(An earlier iteration used a floating `PartsPanel` with
continuous sliders + a board opacity entry; it was replaced by the Appearance
menu to keep all appearance controls in one place.)*

**Why upstream this.** Inspecting a board inside a *closed* enclosure is
impossible without fading/hiding the lid or caps — the existing whole-category
`LayerVisibility` toggles (SMT / through-hole / translucent) can't address one
shell part. This generalizes the viewer from on/off category toggles to
per-instance opacity. It is engine-agnostic (works in both the default Manifold
engine and the JSCAD engine) and inert for boards with no enclosure parts.

**Pairs with** the `pcb-enclosure` change that tags each part's `cad_component`
with `enclosure_part_id` + `name` (these are non-schema fields that survive
`getCircuitJson()`; a future circuit-json addition could make them first-class).

The same branch also provides **Exploded Enclosure** in the context menu.
`cad_component.enclosure_explode_z_offset_mm` is applied only while the toggle is
enabled, so the assembled coordinates remain authoritative and ordinary CAD
components remain inert.

**Verification.** On load both `EN1 Base` / `EN1 Lid` render at 50% (frosted; the
green PCB shows through) and show the `⍻` (U+237B) mark in right-click →
**Appearance**. Clicking `EN1 Lid` cycles it hidden (revealing the PCB + base) →
visible (solid) → 50%. Verified in **both** the Manifold and JSCAD engines
(Storybook `EnclosureParts` story + Playwright screenshots), and shown **inert**
(no rows, no errors) for boards without enclosure parts. Pure-function tests
(`tests/part-appearance-*.test.ts`) cover the key/default/cycle math.

*(The `package.json` diff in 3d-viewer is a yalc artifact — exclude from the PR.
Real changes: `src/contexts/PartAppearanceContext.tsx`, edits to
`AnyCadComponent.tsx`, `CadViewer.tsx`, `components/AppearanceMenu.tsx`,
`components/ContextMenu.tsx`, `components/Icons.tsx`, `JscadModel.tsx`, plus
`stories/EnclosureParts.stories.tsx` and
`tests/part-appearance-{get-part-key,default-opacity,next-opacity}.test.ts`.)*

---

## 6. runframe — File → Export → Enclosure (FEATURE, not a bugfix)

**Repo:** `tscircuit/runframe` · new
`lib/optional-features/exporting/formats/export-enclosure.ts` + a nested
"Enclosure" submenu in `lib/components/FileMenuLeftHeader.tsx`.

**What it adds.** A nested **Enclosure** submenu under File → Export that lists
each enclosure part (`cad_component`s tagged with `enclosure_part_id`) by its
`name` as a binary **STL**, plus **All Parts (STL .zip)**. STL is serialized
in-browser by replaying the part's `model_jscad` plan through the same
`jscad-planner` + `@jscad/modeling` path the 3D viewer already bundles, then
`@jscad/stl-serializer` → `JSZip` (for the zip) → `openForDownload`. The submenu
only appears when the circuit contains enclosure parts.

**Why upstream this.** Enclosure geometry is only useful if you can get it out to
a slicer/CAD; STL is the universal 3D-print format and the parts are already
`model_jscad`. This reuses the existing `availableExports`/`openForDownload`
plumbing and adds no new runtime download (the jscad libs are already in the
bundle for the viewer). Inert for boards without enclosure parts.

**Verification (Playwright, `tsci dev --local`).** File → Export → Enclosure
lists `EN1 Base (STL)` / `EN1 Lid (STL)` / `All Parts (STL .zip)`; clicking a
part downloads a valid binary STL (`index-EN1 Base.stl`, 144,784 B =
80+4+2894×50), and `All Parts` downloads a valid zip (`index-enclosure.zip`,
`PK…`).

*(`@jscad/modeling`, `jscad-planner`, `@jscad/stl-serializer`, `jszip` resolve
transitively today — a clean PR may add them to runframe's explicit deps.
The `package.json` diff is a yalc artifact — exclude from the PR.)*

---

## 7. jscad-electronics — through-hole right-angle pin rows render disconnected conductors

**Repo/files:** `tscircuit/jscad-electronics` · `lib/PinHeader.tsx`,
`lib/PinRow.tsx`

**Problem.** A through-hole right-angle pin-row model such as
`pinrow4_rightangle_invert` renders the horizontal mating pins and vertical
solder tails as separate solids. After `_invert`, the solder tails point down
through the PCB correctly, but the horizontal pins float beside them instead of
forming one bent conductor through the plastic carrier.

**Why it's a real bug.** A standard single-row right-angle male header uses one
continuous L-shaped pin per position: the vertical solder tail passes through
the PCB, bends 90 degrees, crosses the plastic retaining block, and continues as
the horizontal mating pin. The current model is mechanically impossible and
misleading in board/enclosure fit checks. The footprinter parameters are not
underspecified; `rightangle` + `invert` carry enough intent, but the CAD recipe
does not join the two segments.

**Root cause.** `PinHeader.tsx` independently builds:

- a vertical `Hull` at `(x, y)`, and
- a long pin translated by `y = -3.9`, `z = 1` and rotated around X.

Those transforms do not share a bend point, and the discrepancy becomes obvious
when `PinRow` applies its Z inversion.

**Fix.** For non-SMD `rightangle` pins, build an explicit connected L:

1. Place the plastic body around the horizontal segment.
2. Draw the vertical solder tail from its free end to a shared bend point.
3. Draw the horizontal mating segment from that same bend point through the
   plastic body.
4. Pass `invert` into `PinHeader` so only the vertical tail direction changes;
   the horizontal segment remains connected.

The existing SMD-right-angle and straight-pin paths remain unchanged.

**Regression test.**
`tests/pinrow-rightangle-geometry.test.tsx` inspects one inverted right-angle pin
and asserts that the tail ends at the same `(x, y, z)` bend where the horizontal
segment begins, with the tail extending below the PCB plane.

**Publication status.** Committed and pushed to
`addibble/jscad-electronics:fix/connected-right-angle-pinrow`. The
`pcb-enclosure` prefab example exercises it with
`pinrow4_rightangle_invert`.

---

## 8. circuit-json / props / core — embed optional cutout-aperture metadata in parts

**Repos/files:**

- `tscircuit/circuit-json`:
  `src/source/properties/cutout_aperture.ts`,
  `src/source/base/source_component_base.ts`, and source exports/tests.
- `tscircuit/props`: `lib/components/cutout-aperture.ts` and prop exports/tests.
- `tscircuit/core`:
  `lib/components/primitive-components/CutoutAperture.ts`,
  `lib/soup/underscorifyCutoutAperture.ts`,
  intrinsic registration, and a connector regression test.

**Problem.** A connector's required enclosure opening is intrinsic part metadata,
like its footprint and CAD model. Keeping that information in a separate
enclosure-owned catalog requires an MPN/footprint/standard lookup, duplicates
part identity, and prevents an imported part from carrying a complete mechanical
profile.

**Fix.** Add a composable `<cutoutaperture>` child element with nominal
dimensions and shape:

```tsx
<connector>
  <cutoutaperture
    shape="rounded_rect"
    widthMm={3.66}
    heightMm={8.34}
    cornerRadiusMm={1.83}
    zCenterAboveBoardMm={6.75}
  />
</connector>
```

Core lowers the parsed child into its parent source component as
`cutout_aperture` (snake-case Circuit JSON fields such as `width_mm` and
`corner_radius_mm`). The supported shapes are `rect`, `rounded_rect`, `circle`,
and `d_shape`. Optional diameter, flat offset, and fit margin fields preserve the
full existing aperture-profile vocabulary.

Part wrappers can provide a default while allowing an imported part instance (or
a local wrapper around it) to replace that child with ordinary TSX:

```tsx
return (
  <connector {...rest}>
    {props.children ?? <cutoutaperture shape="circle" diameterMm={6.5} />}
  </connector>
)
```

**Why this remains independent of `pcb-enclosure`.** The schema and serializer
live entirely in the normal tscircuit dependency chain:
`props` → `core` → `circuit-json`. Core only copies optional plain data into
Circuit JSON and never imports, registers, or conditionally loads
`pcb-enclosure`. When the child is omitted, core performs no metadata update and
emits the same source component as before. Existing consumers that do not know
the field continue to work; older Zod object schemas strip the unknown optional
field rather than failing.

`pcb-enclosure` consumes `source_component.cutout_aperture` directly. The former
MPN/footprint/standard aperture catalog has been removed; parts that do not carry
the metadata use the existing rectangular body-bounds fallback.

**Verification.**

- `circuit-json`: source connector schema accepts the optional numeric-mm
  aperture and remains valid without it.
- `props`: aperture element props accept number or tscircuit distance-string inputs and
  normalize them to millimetres.
- `core`: a connector with the child emits the underscored metadata; an otherwise
  identical connector without it has no `cutout_aperture` field.
- `pcb-enclosure`: library defaults and circuit-level overrides both round-trip,
  and the prefab example resolves all seven openings from embedded metadata.

**Risk.** Low and additive. The child is optional, the serialized form is plain
Circuit JSON data, and behavior changes only for consumers that explicitly read
`cutout_aperture`.

---

## 9. infer-cable-insertion-point — explicit insertion direction must beat geometry guessing

**Repo/files:** `tscircuit/infer-cable-insertion-point` ·
`lib/guessCableInsertCenter.ts` and
`tests/explicit-insertion-direction.test.ts`

**Problem.** `guessCableInsertCenter` always chooses a mating side from the
largest gap between pad bounds and the overall footprint/silkscreen bounds. It
ignores `pcb_component.insertion_direction`, even though core has already
resolved the footprint-local direction into board coordinates.

That heuristic is useful when no direction metadata exists, but it is the wrong
authority when a footprint explicitly says `from_left`, `from_right`,
`from_front`, `from_back`, or `from_above`. Symmetric footprints are especially
ambiguous. The C7498154 SMA-KWE footprint declared `from_left`, but its symmetric
five-hole subset made the heuristic choose top/+Y, moving
`cable_insertion_center.y` from the connector axis at `-12` to `-7.627`. The
enclosure therefore cut the correct wall but centered the opening several
millimetres away from the connector.

**Fix.** Map explicit insertion directions before consulting geometry:

- `from_left` → `left`
- `from_right` → `right`
- `from_front` → `bottom`
- `from_back` → `top`
- `from_above` → `above`, centered in the footprint bounds

The existing margin heuristic remains unchanged and is used only when
`insertion_direction` is absent or unrecognized.

The example also restores the authoritative SMA-KWE silkscreen/body outline.
That gives the fallback heuristic the real connector envelope rather than only
five symmetric plated holes, but the explicit direction remains authoritative.

**Verification.** Regression tests prove that deliberately misleading geometry
still yields each explicit planar side, `from_above` stays centered, and a
connector without metadata retains the previous geometry-derived result. In the
rebuilt prefab example, J7 now emits `from_left`, a cable insertion point at
`y=-12`, and an enclosure cutout centered at the same `y=-12`.

**Risk.** Low. Connectors without explicit insertion metadata are unchanged.
Connectors with metadata now follow the direction their footprint already
declares. The `above` side is an additive return value used for top-entry parts;
core only consumes the returned XY center.

---

## 10. core — preserve `cadModel.size` in Circuit JSON

**Repo/files:** `tscircuit/core` ·
`NormalComponent.ts` and
`tests/components/normal-components/chip-cad-model-size.test.tsx`

**Problem.** `@tscircuit/props` accepts `cadModel.size`, and Circuit JSON's
`cad_component` supports `size`, but core omitted that field when lowering a
normal component's CAD model. Downstream mechanical consumers therefore saw only
the footprint/pad bounds, even when the part definition supplied an accurate
model body envelope.

This breaks edge-mounted parts whose PCB pins sit well behind their mating face.
For example, the USB-A receptacle is intentionally placed 13 mm inboard while
its 19 mm model body extends toward the enclosure wall. With the size discarded,
the enclosure detector measured a tiny placeholder footprint and rejected the
part as too far from the edge.

**Fix.** Copy the already-parsed optional value into the emitted CAD component:

```ts
size: cadModel?.size
```

`pcb-enclosure` then uses the nearest axis-aligned component-body edge (and any
available cable insertion point) for its edge-reach gate instead of measuring
only from the component center.

**Verification.** Core's regression test renders a chip with
`size: { x: 7, y: 19, z: 6 }` and confirms the exact value survives on
`cad_component.size`. In the prefab example, J4 remains 13 mm from the board
edge, extracts a 19 mm body extent, reaches within 3.5 mm of the wall, and
produces its +Y cutout.

**Risk.** Negligible and additive. Components without `cadModel.size` emit the
same Circuit JSON as before. Components that provide it now retain metadata that
was previously silently dropped.

## Not upstream (our side, for reference)

- `pcb-enclosure`: decoupled from `@jscad/modeling` and inlined a minimal
  `BaseSolver` so the eval worker graph stays light (no `solver-utils` →
  `graphics-debug`); builds `model_jscad` plans via `jscad-planner`.
- `tsc-dev --local`: fills the runframe standalone's eval-worker placeholder with
  the locally-built eval before serving. (Upstream, the **cli** could do this when
  serving its own runframe under `--local`/`RUNFRAME_STANDALONE_FILE_PATH`; that is
  a reasonable cli enhancement but distinct from the four bugs above.)

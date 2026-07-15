# Minimal upstream changes for parametric enclosures

This document records the smallest cross-repository patch set needed to
implement phases 1 and 2 of
[`2026-06-22-parametric-enclosures.md`](https://github.com/addibble/rfc/blob/rfc/parametric-enclosures/rfcs/2026-06-22-parametric-enclosures.md)
while the reference implementation remains in `pcb-enclosure`.

The boundary is:

```text
canonical Circuit JSON       imported enclosure.* TSX
          \                            /
           \                          /
              pcb-enclosure renderer
                       |
              enclosure preview GLB
                       |
        RunFrame / circuit-json-to-gltf / PoppyGL
```

Canonical Circuit JSON contains board/electronics facts only. Enclosure element
props, aperture declarations, CSG plans, and topology remain ephemeral.

## What is intentionally not required

- No `enclosure` or `cutout_aperture` Circuit JSON schema.
- No `source_component.cutout_aperture` field.
- No public or built-in `<enclosure>` intrinsic.
- No enclosure-specific core catalogue entry.
- No `extendCatalogue` export.
- No persisted `model_jscad` enclosure records.
- No enclosure-specific change to `circuit-json-to-gltf`.
- No enclosure-specific change to `3d-viewer`; its existing
  `cad_component.model_glb_url` support is sufficient.

The superseded `addibble/circuit-json:feature/cutout-aperture` branch is not part
of the current design.

## Required repositories

| Repository | Status / branch | Minimal responsibility |
| --- | --- | --- |
| `props` | Merged in [#732](https://github.com/tscircuit/props/pull/732) and [#733](https://github.com/tscircuit/props/pull/733), released in `0.0.580` | React-independent schemas for `enclosure.fdm.box` and `enclosure.cutoutaperture`. |
| `core` | `rfc/parametric-enclosures` | Generic external React host nodes plus `pcb_component.anchor_position` emission. |
| `circuit-json-util` | `rfc/parametric-enclosures` | Transform `pcb_component.anchor_position` with the component. |
| `infer-cable-insertion-point` | `fix/explicit-insertion-direction` (`c1eb3ce`) | Prefer explicit transformed insertion direction over geometry guessing. |
| `eval` | `rfc/parametric-enclosures` | Runtime props imports, optional preview-artifact protocol, and bundled JSCAD/GLB modules. |
| `runframe` | `rfc/parametric-enclosures` | Materialize enclosure GLB blob URLs and augment only the CAD preview. |
| `cli` | `rfc/parametric-enclosures` | Carry preview artifacts into combined GLB and PoppyGL PNG outputs. |
| `3d-viewer` | No enclosure patch required | Render the preview-only GLB CAD component through existing support. |

## 1. `props`: merged authoring contracts

`@tscircuit/props@0.0.580` exports:

```ts
enclosureProps.fdm.box
enclosureProps.cutoutaperture
```

The aperture union supports:

- `pill`: `width`, `height`;
- `rect`: `width`, `height`; and
- `circle`: `radius`.

Every branch may include `margin`. The reference package temporarily extends
the aperture with a component-local `position` until the RFC interaction-surface
vocabulary is finalized.

No additional props patch is currently required.

## 2. `core`: generic external React host elements

**Files:**

- `lib/fiber/external-react-element-registry.ts`
- `lib/components/primitive-components/ExternalReactElement.ts`
- `lib/fiber/create-instance-from-react-element.ts`
- `lib/IsolatedCircuit.ts`
- `lib/components/primitive-components/Group/Subcircuit/inflators/getInflatedPcbPlacement.ts`
- `lib/index.ts`

Imported namespace components are typed React function components that return
string host elements such as `enclosure.fdm.box`. The package registers those
names with a generic core registry and supplies a prop parser.

On a catalogue miss, core checks the external-element registry and creates a
no-op `ExternalReactElement`. This node:

- participates in the ordinary parent/child tree;
- retains parsed props;
- can resolve its nearest normal-component parent; and
- emits no Circuit JSON.

Catalogue entries always take precedence, so external elements cannot shadow
built-ins.

### Isolation and cached placement

Two follow-up fixes keep external nodes usable inside subcircuits:

- `IsolatedCircuit` collects descendant external elements during rendering so
  apertures nested in cached/isolated subcircuits are not dropped; and
- `getInflatedPcbPlacement` prefers `anchor_position` over `center` when
  reinflating a cached subcircuit's PCB placement.

### Mounting origin

The enclosure resolver needs a component-local mounting frame for aperture
offsets. `pcb_component.center` is the rendered footprint bounds center and is
not necessarily the footprint origin.

Core therefore initializes the already-standard
`pcb_component.anchor_position` in:

- `NormalComponent`;
- `Chip`;
- `Jumper`; and
- `SolderJumper`.

No new Circuit JSON field is introduced.

## 3. `circuit-json-util`: transform mounting origins

**File:** `lib/transform-soup-elements.ts`

When a `pcb_component` is translated, rotated, packed, or moved with manual edit
events, apply the same matrix to `anchor_position` as to `center` and
`cable_insertion_center`.

This one generic change covers core grid/pack placement, nested groups, and
manual edits. It replaces the larger core-side reposition wrappers from the
earlier prototype.

This patch is required; without it, asymmetric or rotated footprints retain a
stale mounting origin and local aperture offsets are misplaced.

## 4. `infer-cable-insertion-point`: explicit direction precedence

**Branch/commit:** `fix/explicit-insertion-direction` / `c1eb3ce`

If `pcb_component.insertion_direction` is present, use it before pad,
silkscreen, or bounds heuristics. Geometry remains the fallback when explicit
metadata is absent.

The enclosure package uses:

- transformed insertion direction as mating-face evidence; and
- cable-point inference for board-plane placement/reach.

It never uses those heuristics to invent aperture existence or dimensions.

## 5. `eval`: optional preview artifacts

**Files:**

- `lib/shared/preview-artifacts.ts`
- `lib/shared/types.ts`
- `lib/runner/CircuitRunner.ts`
- `webworker/entrypoint.ts`
- `lib/worker.ts`
- `lib/eval/execution-context.ts`

Add a generic optional host protocol keyed by
`Symbol.for("tscircuit.preview-artifact-host.v1")`.

After core rendering, eval asks registered providers for preview artifacts. The
enclosure provider returns a standard `cad_glb` artifact containing:

- GLB bytes;
- name/id;
- position/rotation; and
- optional diagnostics.

`getCircuitJson()` remains unchanged and canonical.

`@tscircuit/props` must be supplied as its real runtime module rather than the
old `{}` type-only shim, because enclosure schemas parse props at runtime.

Eval also pre-supplies:

- `@jscad/modeling`;
- `jscad-planner`; and
- `jscad-to-gltf`.

This avoids asking the browser evaluator to recursively load JSCAD's CommonJS
source graph. Package resolution additionally falls back to an uploaded
`unpkg` browser entry when `main` is not available.

## 6. `runframe`: preview-only GLB composition

**Files:**

- `lib/components/RunFrame/RunFrame.tsx`
- `lib/components/RunFrame/run-completion.ts`
- `lib/components/CircuitJsonPreview/PreviewContentProps.ts`
- `lib/components/CircuitJsonPreview/CircuitJsonPreview.tsx`
- `lib/components/RunFrameWithApi/RunFrameWithApi.tsx`

RunFrame requests preview artifacts after final rendering, creates blob URLs for
`cad_glb` bytes, and revokes old URLs on rerun/unmount.

Only the CAD tab receives an augmented Circuit JSON copy containing temporary
source/PCB/CAD component records whose `model_glb_url` is the blob URL.

The following continue to receive canonical Circuit JSON:

- PCB/schematic/assembly/BOM/JSON/error tabs;
- `onCircuitJsonChange`;
- `onRenderFinished`; and
- persisted `RUN_COMPLETED` API events.

The raw in-memory `onRunCompleted` callback may receive preview artifacts, but
RunFrame strips the bytes before persisting the event.

## 7. `cli`: PoppyGL and combined GLB output

Node rendering captures preview artifacts while the imported TSX and root
circuit are still live.

Before 3D-only conversion, CLI materializes each GLB as a data URL and appends
the same temporary CAD records used by RunFrame. It applies this only to:

- generated `3d.glb` / GLTF previews; and
- PoppyGL-backed `3d.png`.

The emitted `circuit.json`, PCB/schematic images, fabrication data, and STEP
conversion remain canonical and unaffected.

Worker builds consume artifacts in the worker; single-process builds carry them
on the in-memory `BuildFileResult`.

Preview-artifact generation is guarded: a failing provider (for example an
invalid enclosure spec) is logged and skipped so canonical `circuit.json`
generation and export never abort.

## 8. `3d-viewer`: no enclosure-specific patch

The released viewer already loads `cad_component.model_glb_url`, including blob
and data URLs. RunFrame's synthetic preview component therefore appears beside
the normal board/component scene without an enclosure kernel or topology
support in the viewer.

Per-part opacity and exploded-view controls from the older `model_jscad` design
are not required for RFC phase 2 and should not be included in the minimal
patch.

## Release / integration order

1. Release `circuit-json-util` with transformed `anchor_position`.
2. Release core with generic external elements and mounting-origin emission.
3. Use already-released props `0.0.580`.
4. Release eval with the preview protocol and bundled renderer modules.
5. Release RunFrame and CLI against that eval version.
6. Publish/migrate the current package as `@tscircuit/enclosure` when the
   maintainers provide its repository skeleton.

## End-to-end acceptance

The prefab reference must demonstrate:

1. canonical Circuit JSON has no enclosure or aperture records;
2. seven imported aperture declarations remain owned by their parts;
3. the pure renderer produces base, lid, hardware, DRC results, STL, and GLB;
4. combined GLB contains board/component nodes plus `EN1`;
5. PoppyGL renders the combined scene; and
6. RunFrame's CAD scene loads one additional enclosure GLB object without
   changing the Circuit JSON tab.

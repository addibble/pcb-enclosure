# Minimal upstream changes for parametric enclosures

This document records the smallest cross-repository patch set needed to
implement phases 1 and 2 of
[`2026-06-22-parametric-enclosures.md`](https://github.com/addibble/rfc/blob/rfc/parametric-enclosures/rfcs/2026-06-22-parametric-enclosures.md)
while the reference implementation remains in `pcb-enclosure`.

The boundary is:

```text
board Circuit JSON        imported assembly/enclosure TSX
          \                         /
           \                       /
              pcb-enclosure renderer
                       |
       canonical source/PCB/CAD model_jscad records
                       |
        RunFrame / circuit-json-to-gltf / PoppyGL / CLI
```

Canonical Circuit JSON contains the rendered board plus generated enclosure CAD
plans using its existing source/PCB/CAD record shapes.

## What is intentionally not required

- No Circuit JSON schema changes.
- No public or built-in `<enclosure>` intrinsic.
- No enclosure-specific core catalogue entry.
- No `extendCatalogue` export.
- No preview-artifact or GLB blob side channel.
- No preview-only or out-of-band enclosure representation.

The superseded `addibble/circuit-json:feature/cutout-aperture` branch is not part
of the current design.

## Required repositories

| Repository | Status / branch | Minimal responsibility |
| --- | --- | --- |
| [`addibble/props`](https://github.com/addibble/props/tree/enclosure-support) | `enclosure-support` | Released schemas for `enclosure.fdm.box` and `enclosure.cutoutaperture`, plus the pending `assembly.device` schema. |
| [`addibble/core`](https://github.com/addibble/core/tree/rfc/parametric-enclosures) | `rfc/parametric-enclosures` | External React roots, canonical Circuit JSON postprocessors, and cache opt-out for external metadata. |
| [`addibble/infer-cable-insertion-point`](https://github.com/addibble/infer-cable-insertion-point/tree/fix/explicit-insertion-direction) | `fix/explicit-insertion-direction` (`c1eb3ce`) | Prefer explicit transformed insertion direction over geometry guessing. |
| [`addibble/eval`](https://github.com/addibble/eval/tree/rfc/parametric-enclosures) | `rfc/parametric-enclosures` | Supply runtime props; return canonical Circuit JSON unchanged. |
| [`tscircuit/circuit-json-to-gltf#170`](https://github.com/tscircuit/circuit-json-to-gltf/pull/170) | PR #170 | Execute serialized plans from the existing `cad_component.model_jscad` field. |
| [`addibble/runframe`](https://github.com/addibble/runframe/tree/rfc/parametric-enclosures) | `rfc/parametric-enclosures` | Render canonical Circuit JSON directly; remove the old blob-artifact bridge. |
| [`addibble/cli`](https://github.com/addibble/cli/tree/rfc/parametric-enclosures) | `rfc/parametric-enclosures` | Use canonical Circuit JSON for sequential/parallel GLB, PNG, GLTF, and static outputs. |
| `3d-viewer` | No enclosure-specific patch required | Render `cad_component.model_jscad` through existing CAD support. |

## 1. `props`: authoring contracts

`@tscircuit/props@0.0.580` exports:

```ts
enclosureProps.fdm.box
enclosureProps.cutoutaperture
```

The working `enclosure-support` checkout additionally exports:

```ts
assemblyProps.device
```

The initial device contract carries an optional product-level `name`. The
renderable `<assembly.device>` wrapper is supplied by `pcb-enclosure`, later
`@tscircuit/enclosure`.

The aperture union supports:

- `pill`: `width`, `height`;
- `rect`: `width`, `height`; and
- `circle`: `radius`.

Every branch may include `margin`. The reference package uses this upstream
schema without additional props.

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

Cached subcircuits containing external metadata bypass isolation so the live
owner relationships remain available to the canonical postprocessor.

## 3. `infer-cable-insertion-point`: explicit direction precedence

**Branch/commit:** `fix/explicit-insertion-direction` / `c1eb3ce`

If `pcb_component.insertion_direction` is present, use it before pad,
silkscreen, or bounds heuristics. Geometry remains the fallback when explicit
metadata is absent.

The enclosure package uses:

- transformed insertion direction as mating-face evidence; and
- cable-point inference for board-plane placement/reach.

It never uses those heuristics to invent aperture existence or dimensions.

## 5. Canonical Circuit JSON postprocessing

Core exposes a process-global synchronous postprocessor registry.
`pcb-enclosure` registers a postprocessor that reads the imported assembly and
enclosure elements after board rendering and appends existing:

- synthetic `source_component` records;
- zero-size, non-obstructing, `do_not_place` `pcb_component` records; and
- `cad_component.model_jscad` records for base, lid, and visible hardware.

The synthetic source/PCB records satisfy the current `cad_component` ownership
contract. They are deliberately marked so they do not participate in placement
or obstacle calculations, but they are not semantically real PCB components.

Subcircuit caching is skipped when external metadata exists in the cached
subtree, so owner relationships remain live until the canonical records are
created.

## 6. `circuit-json-to-gltf`

PR #170 executes `jscad-planner` operation trees from
`cad_component.model_jscad`, converts JSCAD Z-up geometry to the renderer's
Y-up frame, and feeds the result through the normal GLTF/PoppyGL pipeline.

## 7. Eval, RunFrame, and CLI

Eval retains only the real runtime `@tscircuit/props` import needed by authored
packages. The preview-artifact host, dynamic JSCAD loader, and worker API are
removed.

RunFrame renders the same canonical Circuit JSON exposed in callbacks and the
JSON tab. There are no GLB blob URLs or CAD-only augmented copies.

CLI sequential and worker builds write the same canonical `circuit.json`.
GLB, GLTF, PoppyGL PNG, saved builds, and static viewers all consume that file,
so concurrency and process boundaries no longer require enclosure-specific
transport.

## Release / integration order

1. Release core with external roots, postprocessors, and cache safety.
2. Release props with `assemblyProps.device`.
3. Release `circuit-json-to-gltf` JSCAD-plan support.
4. Release eval, RunFrame, and CLI with the obsolete artifact path removed.
5. Publish/migrate the current package as `@tscircuit/enclosure` when the
   maintainers provide its repository skeleton.

## End-to-end acceptance

The prefab reference must demonstrate:

1. canonical Circuit JSON contains the expected synthetic source/PCB owners and
   `model_jscad` CAD records;
2. saved Circuit JSON renders the same enclosure without source TSX;
3. sequential and parallel CLI GLB/PNG/GLTF outputs include the enclosure;
4. PoppyGL renders board, components, base, lid, and hardware; and
5. STL and other manufacturing exports remain equivalent to the reference
   implementation.

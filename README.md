# pcb-enclosure

Generate an FDM-first enclosure from a rendered tscircuit board. The current
`main` implementation builds a two-part split shell (`base` + `lid`) from the
board outline, mounting holes, component heights, and connector placement.

![Prefab PCB enclosure with seven automatically aligned connector openings](./enclosure.png)

## What is available on `main`

- Board-driven shell sizing with configurable wall, floor, lid, clearance,
  standoff, headroom, and lid-lip dimensions.
- PCB mounting posts at compatible board holes using a data-driven hardware
  stack (M3 heat-set by default).
- External corner fastening ears when mounting holes do not cover the corners.
- Opt-in automatic connector openings, including USB-C aperture profiles and
  rectangular footprint-bound fallbacks.
- Visible bushings and screws with a toggleable exploded assembly view.
- Seated-assembly and board-insertion collision checks.
- Serializable JSCAD plans for the tscircuit 3D viewer and STL generation.

The `<enclosure />` child vocabulary developed on later branches is not part of
this `main` snapshot. In particular, there is no
`<enclosurecutout>`, `<standoff>`, or `<screwboss>` JSX child API here.

## Required modified upstreams

This repository currently depends on coordinated changes that have **not all
been released by upstream tscircuit packages**. A checkout using only published
package versions is not sufficient. To build and run the current implementation,
use these addibble-owned branches together:

| Repository branch | Required capability |
| --- | --- |
| [`addibble/core:enclosure-support`](https://github.com/addibble/core/tree/enclosure-support) | External intrinsic registration, part aperture serialization, and preservation of CAD model size. |
| [`addibble/circuit-json:feature/cutout-aperture`](https://github.com/addibble/circuit-json/tree/feature/cutout-aperture) | `source_component.cutout_aperture` schema. |
| [`addibble/props:feature/cutout-aperture`](https://github.com/addibble/props/tree/feature/cutout-aperture) | Typed `<cutoutaperture>` child-element props. |
| [`addibble/infer-cable-insertion-point:fix/explicit-insertion-direction`](https://github.com/addibble/infer-cable-insertion-point/tree/fix/explicit-insertion-direction) | Explicit mating direction takes precedence over geometry guessing. |
| [`addibble/eval:enclosure-support`](https://github.com/addibble/eval/tree/enclosure-support) | Browser evaluation of `.cjs` dependencies used by JSCAD tooling. |
| [`addibble/runframe:enclosure-support`](https://github.com/addibble/runframe/tree/enclosure-support) | `.cjs` delivery, embedded eval-worker use, and enclosure STL export. |
| [`addibble/3d-viewer:enclosure-support`](https://github.com/addibble/3d-viewer/tree/enclosure-support) | Per-part opacity and exploded enclosure rendering. |
| [`addibble/jscad-electronics:fix/connected-right-angle-pinrow`](https://github.com/addibble/jscad-electronics/tree/fix/connected-right-angle-pinrow) | Correct connected geometry for inverted right-angle pin rows. |

The local development setup uses these repositories as sibling checkouts and
links their builds into the dependency graph. See
[`UPSTREAM-FIXES.md`](./UPSTREAM-FIXES.md) for the problem statement, exact files,
compatibility analysis, tests, and publication status of every upstream change.

## Element usage

`<enclosure />` is an assembly-level sibling of `<board />`:

```tsx
import "pcb-enclosure/register"

export default () => (
  <group>
    <board name="B1" width="50mm" height="36mm">
      <hole pcbX={-20} pcbY={-13} diameter="3.2mm" />
      <hole pcbX={20} pcbY={-13} diameter="3.2mm" />
      <hole pcbX={20} pcbY={13} diameter="3.2mm" />
      <hole pcbX={-20} pcbY={13} diameter="3.2mm" />
    </board>

    <enclosure name="EN1" boardRef=".B1" autoCutouts />
  </group>
)
```

Supported props:

| Prop | Purpose |
| --- | --- |
| `boardRef` | Select the board to enclose, such as `.B1`. |
| `wallThickness` | Printed side-wall thickness. |
| `floorThickness` | Base floor thickness. |
| `lidThickness` | Lid top-plate thickness. |
| `boardClearance` | XY gap from PCB edge to inner wall. |
| `standoffHeight` | Gap from floor top to PCB bottom. |
| `topHeadroom` | Clearance above the tallest top-side component. |
| `lidLipDepth` | Depth of the friction-fit lid lip. |
| `anchor` | Mounting stack key, such as `m3-heat-set` or `m2-self-tap`. |
| `autoCutouts` | Opt into wall/lid openings for connectors and other deliberately profiled parts. |

## Part metadata and automatic cutouts

Parts carry their nominal opening as a composable child beside their footprint
and CAD model:

```tsx
<connector name="J1">
  <cutoutaperture
    shape="rounded_rect"
    widthMm={3.66}
    heightMm={8.34}
    cornerRadiusMm={1.83}
    zCenterAboveBoardMm={6.75}
  />
</connector>
```

This requires a coordinated data path:

1. `@tscircuit/props` defines the typed `<cutoutaperture>` child props.
2. Core registers a `CutoutAperture` primitive and lowers the child into its
   parent part's source record.
3. Circuit JSON validates the snake-case
   `source_component.cutout_aperture` representation.
4. `pcb-enclosure` extracts that metadata and uses it to size the wall or lid
   opening. Parts without it fall back to a rectangular body-bounds opening.

The footprint also declares its invariant, part-local `insertionDirection`.
Core rotates that direction with the instance's `pcbRotation` and emits the
global `pcb_component.insertion_direction`. The cable-insertion library honors
that explicit direction before using footprint/silkscreen geometry as a
fallback, then supplies the mating point used to center the opening.

Core also preserves `cadModel.size` on `cad_component.size`. Automatic detection
therefore checks the nearest cable insertion point **or model-body edge**, rather
than rejecting a connector merely because its PCB pins and component origin sit
farther inboard.

The concrete example parts under `examples/parts/` keep their supplier
footprint, silkscreen, CAD alignment, measured model bounds, insertion direction,
and `<cutoutaperture>` child together. Because it is ordinary TSX, a reusable
part can compose a default child while allowing callers to supply a replacement
child. Circuit placement code only chooses `pcbX`, `pcbY`, and `pcbRotation`.

## Example gallery

| Example | Exercises |
| --- | --- |
| `prefab-board` | Five M3 PCB posts plus seven connectors with part-embedded aperture profiles, supplier footprints, and OBJ models. |

Build and validate every example:

```bash
bun install
bun run check:examples
```

The checker verifies the emitted base/lid plans, expected post/ear/cutout counts,
hardware-compatible geometry, and seated/insertion clearance.

## Run the web UI

```bash
bun run dev
```

Open <http://localhost:3020>. The command first builds the custom element
server-side, then serves the resulting `*.circuit.json` gallery. This two-stage
flow is intentional: the browser evaluator currently exposes built-in tscircuit
elements only, while RunFrame can render the enclosure JSCAD plans from built
Circuit JSON. The dev command uses the local enclosure-enabled viewer bundle at
`../runframe/dist/standalone.min.js`.

In RunFrame:

1. Choose an example from the file selector at the top.
2. Select **3D** to inspect the assembled base, PCB, and lid.
3. Drag to orbit and scroll to zoom.
4. Right-click the viewport and open **Appearance**.
5. Click **EN1 Base** or **EN1 Lid** to cycle that part through visible,
   transparent, hidden, and back to visible.
6. Toggle **Exploded Enclosure** in the same right-click menu to keep the base
   seated while lifting the lid, bushings, and screws into separate Z layers.

The appearance icons are checked (visible), half-state `⍻` (transparent), and
blank (hidden). The same context menu also provides camera controls and
**Download GLTF**.

Use another port when needed:

```bash
bun run dev -- --port 3026
```

## Build printable STL files

```bash
bun run build:stl
```

This writes:

- `out/base.stl`
- `out/lid.stl`
- `out/pcb.stl`
- `out/viewer.html`

Open `out/viewer.html` for the standalone layered preview. The command also
prints the enclosure dimensions, mounting-hardware BOM, and collision results.

## Library layers

| Module | Responsibility |
| --- | --- |
| `lib/extract-features.ts` | Circuit JSON to board bounds, mounting points, and component bodies. |
| `lib/placement-solver.ts` | Validate PCB mounts and place uncovered corner fasteners. |
| `lib/cutouts.ts` | Resolve opt-in connector apertures and fallback openings. |
| `lib/build-enclosure.ts` | Lower the resolved design to split-shell CSG. |
| `lib/Enclosure.ts` | Integrate the generator with the tscircuit render phases. |

## License

MIT

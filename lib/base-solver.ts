/**
 * Minimal step-based solver base — a self-contained subset of
 * `@tscircuit/solver-utils`' `BaseSolver`.
 *
 * The enclosure artifact renderer can run inside the eval webworker, where the
 * file server cannot serve some `graphics-debug` assets. `@tscircuit/solver-utils`
 * does a *runtime* import of
 * `graphics-debug`, so depending on it would drag that graph into the worker.
 * The placement solver only needs the bare step/solve scaffolding, so we inline
 * it here and keep the heavy solver-utils/graphics-debug deps to dev-only
 * (scripts + the visual debugger).
 */

export interface GraphicsObject {
	points?: Array<{ x: number; y: number; label?: string; color?: string }>;
	lines?: Array<{
		points: Array<{ x: number; y: number }>;
		strokeColor?: string;
	}>;
	rects?: Array<{
		center: { x: number; y: number };
		width: number;
		height: number;
		fill?: string;
		stroke?: string;
		label?: string;
	}>;
	circles?: Array<{
		center: { x: number; y: number };
		radius: number;
		fill?: string;
		stroke?: string;
		label?: string;
	}>;
}

export class BaseSolver {
	MAX_ITERATIONS = 100e3;
	solved = false;
	failed = false;
	iterations = 0;
	error: string | null = null;
	_setupDone = false;

	getSolverName(): string {
		return this.constructor.name;
	}

	setup(): void {
		if (this._setupDone) return;
		this._setup();
		this._setupDone = true;
	}

	/** Override to perform setup logic. */
	_setup(): void {}

	step(): void {
		if (!this._setupDone) this.setup();
		if (this.solved || this.failed) return;
		this.iterations++;
		this._step();
		if (!this.solved && this.iterations >= this.MAX_ITERATIONS) {
			this.error = `${this.getSolverName()} ran out of iterations`;
			this.failed = true;
		}
	}

	/** Override to implement one step of solver logic. */
	_step(): void {}

	solve(): void {
		while (!this.solved && !this.failed) this.step();
	}

	/** Override to return the standardized output. */
	getOutput(): any {
		return null;
	}

	/** Override to return a GraphicsObject representing the current state. */
	visualize(): GraphicsObject {
		return { points: [], lines: [], rects: [], circles: [] };
	}

	getConstructorParams(): any {
		return {};
	}
}

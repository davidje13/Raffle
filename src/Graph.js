'use strict';

const pick_grid = (() => {
	const LOG_AXIS_LIMIT = 1e2;

	function pick_primary(v, {factor, divisors}) {
		const base = 1 / Math.log(factor);
		const ln = Math.log(v) * base;
		let best = Math.ceil(ln);
		for(const divisor of divisors) {
			const shift = Math.log(divisor) * base;
			best = Math.min(best, Math.ceil(ln - shift) + shift);
		}
		return Math.pow(factor, best);
	}

	function pick_divisor(v, limit, {factor, divisors}) {
		let bestD = 1;
		for(const divisor of [factor, ...divisors]) {
			if(divisor > bestD && limit * divisor < v) {
				bestD = divisor;
			}
		}
		return bestD;
	}

	function pick_grid_lin(vis, label, sepMajor, sepMinor) {
		/*
		 * Find the highest sample resolution with no overlaps:
		 *
		 * step * r / (max - min) >= spacing ; step = 10^n
		 * n + log10(r) - log10(max - min) >= log10(spacing)
		 * n >= log10(spacing) - log10(r) + log10(max - min)
		 */

		const result = {major: [], minor: []};

		const scale = (vis.max - vis.min) / Math.abs(vis.r);
		let step = pick_primary(sepMajor * scale, label);
		if(label.minStep > 0) {
			step = Math.ceil(step / label.minStep - 0.01) * label.minStep;
			step = Math.max(step, label.minStep);
		} else if(step <= 0) {
			step = 1;
		}

		const stepDiv = pick_divisor(step, sepMinor * scale, label);
		const stepMinor = step / stepDiv;

		const begin = Math.ceil(vis.min / stepMinor);
		const limit = Math.floor(vis.max / stepMinor);
		for(let i = begin; i <= limit; ++ i) {
			if(i % stepDiv === 0) {
				result.major.push(i * stepMinor);
			} else {
				result.minor.push(i * stepMinor);
			}
		}

		return result;
	}

	function prep_pick_log(vis, label, sepMajor) {
		const sep = Math.exp(sepMajor * vis.lr / Math.abs(vis.r));
		const delta = vis.log * (sep - 1);
		const factorMult = 1 / Math.log(label.factor);
		const logBase = Math.log(label.minStep || 1) * factorMult;

		return {
			allow: (p) => (p <= vis.max),

			minor_after: (p) => ({
				begin: p * 2,
				limit: Math.min(
					p * label.factor - p / 2,
					vis.max - p / label.factor / 2
				),
				step: p,
			}),

			minor_before: (p) => {
				const step = p / label.factor;
				return {
					begin: (Math.floor(vis.min / step) + 1) * step,
					limit: Math.min(p, vis.max) - step / 2,
					step,
				};
			},

			p_begin: () => {
				if(label.minStep > 0) {
					return Math.ceil(vis.min / label.minStep) * label.minStep;
				} else {
					return vis.min;
				}
			},

			p_final: (lastP) => {
				let p = vis.max;
				if(label.minStep > 0) {
					p = Math.floor(p / label.minStep) * label.minStep;
				}
				if(p >= lastP * sep + delta) {
					return p;
				} else {
					return Number.POSITIVE_INFINITY;
				}
			},

			p_next: (lastP) => Math.max(
				Math.pow(
					label.factor,
					Math.ceil(
						Math.log(lastP * sep + delta) * factorMult
						- logBase
					) + logBase
				),
				label.minStep
			),

			populate: (list, {begin, limit, step}) => {
				for(let m = begin; m < limit; m += step) {
					list.push(m);
				}
			},
		};
	}

	function pick_grid_log(vis, label, sepMajor) {
		const result = {major: [], minor: []};

		const picker = prep_pick_log(vis, label, sepMajor);

		let p = picker.p_begin();
		let lastP = p;

		let first = true;
		while(picker.allow(p)) {
			result.major.push(p);

			if(!first) {
				picker.populate(result.minor, picker.minor_after(p));
			}

			lastP = p;
			p = picker.p_next(p);

			if(first) {
				picker.populate(result.minor, picker.minor_before(p));
				first = false;
			}
		}

		p = picker.p_final(lastP);
		if(picker.allow(p)) {
			result.major.push(p);
		}

		return result;
	}

	function fn_pick_grid(vis, label, sepMajor, sepMinor) {
		if(vis.log < LOG_AXIS_LIMIT) {
			return pick_grid_log(vis, label, sepMajor);
		} else {
			return pick_grid_lin(vis, label, sepMajor, sepMinor);
		}
	}

	return fn_pick_grid;
})();

(() => {
	const {UIUtils} = window;
	const {make, res} = UIUtils;

	const LOG_LIMIT = 1e6;

	function make_canvas(width, height) {
		const canvas = make('canvas');
		canvas.width = width * res;
		canvas.height = height * res;
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		return canvas;
	}

	function make_empty_range(begin, range) {
		return {
			log: Number.POSITIVE_INFINITY,
			lr: 0,
			ls: 0,
			max: 0,
			min: 0,
			r: range,
			s: begin,
		};
	}

	function set_range(vis, {min = null, max = null, log = null}) {
		if(min !== null) {
			vis.min = min;
		}
		if(max !== null) {
			vis.max = max;
		}
		if(log !== null) {
			vis.log = log;
		}
	}

	function make_empty_label() {
		return {
			divisors: [5, 2],
			factor: 10,
			label: '',
			minStep: 0,
			values: (v) => String(v),
		};
	}

	function set_label(lbl, {
		divisors = null,
		factor = null,
		label = null,
		minStep = null,
		values = null,
	}) {
		if(divisors !== null) {
			lbl.divisors = divisors;
		}
		if(factor !== null) {
			lbl.factor = factor;
		}
		if(label !== null) {
			lbl.label = label;
		}
		if(minStep !== null) {
			lbl.minStep = minStep;
		}
		if(values !== null) {
			lbl.values = values;
		}
	}

	function update_log_scales(v) {
		if(v.log < LOG_LIMIT) {
			v.ls = Math.log(v.min + v.log);
			v.lr = Math.log(v.max + v.log) - v.ls;
		} else {
			v.ls = v.min;
			v.lr = v.max - v.min;
		}
	}

	function coord_to_pt(p, {log, lr, ls, r, s}) {
		const pp = (log < LOG_LIMIT) ? Math.log(p + log) : p;
		return (pp - ls) * r / lr + s;
	}

	function pt_to_coord(p, {log, lr, ls, r, s}) {
		const pp = (p - s) * lr / r + ls;
		return (log < LOG_LIMIT) ? Math.exp(pp) - log : pp;
	}

	class Graph {
		constructor(width, height) {
			this.width = width;
			this.height = height;
			this.lineW = 1.5;

			this.visX = make_empty_range(
				0.5 * this.lineW * res,
				(width - this.lineW) * res
			);
			this.visY = make_empty_range(
				(height - 0.5 * this.lineW) * res,
				(this.lineW - height) * res
			);
			this.labelX = make_empty_label();
			this.labelY = make_empty_label();

			this.data = [];

			this.build_dom();
		}

		build_dom() {
			this.canvas = make_canvas(this.width, this.height);
			this.context = this.canvas.getContext('2d');
			this.context.lineCap = 'square';

			this.fLabelX = make('div', {'class': 'label x'});
			this.fLabelY = make('div', {'class': 'label y'});
			this.fValuesX = make('div', {'class': 'values x'});
			this.fValuesY = make('div', {'class': 'values y'});

			this.container = make('div', {'class': 'graph'}, [
				this.canvas,
				this.fValuesX,
				this.fValuesY,
				this.fLabelX,
				this.fLabelY,
			]);
		}

		update_log_scales() {
			update_log_scales(this.visX);
			update_log_scales(this.visY);
		}

		set_x_range(options) {
			set_range(this.visX, options);
			this.update_log_scales();
		}

		set_y_range(options) {
			set_range(this.visY, options);
			this.update_log_scales();
		}

		set_x_label(options) {
			set_label(this.labelX, options);
		}

		set_y_label(options) {
			set_label(this.labelY, options);
		}

		set(data, {updateBounds = true} = {}) {
			this.data = data;
			if(!updateBounds) {
				return;
			}
			this.visX.min = Number.POSITIVE_INFINITY;
			this.visY.min = Number.POSITIVE_INFINITY;
			this.visX.max = Number.NEGATIVE_INFINITY;
			this.visY.max = Number.NEGATIVE_INFINITY;
			this.data.forEach(({points}) => points.forEach(({x, y}) => {
				this.visX.min = Math.min(this.visX.min, x);
				this.visY.min = Math.min(this.visY.min, y);
				this.visX.max = Math.max(this.visX.max, x);
				this.visY.max = Math.max(this.visY.max, y);
			}));
			this.update_log_scales();
		}

		coord_to_pt_x(x) {
			return coord_to_pt(x, this.visX);
		}

		coord_to_pt_y(y) {
			return coord_to_pt(y, this.visY);
		}

		coord_to_pt({x, y}) {
			return {
				x: coord_to_pt(x, this.visX),
				y: coord_to_pt(y, this.visY),
			};
		}

		pt_to_coord_x(x) {
			return pt_to_coord(x, this.visX);
		}

		pt_to_coord_y(y) {
			return pt_to_coord(y, this.visY);
		}

		pt_to_coord({x, y}) {
			return {
				x: pt_to_coord(x, this.visX),
				y: pt_to_coord(y, this.visY),
			};
		}

		draw_curve_line(from, to) {
			const p0 = this.pt_to_coord(from);
			const p1 = this.pt_to_coord(to);
			const step = res * 2 * ((to.x < from.x) ? -1 : 1);
			const n = Math.floor((to.x - from.x) / step);
			const m = (p1.y - p0.y) / (p1.x - p0.x);
			const b = p0.y - p0.x * m;
			for(let i = 0; i < n; ++ i) {
				const x = from.x + i * step;
				const y = this.coord_to_pt_y(this.pt_to_coord_x(x) * m + b);
				this.context.lineTo(x, y);
			}
			this.context.lineTo(to.x, to.y);
		}

		draw_line(from, to) {
			if(from === null) {
				this.context.moveTo(to.x, to.y);
			} else if(
				to.x !== from.x
				&& to.y !== from.y
				&& (this.visY.log < LOG_LIMIT || this.visX.log < LOG_LIMIT)
			) {
				this.draw_curve_line(from, to);
			} else {
				this.context.lineTo(to.x, to.y);
			}
		}

		draw_lines_x(lines, style) {
			this.context.strokeStyle = style;
			this.context.lineWidth = res;
			for(const x of lines) {
				const xx = Math.round(this.coord_to_pt_x(x));
				this.context.beginPath();
				this.context.moveTo(xx, 0);
				this.context.lineTo(xx, this.height * res);
				this.context.stroke();
			}
		}

		draw_lines_y(lines, style) {
			this.context.strokeStyle = style;
			this.context.lineWidth = res;
			for(const y of lines) {
				const yy = Math.round(this.coord_to_pt_y(y));
				this.context.beginPath();
				this.context.moveTo(0, yy);
				this.context.lineTo(this.width * res, yy);
				this.context.stroke();
			}
		}

		render() {
			this.context.clearRect(0, 0, this.width * res, this.height * res);

			// Gridlines
			const gridX = pick_grid(this.visX, this.labelX, 60 * res, 5 * res);
			const gridY = pick_grid(this.visY, this.labelY, 20 * res, 5 * res);

			this.draw_lines_x(gridX.minor, 'rgba(0,0,0,0.02)');
			this.draw_lines_y(gridY.minor, 'rgba(0,0,0,0.02)');
			this.draw_lines_x(gridX.major, 'rgba(0,0,0,0.1)');
			this.draw_lines_y(gridY.major, 'rgba(0,0,0,0.1)');

			// Data
			this.data.forEach(({points, style, width}) => {
				this.context.strokeStyle = style || '#000000';
				this.context.lineWidth = (width || this.lineW) * res;
				this.context.beginPath();
				let lastPt = null;
				points.forEach((pt) => {
					const p = this.coord_to_pt(pt);
					this.draw_line(lastPt, p);
					lastPt = p;
				});
				this.context.stroke();
			});

			// X Axis
			this.fLabelX.textContent = this.labelX.label;
			this.fValuesX.textContent = '';
			for(const x of gridX.major) {
				const o = make('span', {}, [this.labelX.values(x)]);
				o.style.left = this.coord_to_pt_x(x) / res;
				this.fValuesX.appendChild(o);
			}

			// Y Axis
			this.fLabelY.textContent = this.labelY.label;
			this.fValuesY.textContent = '';
			for(const y of gridY.major) {
				const o = make('span', {}, [this.labelY.values(y)]);
				o.style.top = this.coord_to_pt_y(y) / res;
				this.fValuesY.appendChild(o);
			}
		}

		dom() {
			return this.container;
		}
	}

	if(typeof module === 'object') {
		module.exports = Graph;
	} else {
		window.Graph = Graph;
	}
})();

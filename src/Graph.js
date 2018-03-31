'use strict';

(() => {
	const LOG_LIMIT = 1e6;
	const LOG_AXIS_LIMIT = 1e2;
	const res = window.devicePixelRatio || 1;
	window.devicePixelRatio = 1;

	function makeText(text = '') {
		return document.createTextNode(text);
	}

	function setAttributes(target, attrs) {
		for(const k in attrs) {
			if(Object.prototype.hasOwnProperty.call(attrs, k)) {
				target.setAttribute(k, attrs[k]);
			}
		}
	}

	function make(type, attrs = {}, children = []) {
		const o = document.createElement(type);
		setAttributes(o, attrs);
		for(const c of children) {
			if(typeof c === 'string') {
				o.appendChild(makeText(c));
			} else {
				o.appendChild(c);
			}
		}
		return o;
	}

	function make_canvas(width, height) {
		const canvas = make('canvas');
		canvas.width = width * res;
		canvas.height = height * res;
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		return canvas;
	}

	function set_range(v, {min = null, max = null, log = null}) {
		if(min !== null) {
			v.min = min;
		}
		if(max !== null) {
			v.max = max;
		}
		if(log !== null) {
			v.log = log;
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

	function pick_values({log, max, min, r}, {minStep}, spacing) {
		const result = [];

		if(log < LOG_AXIS_LIMIT) {
			result.push(min);
			result.push(max);
		} else {
			/*
			 * Find the highest sample resolution with no overlaps:
			 *
			 * step * r / (max - min) >= spacing ; step = 10^n
			 * n + log10(r) - log10(max - min) >= log10(spacing)
			 * n >= log10(spacing) - log10(r) + log10(max - min)
			 */

			const lnStep = (
				Math.log10(spacing)
				- Math.log10(Math.abs(r))
				+ Math.log10(max - min)
			);
			const step10 = Math.ceil(lnStep);
			const step20 = Math.ceil(lnStep - Math.log10(2)) + Math.log10(2);
			const step50 = Math.ceil(lnStep - Math.log10(5)) + Math.log10(5);

			let step = Math.pow(10, Math.min(
				step10,
				Math.min(step20, step50)
			));
			if(minStep > 0) {
				step = Math.ceil(step / minStep - 0.01) * minStep;
				step = Math.max(step, minStep);
			} else if(step <= 0) {
				step = 1;
			}
			const begin = Math.round(min / step) * step;
			for(let i = begin; i <= max; i += step) {
				result.push(i);
			}
		}

		return result;
	}

	class Graph {
		constructor(width, height) {
			this.width = width;
			this.height = height;
			this.lineW = 1.5;

			this.visX = {
				log: Number.POSITIVE_INFINITY,
				lr: 0,
				ls: 0,
				max: 0,
				min: 0,
				r: (width - this.lineW) * res,
				s: 0.5 * this.lineW * res,
			};
			this.visY = {
				log: Number.POSITIVE_INFINITY,
				lr: 0,
				ls: 0,
				max: 0,
				min: 0,
				r: (this.lineW - height) * res,
				s: (height - 0.5 * this.lineW) * res,
			};
			this.labelX = {label: '', minStep: 0, values: (v) => String(v)};
			this.labelY = {label: '', minStep: 0, values: (v) => String(v)};

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

		set_x_label(label, values, minStep = 0) {
			this.labelX = {label, minStep, values};
		}

		set_y_label(label, values, minStep = 0) {
			this.labelY = {label, minStep, values};
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

		render_axes() {
			this.fLabelX.textContent = this.labelX.label;
			this.fLabelY.textContent = this.labelY.label;
			this.fValuesX.textContent = '';
			this.fValuesY.textContent = '';
			for(const x of pick_values(this.visX, this.labelX, 60 * res)) {
				const o = make('span', {}, [this.labelX.values(x)]);
				o.style.left = this.coord_to_pt_x(x) / res;
				this.fValuesX.appendChild(o);
			}
			for(const y of pick_values(this.visY, this.labelY, 20 * res)) {
				const o = make('span', {}, [this.labelY.values(y)]);
				o.style.top = this.coord_to_pt_y(y) / res;
				this.fValuesY.appendChild(o);
			}
		}

		render() {
			this.context.clearRect(0, 0, this.width * res, this.height * res);
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
			this.render_axes();
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

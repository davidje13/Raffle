'use strict';

(() => {
	const LOG_LIMIT = 1e6;
	const res = window.devicePixelRatio || 1;
	window.devicePixelRatio = 1;

	function make_canvas(width, height) {
		const canvas = document.createElement('canvas');
		canvas.width = width * res;
		canvas.height = height * res;
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		return canvas;
	}

	class Graph {
		constructor(width, height) {
			this.width = width * res;
			this.height = height * res;
			this.lineW = 1.5;

			this.vis = {
				h: (this.lineW - height) * res,
				w: (width - this.lineW) * res,
				x: 0.5 * this.lineW * res,
				y: (height - 0.5 * this.lineW) * res,
			};

			this.canvas = make_canvas(width, height);
			this.context = this.canvas.getContext('2d');
			this.data = [];
			this.bounds = {
				maxx: 0,
				maxy: 0,
				minx: 0,
				miny: 0,
			};
			this.lminx = 0;
			this.lminy = 0;
			this.ldx = 0;
			this.ldy = 0;

			this.logX = Number.POSITIVE_INFINITY;
			this.logY = Number.POSITIVE_INFINITY;
		}

		update_log_scales() {
			const b = this.bounds;
			if(this.logX < LOG_LIMIT) {
				this.lminx = Math.log(b.minx + this.logX);
				this.ldx = Math.log(b.maxx + this.logX) - this.lminx;
			} else {
				this.lminx = b.minx;
				this.ldx = b.maxx - b.minx;
			}
			if(this.logY < LOG_LIMIT) {
				this.lminy = Math.log(b.miny + this.logY);
				this.ldy = Math.log(b.maxy + this.logY) - this.lminy;
			} else {
				this.lminy = b.miny;
				this.ldy = b.maxy - b.miny;
			}
		}

		set_x_range({
			min = null,
			max = null,
			log = Number.POSITIVE_INFINITY,
		}) {
			if(min !== null) {
				this.bounds.minx = min;
			}
			if(max !== null) {
				this.bounds.maxx = max;
			}
			this.logX = log;
			this.update_log_scales();
		}

		set_y_range({
			min = null,
			max = null,
			log = Number.POSITIVE_INFINITY,
		}) {
			if(min !== null) {
				this.bounds.miny = min;
			}
			if(max !== null) {
				this.bounds.maxy = max;
			}
			this.logY = log;
			this.update_log_scales();
		}

		set(data) {
			this.data = data;
			const b = this.bounds;
			b.minx = Number.POSITIVE_INFINITY;
			b.miny = Number.POSITIVE_INFINITY;
			b.maxx = Number.NEGATIVE_INFINITY;
			b.maxy = Number.NEGATIVE_INFINITY;
			this.data.forEach(({x, y}) => {
				b.minx = Math.min(b.minx, x);
				b.miny = Math.min(b.miny, y);
				b.maxx = Math.max(b.maxx, x);
				b.maxy = Math.max(b.maxy, y);
			});
			this.update_log_scales();
		}

		coord_to_pt_x(x) {
			const xx = (this.logX < LOG_LIMIT) ? Math.log(x + this.logX) : x;
			return (xx - this.lminx) * this.vis.w / this.ldx + this.vis.x;
		}

		coord_to_pt_y(y) {
			const yy = (this.logY < LOG_LIMIT) ? Math.log(y + this.logY) : y;
			return (yy - this.lminy) * this.vis.h / this.ldy + this.vis.y;
		}

		coord_to_pt({x, y}) {
			return {
				x: this.coord_to_pt_x(x),
				y: this.coord_to_pt_y(y),
			};
		}

		pt_to_coord_x(x) {
			const xx = (x - this.vis.x) * this.ldx / this.vis.w + this.lminx;
			return (this.logX < LOG_LIMIT) ? Math.exp(xx) - this.logX : xx;
		}

		pt_to_coord_y(y) {
			const yy = (y - this.vis.y) * this.ldy / this.vis.h + this.lminy;
			return (this.logY < LOG_LIMIT) ? Math.exp(yy) - this.logY : yy;
		}

		pt_to_coord({x, y}) {
			return {
				x: this.pt_to_coord_x(x),
				y: this.pt_to_coord_y(y),
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
				&& (this.logY < LOG_LIMIT || this.logX < LOG_LIMIT)
			) {
				this.draw_curve_line(from, to);
			} else {
				this.context.lineTo(to.x, to.y);
			}
		}

		render() {
			this.context.lineWidth = this.lineW * res;
			this.context.clearRect(0, 0, this.width, this.height);
			this.context.beginPath();
			let lastPt = null;
			this.data.forEach((pt) => {
				const p = this.coord_to_pt(pt);
				this.draw_line(lastPt, p);
				lastPt = p;
			});
			this.context.stroke();
		}

		dom() {
			return this.canvas;
		}
	}

	if(typeof module === 'object') {
		module.exports = Graph;
	} else {
		window.Graph = Graph;
	}
})();

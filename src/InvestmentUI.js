'use strict';

(() => {
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

	function make_ticket_order(min, max, step) {
		const r = [];
		for(let i = min; i <= max; i += step) {
			r.push(i);
		}
		const r2 = [];
		// There is likely a bettery way!
		for(let stride = r.length - 1; stride > 0; stride >>= 1) {
			for(let i = 0; i < r.length; i += stride) {
				if(r[i] !== null) {
					r2.push({i, v: r[i]});
					r[i] = null;
				}
			}
		}
		return r2;
	}

	const SHOW_VALUE = 0;
	const SHOW_PERCENT = 1;

	class InvestmentUI {
		constructor({
			GraphClass,
			markers,
			maxTickets,
			minTickets,
			stepTickets,
			ticketCost,
		}) {
			this.GraphClass = GraphClass;
			this.maxMonths = 36;
			this.ticketCost = ticketCost;
			this.currencySymbol = '\u00A3';
			this.ticketOrder = make_ticket_order(
				minTickets,
				maxTickets,
				stepTickets
			);

			this.raffle = null;
			this.results = [];
			this.loaded = 0;

			this.lastMonths = 12;
			this.lastShow = SHOW_VALUE;

			this.update = this.update.bind(this);

			const form = make('form', {'action': '#'}, [
				this.build_options(),
				this.build_graph(),
				this.build_key(markers),
				make('button', {
					'class': 'tabulate',
					'disabled': 'disabled',
					'type': 'button',
				}, ['Tabulate']),
			]);
			form.addEventListener('submit', (e) => e.preventDefault());
			this.section = make('section', {'class': 'investment'}, [form]);
		}

		money(v) {
			return this.currencySymbol + v.toFixed(2);
		}

		build_options() {
			this.fMonths = make('input', {
				'max': this.maxMonths,
				'min': '1',
				'step': '1',
				'type': 'number',
				'value': this.lastMonths,
			});
			this.fMonths.addEventListener('input', this.update);

			this.fWinTake = make('input', {
				'checked': 'checked',
				'name': 'winnings',
				'type': 'radio',
			});
			this.fWinInvest = make('input', {
				'disabled': 'disabled',
				'name': 'winnings',
				'type': 'radio',
			});

			this.fShowValue = make('input', {
				'checked': 'checked',
				'name': 'show',
				'type': 'radio',
			});
			this.fShowValue.addEventListener('change', this.update);
			this.fShowPercent = make('input', {
				'name': 'show',
				'type': 'radio',
			});
			this.fShowPercent.addEventListener('change', this.update);

			return make('div', {'class': 'options'}, [
				make('div', {'class': 'optarea left'}, [
					make('label', {}, [
						this.fMonths,
						' months',
					]),
				]),
				make('div', {'class': 'optarea left'}, [
					make('label', {}, [
						this.fWinTake,
						make('span', {}, ['Take winnings']),
					]),
					make('br'),
					make('label', {}, [
						this.fWinInvest,
						make('span', {}, [
							'Reinvest winnings',
							make('br'),
							'(compound interest)',
						]),
					]),
				]),
				make('div', {'class': 'optarea left'}, [
					make('label', {}, [
						this.fShowValue,
						make('span', {}, ['Value']),
					]),
					make('br'),
					make('label', {}, [
						this.fShowPercent,
						make('span', {}, ['Percent']),
					]),
				]),
			]);
		}

		build_graph() {
			this.graph = new this.GraphClass(498, 248);
			this.graph.set_x_label(
				'Tickets',
				(v) => v.toFixed(0),
				1
			);

			this.loader = make('div', {'class': 'loader'});
			this.loader.style.top = '20px';
			this.loader.style.right = '20px';

			return make('div', {'class': 'graph_hold'}, [
				this.graph.dom(),
				this.loader,
			]);
		}

		build_key(markers) {
			const key = make('ul', {'class': 'key'});
			this.markers = [];
			markers.forEach((m) => {
				let o = null;
				if(m.value) {
					const marker = {
						col: m.col,
						value: m.value,
					};
					o = make('li', {'style': `color: ${m.col}`}, [m.name]);
					this.markers.push(marker);
				} else {
					o = make('li', {'class': 'header'}, [m.name]);
				}
				key.appendChild(o);
			});
			return key;
		}

		set_raffle(raffle) {
			if(this.raffle === raffle) {
				return;
			}
			this.raffle = raffle;
			this.lastMonths = null;
			this.update();
		}

		update_months(months) {
			if(months === this.lastMonths || !this.raffle || !(months > 0)) {
				return;
			}
			this.lastMonths = months;

			this.loaded = 0;
			this.results.length = 0;
			const nonce = {};
			this.resultsNonce = nonce;
			this.ticketOrder.forEach(({i, v}) => {
				this.results[i] = null;
				this.raffle.enter(v)
					.then((result) => result.pow(months, {pCutoff: 1e-10}))
					.then((result) => {
						if(this.resultsNonce === nonce) {
							this.results[i] = result;
							this.lastShow = null;
							++ this.loaded;
							this.debounce_got_result();
						}
					})
					.catch(() => {
						if(this.resultsNonce === nonce) {
							++ this.loaded;
							this.debounce_got_result();
						}
					});
			});
		}

		update_show(show) {
			if(show === this.lastShow) {
				return;
			}
			this.lastShow = show;

			this.redraw_graph();
		}

		update() {
			clearTimeout(this.tmUpdate);
			this.tmUpdate = null;

			this.update_months(Number.parseInt(this.fMonths.value, 10));
			this.update_show(
				this.fShowValue.checked
					? SHOW_VALUE
					: SHOW_PERCENT
			);

			if(this.loaded < this.results.length) {
				this.begin_loading();
			} else {
				this.end_loading();
			}
		}

		debounce_got_result() {
			if(!this.tmUpdate) {
				this.tmUpdate = setTimeout(this.update, 0);
			}
		}

		do_begin_loading() {
			this.loader.style.display = 'block';
		}

		begin_loading() {
			if(this.loadingNonce !== null) {
				return;
			}

			const nonce = {};
			this.loadingNonce = nonce;
			setTimeout(() => {
				if(this.loadingNonce === nonce) {
					this.do_begin_loading();
				}
			}, 50);
		}

		end_loading() {
			this.loadingNonce = null;
			this.loader.style.display = 'none';
		}

		redraw_graph() {
			const data = this.markers.map((m) => ({
				points: [{x: 0, y: 0}],
				style: m.col,
			}));

			const show = this.lastShow;

			if(show === SHOW_VALUE) {
				this.graph.set_y_label(
					`Value (${this.currencySymbol})`,
					(v) => (this.currencySymbol + v.toFixed(0)),
					1
				);
			} else {
				this.graph.set_y_label(
					'Value / Capital (%)',
					(v) => `${v.toFixed(3)}%`,
					0.001
				);
			}

			this.results.forEach((r) => {
				if(!r) {
					return;
				}
				const tickets = r.tickets();
				const mPercent = 100 / (tickets * this.ticketCost);

				this.markers.forEach((m, i) => {
					const v = m.value(r);
					const pt = {x: tickets, y: null};
					if(show === SHOW_VALUE) {
						pt.y = v;
					} else if(show === SHOW_PERCENT) {
						pt.y = v * mPercent;
					}
					data[i].points.push(pt);
				});
			});

			this.graph.set(data, {updateBounds: true});
			this.graph.render();
		}

		dom() {
			return this.section;
		}
	}

	if(typeof module === 'object') {
		module.exports = InvestmentUI;
	} else {
		window.InvestmentUI = InvestmentUI;
	}
})();

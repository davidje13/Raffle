'use strict';

if(typeof require !== 'function') {
	window.require = (name) => window[name.replace('./', '')];
}

(() => {
	const UIUtils = require('./UIUtils');
	const {make} = UIUtils;

	function make_ticket_order(min, max, step) {
		const r = [];
		for(let i = min; i <= max; i += step) {
			r.push(i);
		}

		// There is likely a bettery way!

		const r2 = [];

		let NPoT = 1;
		while(NPoT < r.length) {
			NPoT <<= 1;
		}

		const add = (i) => {
			if(r[i] !== null) {
				r2.push({i, v: r[i]});
				r[i] = null;
			}
		};

		add(0);
		add(r.length - 1);

		for(let stride = NPoT; stride > 1; stride >>= 1) {
			for(let i = 0; i < NPoT; i += stride) {
				add(Math.floor(i * r.length / NPoT));
			}
		}
		for(let i = 0; i < r.length; ++ i) {
			add(i);
		}
		return r2;
	}

	function read_ui_num(field, low, high = Number.POSITIVE_INFINITY) {
		return Math.max(Math.min(Number.parseInt(field.value, 10), high), low);
	}

	const WINNINGS_TAKE = 0;
	const WINNINGS_INVEST = 1;

	const SHOW_VALUE = 0;
	const SHOW_PERCENT = 1;

	const pCutoff = 1e-10;

	class InvestmentUI {
		constructor({
			GraphClass,
			currencyCode,
			markers,
			maxTickets,
			minTickets,
			stepTickets,
			stepTicketsLowRes = 0,
			ticketCost = 1,
		}) {
			this.GraphClass = GraphClass;
			this.maxMonths = 36;
			this.ticketCost = ticketCost;
			this.maxTickets = maxTickets;
			this.ticketOrder = make_ticket_order(
				minTickets,
				maxTickets,
				stepTickets
			);
			this.ticketOrderLowRes = make_ticket_order(
				minTickets,
				maxTickets,
				stepTicketsLowRes || stepTickets
			);

			this.fmtCount = UIUtils.make_formatter({});
			this.fmtValue = UIUtils.make_formatter({
				currency: currencyCode,
				minimumFractionDigits: 0,
				style: 'currency',
			});
			this.fmtRatio = UIUtils.make_formatter({
				minimumFractionDigits: 2,
				style: 'percent',
			});

			this.raffle = null;
			this.results = [];
			this.loading = 0;

			this.lastWinnings = WINNINGS_TAKE;
			this.lastMonths = 12;
			this.lastShow = SHOW_VALUE;

			this.update = this.update.bind(this);

			this.build_ui(markers);
		}

		build_ui(markers) {
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
			this.fWinTake.addEventListener('change', this.update);
			this.fWinInvest = make('input', {
				'name': 'winnings',
				'type': 'radio',
			});
			this.fWinInvest.addEventListener('change', this.update);

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
			this.graph.set_x_label({
				label: 'Tickets',
				minStep: 1,
				values: this.fmtCount,
			});

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
					o = make('li', {}, [m.name]);
					o.style.color = m.col;
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
			this.lastWinnings = null;
			this.update();
		}

		update_winnings(winnings) {
			if(winnings === this.lastWinnings) {
				return;
			}
			this.lastWinnings = winnings;
			this.lastMonths = null;
		}

		update_months(months) {
			if(months === this.lastMonths || !this.raffle || !(months > 0)) {
				return;
			}
			this.lastMonths = months;

			this.loading = 0;
			this.results.length = 0;
			const nonce = {};
			this.resultsNonce = nonce;
			let order = null;

			switch(this.lastWinnings) {
			case WINNINGS_TAKE:
				order = this.ticketOrder;
				break;
			case WINNINGS_INVEST:
				order = this.ticketOrderLowRes;
				break;
			}

			order.forEach(({i, v}) => {
				this.results[i] = null;
				++ this.loading;

				let promise = null;
				switch(this.lastWinnings) {
				case WINNINGS_TAKE:
					promise = this.raffle.enter(v, {priority: 20})
						.then((result) => result.pow(months, {
							pCutoff,
							priority: 30,
						}));
					break;
				case WINNINGS_INVEST:
					promise = this.raffle.compound(v, months, {
						maxTickets: this.maxTickets,
						priority: 10,
						ticketCost: this.ticketCost,
					});
					break;
				}

				promise
					.then((result) => {
						if(this.resultsNonce === nonce) {
							this.results[i] = result;
							this.lastShow = null;
							-- this.loading;
							this.debounce_got_result();
						}
					})
					.catch(() => {
						if(this.resultsNonce === nonce) {
							-- this.loading;
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

			this.update_winnings(
				this.fWinTake.checked
					? WINNINGS_TAKE
					: WINNINGS_INVEST
			);
			this.update_months(read_ui_num(this.fMonths, 1, this.maxMonths));
			this.update_show(
				this.fShowValue.checked
					? SHOW_VALUE
					: SHOW_PERCENT
			);

			if(this.loading > 0) {
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
			this.redraw_graph();
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
				points: [],
				style: m.col,
			}));

			const show = this.lastShow;

			switch(show) {
			case SHOW_VALUE:
				this.graph.set_y_label({
					label: 'Value',
					minStep: 1,
					values: this.fmtValue,
				});
				this.graph.set_y_range({log: Number.POSITIVE_INFINITY});
				break;
			case SHOW_PERCENT:
				this.graph.set_y_label({
					label: 'Value / Capital',
					minStep: 0.0001,
					values: this.fmtRatio,
				});
				this.graph.set_y_range({log: 0.002});
				break;
			}

			this.results.forEach((r) => {
				if(!r) {
					return;
				}
				const tickets = r.tickets();
				const mPercent = (tickets > 0)
					? 1 / (tickets * this.ticketCost)
					: 0;

				this.markers.forEach((m, i) => {
					const v = m.value(r);
					const pt = {x: tickets, y: null};
					switch(show) {
					case SHOW_VALUE:
						pt.y = v;
						break;
					case SHOW_PERCENT:
						pt.y = v * mPercent;
						break;
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

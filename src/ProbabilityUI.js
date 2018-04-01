'use strict';

if(typeof require !== 'function') {
	window.require = (name) => window[name.replace('./', '')];
}

(() => {
	const UIUtils = require('./UIUtils');
	const {make, odds} = UIUtils;

	function get_graph_pvalue_data(result) {
		const data = [{x: 0, y: 1}];
		let lastV = null;
		for(const i of result.values()) {
			const p = result.range_probability(i, Number.POSITIVE_INFINITY);
			if(lastV !== null) {
				data.push({x: lastV, y: p});
			}
			data.push({x: i, y: p});
			lastV = i;
		}
		data.push({x: lastV, y: 0});
		return data;
	}

	function read_ui_num(field, low, high = Number.POSITIVE_INFINITY) {
		return Math.max(Math.min(Number.parseInt(field.value, 10), high), low);
	}

	function y_line(x) {
		return [{x, y: 0}, {x, y: 1}];
	}

	function only12(ratio, months) {
		return (months === 12) ? ratio : Number.NaN;
	}

	const WINNINGS_TAKE = 0;
	const WINNINGS_INVEST = 1;

	const pCutoff = 1e-10;

	class ProbabilityUI {
		constructor({
			GraphClass,
			currencyCode,
			defaultTickets = 1,
			graphLimit,
			markers = [],
			maxTickets = Number.POSITIVE_INFINITY,
			ticketCost = 1,
		}) {
			this.GraphClass = GraphClass;
			this.maxMonths = 36;
			this.maxTickets = maxTickets;
			this.ticketCost = ticketCost;
			this.graphLimit = graphLimit;

			this.fmtMoney = UIUtils.make_formatter({
				currency: currencyCode,
				style: 'currency',
			});

			this.fmtMoneyNoDP = UIUtils.make_formatter({
				currency: currencyCode,
				minimumFractionDigits: 0,
				style: 'currency',
			});

			this.fmtProb = UIUtils.make_formatter({
				maximumFractionDigits: 3,
				minimumFractionDigits: 3,
			});

			this.fmtAPR = UIUtils.make_formatter({
				minimumFractionDigits: 2,
				post: ' APR',
				style: 'percent',
			});

			this.currencySymbol = UIUtils.currency_symbol(currencyCode);

			this.raffle = null;
			this.result = null;
			this.power = null;

			this.lastTickets = defaultTickets;
			this.lastWinnings = WINNINGS_TAKE;
			this.lastMonths = 12;
			this.lastOddsRequest = 500;

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
			this.section = make('section', {'class': 'probability'}, [form]);
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
			this.fTickets = make('input', {
				'max': this.maxTickets,
				'min': '1',
				'step': '1',
				'type': 'number',
				'value': this.lastTickets,
			});
			this.fTickets.addEventListener('input', this.update);

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

			this.fOdds = make('input', {
				'min': '0',
				'step': '1',
				'type': 'number',
				'value': this.lastOddsRequest,
			});
			this.fOdds.addEventListener('input', this.update);
			this.fOddsExact = make('span', {'class': 'odds_value'}, ['0%']);
			this.fOddsOrMore = make('span', {'class': 'odds_value'}, ['0%']);

			return make('div', {'class': 'options'}, [
				make('div', {'class': 'optarea left'}, [
					make('label', {}, [this.fMonths, ' months']),
					make('br'),
					make('label', {}, [this.fTickets, ' tickets']),
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
				make('div', {'class': 'optarea right'}, [
					make('label', {}, [
						`Odds of winning ${this.currencySymbol} `,
						this.fOdds,
					]),
					make('div', {'class': 'optarea odds'}, [
						make('label', {'class': 'odds_row'}, ['exactly:']),
						this.fOddsExact,
						make('br'),
						make('label', {'class': 'odds_row'}, ['or more:']),
						this.fOddsOrMore,
					]),
				]),
			]);
		}

		build_graph() {
			this.graph = new this.GraphClass(498, 148);
			this.graph.set_x_range({max: this.graphLimit, min: 0});
			this.graph.set_y_range({max: 1, min: 0});
			this.graph.set_x_label({
				label: 'Value',
				minStep: 1,
				values: this.fmtMoneyNoDP,
			});
			this.graph.set_y_label({
				label: 'p(\u2265 value)',
				minStep: 0.001,
				values: this.fmtProb,
			});

			this.fP0 = UIUtils.make_text();
			this.fPlim = UIUtils.make_text();
			this.loader = make('div', {'class': 'loader'});
			this.loader.style.top = '40px';
			this.loader.style.right = '20px';

			return make('div', {'class': 'graph_hold'}, [
				make('span', {'class': 'probability left'}, [
					`p(${this.fmtMoneyNoDP(0)}) = `,
					this.fP0,
				]),
				make('span', {'class': 'probability right'}, [
					`p(\u2265 ${this.fmtMoneyNoDP(this.graphLimit)}) = `,
					this.fPlim,
				]),
				make('br'),
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
						fAPR: make('span'),
						fVal: make('span'),
						scale: m.scale || only12,
						value: m.value,
					};
					o = make('li', {}, [
						m.name,
						make('span', {'class': 'key_value'}, [
							marker.fVal,
							marker.fAPR,
						]),
					]);
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
			this.lastTickets = null;
			this.update();
		}

		update_tickets(tickets) {
			if(tickets === this.lastTickets || !this.raffle || !(tickets > 0)) {
				return;
			}
			this.lastTickets = tickets;

			const nonce = {};
			this.resultNonce = nonce;
			this.result = null;
			this.power = null;
			this.raffle.enter(tickets, {priority: 25}).then((result) => {
				if(this.resultNonce === nonce) {
					this.result = result;
					this.lastMonths = null;
					this.update();
				}
			});
		}

		update_winnings(winnings) {
			if(winnings === this.lastWinnings) {
				return;
			}
			this.lastWinnings = winnings;
			this.lastMonths = null;
		}

		update_months(months) {
			if(months === this.lastMonths || !this.result || !(months > 0)) {
				return;
			}
			this.lastMonths = months;

			const nonce = {};
			this.powerNonce = nonce;
			this.power = null;
			let promise = null;

			switch(this.lastWinnings) {
			case WINNINGS_TAKE:
				promise = this.result.pow(months, {
					pCutoff,
					priority: 35,
				});
				break;
			case WINNINGS_INVEST:
				promise = this.raffle.compound(this.lastTickets, months, {
					maxTickets: this.maxTickets,
					priority: 15,
					ticketCost: this.ticketCost,
				});
				break;
			}

			promise.then((result) => {
				if(this.powerNonce === nonce) {
					this.power = result;
					this.lastOddsRequest = null;
					this.redraw_graph();
					this.update();
				}
			});
		}

		update_odds_request(oddsRequest) {
			if(oddsRequest === this.lastOddsRequest || !this.power) {
				return;
			}
			this.lastOddsRequest = oddsRequest;

			this.fOddsExact.textContent = odds(this.power.exact_probability(
				oddsRequest
			));
			this.fOddsOrMore.textContent = odds(this.power.range_probability(
				oddsRequest,
				Number.POSITIVE_INFINITY
			));
		}

		update() {
			this.update_tickets(read_ui_num(this.fTickets, 0, this.maxTickets));
			this.update_winnings(
				this.fWinTake.checked
					? WINNINGS_TAKE
					: WINNINGS_INVEST
			);
			this.update_months(read_ui_num(this.fMonths, 1, this.maxMonths));
			this.update_odds_request(read_ui_num(this.fOdds, 0));

			if(this.power) {
				this.end_loading();
			} else {
				this.begin_loading();
			}
		}

		do_begin_loading() {
			this.fOddsExact.textContent = '';
			this.fOddsOrMore.textContent = '';
			this.markers.forEach((m) => {
				m.fVal.textContent = '';
				m.fAPR.textContent = '';
			});
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
			const r = this.power;

			const capital = r.tickets() * this.ticketCost;
			const months = this.lastMonths;

			const data = this.markers.map((m) => {
				const v = m.value(r);
				const apr = m.scale(v / capital, months);
				m.fVal.textContent = this.fmtMoney(v);
				if(Number.isNaN(apr)) {
					m.fAPR.textContent = '';
				} else {
					m.fAPR.textContent = this.fmtAPR(apr);
				}
				return {points: y_line(v), style: m.col, width: 0.5};
			});

			this.fP0.nodeValue = odds(this.power.exact_probability(0));
			this.fPlim.nodeValue = odds(this.power.range_probability(
				this.graphLimit,
				Number.POSITIVE_INFINITY
			));

			data.push({points: get_graph_pvalue_data(r), style: '#000000'});
			this.graph.set(data, {updateBounds: false});

			this.graph.render();
		}

		dom() {
			return this.section;
		}
	}

	if(typeof module === 'object') {
		module.exports = ProbabilityUI;
	} else {
		window.ProbabilityUI = ProbabilityUI;
	}
})();

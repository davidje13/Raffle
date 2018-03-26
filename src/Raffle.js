'use strict';

(() => {
	function find_last_binary(l, fn) {
		let p0 = 0;
		let p1 = l.length;
		while(p0 + 1 < p1) {
			const p = (p0 + p1) >> 1;
			if(fn(l[p])) {
				p0 = p;
			} else {
				p1 = p;
			}
		}
		return p0;
	}

	function accumulate(map, key, value) {
		if(value > 0) {
			const existing = map.get(key) || 0;
			map.set(key, existing + value);
		}
	}

	function clamp(value, low, high) {
		return Math.max(Math.min(value, high), low);
	}

	class Results {
		constructor(tickets, cumulativeP) {
			this.n = tickets;
			this.cumulativeP = cumulativeP;
			this.vmin = this.cumulativeP[0].value;
			this.vmax = this.cumulativeP[this.cumulativeP.length - 1].value;
		}

		tickets() {
			return this.n;
		}

		min() {
			return this.vmin;
		}

		max() {
			return this.vmax;
		}

		p_below(x) {
			if(x <= this.vmin) {
				return 0;
			}
			if(x > this.vmax) {
				return 1;
			}
			const index = find_last_binary(
				this.cumulativeP,
				({value}) => (value < x)
			);
			return this.cumulativeP[index].cp;
		}

		exact_probability(x) {
			if(x < this.vmin || x > this.vmax) {
				return 0;
			}
			const index = find_last_binary(
				this.cumulativeP,
				({value}) => (value <= x)
			);
			const cur = this.cumulativeP[index];
			if(cur.value !== x) {
				return 0;
			}
			return cur.p;
		}

		range_probability(low, high) {
			// Returns p(low <= v < high)
			return clamp(this.p_below(high) - this.p_below(low), 0, 1);
		}

		percentile(percent) {
			const frac = percent * 0.01;
			if(frac <= this.cumulativeP[0].cp) {
				return this.vmin;
			}
			if(frac >= 1) {
				return this.vmax;
			}
			const index = find_last_binary(
				this.cumulativeP,
				({cp}) => (cp < frac)
			) + 1;
			return this.cumulativeP[index].value;
		}

		mean() {
			return this.cumulativeP.reduce((v, {p, value}) => v + p * value, 0);
		}

		median() {
			return this.percentile(50);
		}
	}

	class Raffle {
		constructor({
			audience = null,
			prizes = [],
			pCutoff = 0,
		}) {
			this.pCutoff = pCutoff;

			let prizeCount = 0;
			const prizeMap = new Map();
			for(const prize of prizes) {
				if(prize.count < 0) {
					throw new Error('Invalid prize count');
				}

				accumulate(prizeMap, prize.value, prize.count);
				prizeCount += prize.count;
			}

			if(audience === null) {
				this.m = prizeCount;
			} else {
				if(audience < 0) {
					throw new Error('Invalid audience size');
				}
				if(prizeCount > audience) {
					throw new Error('Too many prizes');
				}
				accumulate(prizeMap, 0, audience - prizeCount);
				this.m = audience;
			}

			// Store rarePrizes = lowest count to highest
			this.rarePrizes = Array.from(prizeMap.entries())
				.map(([value, count]) => ({count, value}))
				.sort((a, b) => (a.count - b.count));
		}

		audience() {
			return this.m;
		}

		enter(tickets) {
			if(tickets < 0 || tickets > this.m) {
				throw new Error('Invalid ticket count');
			}
			return new Promise((resolve) => {
				Raffle.generator(
					tickets,
					this.rarePrizes,
					this.pCutoff,
					(cumulativeP) => {
						resolve(new Results(tickets, cumulativeP));
					}
				);
			});
		}
	}

	Raffle.basePath = 'src';

	Raffle.generator = (tickets, prizes, pCutoff, callback) => {
		const worker = new Worker(`${Raffle.basePath}/raffle_worker.js`);
		worker.addEventListener('message', (event) => {
			switch(event.data.type) {
			case 'info':
				window.console.log(event.data.message);
				break;
			case 'result':
				worker.terminate();
				callback(event.data.cumulativeP);
				break;
			}
		});
		worker.postMessage({
			pCutoff,
			prizes,
			tickets,
		});
	};

	if(typeof module === 'object') {
		module.exports = Raffle;
	} else {
		window.Raffle = Raffle;
	}
})();

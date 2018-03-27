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

	function extractPrizeMap(prizes, audience) {
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
			return {
				fullAudience: prizeCount,
				prizeMap,
			};
		}

		if(audience < 0) {
			throw new Error('Invalid audience size');
		}
		if(prizeCount > audience) {
			throw new Error('Too many prizes');
		}
		accumulate(prizeMap, 0, audience - prizeCount);

		return {
			fullAudience: audience,
			prizeMap,
		};
	}

	class Results {
		constructor(engine, tickets, cumulativeP) {
			this.engine = engine;
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

		pow(power, {pCutoff = 0} = {}) {
			if(power === 0) {
				return new Results(
					this.engine,
					this.n,
					[{cp: 1, p: 1, value: 0}]
				);
			} else if(power === 1) {
				return this;
			}
			if(power < 0 || Math.round(power) !== power) {
				throw new Error(`Invalid power: ${power}`);
			}
			return this.engine.queue_task({
				cumulativeP: this.cumulativeP,
				pCutoff,
				power,
				type: 'pow',
			}).then(({cumulativeP}) => new Results(
				this.engine,
				this.n,
				cumulativeP
			));
		}
	}

	class WebWorkerEngine {
		constructor({basePath = 'src'} = {}) {
			this.workerFilePath = `${basePath}/raffle_worker.js`;
		}

		queue_task(trigger) {
			return new Promise((resolve) => {
				const worker = new Worker(this.workerFilePath);
				worker.addEventListener('message', (event) => {
					switch(event.data.type) {
					case 'info':
						window.console.log(event.data.message);
						break;
					case 'result':
						worker.terminate();
						resolve(event.data);
						break;
					}
				});
				worker.postMessage(trigger);
			});
		}
	}

	class Raffle {
		constructor({
			audience = null,
			engine = null,
			pCutoff = 0,
			prizes = [],
		}) {
			this.engine = engine || new WebWorkerEngine();
			this.pCutoff = pCutoff;

			const {fullAudience, prizeMap} = extractPrizeMap(prizes, audience);

			this.m = fullAudience;

			// Store rarePrizes = lowest count to highest
			this.rarePrizes = Array.from(prizeMap.entries())
				.map(([value, count]) => ({count, value}))
				.sort((a, b) => (a.count - b.count));
		}

		audience() {
			return this.m;
		}

		prizes() {
			return this.rarePrizes;
		}

		enter(tickets) {
			if(tickets < 0 || tickets > this.m) {
				throw new Error('Invalid ticket count');
			}
			return this.engine.queue_task({
				pCutoff: this.pCutoff,
				prizes: this.rarePrizes,
				tickets,
				type: 'generate',
			}).then(({cumulativeP}) => new Results(
				this.engine,
				tickets,
				cumulativeP
			));
		}
	}

	Raffle.WebWorkerEngine = WebWorkerEngine;

	Raffle.from = (seed, {pCutoff = 0} = {}) => new Raffle({
		audience: seed.audience(),
		pCutoff,
		prizes: seed.prizes(),
	});

	if(typeof module === 'object') {
		module.exports = Raffle;
	} else {
		window.Raffle = Raffle;
	}
})();

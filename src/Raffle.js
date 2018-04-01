'use strict';

if(typeof require !== 'function') {
	window.require = (name) => window[name.replace('./', '')];
}

(() => {
	const SharedPromise = require('./SharedPromise');
	const {WebWorkerEngine} = require('./WebWorkerEngine');

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

	function read_cache(cache, key, genFn) {
		const r = cache.get(key);
		if(r) {
			return r;
		}
		const generated = genFn();
		cache.set(key, generated);
		return generated;
	}

	function check_integer(
		message,
		value,
		min = Number.NEGATIVE_INFINITY,
		max = Number.POSITIVE_INFINITY
	) {
		if(typeof value !== 'number') {
			throw new Error(`${message}: "${value}" (must be numeric)`);
		}
		if(Math.round(value) !== value) {
			throw new Error(`${message}: ${value} (must be integer)`);
		}
		if(value < min) {
			throw new Error(`${message}: ${value} (must be >= ${min})`);
		}
		if(value > max) {
			throw new Error(`${message}: ${value} (must be <= ${max})`);
		}
	}

	function extract_prizemap(prizes, audience) {
		let prizeCount = 0;
		const prizeMap = new Map();
		for(const prize of prizes) {
			check_integer('Invalid prize count', prize.count, 0);

			accumulate(prizeMap, prize.value, prize.count);
			prizeCount += prize.count;
		}

		if(audience === null) {
			return {
				fullAudience: prizeCount,
				prizeMap,
			};
		}

		check_integer('Invalid audience size', audience, 0);
		if(prizeCount > audience) {
			throw new Error('Too many prizes');
		}
		accumulate(prizeMap, 0, audience - prizeCount);

		return {
			fullAudience: audience,
			prizeMap,
		};
	}

	const emptyResults = [{cp: 1, p: 1, value: 0}];

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

		values() {
			return this.cumulativeP.map(({value}) => value);
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

		mode() {
			let bestValue = null;
			let bestP = 0;
			this.cumulativeP.forEach(({p, value}) => {
				if(p >= bestP) {
					bestValue = value;
					bestP = p;
				}
			});
			return bestValue;
		}

		pow(power, {pCutoff = 0, priority = 30} = {}) {
			check_integer('Invalid power', power, 0);

			if(power === 0) {
				return Promise.resolve(new Results(
					this.engine,
					this.n,
					emptyResults
				));
			} else if(power === 1) {
				return Promise.resolve(this);
			}

			return this.engine.queue_task({
				cumulativeP: this.cumulativeP,
				pCutoff,
				power,
				type: 'pow',
			}, priority).then(({cumulativeP}) => new Results(
				this.engine,
				this.n,
				cumulativeP
			));
		}
	}

	let defaultEngine = new WebWorkerEngine();

	class Raffle {
		static set_engine(engine) {
			defaultEngine = engine;
		}

		static from(seed, options) {
			return new Raffle(Object.assign({
				audience: seed.audience(),
				prizes: seed.prizes(),
			}, options));
		}

		constructor({
			audience = null,
			engine = null,
			pCutoff = 0,
			prizes = [],
		}) {
			this.engine = engine || defaultEngine;
			this.pCutoff = pCutoff;

			const {fullAudience, prizeMap} = extract_prizemap(prizes, audience);

			this.m = fullAudience;

			// Store rarePrizes = lowest count to highest
			this.rarePrizes = Array.from(prizeMap.entries())
				.map(([value, count]) => ({count, value}))
				.sort((a, b) => (a.count - b.count));

			this.cache = new Map();
			this.compoundCache = new Map();
		}

		audience() {
			return this.m;
		}

		prizes() {
			return this.rarePrizes.slice();
		}

		enter(tickets, {priority = 20} = {}) {
			check_integer('Invalid ticket count', tickets, 0, this.m);

			if(tickets === 0) {
				return Promise.resolve(new Results(
					this.engine,
					tickets,
					emptyResults
				));
			}

			return read_cache(this.cache, tickets, () => (
				new SharedPromise(this.engine.queue_task({
					pCutoff: this.pCutoff,
					prizes: this.rarePrizes,
					tickets,
					type: 'generate',
				}, priority).then(({cumulativeP}) => new Results(
					this.engine,
					tickets,
					cumulativeP
				)))
			)).promise();
		}

		compound(tickets, power, {
			maxTickets = Number.POSITIVE_INFINITY,
			priority = 10,
			ticketCost = 1,
		} = {}) {
			window.lastMe = this;
			check_integer('Invalid ticket count', tickets, 0, this.m);
			check_integer('Invalid power', power, 0);

			if(power === 0 || tickets === 0) {
				return Promise.resolve(new Results(
					this.engine,
					tickets,
					emptyResults
				));
			}

			const optCache = read_cache(
				this.compoundCache,
				`${maxTickets}:${ticketCost}`,
				() => new Map()
			);

			const ticketCache = read_cache(optCache, tickets, () => []);

			const step = (res) => {
				const promises = res.cumulativeP.map(({p, value}) => this.enter(
					Math.min(
						tickets + Math.floor(value / ticketCost),
						maxTickets
					),
					{priority}
				).then((r) => ({p, r: r.cumulativeP, value})));

				return Promise.all(promises)
					.then((parts) => this.engine.queue_task({
						pCutoff: this.pCutoff,
						parts,
						type: 'compound',
					}, priority + 1))
					.then(({cumulativeP}) => new Results(
						this.engine,
						tickets,
						cumulativeP
					));
			};

			const baseP = Math.min(ticketCache.length + 1, power);
			let promise = (baseP === 1)
				? this.enter(tickets, {priority})
				: ticketCache[baseP - 2].promise();

			for(let p = baseP; p < power; ++ p) {
				const sharedPromise = new SharedPromise(promise.then(step));
				ticketCache[p - 1] = sharedPromise;
				promise = sharedPromise.promise();
			}
			return promise;
		}
	}

	if(typeof module === 'object') {
		module.exports = Raffle;
	} else {
		window.Raffle = Raffle;
	}
})();

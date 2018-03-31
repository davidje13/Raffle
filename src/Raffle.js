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

	class SharedPromise {
		constructor(promise) {
			this.state = 0;
			this.chained = [];
			this.v = null;

			const fullResolve = (v) => {
				this.v = v;
				this.state = 1;
				this.chained.forEach(({resolve}) => resolve(v));
				this.chained = null;
			};

			const fullReject = (v) => {
				this.v = v;
				this.state = 2;
				this.chained.forEach(({reject}) => reject(v));
				this.chained = null;
			};

			if(typeof promise === 'function') {
				promise(fullResolve, fullReject);
			} else {
				promise.then(fullResolve).catch(fullReject);
			}
		}

		promise() {
			return new Promise((resolve, reject) => {
				if(this.state === 1) {
					resolve(this.v);
				} else if(this.state === 2) {
					reject(this.v);
				} else {
					this.chained.push({reject, resolve});
				}
			});
		}

		static resolve(v) {
			return new SharedPromise(Promise.resolve(v));
		}

		static reject(v) {
			return new SharedPromise(Promise.reject(v));
		}
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

		pow(power, {pCutoff = 0} = {}) {
			check_integer('Invalid power', power, 0);

			if(power === 0) {
				return new Results(
					this.engine,
					this.n,
					[{cp: 1, p: 1, value: 0}]
				);
			} else if(power === 1) {
				return this;
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

	function worker_fn(callback) {
		return (event) => {
			switch(event.data.type) {
			case 'info':
				window.console.log(event.data.message);
				break;
			case 'result':
				callback(event.data);
				break;
			}
		};
	}

	class WebWorkerEngine {
		constructor({basePath = 'src'} = {}) {
			this.workerFilePath = `${basePath}/raffle_worker.js`;
		}

		queue_task(trigger) {
			return new Promise((resolve) => {
				const worker = new Worker(this.workerFilePath);
				worker.addEventListener('message', worker_fn((data) => {
					worker.terminate();
					resolve(data);
				}));
				worker.postMessage(trigger);
			});
		}
	}

	class SharedWebWorkerEngine {
		constructor({basePath = 'src', workers = 4} = {}) {
			const workerFilePath = `${basePath}/raffle_worker.js`;

			this.queue = [];
			this.threads = [];
			for(let i = 0; i < workers; ++ i) {
				const thread = {
					reject: null,
					resolve: null,
					run: ({reject, resolve, trigger}) => {
						thread.reject = reject;
						thread.resolve = resolve;
						thread.worker.postMessage(trigger);
					},
					worker: new Worker(workerFilePath),
				};
				thread.worker.addEventListener('message', worker_fn((data) => {
					const fn = thread.resolve;
					if(this.queue.length > 0) {
						thread.run(this.queue.shift());
					} else {
						thread.reject = null;
						thread.resolve = null;
					}
					fn(data);
				}));
				this.threads.push(thread);
			}
		}

		queue_task(trigger) {
			return new Promise((resolve, reject) => {
				for(const thread of this.threads) {
					if(thread.resolve === null) {
						thread.run({reject, resolve, trigger});
						return;
					}
				}
				this.queue.push({reject, resolve, trigger});
			});
		}

		terminate() {
			for(const {reject} of this.queue) {
				if(reject !== null) {
					reject('Terminated');
				}
			}
			this.queue.length = 0;

			for(const thread of this.threads) {
				if(thread.reject !== null) {
					thread.reject('Terminated');
					thread.reject = null;
					thread.resolve = null;
					thread.worker.terminate();
				}
			}
			this.threads.length = 0;
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
		}

		audience() {
			return this.m;
		}

		prizes() {
			return this.rarePrizes.slice();
		}

		enter(tickets) {
			check_integer('Invalid ticket count', tickets, 0, this.m);

			let cached = this.cache.get(tickets);
			if(!cached) {
				cached = new SharedPromise(this.engine.queue_task({
					pCutoff: this.pCutoff,
					prizes: this.rarePrizes,
					tickets,
					type: 'generate',
				}).then(({cumulativeP}) => new Results(
					this.engine,
					tickets,
					cumulativeP
				)));
				this.cache.set(tickets, cached);
			}
			return cached.promise();
		}
	}

	Object.assign(Raffle, {
		SharedWebWorkerEngine,
		WebWorkerEngine,
	});

	if(typeof module === 'object') {
		module.exports = Raffle;
	} else {
		window.Raffle = Raffle;
	}
})();

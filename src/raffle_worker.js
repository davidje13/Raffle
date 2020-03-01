'use strict';

/* eslint-disable no-underscore-dangle */ // Auto-name-mangling

function loadWASM() {
	const memory = new WebAssembly.Memory({ initial: 256, maximum: 256 });
	const importObject = {env: {memory}};

	function handleLoaded({instance}) {
		instance.exports._prep();

		function readPositionedList(ptr) {
			const sn = new Int32Array(memory.buffer, ptr, 2);
			const [s, n] = sn;
			if(s < 0) {
				throw new Error(`calculate_odds_nopad requries ${n} entries`);
			}
			return {
				l: new Float64Array(memory.buffer, ptr + sn.byteLength, n),
				s,
			};
		}

		return {
			calculate_final_odds: instance.exports._calculate_final_odds_,
			calculate_odds_nopad: (
				total,
				targets,
				samples
			) => readPositionedList(instance.exports._calculate_odds_nopad_(
				total,
				targets,
				samples
			)),
			ln_factorial: instance.exports._ln_factorial_,
		};
	}

	if(typeof fetch !== 'function') {
		const fs = require('fs');
		// eslint-disable-next-line no-sync
		const bytes = fs.readFileSync('./wasm/dist/main.wasm');
		return WebAssembly.instantiate(bytes, importObject).then(handleLoaded);
	}

	const request = fetch('../wasm/dist/main.wasm');
	if(WebAssembly.instantiateStreaming) {
		return WebAssembly
			.instantiateStreaming(request, importObject)
			.then(handleLoaded);
	} else {
		return request
			.then((res) => res.arrayBuffer())
			.then((bytes) => WebAssembly.instantiate(bytes, importObject))
			.then(handleLoaded);
	}
}

const prep = loadWASM().then(({
	calculate_final_odds,
	calculate_odds_nopad,
	ln_factorial,
}) => {
	const post = {fn: () => null};
	let perf_now = () => 0;

	const LEVEL = {
		aggregate: 999,
		debug: 1,
		info: 2,
		none: 4,
	};

	const profilingLevel = LEVEL.none;
	const aggs = {};

	function send_profiling(name, millis, level, group) {
		if(profilingLevel === LEVEL.aggregate && group) {
			let o = aggs[group];
			if(!o) {
				o = { n: 0, v: 0 };
				aggs[group] = o;
			}
			o.v += millis;
			if((++ o.n) >= 20) {
				const avgMs = o.v / o.n;
				post.fn({
					message: `${(avgMs * 0.001).toFixed(4)}s : avg. ${group}`,
					type: 'info',
				});
				o.n = 0;
				o.v = 0;
			}
		} else if(level >= profilingLevel) {
			post.fn({
				message: `${(millis * 0.001).toFixed(4)}s : ${name}`,
				type: 'info',
			});
		}
	}

	function make_shared_float_array(length) {
		const bytes = length * Float64Array.BYTES_PER_ELEMENT;
		return new Float64Array(new SharedArrayBuffer(bytes));
	}

	// Share temporary objects to reduce GC activity
	const sharedProbList = [];
	const sharedMaps = (() => {
		const maps = [];

		return {
			get: () => {
				if(maps.length > 0) {
					return maps.pop();
				} else {
					return new Map();
				}
			},
			put: (map) => {
				map.clear();
				maps.push(map);
			},
		};
	})();

	function accumulate(map, key, value) {
		const existing = map.get(key) || 0;
		map.set(key, existing + value);
	}

	function find_max(l) {
		let max = 0;
		let ind = 0;
		for(let i = 0; i < l.length; ++ i) {
			if(l[i] > max) {
				max = l[i];
				ind = i;
			}
		}
		return ind;
	}

	/* eslint-disable complexity */ // Heavily optimised hot function
	function apply_distribution(prob, audience, {value, count}, pCutoff) {
		/* eslint-enable complexity */

		const limit = prob.length;
		const pCutoff2 = pCutoff * pCutoff;

		for(let n = limit - 1; (n --) > 0;) {
			if(prob[n].size === 0) {
				continue;
			}

			const {l, s} = calculate_odds_nopad(audience, count, limit - n - 1);
			const maxInd = find_max(l) + 1;
			const oddsBegin = (s === 0) ? 1 : 0;
			const nextPN = sharedMaps.get();

			for(const [v, p] of prob[n]) {
				if(p <= pCutoff) {
					continue;
				}
				for(let i = maxInd; (i --) > oddsBegin;) {
					const pp = p * l[i];
					if(pp <= pCutoff2) {
						break;
					}
					const d = i + s;
					accumulate(prob[n + d], v + d * value, pp);
				}
				for(let i = maxInd; i < l.length; ++ i) {
					const pp = p * l[i];
					if(pp <= pCutoff2) {
						break;
					}
					const d = i + s;
					accumulate(prob[n + d], v + d * value, pp);
				}
				const pp = p * l[0];
				if(s === 0 && pp > pCutoff) {
					nextPN.set(v, pp);
				}
			}

			sharedMaps.put(prob[n]);
			prob[n] = nextPN;
		}
	}

	function apply_final_distribution(prob, audience, {value, count}) {
		// Simplification of apply_distribution;
		// Final stage, so we only care about the case for 0 tickets remaining
		const limit = prob.length;
		for(let n = limit - 1; (n --) > 0;) {
			if(prob[n].size === 0) {
				continue;
			}
			const i = limit - n - 1;
			const odds = calculate_final_odds(audience, count, i);
			if(odds <= 0) {
				continue;
			}
			for(const [v, p] of prob[n]) {
				if(p > 0) {
					accumulate(prob[n + i], v + i * value, p * odds);
				}
			}
		}
	}

	function calculate_probability_map(prizes, tickets, pCutoff) {
		/*
		 * Keep a sparse matrix of current winning probabilities
		 * (use a nested array structure rather than single 2D array so
		 * that we can easily add elements to rows while iterating top-to-
		 * bottom). The order of elements within a row doesn't matter, so
		 * use a Map for faster lookups.
		 */

		const prob = sharedProbList;
		prob.length = 0;

		// First dimension key = number of spent tickets so far
		for(let i = 0; i <= tickets; ++ i) {
			// Second dimension key = total value so far
			// Matrix values = probability
			prob[i] = sharedMaps.get();
		}

		// Begin with no tickets spent (value = 0, p = 1)
		prob[0].set(0, 1);

		let remainingAudience = prizes.reduce((v, {count}) => (v + count), 0);
		for(let p = 0; p < prizes.length - 1; ++ p) {
			const prize = prizes[p];
			const t0 = perf_now();
			apply_distribution(prob, remainingAudience, prize, pCutoff);
			const t1 = perf_now();
			remainingAudience -= prize.count;
			send_profiling(`Distribute ${prize.value}`, t1 - t0, LEVEL.debug);
		}

		const t0 = perf_now();
		const lastPrize = prizes[prizes.length - 1];
		apply_final_distribution(prob, remainingAudience, lastPrize);
		const t1 = perf_now();

		send_profiling('Accumulate', t1 - t0, LEVEL.debug);

		const result = prob[tickets];

		// Return maps to shared pool
		for(let i = 0; i < tickets; ++ i) {
			sharedMaps.put(prob[i]);
		}

		return result;
	}

	function make_pmap(cumulativeP) {
		const P = 1;
		const VALUE = 2;

		const pMap = sharedMaps.get();
		for(let i = 0; i < cumulativeP.length; i += 3) {
			pMap.set(cumulativeP[i + VALUE], cumulativeP[i + P]);
		}
		return pMap;
	}

	const VALUE_SORT = ([v1], [v2]) => (v1 - v2);

	function extract_cumulative_probability(pMap, pCutoff) {
		const CP = 0;
		const P = 1;
		const VALUE = 2;

		const data = Array.from(pMap.entries())
			.filter((entry) => (entry[1] > pCutoff))
			.sort(VALUE_SORT);

		let totalP = 0;
		const cumulativeP = make_shared_float_array(data.length * 3);
		for(let i = 0; i < data.length; ++ i) {
			totalP += data[i][1];
			cumulativeP[i * 3 + CP] = totalP;
		}

		// Normalise to [0 1] to correct for numeric errors
		for(let i = 0; i < data.length; ++ i) {
			const x = i * 3;
			const [value, p] = data[i];
			cumulativeP[x + CP] /= totalP;
			cumulativeP[x + P] = p / totalP;
			cumulativeP[x + VALUE] = value;
		}

		return {cumulativeP, totalP};
	}

	function mult(a, b, pCutoff) {
		if(!a) {
			return b;
		}
		if(!b) {
			return a;
		}

		const m = sharedMaps.get();
		for(const [av, ap] of a.entries()) {
			for(const [bv, bp] of b.entries()) {
				const p = ap * bp;
				if(p > pCutoff) {
					accumulate(m, av + bv, p);
				}
			}
		}
		return m;
	}

	function pow(pMap, power, pCutoff) {
		if(power === 0) {
			const p1Map = sharedMaps.get();
			p1Map.set(0, 1);
			return p1Map;
		}

		let fullPMap = null;
		let lastPMap = pMap;

		for(let p = power; ; lastPMap = mult(lastPMap, lastPMap, pCutoff)) {
			/* eslint-disable no-bitwise */
			if(p & 1) {
				fullPMap = mult(fullPMap, lastPMap, pCutoff);
			}
			p >>>= 1;
			/* eslint-enable no-bitwise */
			if(!p) {
				break;
			}
		}

		return fullPMap;
	}

	function compound(parts, pCutoff) {
		const P = 1;
		const VALUE = 2;

		const pMap = sharedMaps.get();

		for(const {p, r, value} of parts) {
			for(let i = 0; i < r.length; i += 3) {
				const newP = p * r[i + P];
				if(newP > pCutoff) {
					accumulate(pMap, value + r[i + VALUE], newP);
				}
			}
		}

		return pMap;
	}

	function message_handler_generate({prizes, tickets, pCutoff}) {
		const pMap = calculate_probability_map(prizes, tickets, pCutoff);
		const result = extract_cumulative_probability(pMap, pCutoff);
		sharedMaps.put(pMap);
		return result;
	}

	function message_handler_pow({cumulativeP, power, pCutoff}) {
		const pMap1 = make_pmap(cumulativeP);
		const pMapN = pow(pMap1, power, pCutoff);
		// Cannot be sure that pMapN != pMap1, so only return one of them
		sharedMaps.put(pMap1);
		return extract_cumulative_probability(pMapN, pCutoff);
	}

	function message_handler_compound({parts, pCutoff}) {
		const pMap = compound(parts, pCutoff);
		const result = extract_cumulative_probability(pMap, pCutoff);
		sharedMaps.put(pMap);
		return result;
	}

	function message_handler(data) {
		const tB = perf_now();
		let result = null;
		let label = data.type;

		switch(data.type) {
		case 'generate':
			result = message_handler_generate(data);
			label += ` ${data.tickets}`;
			break;
		case 'pow':
			result = message_handler_pow(data);
			label += ` ${data.power}`;
			break;
		case 'compound':
			result = message_handler_compound(data);
			break;
		}

		const tE = perf_now();
		send_profiling(`Total for ${label}`, tE - tB, LEVEL.info, data.type);

		return {
			result: {
				cumulativeP: result.cumulativeP,
				normalisation: result.totalP,
				type: 'result',
			},
			transfer: [],
		};
	}

	function message_listener({data}) {
		const {result, transfer} = message_handler(data);
		post.fn(result, transfer);
	}

	// Function exists only for testing
	function calculate_odds(total, targets, samples) {
		const {l, s} = calculate_odds_nopad(total, targets, samples);
		const odds = [];
		while(odds.length < s) {
			odds.push(0);
		}
		for(let i = 0; i < l.length; ++ i) {
			odds.push(l[i]);
		}
		while(odds.length <= samples) {
			odds.push(0);
		}
		return odds;
	}

	// Class exists only for testing
	class SynchronousEngine {
		static queue_task(trigger) {
			return new Promise((resolve) => {
				resolve(message_handler(trigger).result);
			});
		}
	}

	function install_worker() {
		if(typeof self !== 'undefined') {
			if(self.performance) {
				perf_now = () => self.performance.now();
			}
			post.fn = (msg, transfer) => self.postMessage(msg, transfer);
			self.addEventListener('message', message_listener);
			self.postMessage({type: 'loaded'});
		}
	}

	install_worker();

	return {
		SynchronousEngine,
		calculate_final_odds,
		calculate_odds,
		calculate_probability_map,
		extract_cumulative_probability,
		ln_factorial,
		message_listener,
		mult,
		post,
		pow,
	};
});

if(typeof module === 'object') {
	module.exports = prep;
}

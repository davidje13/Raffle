'use strict';

/* eslint-disable max-statements */
(() => {
	/* eslint-enable max-statements */

	const post = {fn: () => null};
	let perf_now = () => 0;

	const LEVEL = {
		debug: 1,
		info: 2,
		none: 3,
	};

	const profilingLevel = LEVEL.none;

	function send_profiling(name, millis, level) {
		if(level >= profilingLevel) {
			post.fn({
				message: `${(millis * 0.001).toFixed(4)}s : ${name}`,
				type: 'info',
			});
		}
	}

	/*
	 * Once generated, the data does not change, so sharing it is a safe thing
	 * to do and provides a BIG performance boost for .compound()
	 *
	 * Sadly, SharedArrayBuffer has been disabled by default in recent browsers
	 * due to the Spectre attack, so we can't rely on this alone; fall-back to
	 * the transfer API if shared buffers are not available
	 */
	const SUPPORTS_SHARED_BUFFER = (typeof SharedArrayBuffer !== 'undefined');

	function make_shared_float_array(length) {
		if(SUPPORTS_SHARED_BUFFER) {
			const bytes = length * Float64Array.BYTES_PER_ELEMENT;
			const buffer = new SharedArrayBuffer(bytes);
			return new Float64Array(buffer);
		} else {
			return new Float64Array(length);
		}
	}

	function transfer_float_array(array) {
		if(SUPPORTS_SHARED_BUFFER) {
			return [];
		} else {
			return [array.buffer];
		}
	}

	// Share temporary objects to reduce GC activity
	const sharedOdds = {l: [], s: 0};
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

	const ln_factorial = (() => {
		// Thanks, https://www.johndcook.com/blog/2010/08/16/how-to-compute-log-factorial/
		const stirlingConst = 0.5 * Math.log(Math.PI * 2);
		function calc_stirling(x) {
			const lnx = Math.log(x);
			return 1 / (12 * x) - 0.5 * lnx + x * (lnx - 1) + stirlingConst;
		}

		const lookup = [0, 0];
		const EXACT_COUNT = 257;
		const CACHE_COUNT = 262144;
		for(let i = 2; i < EXACT_COUNT; ++ i) {
			lookup[i] = lookup[i - 1] + Math.log(i);
		}
		for(let i = EXACT_COUNT; i < CACHE_COUNT; ++ i) {
			lookup[i] = calc_stirling(i + 1);
		}

		return function(n) {
			if(n < CACHE_COUNT) {
				return lookup[n];
			} else {
				return calc_stirling(n + 1);
			}
		};
	})();

	/* eslint-disable complexity */ // Heavily optimised hot function
	function calculate_odds_nopad(total, targets, samples) {
		/* eslint-enable complexity */
		/*
		 * Computes a table of: (T = total, x = targets, s = samples)
		 *
		 * ((x C n) * ((T - x) C (s - n))) / (T C s)
		 * for n = 0...s
		 *
		 *         (x! * (T - x)! * s! * (T - s)!)
		 * --------------------------------------------------
		 * (n! * (x - n)! * (s - n)! * (T - x + n - s)! * T!)
		 *
		 * + ln((T - x)!)
		 * + ln((T - s)!)
		 * - ln(T!)
		 * - ln(n!)
		 * + ln(x!) - ln((x - n)!)
		 * + ln(s!) - ln((s - n)!)
		 * - ln((n + T - x - s)!)
		 */

		sharedOdds.l.length = 0;

		// Shortcuts for simple values
		if(samples === 0 || targets === 0) {
			sharedOdds.l.push(1);
			sharedOdds.s = 0;
			return sharedOdds;
		} else if(targets === total) {
			sharedOdds.l.push(1);
			sharedOdds.s = total - 1;
			return sharedOdds;
		} else if(samples === 1) {
			const p = targets / total;
			sharedOdds.l.push(1 - p);
			sharedOdds.l.push(p);
			sharedOdds.s = 0;
			return sharedOdds;
		}

		const B = targets + samples - total;

		let cur = (
			ln_factorial(total - samples) - ln_factorial(Math.abs(B))
			+ ln_factorial(total - targets) - ln_factorial(total)
		);

		if(B > 0) {
			cur += (
				ln_factorial(targets) - ln_factorial(targets - B)
				+ ln_factorial(samples) - ln_factorial(samples - B)
			);
		}

		cur = Math.exp(cur);

		let n = Math.max(B, 0);
		const limit = Math.min(samples, targets);

		sharedOdds.s = n;

		for(; n <= limit; ++ n) {
			sharedOdds.l.push(cur);

			// A = foo / (targets - n)! / (samples - n)! / (n - B)! / n!
			// B = foo / (targets-n-1)! / (samples-n-1)! / (n+1-B)! / (n+1)!
			// B/A = ((targets - n) * (samples - n)) / ((n + 1 - B) * (n + 1))
			cur *= ((targets - n) * (samples - n)) / ((n + 1 - B) * (n + 1));
		}

		return sharedOdds;
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

	function calculate_final_odds(total, targets, samples) {
		// Simplification of calculate_odds;
		// Final stage, so we only care about the case for n = samples

		// Shortcuts for simple values
		if(samples > targets) {
			return 0;
		} else if(samples === 0 || targets === total) {
			return 1;
		} else if(samples === 1) {
			return targets / total;
		}

		return Math.exp(
			ln_factorial(total - samples) - ln_factorial(total)
			+ ln_factorial(targets) - ln_factorial(targets - samples)
		);
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
		send_profiling(`Total for ${label}`, tE - tB, LEVEL.info);

		return {
			result: {
				cumulativeP: result.cumulativeP,
				normalisation: result.totalP,
				type: 'result',
			},
			transfer: transfer_float_array(result.cumulativeP),
		};
	}

	function message_listener({data}) {
		const {result, transfer} = message_handler(data);
		post.fn(result, transfer);
	}

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
		}
	}

	install_worker();

	if(typeof module === 'object') {
		module.exports = {
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
	}
})();

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
		if(level < profilingLevel) {
			return;
		}
		post.fn({
			message: `${(millis * 0.001).toFixed(4)}s : ${name}`,
			type: 'info',
		});
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

	function calculate_odds(total, targets, samples) {
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
		 * + ln(x!)
		 * + ln(s!)
		 * - ln(T!)
		 * - ln(n!)
		 * - ln((x - n)!)
		 * - ln((s - n)!)
		 * - ln((n + T - x - s)!)
		 */

		// Shortcut for simple values
		if(samples === 0) {
			return [1];
		} else if(samples === 1) {
			const p = targets / total;
			return [1 - p, p];
		}

		const baseLnLarge = (
			ln_factorial(total - samples)
			- ln_factorial(total)
			+ ln_factorial(total - targets)
		);
		const baseLnSmall = (
			ln_factorial(targets)
			+ ln_factorial(samples)
		);

		const odds = [];

		let n = 0;
		for(const limit = samples + targets - total; n < limit; ++ n) {
			odds.push(0);
		}
		const B = total - targets - samples;
		for(const limit = Math.min(samples, targets); n <= limit; ++ n) {
			odds.push(Math.exp(
				baseLnLarge
				- ln_factorial(B + n)
				- ln_factorial(targets - n)
				+ baseLnSmall
				- ln_factorial(n)
				- ln_factorial(samples - n)
			));
		}
		for(; n <= samples; ++ n) {
			odds.push(0);
		}

		return odds;
	}

	function apply_distribution(prob, audience, {value, count}, pCutoff) {
		const limit = prob.length;
		const pCutoff2 = pCutoff * pCutoff;
		let totalTm = 0;

		for(let n = limit - 1; (n --) > 0;) {
			if(prob[n].size === 0) {
				continue;
			}
			const tm0 = perf_now();
			const odds = calculate_odds(audience, count, limit - n - 1);
			totalTm += perf_now() - tm0;
			prob[n].forEach((p, v) => {
				// Update current entry with new odds
				// (Iteration order is fixed, so no risk of looping forever)
				prob[n].set(v, p * odds[0]);

				if(p <= pCutoff) {
					return;
				}
				for(let i = 1; i < odds.length; ++ i) {
					const pp = p * odds[i];
					if(pp > pCutoff2) {
						accumulate(prob[n + i], v + i * value, pp);
					}
				}
			});
		}
		send_profiling('Calculate odds', totalTm, LEVEL.debug);
	}

	function calculate_final_odds(total, targets, samples) {
		// Simplification of calculate_odds;
		// Final stage, so we only care about the case for n = samples

		// Shortcut for simple values
		if(samples < 2) {
			return calculate_odds(total, targets, samples)[samples];
		}

		if(samples > targets) {
			return 0;
		}

		return Math.exp(
			ln_factorial(total - samples)
			- ln_factorial(total)
			+ ln_factorial(targets)
			- ln_factorial(targets - samples)
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
			prob[n].forEach((p, v) => {
				const pp = p * odds;
				if(pp > 0) {
					accumulate(prob[n + i], v + i * value, pp);
				}
			});
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

		// First dimension key = number of spent tickets so far
		const prob = [];
		for(let i = 0; i <= tickets; ++ i) {
			// Second dimension key = total value so far
			// Matrix values = probability
			prob[i] = new Map();
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

		return prob[tickets];
	}

	function make_pmap(cumulativeP) {
		const P = 1;
		const VALUE = 2;

		const pMap = new Map();
		for(let i = 0; i < cumulativeP.length; i += 3) {
			pMap.set(cumulativeP[i + VALUE], cumulativeP[i + P]);
		}
		return pMap;
	}

	function extract_cumulative_probability(pMap, pCutoff) {
		const CP = 0;
		const P = 1;
		const VALUE = 2;

		const data = Array.from(pMap.entries())
			.filter((entry) => (entry[1] > pCutoff))
			.sort(([v1], [v2]) => (v1 - v2));

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

		const m = new Map();
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
			const p1Map = new Map();
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

		const pMap = new Map();

		parts.forEach(({p, r, value}) => {
			for(let i = 0; i < r.length; i += 3) {
				const newP = p * r[i + P];
				if(newP > pCutoff) {
					accumulate(pMap, value + r[i + VALUE], newP);
				}
			}
		});

		return pMap;
	}

	function message_handler_generate({prizes, tickets, pCutoff}) {
		const pMap = calculate_probability_map(prizes, tickets, pCutoff);
		return extract_cumulative_probability(pMap, pCutoff);
	}

	function message_handler_pow({cumulativeP, power, pCutoff}) {
		const pMap1 = make_pmap(cumulativeP);
		const pMapN = pow(pMap1, power, pCutoff);
		return extract_cumulative_probability(pMapN, pCutoff);
	}

	function message_handler_compound({parts, pCutoff}) {
		const pMap = compound(parts, pCutoff);
		return extract_cumulative_probability(pMap, pCutoff);
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

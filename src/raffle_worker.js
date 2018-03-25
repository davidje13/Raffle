'use strict';

const post = {fn: () => { /* No-op */ }};
let perf_now = () => 0;

function send_profiling(name, millis) {
	post.fn({
		message: `${(millis * 0.001).toFixed(4)}s : ${name}`,
		type: 'info',
	});
}

function accumulate(map, key, value) {
	if(value > 0) {
		const existing = map.get(key) || 0;
		map.set(key, existing + value);
	}
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
	let totalTm = 0;

	for(let n = limit - 1; (n --) > 0;) {
		if(prob[n].size === 0) {
			continue;
		}
		const tm0 = perf_now();
		const odds = calculate_odds(audience, count, limit - n - 1);
		totalTm += perf_now() - tm0;
		prob[n].forEach((p, v) => {
			if(p > pCutoff) {
				for(let i = 1; i < odds.length; ++ i) {
					accumulate(prob[n + i], v + i * value, p * odds[i]);
				}
			}
			// Update current entry with new odds
			// (Iteration order is fixed, so no risk of looping forever)
			prob[n].set(v, p * odds[0]);
		});
	}
	send_profiling('Calculate odds', totalTm);
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
		prob[n].forEach((p, v) => {
			accumulate(prob[n + i], v + i * value, p * odds);
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
		send_profiling(`Distribute ${prize.value}`, t1 - t0);
	}

	const t0 = perf_now();
	const lastPrize = prizes[prizes.length - 1];
	apply_final_distribution(prob, remainingAudience, lastPrize);
	const t1 = perf_now();

	send_profiling('Accumulate', t1 - t0);

	return prob[tickets];
}

function extract_cumulative_probability(pMap) {
	const cumulativeP = Array.from(pMap.entries())
		.map(([value, p]) => ({p, value}))
		.sort((a, b) => (a.value - b.value));

	let totalP = 0;
	for(let i = 0; i < cumulativeP.length; ++ i) {
		totalP += cumulativeP[i].p;
		cumulativeP[i].p = totalP;
	}

	// Normalise to [0 1] to correct for numeric errors
	cumulativeP.forEach((x) => (x.p /= totalP));

	return {cumulativeP, totalP};
}

function message_listener(event) {
	const tB = perf_now();
	const pMap = calculate_probability_map(
		event.data.prizes,
		event.data.tickets,
		event.data.pCutoff
	);

	const {cumulativeP, totalP} = extract_cumulative_probability(pMap);

	const tE = perf_now();
	send_profiling('Total', tE - tB);

	post.fn({
		cumulativeP,
		normalisation: totalP,
		type: 'result',
	});
}

try {
	if(performance) {
		perf_now = () => performance.now();
	}
} catch(ignored) {
	// No performance; skip profiling functionality
}

try {
	if(self) {
		post.fn = (msg) => self.postMessage(msg);
		self.addEventListener('message', message_listener);
	}
} catch(ignored) {
	// No self; we are not a WebWorker (probably Jasmine tests)
}

if(typeof module === 'object') {
	module.exports = {
		calculate_final_odds,
		calculate_odds,
		calculate_probability_map,
		extract_cumulative_probability,
		ln_factorial,
		message_listener,
		post,
	};
}

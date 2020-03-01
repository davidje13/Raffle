#ifndef CALCULATE_ODDS_H_
#define CALCULATE_ODDS_H_

#include "ln_factorial.h"
#include <stdlib.h>
#include <math.h>

#define MAX_ODDS_BUCKETS 500000

struct PositionedList {
	int s;
	int n;
	double l[MAX_ODDS_BUCKETS];
};

struct PositionedList sharedOdds;

const struct PositionedList* calculate_odds_nopad(
	long long total,
	long long targets,
	int samples
) {
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

	// Shortcuts for simple values
	if(samples == 0 || targets == 0) {
		sharedOdds.l[0] = 1.0;
		sharedOdds.s = 0;
		sharedOdds.n = 1;
		return &sharedOdds;
	} else if(targets == total) {
		sharedOdds.l[0] = 1.0;
		sharedOdds.s = (int) (total - 1);
		sharedOdds.n = 1;
		return &sharedOdds;
	} else if(samples == 1) {
		double p = targets / (double) total;
		sharedOdds.l[0] = 1.0 - p;
		sharedOdds.l[1] = p;
		sharedOdds.s = 0;
		sharedOdds.n = 2;
		return &sharedOdds;
	}

	long long B = targets + samples - total;

	double cur = (
		ln_factorial(total - samples) - ln_factorial(llabs(B))
		+ ln_factorial(total - targets) - ln_factorial(total)
	);

	int begin = 0;
	if(B > 0) {
		cur += (
			ln_factorial(targets) - ln_factorial(targets - B)
			+ ln_factorial(samples) - ln_factorial(samples - B)
		);
		begin = B;
	}

	cur = exp(cur);

	int limit;
	if(targets < samples) {
		limit = (int) targets;
	} else {
		limit = samples;
	}
	++ limit;

	if(limit - begin > MAX_ODDS_BUCKETS) {
		// error: not enough memory allocated
		sharedOdds.s = -1;
		sharedOdds.n = limit - begin;
		return &sharedOdds;
	}

	for(int n = begin; n < limit; ++ n) {
		sharedOdds.l[n - begin] = cur;

		// A = foo / (targets - n)! / (samples - n)! / (n - B)! / n!
		// B = foo / (targets-n-1)! / (samples-n-1)! / (n+1-B)! / (n+1)!
		// B/A = ((targets - n) * (samples - n)) / ((n + 1 - B) * (n + 1))
		cur *= ((targets - n) * (samples - n)) / (double) ((n + 1 - B) * (n + 1));
	}
	sharedOdds.s = begin;
	sharedOdds.n = limit - begin;

	return &sharedOdds;
}

double calculate_final_odds(
	long long total,
	long long targets,
	int samples
) {
	// Simplification of calculate_odds;
	// Final stage, so we only care about the case for n = samples

	// Shortcuts for simple values
	if(samples > targets) {
		return 0.0;
	} else if(samples == 0 || targets == total) {
		return 1.0;
	} else if(samples == 1) {
		return targets / (double) total;
	}

	return exp(
		ln_factorial(total - samples) - ln_factorial(total)
		+ ln_factorial(targets) - ln_factorial(targets - samples)
	);
}

// Exports for testing
EMSCRIPTEN_KEEPALIVE const struct PositionedList* calculate_odds_nopad_(
	double total,
	double targets,
	int samples
) {
	return calculate_odds_nopad(total, targets, samples);
}

EMSCRIPTEN_KEEPALIVE double calculate_final_odds_(
	double total,
	double targets,
	int samples
) {
	return calculate_final_odds(total, targets, samples);
}

#endif

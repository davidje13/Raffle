#ifndef CALCULATE_ODDS_NOPAD_H_
#define CALCULATE_ODDS_NOPAD_H_

#include "ln_factorial.h"
#include <math.h>

#define MAX_ODDS_BUCKETS 500000

struct PositionedList {
	int s;
	int n;
	double l[MAX_ODDS_BUCKETS];
};

struct PositionedList sharedOdds;

//int find_max(const struct PositionedList* l) {
//	double max = 0.0;
//	int ind = 0;
//	for(int i = 0; i < l.n; ++ i) {
//		if(l[i] > max) {
//			max = l[i];
//			ind = i;
//		}
//	}
//	return ind;
//}

EMSCRIPTEN_KEEPALIVE const struct PositionedList* calculate_odds_nopad(
	double total, // should be long long
	double targets, // should be long long
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
	if(samples == 0 || targets == 0.0) {
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
		double p = targets / total;
		sharedOdds.l[0] = 1.0 - p;
		sharedOdds.l[1] = p;
		sharedOdds.s = 0;
		sharedOdds.n = 2;
		return &sharedOdds;
	}

	double B = targets + samples - total; // should be long long

	double cur = (
		ln_factorial(total - samples) - ln_factorial(fabs(B))
		+ ln_factorial(total - targets) - ln_factorial(total)
	);

	if(B > 0) {
		cur += (
			ln_factorial(targets) - ln_factorial(targets - B)
			+ ln_factorial((double) samples) - ln_factorial(samples - B)
		);
	}

	cur = exp(cur);

	int begin = (int) fmax(B, 0.0);
	int limit = samples;
	if((int) targets < samples) {
		limit = (int) targets;
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
		cur *= ((targets - n) * (samples - n)) / ((n + 1 - B) * (n + 1));
	}
	sharedOdds.s = begin;
	sharedOdds.n = limit - begin;

	return &sharedOdds;
}

EMSCRIPTEN_KEEPALIVE double calculate_final_odds(
	double total, // should be long long
	double targets, // should be long long
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
		return targets / total;
	}

	return exp(
		ln_factorial(total - samples) - ln_factorial(total)
		+ ln_factorial(targets) - ln_factorial(targets - samples)
	);
}

#endif

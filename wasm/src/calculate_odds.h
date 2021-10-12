#ifndef CALCULATE_ODDS_H_
#define CALCULATE_ODDS_H_

#include "ln_factorial.h"
#include "options.h"
#include "imports.h"
#include <math.h>

struct PositionedList {
	unsigned int start;
	unsigned int length;
	double values[MAX_ODDS_BUCKETS];
};

static struct PositionedList sharedOdds;

const struct PositionedList* calculate_odds_nopad(
	unsigned long long total,
	unsigned long long targets,
	unsigned int samples
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
	if (samples == 0 || targets == 0) {
		sharedOdds.values[0] = 1.0;
		sharedOdds.start = 0;
		sharedOdds.length = 1;
		return &sharedOdds;
	} else if (targets == total) {
		sharedOdds.values[0] = 1.0;
		sharedOdds.start = (int) (total - 1);
		sharedOdds.length = 1;
		return &sharedOdds;
	} else if (samples == 1) {
		double p = targets / (double) total;
		sharedOdds.values[0] = 1.0 - p;
		sharedOdds.values[1] = p;
		sharedOdds.start = 0;
		sharedOdds.length = 2;
		return &sharedOdds;
	}

	long long B = targets + samples - total;

	double cur = (
		ln_factorial(total - samples) - ln_factorial((B < 0) ? -B : B)
		+ ln_factorial(total - targets) - ln_factorial(total)
	);

	unsigned int begin = 0;
	if (B > 0) {
		cur += (
			ln_factorial(targets) - ln_factorial(targets - B)
			+ ln_factorial(samples) - ln_factorial(samples - B)
		);
		begin = (unsigned int) B;
	}

	cur = exp(cur);

	unsigned int limit;
	if (targets < samples) {
		limit = (unsigned int) targets;
	} else {
		limit = samples;
	}
	++ limit;

	if (limit - begin > MAX_ODDS_BUCKETS) {
		throw_error(); // not enough memory allocated
	}

	for (unsigned int n = begin; n < limit; ++ n) {
		sharedOdds.values[n - begin] = cur;

		// A = foo / (targets - n)! / (samples - n)! / (n - B)! / n!
		// B = foo / (targets-n-1)! / (samples-n-1)! / (n+1-B)! / (n+1)!
		// B/A = ((targets - n) * (samples - n)) / ((n + 1 - B) * (n + 1))
		cur *= ((targets - n) * (samples - n)) / (double) ((n + 1 - B) * (n + 1));
	}
	sharedOdds.start = begin;
	sharedOdds.length = limit - begin;
	return &sharedOdds;
}

const struct PositionedList* calculate_odds(
	unsigned long long total,
	unsigned long long targets,
	unsigned int samples
) {
	if (samples + 1 > MAX_ODDS_BUCKETS) {
		throw_error();
	}
	calculate_odds_nopad(total, targets, samples);
	if (sharedOdds.start) {
		for (unsigned int i = sharedOdds.length; (i --) > 0;) {
			sharedOdds.values[i + sharedOdds.start] = sharedOdds.values[i];
		}
		for (unsigned int i = sharedOdds.start; (i --) > 0;) {
			sharedOdds.values[i] = 0.0;
		}
	}
	for (unsigned int i = sharedOdds.start + sharedOdds.length; i <= samples; ++ i) {
		sharedOdds.values[i] = 0.0;
	}
	sharedOdds.length = samples + 1;
	sharedOdds.start = 0;
	return &sharedOdds;
}

double calculate_final_odds(
	unsigned long long total,
	unsigned long long targets,
	unsigned int samples
) {
	// Simplification of calculate_odds;
	// Final stage, so we only care about the case for n = samples

	// Shortcuts for simple values
	if (samples > targets) {
		return 0.0;
	} else if (samples == 0 || targets == total) {
		return 1.0;
	} else if (samples == 1) {
		return targets / (double) total;
	}

	return exp(
		ln_factorial(total - samples) - ln_factorial(total)
		+ ln_factorial(targets) - ln_factorial(targets - samples)
	);
}

#endif

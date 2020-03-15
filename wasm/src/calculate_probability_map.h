#ifndef CALCULATE_PROBABILITY_MAP_H_
#define CALCULATE_PROBABILITY_MAP_H_

#include "calculate_odds.h"
#include "cumulative_probability.h"
#include "prob_map.h"
#include "memory.h"
#include "prizes.h"
#include "options.h"
#include <math.h>

static struct ProbMap* sharedTicketsProb[MAX_TICKETS + 1];

unsigned int find_peak(const struct PositionedList* l) {
	double previous = 0.0;
	for (unsigned int i = 0; i < l->length; ++ i) {
		const double v = l->values[i];
		if (v < previous) {
			return i - 1;
		}
		previous = v;
	}
	return l->length - 1;
}

void apply_distribution(
	struct ProbMap** prob,
	unsigned int limit,
	unsigned long long audience,
	const struct Prize* prize,
	double pCutoff
) {
	const double pCutoff2 = pCutoff * pCutoff;

	for (unsigned int n = limit - 1; (n --) > 0;) {
		if (isEmptyProbMap(prob[n])) {
			continue;
		}

		const struct PositionedList* l = calculate_odds_nopad(
			audience,
			prize->count,
			limit - n - 1
		);
		const unsigned int maxInd = find_peak(l) + 1;
		struct ProbMap* prevPN = prob[n];
		prob[n] = mallocProbMap();

		iterateProbMap(prevPN, iter, {
			if (iter->value <= pCutoff) {
				continue;
			}
			for (unsigned int i = maxInd; (i --) > 0;) {
				double pp = iter->value * l->values[i];
				if (pp <= pCutoff2) {
					break;
				}
				unsigned int d = i + l->start;
				accumulateProbMap(prob[n + d], iter->key + d * prize->value, pp);
			}
			for (unsigned int i = maxInd; i < l->length; ++ i) {
				double pp = iter->value * l->values[i];
				if (pp <= pCutoff2) {
					break;
				}
				unsigned int d = i + l->start;
				accumulateProbMap(prob[n + d], iter->key + d * prize->value, pp);
			}
		})

		freeProbMap(prevPN);
	}
}

void apply_final_distribution(
	struct ProbMap** prob,
	unsigned int limit,
	unsigned long long audience,
	const struct Prize *prize
) {
	// Simplification of apply_distribution;
	// Final stage, so we only care about the case for 0 tickets remaining
	struct ProbMap* targetP = prob[limit - 1];
	for (unsigned int n = limit - 1; (n --) > 0;) {
		if (isEmptyProbMap(prob[n])) {
			continue;
		}
		const unsigned int i = limit - n - 1;
		const double odds = calculate_final_odds(audience, prize->count, i);
		if (odds <= 0.0) {
			continue;
		}
		iterateProbMap(prob[n], iter, {
			if (iter->value > 0.0) {
				accumulateProbMap(targetP, iter->key + i * prize->value, iter->value * odds);
			}
		})
	}
}

struct ProbMap* calculate_probability_map(
	const struct Prize* prizes,
	unsigned int prizesLength,
	unsigned int tickets,
	double pCutoff
) {
	/*
	 * Keep a sparse matrix of current winning probabilities
	 * (use a nested array structure rather than single 2D array so
	 * that we can easily add elements to rows while iterating top-to-
	 * bottom). The order of elements within a row doesn't matter, so
	 * use a Map for faster lookups.
	 */

	if (tickets > MAX_TICKETS) {
		abort();
	}

	// First dimension key = number of spent tickets so far
	for (unsigned int i = 0; i <= tickets; ++ i) {
		// Second dimension key = total value so far
		// Matrix values = probability
		sharedTicketsProb[i] = mallocProbMap();
	}

	// Begin with no tickets spent (value = 0, p = 1)
	accumulateProbMap(sharedTicketsProb[0], 0, 1.0);

	unsigned long long remainingAudience = 0;
	for (unsigned int p = 0; p < prizesLength; ++ p) {
		remainingAudience += prizes[p].count;
	}
	for (unsigned int p = 0; p < prizesLength - 1; ++ p) {
		apply_distribution(
			sharedTicketsProb,
			tickets + 1,
			remainingAudience,
			&prizes[p],
			pCutoff
		);
		remainingAudience -= prizes[p].count;
	}
	apply_final_distribution(
		sharedTicketsProb,
		tickets + 1,
		remainingAudience,
		&prizes[prizesLength - 1]
	);

	for (unsigned int i = 0; i < tickets; ++ i) {
		freeProbMap(sharedTicketsProb[i]);
	}

	return sharedTicketsProb[tickets];
}

EMSCRIPTEN_KEEPALIVE const struct CumulativeProbMap* calculate_cprobability_map(
	unsigned int tickets,
	double pCutoff
) {
	struct ProbMap* pMap = calculate_probability_map(
		sharedPrizes,
		sharedPrizesLength,
		tickets,
		pCutoff
	);
	const struct CumulativeProbMap* cpMap = extract_cumulative_probability(
		pMap,
		pCutoff
	);
	freeProbMap(pMap);
	return cpMap;
}

#endif

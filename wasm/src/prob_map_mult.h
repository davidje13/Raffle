#ifndef PROB_MAP_MULT_
#define PROB_MAP_MULT_

#include "prob_map.h"
#include "cumulative_probability.h"

struct ProbMap* multProbMap(
	struct ProbMap* a,
	struct ProbMap* b,
	double pCutoff
) {
	if (!a) {
		return b;
	}
	if (!b) {
		return a;
	}

	struct ProbMap* m = mallocProbMap();
	iterateProbMap(a, ai, {
		iterateProbMap(b, bi, {
			double p = ai->value * bi->value;
			if (p > pCutoff) {
				accumulateProbMap(m, ai->key + bi->key, p);
			}
		})
	})
	return m;
}

struct ProbMap* powProbMap(
	struct ProbMap* pMap,
	unsigned int power,
	double pCutoff
) {
	if (power == 0) {
		struct ProbMap* m = mallocProbMap();
		accumulateProbMap(m, 0, 1.0);
		return m;
	}

	struct ProbMap* fullPMap = (void*) 0;
	struct ProbMap* lastPMap = pMap;

	unsigned int p = power;
	while (1) {
		if (p & 1) {
			struct ProbMap* oldPMap = fullPMap;
			fullPMap = multProbMap(fullPMap, lastPMap, pCutoff);
			if (oldPMap && oldPMap != fullPMap && oldPMap != lastPMap) {
				freeProbMap(oldPMap);
			}
		}
		p >>= 1;
		if (!p) {
			break;
		}
		struct ProbMap* oldPMap = lastPMap;
		lastPMap = multProbMap(lastPMap, lastPMap, pCutoff);
		if (oldPMap != lastPMap && oldPMap != pMap && oldPMap != fullPMap) {
			freeProbMap(oldPMap);
		}
	}
	if (lastPMap != fullPMap && lastPMap != pMap) {
		freeProbMap(lastPMap);
	}

	return fullPMap;
}

// takes sharedCPMap as input
EMSCRIPTEN_KEEPALIVE const struct CumulativeProbMap* pow_cprobability(
	unsigned int power,
	double pCutoff
) {
	/* TODO:
	 * the existing ProbMap structure is not well suited to this, as there
	 * are many more keys used (this is slow and cannot handle large powers)
	 */
	struct ProbMap* pMap = extract_probability_map(&sharedCPMap);
	struct ProbMap* pMapP = powProbMap(pMap, power, pCutoff);
	if (pMap != pMapP) {
		freeProbMap(pMap);
	}
	const struct CumulativeProbMap* cpMap = extract_cumulative_probability(
		pMapP,
		pCutoff
	);
	freeProbMap(pMap);
	return cpMap;
}

#endif

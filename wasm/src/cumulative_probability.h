#ifndef CUMULATIVE_PROBABILITY_H_
#define CUMULATIVE_PROBABILITY_H_

#include "prob_map.h"
#include "options.h"
#include <stdlib.h>

struct CumulativeProbMapElement {
	double cp;
	double p;
	double value;
};

struct CumulativeProbMap {
	double totalP;
	unsigned int dataLength;
	unsigned int padding; // explicit padding element to align data
	struct CumulativeProbMapElement data[MAX_CP_ELEMENTS];
};

static struct CumulativeProbMap sharedCPMap;

const struct CumulativeProbMap* extract_cumulative_probability(
	const struct ProbMap* pMap,
	double pCutoff
) {
	unsigned int count = 0;
	double totalP = 0.0;
	iterateProbMap(pMap, iter, {
		if (iter->value > pCutoff) {
			if (count >= MAX_CP_ELEMENTS) {
				abort();
			}
			totalP += iter->value;
			sharedCPMap.data[count].p = iter->value;
			sharedCPMap.data[count].value = iter->key;
			++ count;
		}
	})

	// pMap is already sorted low->high if a linkedmap

	// Normalise to [0 1] to correct for numeric errors and assign cumulative values
	double cp = 0.0;
	sharedCPMap.totalP = totalP;
	sharedCPMap.dataLength = count;
	for (unsigned int i = 0; i < count; ++ i) {
		cp += sharedCPMap.data[i].p;
		sharedCPMap.data[i].cp = cp / totalP;
		sharedCPMap.data[i].p /= totalP;
	}

	return &sharedCPMap;
}

#endif

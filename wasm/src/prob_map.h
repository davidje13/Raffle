#ifndef PROBABILITY_MAP_H_
#define PROBABILITY_MAP_H_

#include "linkedmap.h"
#include "options.h"

DEFINE_LINKEDMAP(ProbMap, unsigned int, double, MAX_MAP_GLOBAL_ITEMS)
#define iterateProbMap(mapPtr, entryVar, expr) \
	iterateLinkedMap(ProbMap, mapPtr, entryVar, expr)

#endif

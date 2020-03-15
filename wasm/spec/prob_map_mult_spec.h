#include "util.h"
#include "../src/prob_map_mult.h"

describe(prob_map_mult) {
	it("multiplies two probability maps") {
		struct ProbMap* pMap1 = mallocProbMap();
		accumulateProbMap(pMap1, 0, 0.5);
		accumulateProbMap(pMap1, 1, 0.5);

		struct ProbMap* pMap2 = mallocProbMap();
		accumulateProbMap(pMap2, 2, 0.25);
		accumulateProbMap(pMap2, 5, 0.25);
		accumulateProbMap(pMap2, 7, 0.50);

		struct ProbMap* pMapM = multProbMap(pMap1, pMap2, 0.0);
		freeProbMap(pMap1);
		freeProbMap(pMap2);

		assertEqual(sizeOfProbMap(pMapM), 6);
		assertNear(getProbMap(pMapM, 2), 0.125, 1e-6);
		assertNear(getProbMap(pMapM, 3), 0.125, 1e-6);
		assertNear(getProbMap(pMapM, 5), 0.125, 1e-6);
		assertNear(getProbMap(pMapM, 6), 0.125, 1e-6);
		assertNear(getProbMap(pMapM, 7), 0.250, 1e-6);
		assertNear(getProbMap(pMapM, 8), 0.250, 1e-6);
		freeProbMap(pMapM);
	}

	it("combines incident values") {
		struct ProbMap* pMap1 = mallocProbMap();
		accumulateProbMap(pMap1, 0, 0.5);
		accumulateProbMap(pMap1, 2, 0.5);

		struct ProbMap* pMap2 = mallocProbMap();
		accumulateProbMap(pMap2, 1, 0.5);
		accumulateProbMap(pMap2, 3, 0.5);

		struct ProbMap* pMapM = multProbMap(pMap1, pMap2, 0.0);
		freeProbMap(pMap1);
		freeProbMap(pMap2);

		assertEqual(sizeOfProbMap(pMapM), 3);
		assertNear(getProbMap(pMapM, 1), 0.25, 1e-6);
		assertNear(getProbMap(pMapM, 3), 0.50, 1e-6);
		assertNear(getProbMap(pMapM, 5), 0.25, 1e-6);
		freeProbMap(pMapM);
	}

	it("returns identity transforms if a parameter is null") {
		struct ProbMap* pMap1 = mallocProbMap();
		accumulateProbMap(pMap1, 0, 1.0);

		assertSame(multProbMap(pMap1, (void*) 0, 0.0), pMap1);
		assertSame(multProbMap((void*) 0, pMap1, 0.0), pMap1);
		freeProbMap(pMap1);
	}

	it("returns null if both parameters are null") {
		assertSame(multProbMap((void*) 0, (void*) 0, 0), (void*) 0);
	}
}

describe(prob_map_pow) {
	it("repeatedly multiplies a probability map by itself") {
		struct ProbMap* pMap = mallocProbMap();
		accumulateProbMap(pMap, 0, 0.5);
		accumulateProbMap(pMap, 1, 0.5);

		struct ProbMap* pMapP = powProbMap(pMap, 2, 0.0);
		freeProbMap(pMap);

		assertEqual(sizeOfProbMap(pMapP), 3);
		assertNear(getProbMap(pMapP, 0), 0.25, 1e-6);
		assertNear(getProbMap(pMapP, 1), 0.50, 1e-6);
		assertNear(getProbMap(pMapP, 2), 0.25, 1e-6);
		freeProbMap(pMapP);
	}

	it("handles large powers") {
		struct ProbMap* pMap = mallocProbMap();
		accumulateProbMap(pMap, 0, 0.5);
		accumulateProbMap(pMap, 1, 0.5);

		struct ProbMap* pMapP = powProbMap(pMap, 12, 0.0);
		freeProbMap(pMap);

		assertEqual(sizeOfProbMap(pMapP), 13);
		assertNear(getProbMap(pMapP,  0),   1 / 4096.0, 1e-6);
		assertNear(getProbMap(pMapP,  1),  12 / 4096.0, 1e-6);
		assertNear(getProbMap(pMapP,  2),  66 / 4096.0, 1e-6);
		assertNear(getProbMap(pMapP,  3), 220 / 4096.0, 1e-6);
		assertNear(getProbMap(pMapP,  4), 495 / 4096.0, 1e-6);
		assertNear(getProbMap(pMapP,  5), 792 / 4096.0, 1e-6);
		assertNear(getProbMap(pMapP,  6), 924 / 4096.0, 1e-6);
		assertNear(getProbMap(pMapP,  7), 792 / 4096.0, 1e-6);
		assertNear(getProbMap(pMapP,  8), 495 / 4096.0, 1e-6);
		assertNear(getProbMap(pMapP,  9), 220 / 4096.0, 1e-6);
		assertNear(getProbMap(pMapP, 10),  66 / 4096.0, 1e-6);
		assertNear(getProbMap(pMapP, 11),  12 / 4096.0, 1e-6);
		assertNear(getProbMap(pMapP, 12),   1 / 4096.0, 1e-6);
		freeProbMap(pMapP);
	}

	it("returns identity transforms if the power is 1") {
		struct ProbMap* pMap = mallocProbMap();
		accumulateProbMap(pMap, 0, 0.5);
		accumulateProbMap(pMap, 1, 0.5);

		struct ProbMap* pMapP = powProbMap(pMap, 1, 0.0);

		assertSame(pMapP, pMap);
		freeProbMap(pMapP);
	}

	it("returns a unitary pMap if the power is 0") {
		struct ProbMap* pMap = mallocProbMap();
		accumulateProbMap(pMap, 0, 0.5);
		accumulateProbMap(pMap, 1, 0.5);

		struct ProbMap* pMapP = powProbMap(pMap, 0, 0.0);
		freeProbMap(pMap);

		assertEqual(sizeOfProbMap(pMapP), 1);
		assertNear(getProbMap(pMapP, 0), 1.0, 1e-6);
		freeProbMap(pMapP);
	}
}

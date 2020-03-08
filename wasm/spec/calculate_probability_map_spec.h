#include "util.h"
#include "../src/calculate_probability_map.h"
#include "../src/prizes.h"

describe(calculate_probability_map) {
	it("creates a map of value to probability") {
		reset_prizes();
		add_prize(1, 1);
		add_prize(7, 0);
		struct ProbMap* pMap = calculate_probability_map(
			sharedPrizes,
			sharedPrizesLength,
			1,
			0.0
		);

		assertEqual(sizeOfProbMap(pMap), 2);
		assertNear(getProbMap(pMap, 0), 0.875, 1e-12); // 7/8
		assertNear(getProbMap(pMap, 1), 0.125, 1e-12); // 1/8

		freeProbMap(pMap);
	}

	it("combines winnings from different tickets") {
		reset_prizes();
		add_prize(2, 1);
		add_prize(6, 0);
		struct ProbMap* pMap = calculate_probability_map(
			sharedPrizes,
			sharedPrizesLength,
			2,
			0.0
		);

		assertEqual(sizeOfProbMap(pMap), 3);
		assertNear(getProbMap(pMap, 0), 0.5357143, 1e-6); // 6/8 * 5/7 * 2C0
		assertNear(getProbMap(pMap, 1), 0.4285714, 1e-6); // 2/8 * 6/7 * 2C1
		assertNear(getProbMap(pMap, 2), 0.0357143, 1e-6); // 2/8 * 1/7 * 2C2

		freeProbMap(pMap);
	}

	it("combines winnings from different prizes") {
		reset_prizes();
		add_prize(1, 10);
		add_prize(3, 5);
		add_prize(4, 0);
		struct ProbMap* pMap = calculate_probability_map(
			sharedPrizes,
			sharedPrizesLength,
			4,
			0.0
		);

		assertEqual(sizeOfProbMap(pMap), 6);

		// (4x0): 4/8 * 3/7 * 2/6 * 1/5 * 4C4
		assertNear(getProbMap(pMap, 0), 0.0142857, 1e-6);

		// (1x5, 3x0): 3/8 * 4C1 * 4/7 * 3/6 * 2/5 * 3C3
		assertNear(getProbMap(pMap, 5), 0.1714286, 1e-6);

		// (1x10, 3x0): 1/8 * 4C1 * 4/7 * 3/6 * 2/5 * 3C3 +
		// ( 2x5, 2x0): 3/8 * 2/7 * 4C2 * 4/6 * 3/5 * 2C2
		assertNear(getProbMap(pMap, 10), 0.3142857, 1e-6);

		// (1x10, 1x5, 2x0): 1/8 * 4C1 * 3/7 * 3C1 * 4/6 * 3/5 * 2C2 +
		// (      3x5, 1x0): 3/8 * 2/7 * 1/6 * 4C3 * 4/5 * 1C1
		assertNear(getProbMap(pMap, 15), 0.3142857, 1e-6);

		// (1x10, 2x5, 1x0): 1/8 * 4C1 * 3/7 * 2/6 * 3C2 * 4/5 * 1C1
		assertNear(getProbMap(pMap, 20), 0.1714286, 1e-6);

		// (1x10, 3x5): 1/8 * 4C1 * 3/7 * 2/6 * 1/5 * 3C3
		assertNear(getProbMap(pMap, 25), 0.0142857, 1e-6);

		freeProbMap(pMap);
	}
}

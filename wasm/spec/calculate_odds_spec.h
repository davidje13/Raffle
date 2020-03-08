#include "util.h"
#include "../src/calculate_odds.h"

describe(calculate_odds) {
	it("generates a table of probabilities") {
		const struct PositionedList* odds = calculate_odds(9, 5, 4);

		assertEqual(odds->length, 5);
		assertNear(odds->values[0],  1.0 / 126, 1e-6); // 5c0 * 4c4 =  1*1 =  1
		assertNear(odds->values[1], 20.0 / 126, 1e-6); // 5c1 * 4c3 =  5*4 = 20
		assertNear(odds->values[2], 60.0 / 126, 1e-6); // 5c2 * 4c2 = 10*6 = 60
		assertNear(odds->values[3], 40.0 / 126, 1e-6); // 5c3 * 4c1 = 10*4 = 40
		assertNear(odds->values[4],  5.0 / 126, 1e-6); // 5c4 * 4c0 =  5*1 =  5
	}

	it("gives an exact list for 0 samples") {
		const struct PositionedList* odds = calculate_odds(7, 5, 0);

		assertEqual(odds->length, 1);
		assertNear(odds->values[0], 1.0, 1e-12);
	}

	it("gives an exact list for 1 sample") {
		const struct PositionedList* odds = calculate_odds(7, 5, 1);

		assertEqual(odds->length, 2);
		assertNear(odds->values[0], 2.0 / 7, 1e-6);
		assertNear(odds->values[1], 5.0 / 7, 1e-6);
	}

	it("fills in imposible high values with 0") {
		const struct PositionedList* odds = calculate_odds(7, 2, 4);

		assertEqual(odds->length, 5);
		assertNear(odds->values[0], 1.0 / 7, 1e-6);
		assertNear(odds->values[1], 4.0 / 7, 1e-6);
		assertNear(odds->values[2], 2.0 / 7, 1e-6);
		assertNear(odds->values[3], 0.0 / 7, 1e-6);
		assertNear(odds->values[4], 0.0 / 7, 1e-6);
	}

	it("fills in imposible low values with 0") {
		const struct PositionedList* odds = calculate_odds(7, 5, 4);

		assertEqual(odds->length, 5);
		assertNear(odds->values[0], 0.0 / 7, 1e-6);
		assertNear(odds->values[1], 0.0 / 7, 1e-6);
		assertNear(odds->values[2], 2.0 / 7, 1e-6);
		assertNear(odds->values[3], 4.0 / 7, 1e-6);
		assertNear(odds->values[4], 1.0 / 7, 1e-6);
	}

	it("fills in certainties due to full sampling") {
		const struct PositionedList* odds = calculate_odds(3, 2, 3);

		assertEqual(odds->length, 4);
		assertNear(odds->values[0], 0.0, 1e-12);
		assertNear(odds->values[1], 0.0, 1e-12);
		assertNear(odds->values[2], 1.0, 1e-12);
		assertNear(odds->values[3], 0.0, 1e-12);
	}

	it("fills in certainties due to no targets") {
		const struct PositionedList* odds = calculate_odds(3, 0, 2);

		assertEqual(odds->length, 3);
		assertNear(odds->values[0], 1.0, 1e-12);
		assertNear(odds->values[1], 0.0, 1e-12);
		assertNear(odds->values[2], 0.0, 1e-12);
	}

	it("fills in certainties due to saturated targets") {
		const struct PositionedList* odds = calculate_odds(3, 3, 2);

		assertEqual(odds->length, 3);
		assertNear(odds->values[0], 0.0, 1e-12);
		assertNear(odds->values[1], 0.0, 1e-12);
		assertNear(odds->values[2], 1.0, 1e-12);
	}
}

void checkFinalOdds(
	unsigned long long total,
	unsigned long long targets,
	unsigned int samples,
	double tolerance
) {
	const struct PositionedList* odds = calculate_odds(total, targets, samples);
	const double actual = calculate_final_odds(total, targets, samples);
	const double expected = odds->values[odds->length - 1];
	assertNear(actual, expected, tolerance);
}

describe(calculate_final_odds) {
	it("returns calculate_odds[samples]") {
		checkFinalOdds(100, 20, 10, 1e-6);
	}

	it("gives an exact value for 0 samples") {
		checkFinalOdds(100, 20, 0, 1e-12);
	}

	it("gives an exact value for 1 sample") {
		checkFinalOdds(100, 20, 1, 1e-12);
	}

	it("recognises impossible outcomes") {
		double actual = calculate_final_odds(7, 2, 4);

		assertNear(actual, 0.0, 1e-12);
	}
}

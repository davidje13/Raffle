#include "util.h"
#include "../src/ln_factorial.h"

#include <math.h>

describe(ln_factorial) {
	it("calculates log(n!) for small n") {
		// Simple (sum of logs) domain
		assertNear(ln_factorial(0), 0.0, 1e-6);
		assertNear(ln_factorial(1), 0.0, 1e-6);
		assertNear(ln_factorial(2), 0.6931472, 1e-6);
		assertNear(ln_factorial(3), 1.7917595, 1e-6);
		assertNear(ln_factorial(4), 3.1780538, 1e-6);
		assertNear(ln_factorial(256), 1167.2572786, 1e-6);
	}

	it("calculates log(n!) for large n") {
		// Stirling approximation domain
		assertNear(ln_factorial(257), 1172.8063546, 1e-6);
		assertNear(ln_factorial(300), 1414.9058499, 1e-6);
	}

	it("calculates log(n!) for very large n") {
		assertNear(ln_factorial(1000000), 12815518.3846582, 1e-6);
	}

	it("loses minimal precision") {
		double a = ln_factorial(1000000001);
		double b = ln_factorial(1000000000);

		assertNear(exp(a - b), 1000000001, 1e4);
	}
}

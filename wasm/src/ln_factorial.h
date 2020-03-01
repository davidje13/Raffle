#ifndef LN_FACTORIAL_H_
#define LN_FACTORIAL_H_

#include <math.h>

#define EXACT_COUNT 257
#define CACHE_COUNT 262144

// Thanks, https://www.johndcook.com/blog/2010/08/16/how-to-compute-log-factorial/
double calc_stirling(double x) {
	const double stirlingConst = 0.9189385332046727; // 0.5 * log(M_PI * 2.0);
	const double lnx = log(x);
	return 1.0 / (12.0 * x) - 0.5 * lnx + x * (lnx - 1.0) + stirlingConst;
}

double lookup[CACHE_COUNT] = {0.0, 0.0};
void ln_factorial_prep() {
	double v = 0.0;
	for(int i = 2; i < EXACT_COUNT; ++ i) {
		v += log((double) i);
		lookup[i] = v;
	}
	for(int i = EXACT_COUNT; i < CACHE_COUNT; ++ i) {
		lookup[i] = calc_stirling((double) (i + 1));
	}
}

double ln_factorial(long long n) {
	if(n < CACHE_COUNT) {
		return lookup[n];
	} else {
		return calc_stirling(n + 1);
	}
}

// Exports for testing
EMSCRIPTEN_KEEPALIVE double ln_factorial_(double n) {
	if(n < CACHE_COUNT) {
		return lookup[(int) n];
	} else {
		return calc_stirling(n + 1.0);
	}
}

#endif

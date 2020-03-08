#ifndef LN_FACTORIAL_H_
#define LN_FACTORIAL_H_

#include "options.h"
#include <math.h>

// Thanks, https://www.johndcook.com/blog/2010/08/16/how-to-compute-log-factorial/
// https://en.wikipedia.org/wiki/Stirling%27s_approximation#Speed_of_convergence_and_error_estimates
double calc_stirling_factorial(double x) {
	const double lnx = log(x);
	return (
		0.91893853320467274178 // 0.5 * log(M_PI * 2.0)
		+ 0.5 * lnx
		+ x * lnx
		- x
		+ (1.0 / 12.0) / x
		- (1.0 / 360.0) / (x * x * x)
//		+ (1.0 / 1260.0) / (x * x * x * x * x)
//		- (1.0 / 1680.0) / (x * x * x * x * x * x * x)
	);
}

static double lookup[CACHE_LNF_COUNT] = {0.0, 0.0};
void ln_factorial_prep() {
	double v = 0.0;
	for(unsigned int i = 2; i < EXACT_LNF_COUNT; ++ i) {
		v += log((double) i);
		lookup[i] = v;
	}
	for(unsigned int i = EXACT_LNF_COUNT; i < CACHE_LNF_COUNT; ++ i) {
		lookup[i] = calc_stirling_factorial((double) i);
	}
}

double ln_factorial(unsigned long long n) {
	if(n < CACHE_LNF_COUNT) {
		return lookup[n];
	} else {
		return calc_stirling_factorial((double) n);
	}
}

#endif

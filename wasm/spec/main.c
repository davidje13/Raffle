#include "utils.h"
#include "ln_factorial_spec.h"
#include "calculate_odds_spec.h"
#include "calculate_probability_map_spec.h"
#include "prob_map_mult_spec.h"
#include "../src/ln_factorial.h"

int main() {
	ln_factorial_prep();

	run_suite(ln_factorial);
	run_suite(calculate_odds);
	run_suite(calculate_final_odds);
	run_suite(calculate_probability_map);
	run_suite(prob_map_mult);
	run_suite(prob_map_pow);

	return conclude_tests();
}

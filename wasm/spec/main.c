#include "utils.h"
#include "ln_factorial_spec.h"
#include "calculate_odds_spec.h"
#include "calculate_probability_map_spec.h"
#include "../src/ln_factorial.h"

int main() {
	ln_factorial_prep();

	run_suite(ln_factorial);
	run_suite(calculate_odds);
	run_suite(calculate_final_odds);
	run_suite(calculate_probability_map);

	return conclude_tests();
}

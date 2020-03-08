#include <emscripten/emscripten.h>
#include "ln_factorial.h"
#include "calculate_odds.h"
#include "calculate_probability_map.h"

EMSCRIPTEN_KEEPALIVE void prep() {
	ln_factorial_prep();
}

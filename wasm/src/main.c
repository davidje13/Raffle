#include <emscripten/emscripten.h>
#include "ln_factorial.h"
#include "calculate_odds.h"

EMSCRIPTEN_KEEPALIVE void prep() {
	ln_factorial_prep();
}

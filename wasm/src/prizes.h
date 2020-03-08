#ifndef PRIZES_H_
#define PRIZES_H_

#include "options.h"

struct Prize {
	long long count;
	unsigned int value;
} __attribute__((packed));

static unsigned int sharedPrizesLength = 0;
static struct Prize sharedPrizes[MAX_PRIZES];

EMSCRIPTEN_KEEPALIVE void reset_prizes() {
	sharedPrizesLength = 0;
}

EMSCRIPTEN_KEEPALIVE void add_prize(double count, unsigned int value) {
	if (sharedPrizesLength >= MAX_PRIZES) {
		abort();
	}
	sharedPrizes[sharedPrizesLength].count = (unsigned long long) count;
	sharedPrizes[sharedPrizesLength].value = value;
	++ sharedPrizesLength;
}

#endif

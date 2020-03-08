#ifndef SPEC_UTILS_H_
#define SPEC_UTILS_H_

#include <stdio.h>
#include <stdarg.h>
#include <setjmp.h>

#define EMSCRIPTEN_KEEPALIVE

static const char* globalCurrentBlock = (void*) 0;
static const char* globalCurrentTest = (void*) 0;
static int testCount = 0;
static int testFailures = 0;

static jmp_buf buf;

#define describe(desc) void test_##desc(const char* currentBlock)
#define run_suite(desc) test_##desc(#desc);

#define it(desc) \
	++ testCount; \
	globalCurrentBlock = currentBlock; \
	globalCurrentTest = desc; \
	if (setjmp(buf)) { \
		++ testFailures; \
	} else for (; globalCurrentTest; globalCurrentTest = (void*) 0)

#define _fail(file, line, format, ...) \
	fprintf( \
		stderr, \
		"%s %s FAILED\n> " format " [%s:%d]\n\n", \
		globalCurrentBlock, \
		globalCurrentTest, \
		##__VA_ARGS__, \
		file, \
		line \
	), \
	longjmp(buf, 1)

#define fail(format, ...) _fail(__FILE__, __LINE__, format, ##__VA_ARGS__)

void _assertEqual(const char *file, int line, int a, int b) {
	if (a != b) {
		_fail(file, line, "Expected %d to equal %d", a, b);
	}
}
#define assertEqual(a, b) _assertEqual(__FILE__, __LINE__, a, b)

void _assertNear(const char *file, int line, double a, double b, double tolerance) {
	if (a < b - tolerance || a > b + tolerance) {
		_fail(file, line, "Expected %f to equal %f (+/- %f)", a, b, tolerance);
	}
}
#define assertNear(a, b, tolerance) _assertNear(__FILE__, __LINE__, a, b, tolerance)

int conclude_tests() {
	printf("total tests: %d, failures: %d\n", testCount, testFailures);
	if (testFailures > 0) {
		printf("FAIL\n\n");
		return 1;
	}
	printf("PASS\n\n");
	return 0;
}

#endif

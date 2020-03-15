#ifndef LINKEDMAP_H_
#define LINKEDMAP_H_

#include "memory.h"

#define DEFINE_LINKEDMAP(BaseName, KeyT, ValueT, globalCount) \
struct BaseName##Entry { \
	struct BaseName##Entry* next; \
	KeyT key; \
	ValueT value; \
}; \
DEFINE_MEMORY(BaseName##Entry, struct BaseName##Entry, globalCount, {}) \
struct BaseName { \
	struct BaseName##Entry* firstEntry; \
}; \
void clear##BaseName(struct BaseName* map) { \
	for (struct BaseName##Entry* i = map->firstEntry; i;) { \
		struct BaseName##Entry* next = i->next; \
		free##BaseName##Entry(i); \
		i = next; \
	} \
	map->firstEntry = (void*) 0; \
} \
int isEmpty##BaseName(const struct BaseName* map) { \
	return map->firstEntry == (void*) 0; \
} \
unsigned int sizeOf##BaseName(const struct BaseName* map) { \
	unsigned int n = 0; \
	for (struct BaseName##Entry* i = map->firstEntry; i; i = i->next) { \
		++ n; \
	} \
	return n; \
} \
void accumulate##BaseName( \
	struct BaseName* map, \
	const KeyT key, \
	const ValueT value \
) { \
	struct BaseName##Entry** p = &map->firstEntry; \
	for (; *p; p = &(*p)->next) { \
		const KeyT k = (*p)->key; \
		if (k >= key) { \
			if (k == key) { \
				(*p)->value += value; \
				return; \
			} \
			break; \
		} \
	} \
	struct BaseName##Entry* n = malloc##BaseName##Entry(); \
	n->next = *p; \
	n->key = key; \
	n->value = value; \
	*p = n; \
} \
ValueT get##BaseName( \
	struct BaseName* map, \
	const KeyT key \
) { \
	for (struct BaseName##Entry* i = map->firstEntry; i; i = i->next) { \
		if (i->key == key) { \
			return i->value; \
		} \
	} \
	return 0; \
} \


#define iterateLinkedMap(BaseName, mapPtr, entryVar, expr) { \
	for ( \
		const struct BaseName##Entry* entryVar##Mut = (mapPtr)->firstEntry; \
		entryVar##Mut; \
		entryVar##Mut = entryVar##Mut->next \
	) { \
		const struct BaseName##Entry* entryVar = entryVar##Mut; \
		expr \
	} \
}

#endif

#ifndef MAP_H_
#define MAP_H_

#include "memory.h"

#define DEFINE_MAP(BaseName, KeyT, ValueT, bucketCount, chunkSize, globalChunks) \
struct BaseName##Entry { \
	KeyT key; \
	ValueT value; \
} __attribute__((packed)); \
struct BaseName##Chunk { \
	struct BaseName##Chunk* next; \
	int length; \
	struct BaseName##Entry values[chunkSize]; \
} __attribute__((packed)); \
DEFINE_MEMORY(BaseName##Chunk, struct BaseName##Chunk, globalChunks, { \
	v->next = (void*) 0; \
	v->length = 0; \
}) \
struct BaseName { \
	int size; \
	struct BaseName##Chunk* buckets[bucketCount]; \
} __attribute__((packed)); \
void clear##BaseName(struct BaseName* map) { \
	map->size = 0; \
	for (int i = 0; i < (bucketCount); ++ i) { \
		struct BaseName##Chunk* chunk = map->buckets[i]; \
		while (chunk) { \
			struct BaseName##Chunk* next = chunk->next; \
			free##BaseName##Chunk(chunk); \
			chunk = next; \
		} \
		map->buckets[i] = (void*) 0; \
	} \
} \
int isEmpty##BaseName(const struct BaseName* map) { \
	return map->size == 0; \
} \
ValueT get##BaseName( \
	const struct BaseName* map, \
	const KeyT key, \
	const ValueT defaultValue \
) { \
	const struct BaseName##Chunk* chunk = map->buckets[key % (bucketCount)]; \
	while (chunk) { \
		for (int i = 0, e = chunk->length; i < e; ++ i) { \
			if (chunk->values[i].key == key) { \
				return chunk->values[i].value; \
			} \
		} \
		chunk = chunk->next; \
	} \
	return defaultValue; \
} \
ValueT* putIfAbsent##BaseName( \
	struct BaseName* map, \
	const KeyT key, \
	const ValueT value \
) { \
	struct BaseName##Chunk* chunk = map->buckets[key % (bucketCount)]; \
	if (!chunk) { \
		chunk = malloc##BaseName##Chunk(); \
		map->buckets[key % (bucketCount)] = chunk; \
	} \
	while (1) { \
		const int e = chunk->length; \
		for (int i = 0; i < e; ++ i) { \
			if (chunk->values[i].key == key) { \
				return &chunk->values[i].value; \
			} \
		} \
		if (e < (chunkSize)) { \
			++ chunk->length; \
			++ map->size; \
			chunk->values[e].key = key; \
			chunk->values[e].value = value; \
			return &chunk->values[e].value; \
		} \
		if (!chunk->next) { \
			chunk->next = malloc##BaseName##Chunk(); \
		} \
		chunk = chunk->next; \
	} \
} \
void set##BaseName( \
	struct BaseName* map, \
	const KeyT key, \
	const ValueT value \
) { \
	(*putIfAbsent##BaseName(map, key, value)) = value; \
}

#define iterateMap(BaseName, mapPtr, entryVar, expr) { \
	const struct BaseName* iterMap = (mapPtr); \
	for (int b = 0, iterN = 0, iterE = iterMap->size; iterN < iterE; ++ b) { \
		const struct BaseName##Chunk* iterChunk = iterMap->buckets[b]; \
		while (iterChunk) { \
			const int iterChunkE = iterChunk->length; \
			for (int iterI = 0; iterI < iterChunkE; ++ iterI) { \
				const struct BaseName##Entry* entryVar = &iterChunk->values[iterI]; \
				expr \
			} \
			iterN += iterChunkE; \
			iterChunk = iterChunk->next; \
		} \
	} \
}

#endif

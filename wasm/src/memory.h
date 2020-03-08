#ifndef MEMORY_H_
#define MEMORY_H_

#define min(a, b) ((a) < (b) ? (a) : (b))

#define MEM_MASK_T unsigned long long

#define MEM_MASK_SZ ((unsigned int) sizeof(MEM_MASK_T) * 8)
#define MEM_MASK_ELEMENTS(limit) (((limit) + MEM_MASK_SZ - 1) / MEM_MASK_SZ)
#define MEM_ELEMENTS(limit) (((limit) + MEM_MASK_SZ - 1) & ~(MEM_MASK_SZ - 1))

#define DEFINE_MEMORY(BaseName, ValueT, limit, resetBlock) \
static MEM_MASK_T mask##BaseName[MEM_MASK_ELEMENTS(limit)]; \
static ValueT blocks##BaseName[MEM_ELEMENTS(limit)]; \
static unsigned int beginMem##BaseName = 0; \
ValueT* malloc##BaseName() { \
	for (unsigned int i = beginMem##BaseName; i < MEM_MASK_ELEMENTS(limit); ++ i) { \
		const MEM_MASK_T v = mask##BaseName[i]; \
		if (v != ~(MEM_MASK_T) 0) { \
			MEM_MASK_T m = 1; \
			for (unsigned int j = 0; ; m <<= 1, ++ j) { \
				if (!(v & m)) { \
					beginMem##BaseName = i; \
					mask##BaseName[i] |= m; \
					return &blocks##BaseName[(i * MEM_MASK_SZ) | j]; \
				} \
			} \
		} \
	} \
	abort(); \
} \
void free##BaseName(ValueT* v) { \
	resetBlock \
	const unsigned int pos = v - blocks##BaseName; \
	const unsigned int i = pos / MEM_MASK_SZ; \
	beginMem##BaseName = min(i, beginMem##BaseName); \
	mask##BaseName[i] ^= ((MEM_MASK_T) 1) << (pos & (MEM_MASK_SZ - 1)); \
}

#endif

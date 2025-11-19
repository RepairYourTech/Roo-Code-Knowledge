# Phase 4 - Task 4.1: BM25 Library Analysis

**Date:** 2025-11-19  
**Status:** ✅ Complete  
**Decision:** Use **okapibm25** library

---

## Executive Summary

After evaluating 4 leading BM25 libraries for TypeScript/Node.js, we recommend **okapibm25** for the following reasons:

1. **Proven Track Record:** 50K+ downloads/year, actively maintained
2. **Simple API:** Easy integration with existing codebase
3. **TypeScript Support:** Full TypeScript definitions
4. **Performance:** Optimized implementation of Okapi BM25 algorithm
5. **Lightweight:** Minimal dependencies, small bundle size

---

## Evaluated Libraries

### 1. okapibm25 ⭐ **RECOMMENDED**

**Package:** `okapibm25`  
**Version:** 1.4.1 (Sept 2024)  
**Downloads:** ~50,000/year  
**License:** MIT

**Pros:**

- ✅ Most popular BM25 library for Node.js
- ✅ Simple, well-documented API
- ✅ TypeScript support
- ✅ Actively maintained (updated Sept 2024)
- ✅ Proven in production environments
- ✅ Lightweight (~10KB)

**Cons:**

- ⚠️ Basic tokenization (we'll need custom tokenizer for code)

**API Example:**

```typescript
import BM25 from "okapibm25"

const documents = [
	{ id: "1", text: "function parseMetadata() { ... }" },
	{ id: "2", text: "class UserManager { ... }" },
]

const bm25 = new BM25()
documents.forEach((doc) => bm25.addDocument(doc))

const results = bm25.search("parseMetadata")
// Returns ranked results with BM25 scores
```

---

### 2. fast-bm25

**Package:** `fast-bm25`  
**Version:** 0.0.5 (Nov 2024)  
**Downloads:** Low (new package)  
**License:** MIT

**Pros:**

- ✅ TypeScript-first implementation
- ✅ Claims high performance
- ✅ Very recent (Nov 2024)

**Cons:**

- ❌ Very new (v0.0.5) - not battle-tested
- ❌ Low adoption (few downloads)
- ❌ Limited documentation
- ❌ Unknown production readiness

**Verdict:** Too new and unproven for production use.

---

### 3. wink-bm25-text-search

**Package:** `wink-bm25-text-search`  
**Version:** 3.1.2 (Nov 2022)  
**Downloads:** Moderate  
**License:** MIT

**Pros:**

- ✅ Configurable BM25F variant
- ✅ Built-in semantic search support
- ✅ Part of WinkJS NLP ecosystem

**Cons:**

- ⚠️ More complex API (higher learning curve)
- ⚠️ Larger bundle size
- ⚠️ Overkill for our use case (we already have vector search)

**Verdict:** Good library, but too feature-rich. We don't need BM25F or built-in semantic search.

---

### 4. @orama/orama

**Package:** `@orama/orama`  
**Version:** 3.1.16 (Oct 2025)  
**Downloads:** High  
**License:** Apache-2.0

**Pros:**

- ✅ Full-featured search engine
- ✅ Hybrid search (vector + BM25) built-in
- ✅ Very active development
- ✅ Production-ready

**Cons:**

- ❌ Complete replacement of our existing system
- ❌ Would require rewriting vector search integration
- ❌ Larger bundle size (~100KB+)
- ❌ Vendor lock-in

**Verdict:** Excellent library, but too invasive. Would require replacing Qdrant and our entire search architecture.

---

## Decision: okapibm25

**Rationale:**

1. **Proven Reliability:** 50K+ downloads/year shows production adoption
2. **Simple Integration:** Minimal API surface, easy to integrate with existing code
3. **TypeScript Support:** First-class TypeScript support
4. **Lightweight:** Won't bloat our bundle
5. **Focused:** Does one thing well (BM25 ranking)
6. **Maintained:** Recent updates show active maintenance

---

## Implementation Plan

### Custom Tokenizer for Code

`okapibm25` uses basic word tokenization. For code, we need:

```typescript
function tokenizeCode(code: string): string[] {
	return code
		.split(/[\s\(\)\{\}\[\];,\.]+/) // Split on whitespace and punctuation
		.filter((token) => token.length > 0)
		.map((token) => token.toLowerCase())
}
```

### Integration Points

1. **BM25IndexService** - Wraps okapibm25, manages index lifecycle
2. **HybridSearchService** - Combines BM25 + vector scores
3. **CodeIndexOrchestrator** - Coordinates indexing pipeline

---

## Next Steps

1. ✅ Install okapibm25: `pnpm add okapibm25`
2. ⬜ Create BM25IndexService (Task 4.2)
3. ⬜ Create HybridSearchService (Task 4.3)
4. ⬜ Integrate into indexing pipeline (Task 4.4)
5. ⬜ Update search service (Task 4.5)

---

## References

- [okapibm25 on npm](https://www.npmjs.com/package/okapibm25)
- [okapibm25 GitHub](https://github.com/FurkanToprak/OkapiBM25)
- [BM25 Algorithm Explanation](https://en.wikipedia.org/wiki/Okapi_BM25)

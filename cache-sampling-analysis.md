# Cache Hashing Sampling: Performance & Security Tradeoff Analysis

## Summary

Streamlit's `@st.cache_data` / `@st.cache_resource` hashing layer samples large data objects (pandas, polars, numpy) instead of hashing them fully. This document analyzes (1) the performance cost of removing sampling, (2) the realistic threat surface of the sampling vulnerability, and (3) provides a recommendation.

**TL;DR:** The sampling vulnerability is largely theoretical for most deployments. Full hashing is viable for pandas/polars at typical data sizes but prohibitively expensive for very large numpy arrays. We recommend a hybrid approach: remove sampling for pandas/polars (where the cost is bounded and acceptable) and keep sampling for numpy with a per-process random seed.

---

## Part 1: Performance Analysis

### Methodology

- **Machine:** Linux (cloud VM), Python 3.12, numpy 2.4.4, pandas 3.0.3, polars 1.41.2
- **Hash function:** BLAKE2b (16-byte digest), matching Streamlit's `util.create_fast_hasher()`
- **Measurement:** Median of 5 runs per configuration
- **Sampling thresholds:** Pandas/Polars: 50,000 rows → sample 10,000; NumPy: 500,000 elements → sample 100,000

### Results

| Type | Size | Memory | Sampled | Full | Slowdown |
|------|------|--------|---------|------|----------|
| pandas DataFrame | 50k rows | 1.5 MB | 1.81 ms | 2.00 ms | 1.11x |
| pandas DataFrame | 100k rows | 3.1 MB | 2.36 ms | 3.36 ms | 1.42x |
| pandas DataFrame | 500k rows | 15.3 MB | 6.54 ms | 18.16 ms | 2.78x |
| pandas DataFrame | 1M rows | 30.5 MB | 12.18 ms | 35.20 ms | 2.89x |
| pandas DataFrame | 5M rows | 152.6 MB | 65.61 ms | 218.66 ms | **3.33x** |
| pandas Series | 50k | 0.4 MB | 1.00 ms | 0.90 ms | 0.90x |
| pandas Series | 100k | 0.8 MB | 1.58 ms | 1.71 ms | 1.09x |
| pandas Series | 500k | 3.8 MB | 5.79 ms | 10.28 ms | 1.78x |
| pandas Series | 1M | 7.6 MB | 11.38 ms | 22.15 ms | 1.95x |
| pandas Series | 5M | 38.1 MB | 66.99 ms | 122.45 ms | **1.83x** |
| numpy ndarray | 500k | 3.8 MB | 1.80 ms | 5.00 ms | 2.78x |
| numpy ndarray | 1M | 7.6 MB | 1.75 ms | 9.83 ms | 5.63x |
| numpy ndarray | 5M | 38.1 MB | 2.69 ms | 49.67 ms | 18.48x |
| numpy ndarray | 10M | 76.3 MB | 2.72 ms | 127.53 ms | 46.95x |
| numpy ndarray | 50M | 381.5 MB | 2.37 ms | 670.83 ms | **283.04x** |
| polars DataFrame | 50k rows | 1.5 MB | 0.60 ms | 0.32 ms | 0.53x |
| polars DataFrame | 100k rows | 3.1 MB | 0.44 ms | 0.83 ms | 1.88x |
| polars DataFrame | 500k rows | 15.3 MB | 0.69 ms | 2.32 ms | 3.38x |
| polars DataFrame | 1M rows | 30.5 MB | 0.88 ms | 3.77 ms | 4.27x |
| polars DataFrame | 5M rows | 152.6 MB | 0.87 ms | 18.63 ms | **21.35x** |
| polars Series | 50k | 0.4 MB | 0.47 ms | 0.09 ms | 0.19x |
| polars Series | 100k | 0.8 MB | 0.41 ms | 0.15 ms | 0.36x |
| polars Series | 500k | 3.8 MB | 0.47 ms | 0.74 ms | 1.58x |
| polars Series | 1M | 7.6 MB | 0.62 ms | 1.19 ms | 1.93x |
| polars Series | 5M | 38.1 MB | 0.71 ms | 5.45 ms | **7.72x** |

### Key Performance Observations

1. **pandas DataFrame/Series:** Full hashing at 5M rows costs ~220 ms (DataFrame) or ~122 ms (Series). The slowdown factor is moderate (1.8x–3.3x). Even at 5M rows, the full hash completes in under 250 ms — acceptable for a cache-check operation that happens once per unique argument set.

2. **polars DataFrame/Series:** Polars' native `hash_rows()` is extremely fast. Full hashing at 5M rows takes only ~19 ms (DataFrame) or ~5 ms (Series). The high ratio (21x for DataFrame) is misleading because the *absolute* sampled time is already sub-millisecond — the full hash is still fast in absolute terms.

3. **numpy ndarray:** This is where sampling matters enormously. At 50M elements, full hashing via `.tobytes()` costs 671 ms vs. 2.4 ms sampled — a **283x** slowdown. The `.tobytes()` approach is I/O-bound (copying 381 MB to a hash function). Even at 5M elements, full hashing takes 50 ms vs. 2.7 ms. Numpy's raw-bytes approach scales linearly with array size and has no optimized column-oriented hash like pandas/polars.

4. **Sampling overhead for small objects:** For objects below the sampling threshold (50k for pandas/polars), the sampling logic (`.sample()` call, RNG setup) actually adds overhead. For polars Series at 50k elements, the sampled path is 5x *slower* than full hashing because the sample call + overhead dominates the cheap full-object hash.

5. **Context for absolute times:** A 220 ms hash for a 5M-row DataFrame is comparable to the time it takes to serialize/deserialize the same data. Users working with 5M+ row DataFrames already accept multi-second operations. Cache checks happen once per unique argument combination, not on every rerun.

---

## Part 2: Threat Model Analysis

### 2.1 Who is the attacker?

| Deployment Scenario | Attacker Controls Data? | Risk Level |
|---|---|---|
| **Single-user local dev** | User IS the data source | None — self-attack |
| **Internal dashboard (trusted DB/API)** | No — data comes from trusted sources | Negligible |
| **Public app with user-input → cached fn** | Possibly, if user input becomes a cached function argument | Low–Medium |
| **Multi-tenant with shared cache** | Possibly, if using `@st.cache_resource` or `persist="disk"` | Medium |

The realistic attack scenario requires ALL of the following:

1. The attacker can control the exact contents of a large (50k+ row) DataFrame or array
2. That DataFrame/array is passed directly as an argument to a cached function
3. The attacker and victim share the same cache (requires `@st.cache_resource` or `persist="disk"`)
4. The attacker can pre-compute which indices are sampled (trivial with the hardcoded seed)
5. The attacker can craft two different datasets that produce the same hash after sampling

### 2.2 What does a successful collision achieve?

A successful hash collision means two different inputs map to the same cache key, causing the cached function to return stale/incorrect results.

**Impact analysis by cache type:**

| Cache Mechanism | Shared Across Sessions? | Attack Surface |
|---|---|---|
| `@st.cache_data` (default) | No — per-session | Attacker must be in same session as victim. Not exploitable in multi-user scenarios. |
| `@st.cache_resource` | **Yes** — shared across all sessions | Attacker in one session can poison results seen by all users. |
| `@st.cache_data(persist="disk")` | **Yes** — persisted to filesystem | Attacker can poison results that persist across server restarts. |
| `@st.cache_resource(validate=...)` | Partially — validation may catch inconsistencies | Depends on the validation function. |

**Consequence severity:**

- The victim sees incorrect data (wrong computation results, wrong chart, wrong metrics)
- In a dashboard context, this could cause incorrect business decisions
- However, the attacker cannot execute code — this is a data integrity issue, not RCE
- The poisoned cache entry expires according to `ttl` or `max_entries` parameters

### 2.3 How realistic is the attack?

**Difficulty factors making the attack hard:**

1. **Data control is rare:** Most cached functions operate on DB query results (`pd.read_sql`), API responses, or file reads. It is uncommon for raw user input to become a 50k+ row DataFrame argument.

2. **Exact byte control required:** The attacker needs to control the exact float64 values in a DataFrame. In practice, user input goes through transformations (parsing, validation, type coercion) that make precise byte-level control difficult.

3. **Cache key includes more than just data:** The cache key includes the function's source code, all arguments, and their types. The attacker needs the *entire* cache key to collide, not just the data portion.

4. **Collision crafting is non-trivial:** Even knowing which indices are sampled, the attacker must produce two different datasets where:
   - The sampled positions have identical values
   - The non-sampled positions differ in a meaningful way
   - Both datasets are valid inputs that the cached function would process

5. **Limited value without shared cache:** With `@st.cache_data` (the default), caches are per-session. The attacker would need to poison their own session first, then somehow cause the victim to use the same session.

**Factors making it easier:**

1. **Deterministic sampling:** With `random_state=0`, the sampled indices are fixed and publicly known. An attacker can trivially compute them.
2. **Public source code:** The hashing implementation is open source, so all implementation details are available.
3. **Simple sampling strategy:** Only 10k of 50k+ rows are checked — the attacker has 40k+ "free" rows to modify without detection.

### 2.4 Comparison to other accepted risks

| Risk | Streamlit's Current Stance |
|---|---|
| **MD5 (formerly) / BLAKE2b for cache keys** | BLAKE2b is collision-resistant. No known practical attacks. |
| **xxhash for session IDs** | Not cryptographic, but acceptable for the use case. |
| **Sampling with hardcoded seed** | Known positions can be exploited → current issue. |
| **No HMAC or authentication on cache entries** | Cache entries are not signed; any process with filesystem access can tamper with persisted caches. |
| **Pickle for cache serialization** | Deserialization of malicious pickles is a known RCE vector, but cache files are server-side only. |

The sampling vulnerability is strictly weaker than the pickle deserialization risk. An attacker who can write to the disk cache directory can already inject arbitrary code via pickle, which is far more severe than data poisoning via hash collision.

### 2.5 Verdict on threat realism

**Low severity, low probability for the vast majority of deployments.** The attack is theoretically possible in a narrow scenario (multi-tenant app with `@st.cache_resource`, where user input directly becomes a cached function's DataFrame argument of 50k+ rows). This combination is rare in practice.

---

## Part 3: Recommendation

### Recommendation: **Option C — Hybrid Approach**

Based on the performance data and threat analysis, implement a tiered mitigation:

#### 1. Remove sampling for pandas and polars (Option A for these types)

**Rationale:**
- pandas DataFrame at 5M rows: 219 ms full hash is acceptable (< 250 ms)
- pandas Series at 5M rows: 122 ms full hash is acceptable
- polars DataFrame at 5M rows: 19 ms full hash is fast
- polars Series at 5M rows: 5.5 ms full hash is fast
- These are one-time costs per unique argument set, not per-rerun
- The sampling overhead for small objects actually *hurts* performance (polars Series at 50k: 0.47 ms sampled vs. 0.09 ms full)

**Implementation:** Simply remove the `if len(obj) >= _PANDAS_ROWS_LARGE: obj = obj.sample(...)` blocks for pandas and polars types.

#### 2. For numpy: use a per-process random seed (not hardcoded)

**Rationale:**
- numpy at 50M elements: 671 ms full hash is too expensive for many use cases
- numpy at 10M elements: 128 ms is borderline
- Sampling provides a **283x** speedup at 50M elements — removing it would be a significant regression
- A per-process random seed (generated once at import time via `os.urandom`) makes the sampled positions unpredictable to an attacker without compromising determinism within a single process lifetime

**Implementation:**
```python
import os
import struct

# Generated once per process, unpredictable to external attackers
_NUMPY_SAMPLING_SEED = struct.unpack("I", os.urandom(4))[0]

# In the numpy hashing path:
if np_obj.size >= _NP_SIZE_LARGE:
    state = np.random.RandomState(_NUMPY_SAMPLING_SEED)
    np_obj = state.choice(np_obj.flat, size=_NP_SAMPLE_SIZE)
```

**Tradeoff:** This means the same numpy array may produce different cache keys across process restarts. For `persist="disk"` caches, this means a cache miss after restart. This is acceptable because:
- `persist="disk"` already handles cache misses gracefully (just re-computes)
- The security improvement outweighs the minor cache-miss cost
- Alternatively, use `secrets.token_bytes()` + HMAC for a key-dependent sample selection

#### 3. Document the limitation

Regardless of implementation changes, add documentation noting:
- Cache key computation uses sampling for very large numpy arrays (50M+ elements)
- This is a performance optimization that trades strict collision resistance for speed
- For security-sensitive deployments, users should validate cached results independently or use `validate` parameter

### Why not full removal of sampling (Option A)?

The 283x slowdown for large numpy arrays (670 ms at 50M elements) would make caching counterproductive for workloads involving large images, ML model outputs, or scientific computing arrays. A 670 ms hash check on every potential cache hit fundamentally changes the performance characteristics of `@st.cache_data` for these users.

### Why not just document it (Option B)?

While the threat is largely theoretical, the fix for pandas/polars is essentially free (removing code, slightly slower for 5M+ row edge cases, *faster* for small objects). There's no reason to keep exploitable-in-principle behavior when removing it has negligible cost.

### Summary of recommended changes

| Type | Current | Proposed | Performance Impact |
|---|---|---|---|
| pandas DataFrame | Sample 10k of 50k+ rows | Hash full object | +3.3x at 5M rows (219 ms absolute) |
| pandas Series | Sample 10k of 50k+ rows | Hash full object | +1.8x at 5M rows (122 ms absolute) |
| polars DataFrame | Sample 10k of 50k+ rows | Hash full object | +21x at 5M rows (19 ms absolute) |
| polars Series | Sample 10k of 50k+ rows | Hash full object | +7.7x at 5M rows (5.5 ms absolute) |
| numpy ndarray | Sample 100k of 500k+ elements (seed=0) | Sample with per-process random seed | ~0% (same sampling, different seed) |

### Risk assessment of recommendation

- **Breaking change risk:** Low. Cache keys will change for pandas/polars objects ≥50k rows, invalidating existing caches. This is a one-time cost and caches regenerate automatically.
- **Performance regression risk:** Moderate for pandas at 5M+ rows. These users already accept multi-second operations for data processing; an extra 150 ms for hash computation is unlikely to be noticed.
- **Security improvement:** Eliminates the known-position sampling attack for pandas/polars entirely. Makes the numpy attack non-deterministic (attacker cannot pre-compute sampled indices).

---

## Appendix: Running the Benchmark

```bash
# From the repo root, with the Streamlit dev environment active:
python benchmark_cache_hashing.py
```

The benchmark script is at `benchmark_cache_hashing.py` in the repo root. It measures median wall-clock time over 5 runs for each type × size × approach combination.

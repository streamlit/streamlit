# `st.cache_data(copy="cow")` Area Stability evaluation

## Conclusion

The prototype did not make the optimized Area Stability dashboard faster. Across three
cache-cleared runs per condition, parallel fragments with normal deep copies averaged
14.33 seconds, while the same app with `copy="cow"` averaged 17.13 seconds. CoW was
19.5% slower than the equivalent deep-copy condition and 10.4% slower than the original
app.

The parallel-fragment and dynamic-tab work still improved progressive rendering. Its
data cutoff appeared in about 4–5 seconds in representative runs, compared with 11.1
seconds in the original app. That benefit is separate from the CoW result.

Recommendation: do not advance this prototype as the performance solution for issue
#17084. Keep the mutation-isolation design and tests as reference material, but profile
the validation and copy paths before considering another implementation. The dashboard
results do support continuing the parallel-fragment and dynamic-tab optimization with
the existing deep-copy cache behavior.

## Prototype behavior

The opt-in `copy="cow"` mode:

- leaves the default pickle serialize/deserialize behavior unchanged;
- supports pandas DataFrames and Series, immutable scalar values, and nested built-in
  tuples, lists, and dictionaries;
- returns shallow pandas copies while copying axes and `attrs`;
- rejects mutable object cells and unsupported values instead of sharing them;
- requires pandas Copy-on-Write on pandas versions before 3;
- rejects `persist="disk"` because its baseline is process-local; and
- participates in clear, TTL/LRU eviction, async writes, and background refresh.

Targeted tests cover default behavior, cache hits, caller/cache mutation isolation,
nested dashboard-shaped returns, concurrent readers, clear, eviction, TTL, async
writes, and background refresh.

## Method

The dashboard used the saved Area Stability experiment with two local controls:

- `ASM_CACHE_COPY_MODE=deep|cow` selects the cache implementation.
- `?parallel=0|1` selects the original app or parallel fragments with dynamic tabs.

Each measured run:

1. used the same local dashboard code and Streamlit prototype;
2. used the same selected values: Current State by Area, Org `(all)`, Area `(all)`,
   and Category `(all)`;
3. loaded data with the same displayed cutoff, `2026-10-12 09:13 UTC`;
4. set `clear_cache=1` with a unique reload token;
5. started timing at browser navigation;
6. ended when the data cutoff, Overall Health, Drill into an Org/Area, and Metrics
   Lookup were present and the parallel loading placeholders were gone; and
7. disabled the browser asset cache for the final matrix.

Snowflake external-browser authentication completed before measurements and is excluded.
The secure local credential cache allowed server-mode changes without including login
time.

The app's `run_end` instrumentation is not an end-to-end measure in parallel mode: the
main script finishes immediately after dispatching parallel fragments. Browser section
readiness is therefore the authoritative timing here.

## Raw results

All values are seconds from browser navigation to the completion condition.

### Original app, deep copies

- Run 1: 15.342
- Run 2: 16.040
- Run 3: 15.157
- Mean: 15.513
- Median: 15.342
- Range: 15.157–16.040

### Parallel fragments and dynamic tabs, deep copies

- Run 1: 14.348
- Run 2: 11.934
- Run 3: 16.723
- Mean: 14.335
- Median: 14.348
- Range: 11.934–16.723
- Mean change from original: 7.6% faster

### Parallel fragments and dynamic tabs, CoW

- Run 1: 19.073
- Run 2: 15.974
- Run 3: 16.349
- Mean: 17.132
- Median: 16.349
- Range: 15.974–19.073
- Mean change from parallel/deep: 19.5% slower
- Mean change from original: 10.4% slower

## Representative section readiness

These marks come from one representative cache-cleared run per condition. They show the
progressive-rendering shape, not a replacement for the three-run totals.

### Original app, deep copies

- App header: 4.701 seconds
- Data cutoff: 11.101 seconds
- Overall Health: 11.574 seconds
- Drill into an Org/Area: 14.763 seconds
- Metrics Lookup / completion: 15.157 seconds

### Parallel fragments and dynamic tabs, deep copies

- App header and data cutoff: 4.300 seconds
- Overall Health and drilldown: 13.324 seconds
- Metrics Lookup / completion: 14.348 seconds

### Parallel fragments and dynamic tabs, CoW

- App header and data cutoff: 5.121 seconds
- Overall Health and drilldown: 17.119 seconds
- Metrics Lookup / completion: 18.121 seconds

## Memory observations

One post-series RSS sample was 1,639 MiB for deep mode and 977 MiB for CoW mode. This is
not a controlled memory comparison: the processes had completed different numbers and
orders of runs, and Python's allocator can retain freed memory. The samples are recorded
because RSS was requested, but they are not evidence of a specific memory saving.

## Behavior verification

Browser testing confirmed:

- initial Current State by Area content;
- Current State by Org;
- Breach conditions;
- Metrics Trending by Org;
- Metrics Lookup after selecting the Joe Witt organization;
- rendered Preprod Quality and Production category content; and
- the actual dashboard cached DataFrames passed the mutation-isolation probe in CoW
  mode.

The mutation probe mutates both DataFrames returned by `_prepare_health_data`, calls the
cached function again, and verifies neither marker column is present in the second
caller's results.

## Invalid attempts and limitations

- Initial attempts were discarded because generated local secrets used `laurawilby`
  while the configured Snowflake identity was `lwilby`. Authentication failures and
  repeated validation windows were not timed.
- Browser attempts that did not mount the Streamlit frontend on repeated local
  navigations were discarded. The final matrix used browser caching disabled.
- Monitoring attempts that attached after completion or required instrumentation absent
  from the original mode were discarded.
- Warehouse load and result-cache state are external variables and were not reset.
- The three-run ranges overlap, so the exact percentages are not stable enough for a
  general performance claim. They are sufficient to reject the hypothesis that this CoW
  prototype makes this dashboard consistently faster.
- Per-cache timing could not be separated reliably from concurrent query, preparation,
  and chart work. The browser totals capture the user-visible result.

## Interpretation

The cache's pickle deserialization cost was not the dominant end-to-end bottleneck in
this experiment. The CoW path also performs safety work that the default path does not:
it validates nested values, axes, object cells, and metadata, then constructs isolated
pandas containers. For the Area Stability return shapes, that work outweighed any
avoided deep-copy cost.

The stronger result is architectural: parallel fragments and dynamic tabs can expose
useful content much earlier, but changing cache-copy semantics is not required to obtain
that progressive-rendering improvement.

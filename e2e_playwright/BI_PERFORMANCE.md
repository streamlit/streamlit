# BI dashboard performance benchmarks

The BI suite measures focused user interactions against deterministic,
locally generated dashboard data. It is separate from the ordinary all-browser
E2E suite and from the historical Playwright performance artifacts.

## Benchmark designs

- **Executive overview:** Four KPIs and seven chart tiles with tile-local range
  and series controls. The data-preview tab is dynamic, so its dataframe is
  built only after the tab opens.
- **Linked analysis:** Vega point and interval selections cross-filter KPIs and
  dependent charts. The selectable region chart intentionally ignores its own
  region filter, and the brush chart ignores its own time filter, so both
  controls remain usable.
- **Selection diagnostics:** Focused one-chart point and interval benchmarks
  distinguish chart-event latency from full-dashboard rendering.

Vega and ECharts use the same generated rows, filters, and aggregations for
equivalent display and presentation interactions. The landed
`st.echarts_chart` API is display-only, so selection benchmarks are Vega-only.
Do not add a simulated ECharts selection path. Add ECharts selection benchmarks
after a public selection API lands.

## Stable IDs and primary metrics

IDs follow:

```text
bi.<design>.<renderer>.rows<row-count>.<interaction>.v<definition-version>
```

Keep an ID unchanged only while its app state, gesture, completion contract,
and primary metric are unchanged. The raw sample also includes a source
fingerprint. A paired report marks changed definitions or toolchains
non-comparable instead of calculating a misleading delta.

The primary metric is `interaction_to_completion_ms`, measured from browser
input—or pointer release for selections—until the expected completion state
has painted and two animation frames have passed. Each raw sample also records:

- input-to-BackMsg latency;
- rerun count from the app-visible run counter;
- WebSocket message counts and payload bytes;
- server script duration from the completion contract;
- last received WebSocket frame to final paint;
- maximum long-animation-frame duration.

Functional assertions are separate from the recorded timing. They verify
filtered row counts and checksums, renderer output parity, selection state,
clear-filter restoration, expected reruns, and that the browser-only ECharts
legend interaction performs no rerun.

## Adding an interaction

1. Add the deterministic state and UI to
   `bi_performance_dashboard.py`. Reuse `_generate_rows`, `_filter_rows`, and
   the shared aggregation helpers.
2. Include final filter state, row count or checksum, run counter, and server
   duration in the `bi_completion` contract.
3. Add a test in `bi_performance_dashboard_test.py` with both
   `performance` and `bi_performance` markers.
4. Warm the interaction, restore its initial state, then call
   `measure_interaction`. Keep correctness assertions outside the measurement
   helper.
5. Give the benchmark a stable ID and identify
   `interaction_to_completion_ms` as its primary metric unless the interaction
   has a documented reason to use another metric.
6. Add equivalent Vega and ECharts cases only where both public APIs implement
   the same semantics.

## Tiers and local commands

Build the profiling frontend before collecting measurements:

```bash
make frontend-with-profiler
make bi-performance-short
make bi-performance-extended
```

The short tier uses Chromium, 10,002 rows, one warmup per test invocation, and
five measured samples. It includes initial load, range, series, preview, point,
brush, slow brush, clear, ECharts legend, and single-chart selection
diagnostics. It is the labeled-PR tier.

The extended tier uses 100,002 rows and three measured samples for the
large-payload initial-load, range, and preview variants. Override the sample
count for investigation with `BI_PERFORMANCE_SAMPLES`.

## Paired PR comparison

Apply the `run-performance` label to a PR. The BI workflow removes the label,
then checks out the event's exact base SHA and PR merge commit into isolated
source trees and Python environments. Both revisions run sequentially on the
same 8-core runner. The workflow:

- compares only matching IDs with identical benchmark definitions and
  toolchains;
- uploads versioned combined JSON containing raw samples, revision and
  toolchain metadata, medians, absolute and percentage deltas, counts, and a
  median-absolute-deviation noise indicator;
- writes a concise GitHub summary that keeps selection latency and reruns
  visible;
- reports missing or failed samples as partial artifacts;
- never fails a PR based on a performance threshold.

The generic Performance Suite still writes its established single-revision
artifacts on pushes to `develop`; it explicitly excludes the BI marker. Use
the BI workflow's manual trigger to compare arbitrary revisions or run the
extended tier.

## Runtime

Local validation on an Apple M4 Pro with the profiling frontend already built
measured:

- short tier, one revision: 3 minutes;
- paired short execution and report: about 6 minutes;
- extended tier: 43 seconds.

The paired figure is two sequential five-sample short runs plus report
generation on the same host. It excludes checkout, dependency installation,
and frontend build time, which the labeled workflow adds. The workflow prints
each revision's benchmark runtime in its job summary so CI setup time remains
distinguishable from the measurements.

## Limitations

- Results are single-user, loopback measurements on a shared GitHub runner.
  They do not include production network, Snowflake, SiS, warehouse, or
  concurrency costs.
- The short sample count supports medians and a noise indicator, not a reliable
  p95. Frame quantization makes differences below roughly one 60 Hz frame hard
  to interpret.
- WebSocket payload bytes are measured from CDP frame payloads and are useful
  for paired trends, not wire-level accounting.
- The app-visible server duration covers the benchmark script body, not every
  queueing, serialization, or transport phase.
- ECharts selection coverage is unavailable until its public API supports
  Python-facing selection events.

# Playwright e2e Tests

You can find documentation on how to use and implement Playwright end-to-end tests in [our wiki](../wiki/running-e2e-tests.md).

## BI performance benchmarks

The BI benchmarks measure focused interactions against deterministic local
dashboard data. They run separately from the ordinary all-browser E2E suite:

```bash
make frontend-with-profiler
make bi-performance-short
make bi-performance-extended
```

The short tier is the canonical labeled-PR suite; the extended tier covers
larger payloads. Apply the `run-performance` label to compare the PR merge
commit with its exact base SHA. Both revisions run sequentially on the same
runner. The report is informational: compare medians and reruns alongside the
noise indicator, and treat changed benchmark definitions or toolchains as
non-comparable.

To add an interaction, follow the existing cases in
`bi_performance_dashboard_test.py`: use deterministic app-visible completion
data, warm and reset the interaction, and keep correctness assertions outside
the measurement. Keep a benchmark ID unchanged only while its state, gesture,
completion contract, and primary metric are unchanged.

The default primary metric, `interaction_to_completion_ms`, runs from browser
input—or pointer release for selections—until completion has painted and two
animation frames have passed. ECharts selection benchmarks remain unavailable
until ECharts has a public Python-facing selection API.

Interpret results as single-user loopback measurements on a shared runner.
The small sample count supports medians and a noise indicator, not a reliable
p95. WebSocket byte counts are useful for paired trends rather than wire-level
accounting, and the app-visible server duration does not include every
queueing, serialization, or transport phase.

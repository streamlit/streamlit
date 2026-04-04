# Starlette Optimization Findings

## Methodology

- Load-test harness: `make run-e2e-test e2e_playwright/load_testing/test_load.py`
- Browser: `chromium`
- Concurrency: `10` local sessions
- Measurement style: scenario-specific deltas versus a local baseline
- Caveat: these are local measurements, useful for relative ranking, not a replacement for the 80-user CI numbers in the plan

## Baseline Diagnostics

- HTTP backend: `HttpToolsProtocol`
- WebSocket backend: `WebSocketProtocol`
- Uvicorn loop setting: `auto`
- `httptools` installed: `True`
- `uvloop` installed: `True`
- AnyIO default thread tokens: `40`

## Round 1 Summary

- `E6 Skip middleware for static files` was the strongest stable first-round win:
  - `simple_app`: load p50 `-19.9%`, rerun p99 `-5.3%`, peak RSS `-21.7%`
  - `caching_app`: load p50 `-10.9%`, peak RSS `-9.6%`
- `E3 AnyIO limiter N=20` gave the best first-round rerun-tail result, but only on `widget_heavy_app`:
  - rerun p99 `-57.5%`
  - load p50 `+15.8%`
  - threads `51 -> 30`
- `E1 Explicit httptools + uvloop` behaved like a guardrail, not a real optimization.
- `E5 wsproto` was unstable in all tested scenarios.
- `E11 Combined quick wins` failed `widget_heavy_app`.
- `E12 Direct send` helped some rerun-heavy cases, but failed `many_messages_app` badly.

## Round 2 Follow-up Results

The second round tested three follow-ups suggested by round 1:

1. Split `E6` into session-only and gzip-only variants
2. Combine the full static bypass with tighter AnyIO values (`24`, `28`, `32`)
3. Replace direct-send with a safer batched sender-task variant

### Split `E6`

| Experiment | Scenario | load p50 | rerun p99 | mem peak | threads | Conclusion |
|---|---|---:|---:|---:|---:|---|
| `F1 Session-only static bypass` | `simple_app` | `+50.4%` | `+14.5%` | `+3.1%` | `+19.1%` | Clear regression |
| `F1 Session-only static bypass` | `caching_app` | `+98.6%` | `+30.0%` | `-0.6%` | `-9.3%` | Clear regression |
| `F2 GZip-only static bypass` | `simple_app` | `-44.4%` | `+0.2%` | `-16.0%` | `+19.1%` | Strong win |
| `F2 GZip-only static bypass` | `caching_app` | `-19.4%` | `-16.6%` | `-17.8%` | `+9.3%` | Strong win |

Takeaway: the first-round `E6` win was not coming from `SessionMiddleware`. Locally, the gain came overwhelmingly from bypassing `GZipMiddleware` on static asset requests.

### `E6 + AnyIO` Sweep

| Experiment | Scenario | load p50 | rerun p99 | mem peak | threads |
|---|---|---:|---:|---:|---:|
| `F3 Full static bypass + AnyIO N=24` | `simple_app` | `-42.0%` | `-4.2%` | `-16.6%` | `-29.8%` |
| `F3 Full static bypass + AnyIO N=24` | `caching_app` | `-9.2%` | `+47.6%` | `-18.1%` | `-33.3%` |
| `F3 Full static bypass + AnyIO N=24` | `widget_heavy_app` | `+35.8%` | `+31.5%` | `-16.7%` | `-41.7%` |
| `F3 Full static bypass + AnyIO N=28` | `simple_app` | `-41.2%` | `-16.7%` | `-16.5%` | `-8.5%` |
| `F3 Full static bypass + AnyIO N=28` | `caching_app` | `-24.0%` | `+4.5%` | `-18.2%` | `-20.4%` |
| `F3 Full static bypass + AnyIO N=28` | `widget_heavy_app` | `-14.2%` | `+1.9%` | `-17.1%` | `-26.7%` |
| `F3 Full static bypass + AnyIO N=32` | `simple_app` | `-37.7%` | `-13.3%` | `-16.2%` | `+0.0%` |
| `F3 Full static bypass + AnyIO N=32` | `caching_app` | `-30.1%` | `-16.1%` | `-18.1%` | `-20.4%` |
| `F3 Full static bypass + AnyIO N=32` | `widget_heavy_app` | `-13.5%` | `+12.1%` | `-17.2%` | `-21.7%` |

Takeaway: `N=28` was the best overall balance. `N=24` over-optimized for thread reduction and hurt rerun behavior. `N=32` was also good, especially on `caching_app`, but `N=28` was the safest all-around point across `simple_app`, `caching_app`, and `widget_heavy_app`.

### Batched Sender Task

| Experiment | Scenario | load p50 | rerun p99 | mem peak | threads | Conclusion |
|---|---|---:|---:|---:|---:|---|
| `F4 Batched sender task` | `widget_heavy_app` | `+2.6%` | `+29.5%` | `+2.3%` | `-15.0%` | Worse |
| `F4 Batched sender task` | `many_messages_app` | `-29.1%` | `-64.5%` | `-1.4%` | `-15.5%` | Strong win |
| `F4 Batched sender task` | `fragment_app` | `+5.2%` | `-8.1%` | `+0.8%` | `+8.9%` | Mixed |

Takeaway: batching the existing sender task is much safer than direct-send, but it is still workload-specific. It looks genuinely promising for `many_messages_app`, but not as a universal optimization.

## Recommended Direction

- Promote `static gzip bypass` to the top candidate. It produced the clearest stable wins and explains the earlier `E6` result much better than session bypass.
- If we want one combined low-risk-ish candidate, use `static gzip bypass + AnyIO N=28` as the next implementation target.
- Keep `batched sender task` as a message-heavy follow-up, not a global default.
- Deprioritize:
  - session-only middleware bypass
  - `websockets-sansio`
  - `wsproto`
  - send queue size reduction
  - direct-send / no-queue WebSocket path

## Send Queue Matrix

I also ran an extra queue-size sweep on top of the optimized branch state for:

- `50`
- `100`
- `200`
- `300`
- `500` (baseline)
- `750`
- `1000`

Scenarios tested:

- `many_messages_app`
- `widget_heavy_app`
- `fragment_app`

Key takeaways:

- Queue size still does **not** look like a primary memory lever. Peak RSS moved only slightly for most values:
  - best memory result was `50` on `many_messages_app` at `-7.1%`
  - most other deltas stayed roughly within `-3%` to `+1%`
- If optimizing only for message-heavy scenarios, smaller or larger values can help a lot:
  - `100` was strongest for `many_messages_app` and very strong for `widget_heavy_app`
  - `750` was also very strong on those two scenarios
- But `100` and `750` both hurt `fragment_app`, especially `750`, which regressed fragment rerun p99 by `+124.8%`
- The best **global compromise** was `1000`:
  - `many_messages_app`: load p50 `-31.0%`, rerun p99 `-30.7%`
  - `widget_heavy_app`: rerun p99 `-45.9%`, but load p50 `+12.3%`
  - `fragment_app`: load p50 `-9.3%`, rerun p99 `+2.7%`
- Conclusion: there is no universally dominant queue size, and queue tuning remains secondary to the middleware/gzip and AnyIO wins. If a global change is desired, `1000` is the least risky promising value from the matrix. If optimizing specifically for very message-heavy workloads, `100` is the stronger aggressive choice.

## Raw Artifacts

- Round 1 raw summary: `work-tmp/agent-metrics/starlette-experiments/summary.json`
- Round 2 raw summary: `work-tmp/agent-metrics/starlette-followup-experiments/summary.json`
- Round 2 compact table: `work-tmp/agent-metrics/starlette-followup-experiments/summary.md`
- Send queue matrix: `work-tmp/agent-metrics/send-queue-matrix/summary.md`

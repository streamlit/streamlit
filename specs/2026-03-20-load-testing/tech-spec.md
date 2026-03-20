---
author: lukasmasuch
created: 2026-03-20
---

# Server Load Testing Setup

## Summary

A load testing framework to measure Streamlit server performance under concurrent user load. Uses Playwright to simulate parallel browser sessions while collecting backend metrics (memory, CPU, response times, WebSocket latency). Runs on-demand in CI via a manually-triggered GitHub Actions workflow on a 64-core runner, with results uploaded as artifacts for regression analysis.

## Problem

We currently lack systematic load testing for the Streamlit server. This makes it difficult to:

1. **Detect performance regressions** — Changes like the Tornado→Starlette migration may impact server performance under load, but we have no baseline or automated way to measure this.
2. **Understand concurrency limits** — We don't know how many concurrent users/sessions the server can handle before degradation.
3. **Identify memory leaks** — Long-running servers with many sessions may leak memory, but this isn't tested.
4. **Validate architectural changes** — Server-side changes (caching, fragments, session handling) need load testing to validate they don't regress performance.

### Related Work

- Existing `@pytest.mark.performance` tests measure single-session rendering performance, not server load.
- The `performance.yml` workflow runs microbenchmarks, but doesn't test concurrent connections.

## Proposal

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Actions (64-core runner)             │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────────────────────────────┐   │
│  │  Streamlit   │◄───│  Playwright Workers (N parallel)     │   │
│  │  Server      │    │  - Each simulates 1 user session     │   │
│  │  (single     │    │  - Performs predefined interactions  │   │
│  │   process)   │    │  - Reports timing metrics            │   │
│  └──────┬───────┘    └──────────────────────────────────────┘   │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐    ┌──────────────────────────────────────┐   │
│  │  Metrics     │───►│  JSON Results + Summary              │   │
│  │  Collector   │    │  (uploaded as workflow artifacts)    │   │
│  │  (psutil)    │    └──────────────────────────────────────┘   │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Single Streamlit server process** — We test a single server instance to simulate realistic deployment. The server runs in a subprocess with metrics collection via `psutil`.

2. **Playwright for user simulation** — Reuses existing e2e infrastructure (`conftest.py` utilities). Each Playwright worker represents one concurrent user with a real browser context and WebSocket connection.

3. **Backend-focused metrics** — Primary metrics are server-side: memory RSS, CPU %, WebSocket message latency, session count, script execution time. Frontend metrics (render time) are secondary.

4. **Scenario-based testing** — Multiple test scenarios (simple app, data-heavy app, widget-heavy app, caching patterns) to test different server behaviors.

5. **64-core runner** — Allows spawning many parallel Playwright workers without client-side bottlenecks affecting results.

### Directory Structure

Located within `e2e_playwright/` to reuse existing infrastructure (conftest, fixtures, utilities):

```
e2e_playwright/
├── load_testing/
│   ├── __init__.py
│   ├── conftest.py              # Load test fixtures, extends parent conftest
│   ├── metrics_collector.py     # psutil-based server metrics collection
│   ├── scenarios/
│   │   ├── __init__.py
│   │   ├── simple_app.py        # Minimal app for baseline
│   │   ├── data_heavy_app.py    # Large dataframes, configurable message sizes
│   │   ├── widget_heavy_app.py  # Many interactive widgets
│   │   ├── caching_app.py       # @st.cache_data patterns
│   │   └── fragment_app.py      # @st.fragment patterns
│   ├── test_load.py             # Main load test suite
│   ├── generate_report.py       # Results aggregation and markdown report
│   └── README.md                # Usage documentation
└── ...
```

This placement allows direct imports from the parent `conftest.py` (`wait_for_app_run`, `wait_until`, etc.) and reuse of `shared/app_utils.py` helpers.

### Metrics Collected

#### Server Metrics (via psutil, sampled every 500ms)

| Metric | Description |
|--------|-------------|
| `memory_rss_mb` | Resident Set Size in MB |
| `memory_rss_peak_mb` | Peak RSS during test |
| `memory_rss_growth_mb` | RSS growth from start to end |
| `cpu_percent` | CPU utilization (0-100 per core) |
| `cpu_percent_avg` | Average CPU over test duration |
| `cpu_percent_peak` | Peak CPU utilization |
| `active_sessions` | Number of active WebSocket sessions |
| `thread_count` | Number of server threads |

#### Request/Response Metrics (per session)

| Metric | Description |
|--------|-------------|
| `ws_connect_time_ms` | WebSocket connection establishment time |
| `initial_load_time_ms` | Time to first complete app render |
| `rerun_time_ms` | Time for script rerun after interaction |
| `ws_message_latency_ms` | Round-trip time for WebSocket messages |

#### Aggregate Metrics

| Metric | Description |
|--------|-------------|
| `total_duration_s` | Total test duration |
| `sessions_completed` | Number of sessions that completed successfully |
| `sessions_failed` | Number of sessions that failed/timed out |
| `p50_load_time_ms` | 50th percentile initial load time |
| `p95_load_time_ms` | 95th percentile initial load time |
| `p99_load_time_ms` | 99th percentile initial load time |

### Test Scenarios

All scenarios run with the same `--concurrent-users` value (default: 50). This simplifies configuration and makes cross-scenario comparisons straightforward.

#### 1. Baseline: Simple App
```python
# scenarios/simple_app.py
import streamlit as st

st.title("Load Test - Simple")
st.write("Hello, World!")
if st.button("Click me"):
    st.write("Clicked!")
```
- **Purpose**: Establish baseline server overhead (minimal processing)
- **Interaction**: Load page, click button, verify response

#### 2. Data Heavy App

Inspired by `e2e_playwright/forward_msg_cache.py` — configurable message sizes and large dataframes to stress ForwardMsg serialization and caching.

```python
# scenarios/data_heavy_app.py
import streamlit as st
import pandas as pd

st.title("Load Test - Data Heavy")

# Configurable message payload (similar to forward_msg_cache.py)
num_messages = st.number_input("Messages", value=20, min_value=1, max_value=100)
kb_per_message = st.number_input("KB per message", value=10, min_value=1, max_value=100)

message_1kb = "Lorem ipsum..." * 20  # ~1KB when rendered

with st.container(height=300):
    for i in range(num_messages):
        st.markdown(f"**Message {i}:** " + "\n\n".join(kb_per_message * [message_1kb]))

# Large dataframe (configurable size)
@st.cache_data
def create_dataframe(rows: int, cols: int) -> pd.DataFrame:
    return pd.DataFrame({f"col_{i}": range(rows) for i in range(cols)})

if st.toggle("Show dataframe"):
    df = create_dataframe(50000, 10)
    st.dataframe(df)
```
- **Purpose**: Test memory under ForwardMsg serialization load, validate message caching
- **Interaction**: Load page, toggle dataframe, trigger reruns

#### 3. Widget Heavy App
```python
# scenarios/widget_heavy_app.py
import streamlit as st

st.title("Load Test - Widget Heavy")

cols = st.columns(3)
for i in range(30):
    with cols[i % 3]:
        st.text_input(f"Input {i}", key=f"input_{i}")
        st.slider(f"Slider {i}", 0, 100, key=f"slider_{i}")
        st.checkbox(f"Check {i}", key=f"check_{i}")
```
- **Purpose**: Test widget state management under load (90+ widgets)
- **Interaction**: Fill inputs, adjust sliders, check boxes

#### 4. Caching App
```python
# scenarios/caching_app.py
import streamlit as st
import time

@st.cache_data
def expensive_computation(n: int) -> list[int]:
    time.sleep(0.05)  # Simulate work
    return list(range(n))

st.title("Load Test - Caching")

n = st.slider("N", 100, 10000, 1000)
data = expensive_computation(n)
st.write(f"Computed {len(data)} items")

if st.button("Rerun"):
    st.rerun()
```
- **Purpose**: Validate cache effectiveness under concurrent access (cache hit ratio)
- **Interaction**: Adjust slider (mix of cache hits + misses), trigger reruns

#### 5. Fragment App
```python
# scenarios/fragment_app.py
import streamlit as st

st.title("Load Test - Fragments")

@st.fragment
def counter_fragment():
    if "count" not in st.session_state:
        st.session_state.count = 0
    if st.button("Increment", key="frag_btn"):
        st.session_state.count += 1
    st.write(f"Count: {st.session_state.count}")

counter_fragment()

# Heavy content outside fragment (should NOT rerun on fragment interaction)
with st.expander("Heavy content"):
    for i in range(20):
        st.markdown(f"**Item {i}**: " + "x" * 500)

st.button("Full rerun")
```
- **Purpose**: Test fragment partial rerun performance (fragment-only vs full reruns)
- **Interaction**: Rapid fragment button clicks, occasional full reruns

### Implementation Details

#### Metrics Collector

```python
# load_testing/metrics_collector.py
import psutil
import threading
import time
from dataclasses import dataclass, field
from typing import List

@dataclass
class ServerMetrics:
    timestamp: float
    memory_rss_mb: float
    cpu_percent: float
    thread_count: int
    # ... additional fields

class MetricsCollector:
    def __init__(self, pid: int, interval_ms: int = 500):
        self.process = psutil.Process(pid)
        self.interval = interval_ms / 1000
        self.samples: List[ServerMetrics] = []
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self):
        self._thread = threading.Thread(target=self._collect_loop, daemon=True)
        self._thread.start()

    def stop(self) -> dict:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)
        return self._compute_summary()

    def _collect_loop(self):
        while not self._stop_event.is_set():
            try:
                mem = self.process.memory_info()
                cpu = self.process.cpu_percent()
                threads = self.process.num_threads()
                self.samples.append(ServerMetrics(
                    timestamp=time.time(),
                    memory_rss_mb=mem.rss / 1024 / 1024,
                    cpu_percent=cpu,
                    thread_count=threads,
                ))
            except psutil.NoSuchProcess:
                break
            time.sleep(self.interval)

    def _compute_summary(self) -> dict:
        if not self.samples:
            return {}
        return {
            "memory_rss_mb_start": self.samples[0].memory_rss_mb,
            "memory_rss_mb_end": self.samples[-1].memory_rss_mb,
            "memory_rss_mb_peak": max(s.memory_rss_mb for s in self.samples),
            "memory_rss_mb_growth": self.samples[-1].memory_rss_mb - self.samples[0].memory_rss_mb,
            "cpu_percent_avg": sum(s.cpu_percent for s in self.samples) / len(self.samples),
            "cpu_percent_peak": max(s.cpu_percent for s in self.samples),
            "sample_count": len(self.samples),
        }
```

#### Session Metrics (per Playwright worker)

```python
# e2e_playwright/load_testing/conftest.py
import time
import uuid
from dataclasses import dataclass, field

from e2e_playwright.conftest import wait_for_app_run

@dataclass
class SessionMetrics:
    session_id: str
    ws_connect_time_ms: float = 0
    initial_load_time_ms: float = 0
    rerun_times_ms: list[float] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    completed: bool = False
```

#### Test Runner

Uses a single `--concurrent-users` CLI option that applies to all scenarios:

```python
# e2e_playwright/load_testing/test_load.py
import pytest
from concurrent.futures import ThreadPoolExecutor, as_completed

def pytest_addoption(parser):
    parser.addoption("--concurrent-users", type=int, default=50,
                     help="Number of concurrent users for load tests")
    parser.addoption("--scenarios", default="all",
                     help="Scenarios to run (comma-separated or 'all')")

@pytest.fixture
def concurrent_users(request) -> int:
    return request.config.getoption("--concurrent-users")

@pytest.mark.load_test
def test_simple_app_load(
    streamlit_server: tuple[subprocess.Popen, str, MetricsCollector],
    concurrent_users: int,
    browser: Browser,
):
    """Test simple app under concurrent user load."""
    process, app_url, metrics_collector = streamlit_server
    metrics_collector.start()

    session_results = []

    def run_session(session_num: int) -> SessionMetrics:
        context = browser.new_context()
        page = context.new_page()
        metrics = SessionMetrics(session_id=f"session_{session_num}")

        try:
            load_start = time.perf_counter()
            page.goto(app_url)
            wait_for_app_run(page)
            metrics.initial_load_time_ms = (time.perf_counter() - load_start) * 1000

            page.get_by_role("button", name="Click me").click()
            rerun_start = time.perf_counter()
            wait_for_app_run(page)
            metrics.rerun_times_ms.append((time.perf_counter() - rerun_start) * 1000)

            metrics.completed = True
        except Exception as e:
            metrics.errors.append(str(e))
        finally:
            context.close()

        return metrics

    with ThreadPoolExecutor(max_workers=concurrent_users) as executor:
        futures = [executor.submit(run_session, i) for i in range(concurrent_users)]
        for future in as_completed(futures):
            session_results.append(future.result())

    server_metrics = metrics_collector.stop()
    results = aggregate_results(server_metrics, session_results, scenario="simple_app")
    write_results(results)

    assert results["sessions_failed"] == 0
    assert results["p95_load_time_ms"] < 10000
```

### GitHub Actions Workflow

```yaml
# .github/workflows/load-testing.yml
name: Load Testing

on:
  workflow_dispatch:
    inputs:
      concurrent_users:
        description: 'Number of concurrent users'
        required: false
        default: '50'
      scenarios:
        description: 'Scenarios to run (comma-separated, or "all")'
        required: false
        default: 'all'

jobs:
  load-test:
    runs-on: ubuntu-latest-64-cores
    timeout-minutes: 60

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install uv
        uses: astral-sh/setup-uv@v5

      - name: Install dependencies
        run: |
          uv sync
          uv run playwright install chromium

      - name: Build frontend
        run: make frontend-fast

      - name: Run load tests
        run: |
          uv run pytest e2e_playwright/load_testing/test_load.py \
            -v \
            --tb=short \
            --concurrent-users=${{ inputs.concurrent_users }} \
            --scenarios="${{ inputs.scenarios }}"

      - name: Generate summary report
        if: always()
        run: |
          uv run python e2e_playwright/load_testing/generate_report.py \
            --results-dir=e2e_playwright/load_testing/results \
            --output=e2e_playwright/load_testing/results/summary.md

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: load-test-results-${{ github.sha }}
          path: e2e_playwright/load_testing/results/
          retention-days: 90

      - name: Add summary to workflow
        if: always()
        run: |
          echo "## Load Test Results" >> $GITHUB_STEP_SUMMARY
          cat e2e_playwright/load_testing/results/summary.md >> $GITHUB_STEP_SUMMARY
```

### Results Format

```json
{
  "metadata": {
    "timestamp": "2026-03-20T10:30:00Z",
    "git_sha": "abc123",
    "git_branch": "feature/starlette",
    "scenario": "simple_app",
    "concurrent_users": 50,
    "runner": "ubuntu-latest-64-cores"
  },
  "server_metrics": {
    "memory_rss_mb_start": 85.2,
    "memory_rss_mb_end": 142.8,
    "memory_rss_mb_peak": 156.3,
    "memory_rss_mb_growth": 57.6,
    "cpu_percent_avg": 34.2,
    "cpu_percent_peak": 89.1,
    "sample_count": 120
  },
  "session_metrics": {
    "total_sessions": 50,
    "sessions_completed": 50,
    "sessions_failed": 0,
    "initial_load_time_ms": {
      "min": 234,
      "max": 1823,
      "mean": 542,
      "p50": 498,
      "p95": 1245,
      "p99": 1756
    },
    "rerun_time_ms": {
      "min": 45,
      "max": 312,
      "mean": 89,
      "p50": 78,
      "p95": 198,
      "p99": 287
    }
  },
  "raw_samples": [
    {"timestamp": 0.0, "memory_rss_mb": 85.2, "cpu_percent": 12.3, ...},
    ...
  ]
}
```

### Reusing E2E Infrastructure

The load testing framework reuses these utilities from `e2e_playwright/`:

- `conftest.py`:
  - `wait_for_app_run()` — Wait for script execution to complete
  - `wait_until()` — Generic condition waiter
  - Server process management patterns
- `shared/app_utils.py` — Widget interaction helpers (click_button, fill_input, etc.)

### Extension Points

1. **Custom scenarios** — Add new `scenarios/*.py` files
2. **Additional metrics** — Extend `MetricsCollector` with more psutil data (disk I/O, network, etc.)
3. **Alerting thresholds** — Configure acceptable regression percentages in results assertions

## Future Work

These features are intentionally deferred to keep the initial implementation focused:

### Comparison Mode

Automatically compare load test results between two branches:

```yaml
# Future workflow input
compare_branch:
  description: 'Branch to compare against'
  required: false
```

Would generate diff reports:

```markdown
## Load Test Comparison: feature/starlette vs develop

| Metric | develop | feature/starlette | Change |
|--------|---------|-------------------|--------|
| Memory Peak (MB) | 142.8 | 138.2 | -3.2% ✅ |
| P95 Load Time (ms) | 1245 | 1389 | +11.6% ⚠️ |
```

### Scheduled Nightly Runs

Once baselines are established, add scheduled runs to track performance over time.

### Multi-User-Count Parameterization

Option to run each scenario with multiple user counts (10, 25, 50, 100) for deeper analysis.

### WebSocket Message-Level Metrics

Instrument WebSocket frames to measure individual message latencies and sizes.

## Alternatives Considered

### 1. Locust or k6 Instead of Playwright

**Pros**: Purpose-built for load testing, more efficient resource usage
**Cons**: Cannot simulate real browser behavior (JavaScript, WebSocket handshake), would require reimplementing Streamlit protocol

**Decision**: Use Playwright because we need real browser sessions with actual WebSocket connections to accurately test the server.

### 2. Docker-based Multi-Server Testing

**Pros**: Could test horizontal scaling, more production-like
**Cons**: Adds complexity, harder to isolate server performance, not our primary use case

**Decision**: Focus on single-server performance first. Multi-server testing can be added later if needed.

### 3. Continuous Performance Monitoring (run on every PR)

**Pros**: Catches regressions immediately
**Cons**: Expensive (64-core runner), slows down CI, noisy results from variance

**Decision**: Manual trigger for now. Can add scheduled nightly runs once baselines are established.

### 4. Frontend Performance Metrics via Lighthouse

**Pros**: Industry-standard frontend metrics
**Cons**: Focuses on frontend rendering, not server performance

**Decision**: Out of scope for this spec. Could be a separate initiative.

## Checklist

| Item | Status |
|------|--------|
| No breaking changes | N/A (new feature) |
| No new runtime dependencies | Yes (`psutil` already in dev deps) |
| Security impact | None |
| Documentation needed | Yes (README in `e2e_playwright/load_testing/`) |
| Rollout plan | Manual workflow, iterate on scenarios |

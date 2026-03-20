# Streamlit Server Load Testing Framework

## Problem

We lack systematic load testing for the Streamlit server. This gap makes it difficult to:

1. **Detect regressions** from architectural changes (e.g., Tornado → Starlette migration)
2. **Understand concurrency limits** — how many simultaneous users before degradation?
3. **Identify memory leaks** in long-running servers with many sessions

## Goals

- Measure server performance under realistic concurrent user load
- Collect server-side metrics (memory, CPU, threads) during load
- Produce comparable results across commits for regression detection
- Run in CI with configurable concurrency levels

## Non-Goals

- Frontend performance profiling (Lighthouse, Core Web Vitals)
- Horizontal scaling / multi-server deployments
- Network simulation (latency, packet loss)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Test Orchestrator                        │
│                      (pytest main process)                      │
└─────────────────────────────────────────────────────────────────┘
        │                                              │
        │ starts                                       │ spawns N
        ▼                                              ▼
┌───────────────────┐                    ┌─────────────────────────┐
│  Streamlit Server │◄───── HTTP/WS ────│   Playwright Workers    │
│  (single process) │                    │   (N separate procs)    │
│                   │                    │                         │
│  • Port 8501      │                    │  Worker 0: Browser → WS │
│  • Metrics via    │                    │  Worker 1: Browser → WS │
│    psutil PID     │                    │  Worker 2: Browser → WS │
│                   │                    │  ...                    │
└───────────────────┘                    │  Worker N: Browser → WS │
                                         └─────────────────────────┘
```

### Key Design Decisions

**One server, many clients**: A single Streamlit server subprocess handles all concurrent connections. This is what we want to stress-test.

**Multiprocessing, not threading**: Playwright's sync API is not thread-safe when sharing browser instances. Using `multiprocessing` gives each worker its own Python interpreter and Playwright browser — true parallelism with no shared state issues.

**Real browsers**: Each worker runs a real Chromium instance with actual WebSocket connections. This accurately simulates user load, unlike HTTP-only tools (Locust, k6) that can't test Streamlit's bidirectional protocol.

## Implementation

### Directory Structure

```
e2e_playwright/load_testing/
├── conftest.py              # Fixtures: server lifecycle, worker pool
├── metrics_collector.py     # psutil-based server metrics sampling
├── worker.py                # Subprocess entry point for Playwright sessions
├── test_load.py             # Test scenarios and assertions
├── generate_report.py       # Results → Markdown summary
├── scenarios/
│   ├── simple_app.py        # Minimal baseline
│   ├── dataframe_app.py     # Large payload serialization
│   ├── widget_heavy_app.py  # 90+ widgets, state management
│   ├── caching_app.py       # @st.cache_data patterns
│   └── fragment_app.py      # @st.fragment partial reruns
└── results/                 # JSON output (gitignored)
```

### Core Components

#### 1. Server Fixture (session-scoped)

Starts one Streamlit server per test session. All workers connect to this server.

```python
@pytest.fixture(scope="session")
def load_test_server(scenario_path: Path) -> Generator[ServerInfo, None, None]:
    port = find_available_port()
    process = subprocess.Popen([
        sys.executable, "-m", "streamlit", "run", str(scenario_path),
        "--server.port", str(port),
        "--server.headless", "true",
    ])
    wait_for_server(port)
    yield ServerInfo(url=f"http://localhost:{port}", pid=process.pid)
    process.terminate()
```

#### 2. Worker Pool (multiprocessing)

Spawns N Playwright processes targeting the shared server. Uses `apply_async` for per-worker timeout and error isolation.

```python
def run_concurrent_load_test(
    server_url: str, scenario: str, num_users: int, timeout_sec: int = 120
) -> list[SessionMetrics]:
    worker_args = [(server_url, i, scenario, timeout_sec) for i in range(num_users)]
    results: list[SessionMetrics] = []

    with Pool(processes=num_users) as pool:
        async_results = [pool.apply_async(run_worker_session, args) for args in worker_args]

        for i, ar in enumerate(async_results):
            try:
                result = ar.get(timeout=timeout_sec + 30)
                results.append(result)
            except TimeoutError:
                results.append(SessionMetrics(
                    session_id=f"worker_{i}",
                    errors=[f"Worker timed out after {timeout_sec}s"],
                ))
            except Exception as e:
                results.append(SessionMetrics(
                    session_id=f"worker_{i}",
                    errors=[f"{type(e).__name__}: {e}"],
                ))

    return results
```

#### 3. Worker Process

Each worker is a separate Python process with its own Playwright browser.

```python
# worker.py - runs in subprocess
def run_worker_session(server_url: str, worker_id: int) -> SessionMetrics:
    """Execute one user session. Called via multiprocessing."""
    metrics = SessionMetrics(session_id=f"worker_{worker_id}")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context()
        page = context.new_page()

        # Measure initial load
        start = time.perf_counter()
        page.goto(server_url)
        wait_for_app_run(page)
        metrics.initial_load_time_ms = (time.perf_counter() - start) * 1000

        # Run interactions (scenario-specific)
        run_interactions(page, metrics)

        browser.close()

    return metrics
```

#### 4. Metrics Collector

Samples server process metrics via psutil while workers run.

```python
class MetricsCollector:
    def __init__(self, server_pid: int, interval_ms: int = 500):
        self.process = psutil.Process(server_pid)
        self.samples: list[MetricSample] = []

    def start(self):
        """Start background sampling thread."""
        self._running = True
        self._thread = threading.Thread(target=self._sample_loop)
        self._thread.start()

    def _sample_loop(self):
        while self._running:
            self.samples.append(MetricSample(
                memory_rss_mb=self.process.memory_info().rss / 1024 / 1024,
                cpu_percent=self.process.cpu_percent(),
                num_threads=self.process.num_threads(),
            ))
            time.sleep(self.interval_ms / 1000)
```

### Error Handling

Worker failures are isolated—they never crash the main test process. Each failure mode is handled explicitly:

| Failure Mode | Handling |
|--------------|----------|
| Worker exception | Caught by `ar.get()`, recorded as failed session with error message |
| Worker timeout | `ar.get(timeout=N)` raises `TimeoutError`, recorded as timeout failure |
| Worker crash | Pool detects, raises exception, recorded as failure |
| All workers fail | Test completes, reports 0% success rate, assertion fails gracefully |

The load test **always produces results**—failed sessions are data points (success=False, error=...). Final assertions check aggregate success rate:

```python
def test_scenario(load_results):
    success_rate = sum(r.completed for r in load_results) / len(load_results)
    assert success_rate >= 0.9, f"Success rate {success_rate:.0%} below 90%"
```

### Test Flow

```
1. pytest starts
2. Fixture launches Streamlit server on available port
3. MetricsCollector starts sampling server PID (background thread)
4. multiprocessing.Pool spawns N worker processes
5. Each worker (in parallel):
   a. Launches own Chromium browser
   b. Navigates to http://localhost:PORT
   c. Waits for app load (WebSocket connected, script finished)
   d. Executes scenario interactions (clicks, inputs)
   e. Records timing metrics
   f. Closes browser, returns SessionMetrics
6. Main process collects results via apply_async().get() with timeouts
7. MetricsCollector stops, aggregates samples
8. Results written to JSON
9. Assertions validate success rate, P95 latency
10. Server terminated
```

## Metrics

### Server Metrics (sampled every 500ms)

| Metric | Description |
|--------|-------------|
| `memory_rss_mb` | Resident Set Size |
| `memory_rss_mb_peak` | Peak RSS during test |
| `memory_rss_mb_growth` | End - Start RSS |
| `cpu_percent_avg` | Average CPU utilization |
| `cpu_percent_peak` | Peak CPU utilization |
| `thread_count_max` | Maximum server threads |

### Session Metrics (per worker)

| Metric | Description |
|--------|-------------|
| `initial_load_time_ms` | Time to first complete render |
| `rerun_times_ms` | Script rerun durations |
| `websocket_connect_ms` | WS handshake time |
| `errors` | Any exceptions encountered |

### Aggregate Metrics

| Metric | Description |
|--------|-------------|
| `sessions_completed` | Successful sessions |
| `sessions_failed` | Failed/timed out sessions |
| `p50/p95/p99_load_time_ms` | Percentile distributions |

## Test Scenarios

| Scenario | Purpose | Key Stress |
|----------|---------|------------|
| `simple_app` | Baseline overhead | Minimal — connection + rerun |
| `dataframe_app` | Payload serialization | Large ForwardMsg, caching |
| `widget_heavy_app` | State management | 90+ widgets, BackMsg volume |
| `caching_app` | Cache effectiveness | Concurrent cache access |
| `fragment_app` | Partial reruns | Fragment vs full rerun cost |

## CI Integration

GitHub Actions workflow with manual trigger:

```yaml
name: Load Testing
on:
  workflow_dispatch:
    inputs:
      concurrent_users:
        description: 'Number of concurrent users'
        default: '50'
      scenario:
        description: 'Scenario to run (or leave empty for all)'
        default: ''

jobs:
  load-test:
    runs-on: ubuntu-latest-64-cores  # High-core runner
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - name: Run load tests
        env:
          CONCURRENT_USERS: ${{ inputs.concurrent_users }}
          SCENARIO_FILTER: ${{ inputs.scenario }}
        run: |
          PYTEST_ARGS=(-v --num-sessions="$CONCURRENT_USERS")
          if [ -n "$SCENARIO_FILTER" ]; then
            PYTEST_ARGS+=(-k "$SCENARIO_FILTER")
          fi
          uv run pytest e2e_playwright/load_testing/test_load.py "${PYTEST_ARGS[@]}"
      - uses: actions/upload-artifact@v4
        with:
          name: load-test-results
          path: e2e_playwright/load_testing/results/
```

## Usage

```bash
# Run all scenarios with 50 concurrent users
uv run pytest e2e_playwright/load_testing/test_load.py \
  --num-sessions=50

# Run specific scenario
uv run pytest e2e_playwright/load_testing/test_load.py \
  --num-sessions=25 \
  -k simple_app

# Generate summary report
uv run python e2e_playwright/load_testing/generate_report.py \
  --results-dir=e2e_playwright/load_testing/results
```

## Success Criteria

| Scenario | Requirement |
|----------|-------------|
| `simple_app` | 100% success rate, P95 load < 5s |
| Others | >90% success rate, P95 load < 10s |
| All | Memory growth < 100MB per 50 users |

## Future Enhancements

- WebSocket-level metrics (message count, latency)
- Long-running soak tests (hours, detect memory leaks)
- Comparison reports across git commits
- Grafana dashboard for historical trends

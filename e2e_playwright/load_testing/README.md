# Streamlit Server Load Testing

A load testing framework to measure Streamlit server performance under user load. Uses Playwright to simulate browser sessions while collecting backend metrics.

## Overview

This framework tests how the Streamlit server performs when handling user sessions. It:

- Simulates realistic browser sessions with real WebSocket connections
- Collects server-side metrics (memory, CPU, threads)
- Measures client-side timing (load times, rerun times)
- Produces JSON results and markdown summaries

**Note:** This framework uses Python's multiprocessing to run concurrent browser sessions against a single Streamlit server. Each worker process has its own Playwright browser instance.

## Quick Start

### Local Testing

From the repository root:

```bash
# Run with default settings (5 sessions, all scenarios)
make run-e2e-test e2e_playwright/load_testing/test_load.py

# Run with a specific browser and increased verbosity
PYTEST_ADDOPTS='--browser=chromium -v' \
  make run-e2e-test e2e_playwright/load_testing/test_load.py

# Run with more sessions
PYTEST_ADDOPTS='--browser=chromium --num-sessions=10 -v' \
  make run-e2e-test e2e_playwright/load_testing/test_load.py

# Run a specific scenario
PYTEST_ADDOPTS='--browser=chromium --num-sessions=5 -k simple_app -v' \
  make run-e2e-test e2e_playwright/load_testing/test_load.py
```

### CI/CD

Trigger the load test workflow manually from GitHub Actions:
1. Go to Actions > "Load Testing"
2. Click "Run workflow"
3. Configure concurrent users and optionally filter by scenario
4. Results are uploaded as artifacts

## Test Scenarios

| Scenario | Description |
|----------|-------------|
| `simple_app` | Baseline: minimal app with title, text, and button |
| `dataframe_app` | Large dataframes with caching |
| `widget_heavy_app` | 90+ interactive widgets (inputs, sliders, checkboxes) |
| `caching_app` | `@st.cache_data` patterns with simulated computation |
| `fragment_app` | `@st.fragment` partial reruns vs full reruns |
| `many_messages_app` | App that produces many forward messages |

## Metrics Collected

### Server Metrics (via psutil, sampled every 500ms)

| Metric | Description |
|--------|-------------|
| `memory_rss_mb` | Resident Set Size in MB (start/end) |
| `memory_rss_mb_peak` | Peak RSS during test |
| `memory_rss_mb_avg` | Average RSS during test |
| `memory_rss_mb_growth` | RSS growth from start to end |
| `cpu_percent_avg` | Average CPU utilization |
| `cpu_percent_peak` | Peak CPU utilization |
| `thread_count_max` | Maximum number of server threads |

### Session Metrics (per simulated user)

| Metric | Description |
|--------|-------------|
| `initial_load_time_ms` | Time to first complete app render |
| `rerun_times_ms` | Times for script reruns after interactions |
| `errors` | Any errors encountered during the session |

### Aggregate Metrics

| Metric | Description |
|--------|-------------|
| `sessions_completed` | Number of sessions that completed successfully |
| `sessions_failed` | Number of sessions that failed/timed out |
| `initial_load_time_ms` | Object with `min` / `max` / `mean` / `p50` / `p95` / `p99` percentiles (ms) for initial load time |
| `rerun_time_ms` | Object with `min` / `max` / `mean` / `p50` / `p95` / `p99` percentiles (ms) for rerun times |

## Configuration

### CLI Options

| Option | Default | Description |
|--------|---------|-------------|
| `--num-sessions` | 5 | Number of user sessions to simulate |
| `--results-dir` | `results/` | Directory to write JSON results |
| `-k` | (all) | pytest filter to run specific scenarios |

**Note:** High `--num-sessions` values (25+) require substantial system resources since each session spawns a separate Playwright browser process. The CI workflow uses 64-core runners for this reason.

### Example Commands

```bash
# Run only the simple app scenario with 10 sessions (from repo root)
PYTEST_ADDOPTS='--browser=chromium --num-sessions=10 -k simple_app' \
  make run-e2e-test e2e_playwright/load_testing/test_load.py

# Run dataframe and widget scenarios with 25 sessions
PYTEST_ADDOPTS='--browser=chromium --num-sessions=25 -k "dataframe_app or widget_heavy_app"' \
  make run-e2e-test e2e_playwright/load_testing/test_load.py

# Run all scenarios with 50 sessions
PYTEST_ADDOPTS='--browser=chromium --num-sessions=50' \
  make run-e2e-test e2e_playwright/load_testing/test_load.py
```

## Results Format

Results are written as a single combined JSON file to the results directory:

```json
{
  "metadata": {
    "timestamp": "2026-03-20T10:30:00Z",
    "git_sha": "abc123",
    "git_branch": "feature/starlette",
    "runner": "local"
  },
  "scenarios": [
    {
      "scenario": "simple_app",
      "concurrent_users": 50,
      "server_metrics": {
        "memory_rss_mb_start": 85.2,
        "memory_rss_mb_end": 142.8,
        "memory_rss_mb_peak": 156.3,
        "memory_rss_mb_growth": 57.6,
        "memory_rss_mb_avg": 110.5,
        "cpu_percent_avg": 34.2,
        "cpu_percent_peak": 89.1,
        "thread_count_max": 12,
        "sample_count": 60
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
        }
      },
      "duration_seconds": 45.2
    }
  ]
}
```

## Generating Reports

After running tests, generate a markdown summary (from the repo root):

```bash
uv run python e2e_playwright/load_testing/generate_report.py \
    --results-dir=e2e_playwright/load_testing/results \
    --output=e2e_playwright/load_testing/results/summary.md
```

## Directory Structure

```
e2e_playwright/load_testing/
├── __init__.py
├── conftest.py              # Load test fixtures
├── metrics_collector.py     # psutil-based server metrics
├── test_load.py             # Main load test suite
├── worker.py                # Per-session interaction logic
├── generate_report.py       # Results aggregation
├── scenarios/
│   ├── __init__.py
│   ├── simple_app.py        # Minimal baseline app
│   ├── dataframe_app.py     # Large dataframes
│   ├── widget_heavy_app.py  # Many widgets
│   ├── caching_app.py       # @st.cache_data patterns
│   ├── fragment_app.py      # @st.fragment patterns
│   └── many_messages_app.py # Many forward messages
├── results/                 # Test output (gitignored)
└── README.md                # This file
```

## Extending the Framework

### Adding New Scenarios

1. Create a new Streamlit app in `scenarios/`
2. Add an interaction function in `worker.py` (prefixed with `_`)
3. Register the function in `_INTERACTION_FNS` dict in `worker.py`
4. Add a new `ScenarioConfig` entry to `_SCENARIOS` in `test_load.py`

### Custom Metrics

Extend `MetricsCollector` in `metrics_collector.py` to collect additional psutil data (disk I/O, network, etc.).

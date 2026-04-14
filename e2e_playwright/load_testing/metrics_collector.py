# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Server metrics collection using psutil."""

from __future__ import annotations

import statistics
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Final

import psutil

_BYTES_PER_MB: Final = 1024 * 1024


@dataclass
class ServerMetricsSample:
    """A single sample of server metrics at a point in time."""

    timestamp: float
    memory_rss_mb: float
    cpu_percent: float
    thread_count: int


@dataclass
class ServerMetricsSummary:
    """Aggregated summary of server metrics over a test run."""

    memory_rss_mb_start: float
    memory_rss_mb_end: float
    memory_rss_mb_peak: float
    memory_rss_mb_growth: float
    memory_rss_mb_avg: float
    cpu_percent_avg: float
    cpu_percent_peak: float
    thread_count_max: int
    sample_count: int
    duration_seconds: float

    @classmethod
    def empty(cls) -> ServerMetricsSummary:
        """Return a summary with all zero values for when no samples exist."""
        return cls(
            memory_rss_mb_start=0,
            memory_rss_mb_end=0,
            memory_rss_mb_peak=0,
            memory_rss_mb_growth=0,
            memory_rss_mb_avg=0,
            cpu_percent_avg=0,
            cpu_percent_peak=0,
            thread_count_max=0,
            sample_count=0,
            duration_seconds=0,
        )


@dataclass
class SessionMetrics:
    """Metrics for a single load test session (one simulated user)."""

    session_id: str
    initial_load_time_ms: float = 0.0
    rerun_times_ms: list[float] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    completed: bool = False


class MetricsCollector:
    """Collects server metrics at regular intervals using psutil."""

    def __init__(self, pid: int, interval_ms: int = 500):
        self.pid = pid
        self.interval = interval_ms / 1000.0
        self.samples: list[ServerMetricsSample] = []
        self._process: psutil.Process | None = None
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        """Start collecting metrics in a background thread."""
        try:
            self._process = psutil.Process(self.pid)
            self._process.cpu_percent()  # Prime CPU measurement (first call returns 0)
        except psutil.NoSuchProcess as e:
            raise RuntimeError(f"Process {self.pid} not found") from e

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._collect_loop, daemon=True)
        self._thread.start()

    def stop(self) -> ServerMetricsSummary:
        """Stop collecting metrics and return the summary."""
        self._stop_event.set()
        if self._thread is not None:
            # Wait for the sampling thread to fully stop to avoid concurrent
            # writes to `self.samples` while computing the summary.
            self._thread.join()
            self._thread = None

        return self._compute_summary()

    def get_samples(self) -> list[ServerMetricsSample]:
        """Return a copy of the raw samples collected."""
        return list(self.samples)

    def _collect_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                if self._process is None:
                    break

                mem_info = self._process.memory_info()
                sample = ServerMetricsSample(
                    timestamp=time.time(),
                    memory_rss_mb=mem_info.rss / _BYTES_PER_MB,
                    cpu_percent=self._process.cpu_percent(),
                    thread_count=self._process.num_threads(),
                )
                self.samples.append(sample)

            except (psutil.NoSuchProcess, psutil.AccessDenied):
                break

            self._stop_event.wait(timeout=self.interval)

    def _compute_summary(self) -> ServerMetricsSummary:
        if not self.samples:
            return ServerMetricsSummary.empty()

        memory_values = [s.memory_rss_mb for s in self.samples]
        cpu_values = [s.cpu_percent for s in self.samples]
        thread_values = [s.thread_count for s in self.samples]

        duration = (
            self.samples[-1].timestamp - self.samples[0].timestamp
            if len(self.samples) > 1
            else 0
        )

        return ServerMetricsSummary(
            memory_rss_mb_start=memory_values[0],
            memory_rss_mb_end=memory_values[-1],
            memory_rss_mb_peak=max(memory_values),
            memory_rss_mb_growth=memory_values[-1] - memory_values[0],
            memory_rss_mb_avg=statistics.mean(memory_values),
            cpu_percent_avg=statistics.mean(cpu_values),
            cpu_percent_peak=max(cpu_values),
            thread_count_max=max(thread_values),
            sample_count=len(self.samples),
            duration_seconds=duration,
        )


def compute_percentile(sorted_values: list[float], percentile: float) -> float:
    """Calculate percentile using linear interpolation.

    Expects a pre-sorted list and a percentile between 0 and 1.
    Raises ValueError if the list is empty.
    """
    if not sorted_values:
        raise ValueError("sorted_values must be non-empty")
    n = len(sorted_values)
    if n == 1:
        return sorted_values[0]
    rank = (n - 1) * percentile
    lower_idx = int(rank)
    upper_idx = min(lower_idx + 1, n - 1)
    fraction = rank - lower_idx
    return sorted_values[lower_idx] + fraction * (
        sorted_values[upper_idx] - sorted_values[lower_idx]
    )


def _compute_percentiles(values: list[float]) -> dict[str, float]:
    """Compute common percentiles for a list of values."""
    if not values:
        return {"min": 0, "max": 0, "mean": 0, "p50": 0, "p95": 0, "p99": 0}

    sorted_values = sorted(values)
    return {
        "min": sorted_values[0],
        "max": sorted_values[-1],
        "mean": statistics.mean(sorted_values),
        "p50": compute_percentile(sorted_values, 0.50),
        "p95": compute_percentile(sorted_values, 0.95),
        "p99": compute_percentile(sorted_values, 0.99),
    }


def aggregate_session_metrics(sessions: list[SessionMetrics]) -> dict[str, Any]:
    """Aggregate metrics from multiple sessions into a summary."""
    completed = [s for s in sessions if s.completed]
    failed = [s for s in sessions if not s.completed]

    load_times = [
        s.initial_load_time_ms for s in completed if s.initial_load_time_ms > 0
    ]
    all_rerun_times = [t for s in completed for t in s.rerun_times_ms]

    return {
        "total_sessions": len(sessions),
        "sessions_completed": len(completed),
        "sessions_failed": len(failed),
        "initial_load_time_ms": _compute_percentiles(load_times),
        "rerun_time_ms": _compute_percentiles(all_rerun_times),
        "errors": [e for s in failed for e in s.errors],
    }

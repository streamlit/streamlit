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

"""Per-function lookup, compute-duration, and eviction metrics for cached functions.

Counts live in a process-wide registry keyed by the same ``cache_type`` and
``cache`` labels as ``cache_memory_bytes``, so they outlive the cache objects
that are replaced when parameters change or caches are cleared. Counters only
reset when the process restarts.
"""

from __future__ import annotations

import bisect
import math
import threading
from typing import TYPE_CHECKING, Final, Literal, TypeAlias

from streamlit.runtime.caching.cache_type import CacheType
from streamlit.runtime.stats import CounterStat, HistogramStat, StatsProvider

if TYPE_CHECKING:
    from collections.abc import Sequence

    from streamlit.runtime.stats import Stat

CACHE_LOOKUPS_FAMILY: Final = "cache_lookups"
CACHE_COMPUTE_DURATION_FAMILY: Final = "cache_compute_duration_seconds"
CACHE_EVICTIONS_FAMILY: Final = "cache_evictions"

EvictionReason: TypeAlias = Literal[
    "ttl", "max_entries", "max_size", "global_budget", "validate"
]

# Bucket upper bounds in seconds, excluding +Inf. Cached functions range from
# millisecond lookups to multi-minute queries or model loads, so the buckets
# extend Prometheus's default 5 ms to 10 s range up to 5 minutes.
COMPUTE_DURATION_BUCKETS: Final[tuple[float, ...]] = (
    0.005,
    0.01,
    0.025,
    0.05,
    0.1,
    0.25,
    0.5,
    1.0,
    2.5,
    5.0,
    10.0,
    30.0,
    60.0,
    120.0,
    300.0,
)

_CACHE_TYPE_LABELS: Final[dict[CacheType, str]] = {
    CacheType.DATA: "st_cache_data",
    CacheType.RESOURCE: "st_cache_resource",
}

# Every reason that can apply to a cache type, emitted even at zero so queries
# never see a missing series.
_EVICTION_REASONS: Final[dict[CacheType, tuple[EvictionReason, ...]]] = {
    CacheType.DATA: ("ttl", "max_entries", "max_size", "global_budget"),
    CacheType.RESOURCE: ("ttl", "max_entries", "validate"),
}


class FunctionCacheMetrics:
    """Thread-safe counters for one cached function's ``cache_type`` and ``cache``
    labels.

    Each update holds a dedicated lock only for the integer additions, so
    recording never extends the scope of a cache lock.
    """

    def __init__(self, cache_type: CacheType, display_name: str) -> None:
        self.labels = {
            "cache_type": _CACHE_TYPE_LABELS[cache_type],
            "cache": display_name,
        }
        self._lock = threading.Lock()
        self._hits = 0
        self._misses = 0
        # Per-bucket (non-cumulative) counts. The final slot is the +Inf bucket.
        self._duration_bucket_counts = [0] * (len(COMPUTE_DURATION_BUCKETS) + 1)
        self._duration_sum = 0.0
        self._duration_count = 0
        self._evictions: dict[EvictionReason, int] = dict.fromkeys(
            _EVICTION_REASONS[cache_type], 0
        )

    def record_hit(self) -> None:
        with self._lock:
            self._hits += 1

    def record_miss(self) -> None:
        with self._lock:
            self._misses += 1

    def record_compute_duration(self, seconds: float) -> None:
        # bisect_left gives the first bucket whose bound is >= seconds, matching
        # the inclusive ``le`` semantics of histogram buckets.
        bucket_index = bisect.bisect_left(COMPUTE_DURATION_BUCKETS, seconds)
        with self._lock:
            self._duration_bucket_counts[bucket_index] += 1
            self._duration_sum += seconds
            self._duration_count += 1

    def record_evictions(self, reason: EvictionReason, count: int = 1) -> None:
        with self._lock:
            self._evictions[reason] = self._evictions.get(reason, 0) + count

    def get_stats(self, family_names: Sequence[str] | None) -> dict[str, list[Stat]]:
        """Return this function's stats for the requested families."""
        with self._lock:
            hits = self._hits
            misses = self._misses
            bucket_counts = list(self._duration_bucket_counts)
            duration_sum = self._duration_sum
            duration_count = self._duration_count
            evictions = dict(self._evictions)

        result: dict[str, list[Stat]] = {}
        if family_names is None or CACHE_LOOKUPS_FAMILY in family_names:
            result[CACHE_LOOKUPS_FAMILY] = [
                CounterStat(
                    family_name=CACHE_LOOKUPS_FAMILY,
                    value=value,
                    labels={**self.labels, "result": lookup_result},
                    help="Total calls to a cached function by lookup result.",
                )
                for lookup_result, value in (("hit", hits), ("miss", misses))
            ]
        if family_names is None or CACHE_COMPUTE_DURATION_FAMILY in family_names:
            cumulative = 0
            buckets: list[tuple[float, int]] = []
            for bound, bucket_count in zip(
                (*COMPUTE_DURATION_BUCKETS, math.inf), bucket_counts, strict=True
            ):
                cumulative += bucket_count
                buckets.append((bound, cumulative))
            result[CACHE_COMPUTE_DURATION_FAMILY] = [
                HistogramStat(
                    family_name=CACHE_COMPUTE_DURATION_FAMILY,
                    buckets=tuple(buckets),
                    observation_sum=duration_sum,
                    observation_count=duration_count,
                    labels=dict(self.labels),
                    unit="seconds",
                    help="Time spent running a cached function on a cache miss.",
                )
            ]
        if family_names is None or CACHE_EVICTIONS_FAMILY in family_names:
            result[CACHE_EVICTIONS_FAMILY] = [
                CounterStat(
                    family_name=CACHE_EVICTIONS_FAMILY,
                    value=value,
                    labels={**self.labels, "reason": reason},
                    help=(
                        "Total cache entries removed automatically, by reason. "
                        "Explicit clear() calls are not counted."
                    ),
                )
                for reason, value in sorted(evictions.items())
            ]
        return result


class CacheMetrics(StatsProvider):
    """Process-wide registry of ``FunctionCacheMetrics``, served on the metrics
    endpoint.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._functions: dict[tuple[CacheType, str], FunctionCacheMetrics] = {}

    @property
    def stats_families(self) -> Sequence[str]:
        return (
            CACHE_LOOKUPS_FAMILY,
            CACHE_COMPUTE_DURATION_FAMILY,
            CACHE_EVICTIONS_FAMILY,
        )

    def get_function_metrics(
        self, cache_type: CacheType, display_name: str
    ) -> FunctionCacheMetrics:
        """Return the metrics for a cached function, creating them on first use."""
        key = (cache_type, display_name)
        with self._lock:
            metrics = self._functions.get(key)
            if metrics is None:
                metrics = self._functions[key] = FunctionCacheMetrics(
                    cache_type, display_name
                )
            return metrics

    def get_stats(
        self, family_names: Sequence[str] | None = None
    ) -> dict[str, list[Stat]]:
        with self._lock:
            functions = [
                self._functions[key]
                for key in sorted(
                    self._functions, key=lambda k: (_CACHE_TYPE_LABELS[k[0]], k[1])
                )
            ]

        result: dict[str, list[Stat]] = {}
        for metrics in functions:
            for family, stats in metrics.get_stats(family_names).items():
                result.setdefault(family, []).extend(stats)
        return result


_cache_metrics = CacheMetrics()


def get_cache_metrics() -> CacheMetrics:
    """Return the process-wide cache metrics registry."""
    return _cache_metrics

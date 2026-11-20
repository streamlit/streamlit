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

"""Per-run database query totals reported in the page profile.

Each thread that runs a query during a script run gets its own
``ThreadQueryStats``, written only by that thread, so concurrent queries (for
example from parallel fragments) never contend on a lock for their counts. The
totals are combined when the run's page profile is built.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Final, Literal

QuerySource = Literal["snowflake_connector", "sqlalchemy", "snowpark"]

# Keeps the page profile small for apps that run many queries per run. The
# query counts still include the queries past the cap.
MAX_QUERY_IDS: Final = 50


@dataclass(slots=True)
class QueryTotals:
    """Query counts and times (in seconds) for one query source."""

    queries: int = 0
    failed: int = 0
    async_queries: int = 0
    describe_queries: int = 0
    timed_queries: int = 0
    time: float = 0.0
    time_in_cache: float = 0.0
    time_in_commands: float = 0.0

    def add(self, other: QueryTotals) -> None:
        """Add ``other`` to these totals."""
        self.queries += other.queries
        self.failed += other.failed
        self.async_queries += other.async_queries
        self.describe_queries += other.describe_queries
        self.timed_queries += other.timed_queries
        self.time += other.time
        self.time_in_cache += other.time_in_cache
        self.time_in_commands += other.time_in_commands


class ThreadQueryStats:
    """Query totals recorded by one thread during one script run."""

    __slots__ = ("snowflake_connector", "snowpark", "sqlalchemy")

    def __init__(self) -> None:
        self.snowflake_connector = QueryTotals()
        self.sqlalchemy = QueryTotals()
        self.snowpark = QueryTotals()

    def totals_for(self, source: QuerySource) -> QueryTotals:
        totals: QueryTotals = getattr(self, source)
        return totals


class RunQueryStats:
    """The query totals of every thread that ran a query this run, and the
    run's first Snowflake query IDs.
    """

    def __init__(self) -> None:
        self._local = threading.local()
        # Guards the list of threads, which changes once per thread and run.
        self._threads_lock = threading.Lock()
        self._threads: list[ThreadQueryStats] = []
        self._query_ids_lock = threading.Lock()
        self._query_ids: list[str] = []

    def current_thread_stats(self) -> ThreadQueryStats:
        """Return the calling thread's totals, creating them on first use."""
        stats: ThreadQueryStats | None = getattr(self._local, "stats", None)
        if stats is None:
            stats = ThreadQueryStats()
            self._local.stats = stats
            with self._threads_lock:
                self._threads.append(stats)
        return stats

    def add_query_id(self, query_id: str) -> None:
        """Keep ``query_id`` if the run has fewer than ``MAX_QUERY_IDS``."""
        with self._query_ids_lock:
            if len(self._query_ids) < MAX_QUERY_IDS:
                self._query_ids.append(query_id)

    def query_ids(self) -> list[str]:
        with self._query_ids_lock:
            return list(self._query_ids)

    def totals(self) -> dict[QuerySource, QueryTotals]:
        """Return the combined totals of each query source."""
        with self._threads_lock:
            threads = list(self._threads)
        combined: dict[QuerySource, QueryTotals] = {
            "snowflake_connector": QueryTotals(),
            "sqlalchemy": QueryTotals(),
            "snowpark": QueryTotals(),
        }
        for stats in threads:
            for source, totals in combined.items():
                totals.add(stats.totals_for(source))
        return combined

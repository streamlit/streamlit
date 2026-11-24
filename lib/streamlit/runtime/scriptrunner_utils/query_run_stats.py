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

Each thread records its queries in the ``ThreadQueryStats`` of its own
``ThreadRunStats`` (see ``run_stats.py``), written only by that thread, so
concurrent queries (for example from parallel fragments) never contend on a
lock for their counts. The totals are combined when the run's page profile is
built. The run's first Snowflake query IDs are kept in ``QueryIds``.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import TYPE_CHECKING, Final, Literal

if TYPE_CHECKING:
    from collections.abc import Iterable

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
    queries_in_cache: int = 0
    queries_in_commands: int = 0
    time: float = 0.0
    time_in_cache: float = 0.0
    time_in_commands: float = 0.0

    def add(self, other: QueryTotals) -> None:
        """Add ``other`` to these totals."""
        self.queries += other.queries
        self.failed += other.failed
        self.async_queries += other.async_queries
        self.describe_queries += other.describe_queries
        self.queries_in_cache += other.queries_in_cache
        self.queries_in_commands += other.queries_in_commands
        self.time += other.time
        self.time_in_cache += other.time_in_cache
        self.time_in_commands += other.time_in_commands


class ThreadQueryStats:
    """Query totals for each query source, recorded by one thread or combined
    across threads.
    """

    __slots__ = ("snowflake_connector", "snowpark", "sqlalchemy")

    def __init__(self) -> None:
        self.snowflake_connector = QueryTotals()
        self.sqlalchemy = QueryTotals()
        self.snowpark = QueryTotals()

    def totals_for(self, source: QuerySource) -> QueryTotals:
        totals: QueryTotals = getattr(self, source)
        return totals

    def add(self, other: ThreadQueryStats) -> None:
        """Add each source's totals from ``other`` to these."""
        self.snowflake_connector.add(other.snowflake_connector)
        self.sqlalchemy.add(other.sqlalchemy)
        self.snowpark.add(other.snowpark)

    def combined(self) -> QueryTotals:
        """Return the totals of all sources added together."""
        combined = QueryTotals()
        combined.add(self.snowflake_connector)
        combined.add(self.sqlalchemy)
        combined.add(self.snowpark)
        return combined

    @classmethod
    def combine(cls, threads: Iterable[ThreadQueryStats]) -> ThreadQueryStats:
        """Return the totals of ``threads`` added together."""
        totals = cls()
        for stats in threads:
            totals.add(stats)
        return totals


class QueryIds:
    """The first ``MAX_QUERY_IDS`` Snowflake query IDs of one script run."""

    def __init__(self) -> None:
        # Guards both lists, which any thread of the run can append to.
        self._lock = threading.Lock()
        self._query_ids: list[str] = []
        self._query_ids_in_cache: list[str] = []

    def add(self, query_id: str, *, in_cache: bool) -> None:
        """Keep ``query_id`` if the run has fewer than ``MAX_QUERY_IDS``, in the
        list for queries inside recorded cached calls if ``in_cache``.
        """
        with self._lock:
            if len(self._query_ids) + len(self._query_ids_in_cache) < MAX_QUERY_IDS:
                if in_cache:
                    self._query_ids_in_cache.append(query_id)
                else:
                    self._query_ids.append(query_id)

    def query_ids(self) -> list[str]:
        """Return the kept IDs of queries that weren't inside recorded cached
        calls.
        """
        with self._lock:
            return list(self._query_ids)

    def query_ids_in_cache(self) -> list[str]:
        """Return the kept IDs of queries inside recorded cached calls."""
        with self._lock:
            return list(self._query_ids_in_cache)

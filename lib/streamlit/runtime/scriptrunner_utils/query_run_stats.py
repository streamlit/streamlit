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
built.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from collections.abc import Iterable

QuerySource = Literal["snowflake_connector", "sqlalchemy", "snowpark"]


@dataclass(slots=True)
class QueryTotals:
    """Query counts and times (in seconds) for one query source."""

    queries: int = 0
    failed: int = 0
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

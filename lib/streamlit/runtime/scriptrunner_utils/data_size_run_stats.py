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

"""Per-run Arrow payload totals for the page profile.

Each thread records into its own ``ThreadRunStats`` (see ``run_stats.py``), so
recording takes no lock. The page profile combines the threads' totals.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Iterable


class ThreadDataSizeStats:
    """Arrow payloads that one thread or parallel fragment run serialized."""

    __slots__ = ("arrow_bytes", "arrow_rows", "largest_arrow_bytes")

    def __init__(self) -> None:
        self.arrow_bytes = 0
        self.arrow_rows = 0
        self.largest_arrow_bytes = 0

    def record_arrow_payload(self, num_bytes: int, num_rows: int) -> None:
        self.arrow_bytes += num_bytes
        self.arrow_rows += num_rows
        self.largest_arrow_bytes = max(self.largest_arrow_bytes, num_bytes)

    @classmethod
    def combine(cls, threads: Iterable[ThreadDataSizeStats]) -> ThreadDataSizeStats:
        """Sum the threads' totals, keeping the largest single payload."""
        totals = cls()
        for stats in threads:
            totals.arrow_bytes += stats.arrow_bytes
            totals.arrow_rows += stats.arrow_rows
            totals.largest_arrow_bytes = max(
                totals.largest_arrow_bytes, stats.largest_arrow_bytes
            )
        return totals

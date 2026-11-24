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

from __future__ import annotations

from streamlit.runtime.scriptrunner_utils.data_size_run_stats import (
    ThreadDataSizeStats,
)


def test_record_arrow_payload_adds_bytes_and_rows_and_keeps_the_largest() -> None:
    """Each payload adds to the totals, and only the largest one is kept."""
    stats = ThreadDataSizeStats()
    stats.record_arrow_payload(300, 10)
    stats.record_arrow_payload(1_000, 40)
    stats.record_arrow_payload(200, 5)

    assert stats.arrow_bytes == 1_500
    assert stats.arrow_rows == 55
    assert stats.largest_arrow_bytes == 1_000


def test_combine_adds_threads_and_keeps_the_largest_payload() -> None:
    """Totals add up across threads, and the largest payload is the largest of
    any thread, not the sum of their largest payloads.
    """
    first = ThreadDataSizeStats()
    first.record_arrow_payload(400, 4)
    first.record_arrow_payload(100, 1)
    second = ThreadDataSizeStats()
    second.record_arrow_payload(700, 7)

    totals = ThreadDataSizeStats.combine([first, second, ThreadDataSizeStats()])

    assert totals.arrow_bytes == 1_200
    assert totals.arrow_rows == 12
    assert totals.largest_arrow_bytes == 700


def test_combine_of_no_threads_is_zero() -> None:
    totals = ThreadDataSizeStats.combine([])

    assert totals.arrow_bytes == 0
    assert totals.arrow_rows == 0
    assert totals.largest_arrow_bytes == 0

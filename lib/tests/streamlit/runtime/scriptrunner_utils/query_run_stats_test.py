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

import threading

from streamlit.runtime.scriptrunner_utils.query_run_stats import (
    MAX_QUERY_IDS,
    QueryIds,
    QueryTotals,
    ThreadQueryStats,
)
from streamlit.runtime.scriptrunner_utils.run_stats import RunStats


def test_combine_adds_every_threads_totals_per_source() -> None:
    run_stats = RunStats()
    main = run_stats.current_thread_stats().query
    main.sqlalchemy.queries = 2
    main.sqlalchemy.time = 0.5
    main.snowpark.queries = 1

    def worker() -> None:
        stats = run_stats.current_thread_stats().query
        stats.sqlalchemy.queries = 3
        stats.sqlalchemy.failed = 1
        stats.sqlalchemy.time = 0.25

    thread = threading.Thread(target=worker)
    thread.start()
    thread.join(5)

    totals = ThreadQueryStats.combine(
        stats.query for stats in run_stats.all_thread_stats()
    )
    assert totals.sqlalchemy == QueryTotals(queries=5, failed=1, time=0.75)
    assert totals.snowpark == QueryTotals(queries=1)
    assert totals.snowflake_connector == QueryTotals()


def test_query_ids_keep_the_first_ones_up_to_the_cap() -> None:
    run_query_ids = QueryIds()

    for i in range(MAX_QUERY_IDS + 5):
        run_query_ids.add(f"id-{i}", in_cache=False)

    query_ids = run_query_ids.query_ids()
    assert len(query_ids) == MAX_QUERY_IDS
    assert query_ids[0] == "id-0"
    assert query_ids[-1] == f"id-{MAX_QUERY_IDS - 1}"
    assert run_query_ids.query_ids_in_cache() == []


def test_both_query_id_lists_share_the_cap() -> None:
    run_query_ids = QueryIds()

    for i in range(MAX_QUERY_IDS + 5):
        run_query_ids.add(f"id-{i}", in_cache=i % 2 == 1)

    query_ids = run_query_ids.query_ids()
    query_ids_in_cache = run_query_ids.query_ids_in_cache()
    assert len(query_ids) + len(query_ids_in_cache) == MAX_QUERY_IDS
    assert query_ids[:2] == ["id-0", "id-2"]
    assert query_ids_in_cache[:2] == ["id-1", "id-3"]
    assert f"id-{MAX_QUERY_IDS}" not in query_ids


def test_combined_adds_every_source() -> None:
    stats = ThreadQueryStats()
    stats.snowflake_connector.time = 0.5
    stats.snowflake_connector.time_in_cache = 0.25
    stats.sqlalchemy.time = 0.25
    stats.sqlalchemy.time_in_commands = 0.125
    stats.snowpark.queries = 2
    stats.snowpark.queries_in_cache = 1

    assert stats.combined() == QueryTotals(
        queries=2,
        queries_in_cache=1,
        time=0.75,
        time_in_cache=0.25,
        time_in_commands=0.125,
    )

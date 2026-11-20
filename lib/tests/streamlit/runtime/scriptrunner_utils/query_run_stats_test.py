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
    QueryTotals,
    RunQueryStats,
)


def test_totals_combine_every_thread_per_source() -> None:
    run_stats = RunQueryStats()
    main = run_stats.current_thread_stats()
    main.sqlalchemy.queries = 2
    main.sqlalchemy.time = 0.5
    main.snowpark.queries = 1

    def worker() -> None:
        stats = run_stats.current_thread_stats()
        stats.sqlalchemy.queries = 3
        stats.sqlalchemy.failed = 1
        stats.sqlalchemy.time = 0.25

    thread = threading.Thread(target=worker)
    thread.start()
    thread.join(5)

    totals = run_stats.totals()
    assert totals["sqlalchemy"] == QueryTotals(queries=5, failed=1, time=0.75)
    assert totals["snowpark"] == QueryTotals(queries=1)
    assert totals["snowflake_connector"] == QueryTotals()
    assert run_stats.current_thread_stats() is main


def test_query_ids_keep_the_first_ones_up_to_the_cap() -> None:
    run_stats = RunQueryStats()

    for i in range(MAX_QUERY_IDS + 5):
        run_stats.add_query_id(f"id-{i}")

    query_ids = run_stats.query_ids()
    assert len(query_ids) == MAX_QUERY_IDS
    assert query_ids[0] == "id-0"
    assert query_ids[-1] == f"id-{MAX_QUERY_IDS - 1}"

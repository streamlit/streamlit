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

"""SPIKE: what copying a session's state costs, for typical session contents.

The fork copies on the server's event loop, so the time below is also how long
every other session on the server waits. Run from the repo root:

    uv run python specs/2026-08-28-agent-app-interface/session-fork/bench_copy.py
"""

# ruff: noqa: T201, INP001  # A standalone script that prints a table.

from __future__ import annotations

import gc
import statistics
import time
import tracemalloc
from typing import TYPE_CHECKING, Any

import numpy as np
import pandas as pd
import pyarrow as pa

from streamlit.runtime.agent import fork
from streamlit.runtime.state.session_state import SessionState

if TYPE_CHECKING:
    from collections.abc import Callable

_ROWS = 1_000_000


def _numeric_frame() -> Any:
    return pd.DataFrame(np.random.default_rng(0).random((_ROWS, 10)))


def _string_frame() -> Any:
    return pd.DataFrame(
        {"id": np.arange(_ROWS), "name": [f"customer-{n}" for n in range(_ROWS)]}
    )


def _arrow_table() -> Any:
    return pa.Table.from_pandas(_numeric_frame())


def _records(count: int) -> Callable[[], Any]:
    # Query results kept as a list of dicts, as apps often do.
    return lambda: [{"id": n, "name": f"row-{n}", "score": n / 3} for n in range(count)]


def _chat_history() -> Any:
    return [
        {"role": "user" if n % 2 else "assistant", "content": "lorem ipsum " * 40}
        for n in range(200)
    ]


_CASES: dict[str, Callable[[], Any]] = {
    "chat history, 200 messages": _chat_history,
    "pandas 1M x 10 float64 (80 MB)": _numeric_frame,
    # pandas 3 stores `str` as immutable Arrow arrays, which a deep copy shares.
    "pandas 1M rows with a str column": _string_frame,
    "pyarrow 1M x 10 float64 (80 MB)": _arrow_table,
    "list of 100k dicts": _records(100_000),
    "list of 1M dicts": _records(1_000_000),
}


def _state_holding(value: Any) -> SessionState:
    state = SessionState()
    state._new_session_state["value"] = value
    return state


def _time_ms(state: SessionState, repeats: int = 3) -> float:
    samples = []
    for _ in range(repeats):
        gc.collect()
        started = time.perf_counter()
        fork.copy_session_state(state, fork.ForkReport())
        samples.append((time.perf_counter() - started) * 1000)
    return statistics.median(samples)


def _peak_mb(state: SessionState) -> float:
    gc.collect()
    tracemalloc.start()
    copied = fork.copy_session_state(state, fork.ForkReport())
    _, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    del copied
    return peak / 1e6


def main() -> None:
    print("| Session state holds | Copy time (event loop blocked) | Extra memory |")
    print("| --- | ---: | ---: |")
    for name, build in _CASES.items():
        state = _state_holding(build())
        print(f"| {name} | {_time_ms(state):.0f} ms | {_peak_mb(state):.0f} MB |")


if __name__ == "__main__":
    main()

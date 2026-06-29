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

"""Unit tests for the session-scoped lazy dataframe source manager."""

from __future__ import annotations

from unittest.mock import patch

import pyarrow as pa
import pytest

from streamlit.dataframe.source import InMemoryDataframeSource, SortSpec
from streamlit.dataframe_util import convert_arrow_bytes_to_pandas_df
from streamlit.runtime.dataframe_source_manager import (
    DataframeSourceError,
    DataframeSourceManager,
)


def _make_source(num_rows: int = 1000) -> InMemoryDataframeSource:
    """Build an in-memory source with ``num_rows`` rows."""
    return InMemoryDataframeSource(
        pa.table({"a": list(range(num_rows)), "b": [x * 2 for x in range(num_rows)]})
    )


def _register(
    mgr: DataframeSourceManager,
    *,
    session_id: str = "s1",
    coordinates: str = "1.0.0",
    num_rows: int = 1000,
):
    """Register a source under a given session id (patches the active session)."""
    with patch(
        "streamlit.runtime.dataframe_source_manager._get_session_id",
        return_value=session_id,
    ):
        return mgr.register_source(_make_source(num_rows), coordinates)


def test_register_source_returns_unique_ids() -> None:
    """Each registration gets a unique source id and generation."""
    mgr = DataframeSourceManager()
    reg1 = _register(mgr, coordinates="1.0.0")
    reg2 = _register(mgr, coordinates="1.0.1")
    assert reg1.source_id != reg2.source_id
    assert reg1.generation != reg2.generation
    assert mgr.get_source_count() == 2


def test_load_chunk_returns_requested_rows() -> None:
    """A valid chunk request returns the requested Arrow rows."""
    mgr = DataframeSourceManager()
    reg = _register(mgr)
    arrow_bytes, offset = mgr.load_chunk(
        reg.session_id, reg.source_id, reg.generation, 100, 5, None
    )
    assert offset == 100
    df = convert_arrow_bytes_to_pandas_df(arrow_bytes)
    assert df["a"].tolist() == [100, 101, 102, 103, 104]


def test_load_chunk_applies_sort() -> None:
    """A chunk request with sort state returns sorted rows."""
    mgr = DataframeSourceManager()
    reg = _register(mgr)
    arrow_bytes, _ = mgr.load_chunk(
        reg.session_id,
        reg.source_id,
        reg.generation,
        0,
        3,
        SortSpec("a", descending=True),
    )
    df = convert_arrow_bytes_to_pandas_df(arrow_bytes)
    assert df["a"].tolist() == [999, 998, 997]


def test_load_chunk_unknown_source_raises() -> None:
    """Requesting an unknown source id raises a DataframeSourceError."""
    mgr = DataframeSourceManager()
    with pytest.raises(DataframeSourceError, match="not found"):
        mgr.load_chunk("s1", "missing", "gen", 0, 5, None)


def test_load_chunk_wrong_session_raises() -> None:
    """A source registered for one session cannot be read by another."""
    mgr = DataframeSourceManager()
    reg = _register(mgr, session_id="s1")
    with pytest.raises(DataframeSourceError, match="does not belong"):
        mgr.load_chunk("other", reg.source_id, reg.generation, 0, 5, None)


def test_load_chunk_stale_generation_raises() -> None:
    """A stale generation token is rejected."""
    mgr = DataframeSourceManager()
    reg = _register(mgr)
    with pytest.raises(DataframeSourceError, match="stale"):
        mgr.load_chunk(reg.session_id, reg.source_id, "stale-gen", 0, 5, None)


def test_load_chunk_negative_offset_raises() -> None:
    """A negative offset is rejected."""
    mgr = DataframeSourceManager()
    reg = _register(mgr)
    with pytest.raises(DataframeSourceError, match="non-negative"):
        mgr.load_chunk(reg.session_id, reg.source_id, reg.generation, -1, 5, None)


def test_load_chunk_caps_limit() -> None:
    """The chunk limit is capped at MAX_CHUNK_ROWS."""
    mgr = DataframeSourceManager()
    reg = _register(mgr, num_rows=20_000)
    arrow_bytes, _ = mgr.load_chunk(
        reg.session_id, reg.source_id, reg.generation, 0, 1_000_000, None
    )
    df = convert_arrow_bytes_to_pandas_df(arrow_bytes)
    # Capped to MAX_CHUNK_ROWS (10_000), not the full 20_000 rows.
    assert len(df) == 10_000


def test_re_register_same_coordinates_orphans_previous() -> None:
    """Re-registering at the same coordinates orphans the old source on prune."""
    mgr = DataframeSourceManager()
    reg1 = _register(mgr, coordinates="1.0.0")
    reg2 = _register(mgr, coordinates="1.0.0")
    assert reg1.source_id != reg2.source_id
    assert mgr.get_source_count() == 2

    mgr.remove_orphaned_sources()
    # The first source is now orphaned and removed; the second remains.
    assert mgr.get_source_count() == 1
    with pytest.raises(DataframeSourceError):
        mgr.load_chunk(reg1.session_id, reg1.source_id, reg1.generation, 0, 5, None)
    # The new source still works.
    mgr.load_chunk(reg2.session_id, reg2.source_id, reg2.generation, 0, 5, None)


def test_clear_session_refs_then_prune_removes_sources() -> None:
    """Clearing a session's refs and pruning removes its sources."""
    mgr = DataframeSourceManager()
    reg = _register(mgr, session_id="s1")
    mgr.clear_session_refs("s1")
    mgr.remove_orphaned_sources()
    assert mgr.get_source_count() == 0
    with pytest.raises(DataframeSourceError):
        mgr.load_chunk(reg.session_id, reg.source_id, reg.generation, 0, 5, None)


def test_clear_session_refs_only_affects_target_session() -> None:
    """Clearing one session's refs does not remove another session's sources."""
    mgr = DataframeSourceManager()
    reg_s1 = _register(mgr, session_id="s1", coordinates="1.0.0")
    reg_s2 = _register(mgr, session_id="s2", coordinates="1.0.0")

    mgr.clear_session_refs("s1")
    mgr.remove_orphaned_sources()

    with pytest.raises(DataframeSourceError):
        mgr.load_chunk(
            reg_s1.session_id, reg_s1.source_id, reg_s1.generation, 0, 5, None
        )
    # s2's source is still available.
    mgr.load_chunk(reg_s2.session_id, reg_s2.source_id, reg_s2.generation, 0, 5, None)


def test_clear_all_for_session() -> None:
    """``clear_all_for_session`` clears refs and prunes in one call."""
    mgr = DataframeSourceManager()
    _register(mgr, session_id="s1")
    mgr.clear_all_for_session("s1")
    assert mgr.get_source_count() == 0

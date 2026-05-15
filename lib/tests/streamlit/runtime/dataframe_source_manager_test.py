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

"""Unit tests for DataframeSourceManager."""

from __future__ import annotations

from unittest.mock import MagicMock

import pyarrow as pa

from streamlit.runtime.dataframe_source_manager import DataframeSourceManager


def _create_mock_source() -> MagicMock:
    """Create a mock DataframeSourceProtocol implementation."""
    source = MagicMock()
    source.row_count = 100
    source.schema = pa.schema([("col1", pa.int64())])
    source.sortable = True
    source.load_rows.return_value = b"arrow_data"
    return source


def test_register_source_returns_unique_ids() -> None:
    """Test that register_source returns unique source_id and generation."""
    manager = DataframeSourceManager()
    source = _create_mock_source()

    id1, gen1 = manager.register_source(source, "delta_path_1")
    id2, gen2 = manager.register_source(source, "delta_path_2")

    assert id1 != id2
    assert gen1 != gen2
    assert manager.source_count == 2


def test_get_source_returns_registered_source() -> None:
    """Test that get_source returns the source when ID and generation match."""
    manager = DataframeSourceManager()
    source = _create_mock_source()

    source_id, generation = manager.register_source(source, "delta_path")

    result = manager.get_source(source_id, generation)

    assert result is source


def test_get_source_returns_none_for_unknown_id() -> None:
    """Test that get_source returns None for unknown source IDs."""
    manager = DataframeSourceManager()

    result = manager.get_source("unknown_id", "unknown_generation")

    assert result is None


def test_get_source_returns_none_for_wrong_generation() -> None:
    """Test that get_source returns None when generation doesn't match."""
    manager = DataframeSourceManager()
    source = _create_mock_source()

    source_id, _ = manager.register_source(source, "delta_path")

    result = manager.get_source(source_id, "wrong_generation")

    assert result is None


def test_clear_active_refs_clears_all_refs_for_full_rerun() -> None:
    """Test that clear_active_refs with no fragment_id clears all refs."""
    manager = DataframeSourceManager()
    source = _create_mock_source()

    manager.register_source(source, "delta_path_1")
    manager.register_source(source, "delta_path_2")
    manager.clear_active_refs()
    manager.prune_unreferenced_sources()

    assert manager.source_count == 0


def test_clear_active_refs_only_clears_fragment_refs() -> None:
    """Test that clear_active_refs with fragment_id only clears that fragment."""
    manager = DataframeSourceManager()
    source = _create_mock_source()

    # Register sources: one for a fragment, one without
    manager.register_source(source, "delta_path_main")
    manager.register_source(source, "delta_path_fragment", fragment_id="frag1")

    # Clear only fragment refs and prune
    manager.clear_active_refs(fragment_id="frag1")
    manager.prune_unreferenced_sources(fragment_id="frag1")

    # Only fragment source should be pruned
    assert manager.source_count == 1


def test_prune_removes_unreferenced_sources() -> None:
    """Test that prune_unreferenced_sources removes sources not re-registered."""
    manager = DataframeSourceManager()
    source = _create_mock_source()

    manager.register_source(source, "delta_path_1")
    manager.register_source(source, "delta_path_2")

    # Simulate a rerun: clear refs, re-register only the second source
    manager.clear_active_refs()
    manager.register_source(source, "delta_path_2")

    manager.prune_unreferenced_sources()

    # First source should be gone (not re-registered), second should remain
    # (and was replaced during re-registration)
    assert manager.source_count == 1


def test_clear_all_removes_all_sources() -> None:
    """Test that clear_all removes all sources on session shutdown."""
    manager = DataframeSourceManager()
    source = _create_mock_source()

    manager.register_source(source, "delta_path_1")
    manager.register_source(source, "delta_path_2")

    manager.clear_all()

    assert manager.source_count == 0


def test_source_count_reflects_current_state() -> None:
    """Test that source_count accurately reflects registered sources."""
    manager = DataframeSourceManager()
    source = _create_mock_source()

    assert manager.source_count == 0

    manager.register_source(source, "delta_path_1")
    assert manager.source_count == 1

    manager.register_source(source, "delta_path_2")
    assert manager.source_count == 2

    manager.clear_all()
    assert manager.source_count == 0

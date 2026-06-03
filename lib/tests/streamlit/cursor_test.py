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

from unittest.mock import MagicMock, patch

import pytest

from streamlit.cursor import (
    Cursor,
    LockedCursor,
    RunningCursor,
    SparseList,
    get_container_cursor,
    make_delta_path,
)
from streamlit.proto.RootContainer_pb2 import RootContainer


class TestSparseList:
    def test_set_and_get_item(self) -> None:
        """Test setting and getting items in SparseList."""
        sl = SparseList()
        sl[0] = "a"
        sl[2] = "c"

        assert sl[0] == "a"
        assert sl[2] == "c"
        with pytest.raises(KeyError):
            _ = sl[1]

    def test_set_invalid_index(self):
        """Test setting invalid indices raises IndexError."""
        sl = SparseList()
        with pytest.raises(IndexError):
            sl[-1] = "fail"
        with pytest.raises(IndexError):
            sl["not_int"] = "fail"  # type: ignore

    def test_del_item(self):
        """Test deleting items."""
        sl = SparseList()
        sl[0] = "a"
        del sl[0]
        with pytest.raises(KeyError):
            _ = sl[0]
        with pytest.raises(KeyError):
            del sl[1]

    def test_len(self):
        """Test length of SparseList."""
        sl = SparseList()
        sl[0] = "a"
        sl[10] = "b"
        assert len(sl) == 2

    def test_iteration(self):
        """Test iteration over SparseList."""
        sl = SparseList()
        sl[2] = "c"
        sl[0] = "a"
        sl[1] = "b"

        assert list(sl) == ["a", "b", "c"]
        assert list(sl.items()) == [(0, "a"), (1, "b"), (2, "c")]

    def test_contains(self):
        """Test __contains__."""
        sl = SparseList()
        sl[0] = "a"
        assert 0 in sl
        assert 1 not in sl

    def test_repr(self):
        """Test __repr__."""
        sl = SparseList()
        sl[0] = "a"
        sl[2] = "c"
        assert repr(sl) == "SparseList({0: a, 2: c})"


class TestCursorFunctions:
    def test_make_delta_path(self):
        """Test make_delta_path."""
        path = make_delta_path(RootContainer.MAIN, (1, 2), 3)
        assert path == [RootContainer.MAIN, 1, 2, 3]

    @patch("streamlit.cursor.get_script_run_ctx")
    def test_get_container_cursor_no_ctx(self, mock_get_ctx):
        """Test get_container_cursor when no context exists."""
        mock_get_ctx.return_value = None
        cursor = get_container_cursor(RootContainer.MAIN)
        assert cursor is None

    def test_get_container_cursor_none_root(self):
        """Test get_container_cursor with None root."""
        cursor = get_container_cursor(None)
        assert cursor is None

    @patch("streamlit.cursor.get_script_run_ctx")
    def test_get_container_cursor_creates_new(self, mock_get_ctx):
        """Test get_container_cursor creates a new cursor if not present."""
        mock_ctx = MagicMock()
        mock_ctx.cursors = {}
        mock_get_ctx.return_value = mock_ctx

        cursor = get_container_cursor(RootContainer.MAIN)
        assert isinstance(cursor, RunningCursor)
        assert cursor.root_container == RootContainer.MAIN
        assert RootContainer.MAIN in mock_ctx.cursors
        assert mock_ctx.cursors[RootContainer.MAIN] == cursor

    @patch("streamlit.cursor.get_script_run_ctx")
    def test_get_container_cursor_returns_existing(self, mock_get_ctx):
        """Test get_container_cursor returns existing cursor."""
        mock_ctx = MagicMock()
        existing_cursor = RunningCursor(RootContainer.MAIN)
        mock_ctx.cursors = {RootContainer.MAIN: existing_cursor}
        mock_get_ctx.return_value = mock_ctx

        cursor = get_container_cursor(RootContainer.MAIN)
        assert cursor == existing_cursor


class TestRunningCursor:
    def test_initialization(self):
        """Test initialization of RunningCursor."""
        cursor = RunningCursor(RootContainer.MAIN, (1, 2))
        assert cursor.root_container == RootContainer.MAIN
        assert cursor.parent_path == (1, 2)
        assert cursor.index == 0
        assert cursor.delta_path == [RootContainer.MAIN, 1, 2, 0]
        assert not cursor.is_locked
        assert len(cursor.transient_elements) == 0

    def test_lock_element(self):
        """Test lock_element from RunningCursor."""
        cursor = RunningCursor(RootContainer.MAIN)

        # First lock
        locked1 = cursor.lock_element()
        assert isinstance(locked1, LockedCursor)
        assert locked1.index == 0
        assert cursor.index == 1

        # Second lock
        locked2 = cursor.lock_element()
        assert locked2.index == 1
        assert cursor.index == 2

    def test_get_transient_cursor(self):
        """Test get_transient_cursor from RunningCursor."""
        cursor = RunningCursor(RootContainer.MAIN)

        # First transient
        t1 = cursor.get_transient_cursor()
        assert t1 == cursor
        assert cursor.transient_index == 0

        # Second transient
        cursor.get_transient_cursor()
        assert cursor.transient_index == 1

    def test_lock_element_resets_transient(self):
        """Test that lock_element resets transient state."""
        cursor = RunningCursor(RootContainer.MAIN)
        cursor.get_transient_cursor()
        cursor.transient_elements[0] = "element"  # Simulate adding element
        assert cursor.transient_index == 0
        assert len(cursor.transient_elements) == 1

        cursor.lock_element()
        # Should be reset
        assert cursor.transient_index == 0
        assert len(cursor.transient_elements) == 0

    def test_open_block(self):
        """Test open_block creates a child cursor and advances."""
        cursor = RunningCursor(RootContainer.MAIN, parent_path=(1,))
        assert cursor.index == 0

        child = cursor.open_block()
        assert isinstance(child, RunningCursor)
        assert child.root_container == RootContainer.MAIN
        assert child.parent_path == (1, 0)
        assert child.index == 0
        assert cursor.index == 1

        child2 = cursor.open_block()
        assert child2.parent_path == (1, 1)
        assert child2.index == 0
        assert cursor.index == 2


class TestCursorBase:
    """Tests for the abstract Cursor base class."""

    def test_repr_returns_string(self) -> None:
        """Test that __repr__ returns a string representation."""
        cursor = Cursor()
        result = repr(cursor)
        assert isinstance(result, str)
        assert "Cursor" in result

    def test_root_container_raises_not_implemented(self) -> None:
        """Test that root_container on base Cursor raises NotImplementedError."""
        cursor = Cursor()
        with pytest.raises(NotImplementedError):
            _ = cursor.root_container

    def test_parent_path_raises_not_implemented(self) -> None:
        """Test that parent_path on base Cursor raises NotImplementedError."""
        cursor = Cursor()
        with pytest.raises(NotImplementedError):
            _ = cursor.parent_path

    def test_index_raises_not_implemented(self) -> None:
        """Test that index on base Cursor raises NotImplementedError."""
        cursor = Cursor()
        with pytest.raises(NotImplementedError):
            _ = cursor.index

    def test_is_locked_raises_not_implemented(self) -> None:
        """Test that is_locked on base Cursor raises NotImplementedError."""
        cursor = Cursor()
        with pytest.raises(NotImplementedError):
            _ = cursor.is_locked

    def test_lock_element_raises_not_implemented(self) -> None:
        """Test that lock_element on base Cursor raises NotImplementedError."""
        cursor = Cursor()
        with pytest.raises(NotImplementedError):
            cursor.lock_element()

    def test_open_block_raises_not_implemented(self) -> None:
        """Test that open_block on base Cursor raises NotImplementedError."""
        cursor = Cursor()
        with pytest.raises(NotImplementedError):
            cursor.open_block()


class TestLockedCursor:
    def test_initialization(self):
        """Test initialization of LockedCursor."""
        cursor = LockedCursor(RootContainer.MAIN, (1,), 5)
        assert cursor.root_container == RootContainer.MAIN
        assert cursor.parent_path == (1,)
        assert cursor.index == 5
        assert cursor.is_locked

    def test_lock_element_returns_self(self):
        """Test lock_element from LockedCursor returns itself."""
        cursor = LockedCursor(RootContainer.MAIN, index=5)

        locked = cursor.lock_element()
        assert locked == cursor
        assert cursor.index == 5  # Index doesn't change

    def test_open_block_returns_child_cursor(self):
        """Test open_block from LockedCursor returns a child RunningCursor."""
        cursor = LockedCursor(RootContainer.MAIN, parent_path=(1,), index=3)
        child = cursor.open_block()
        assert isinstance(child, RunningCursor)
        assert child.root_container == RootContainer.MAIN
        assert child.parent_path == (1, 3)
        assert child.index == 0

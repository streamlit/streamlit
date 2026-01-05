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

from typing import TYPE_CHECKING, Any, Generic, TypeVar

from streamlit import util
from streamlit.proto.Element_pb2 import Element
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx

if TYPE_CHECKING:
    from collections.abc import Iterator


def make_delta_path(
    root_container: int, parent_path: tuple[int, ...], index: int
) -> list[int]:
    delta_path = [root_container]
    delta_path.extend(parent_path)
    delta_path.append(index)
    return delta_path


def get_container_cursor(
    root_container: int | None,
) -> RunningCursor | None:
    """Return the top-level RunningCursor for the given container.
    This is the cursor that is used when user code calls something like
    `st.foo` (which uses the main container) or `st.sidebar.foo` (which uses
    the sidebar container).
    """
    if root_container is None:
        return None

    ctx = get_script_run_ctx()

    if ctx is None:
        return None

    if root_container in ctx.cursors:
        return ctx.cursors[root_container]

    cursor = RunningCursor(root_container=root_container)
    ctx.cursors[root_container] = cursor
    return cursor


T = TypeVar("T")


class SparseList(Generic[T]):
    """A list-like data structure that only stores non-empty items."""

    def __init__(self) -> None:
        self._data: dict[int, T] = {}

    def __setitem__(self, index: int, value: T) -> None:
        if not isinstance(index, int) or index < 0:
            raise IndexError("SparseList indices must be non-negative integers")

        self._data[index] = value

    def __getitem__(self, index: int) -> T:
        if index not in self._data:
            raise KeyError(f"Index {index} is empty")

        return self._data[index]

    def __delitem__(self, index: int) -> None:
        if index in self._data:
            del self._data[index]
        else:
            raise KeyError(f"Index {index} is empty")

    def __iter__(self) -> Iterator[T]:
        # Iterate in index order.
        for index in sorted(self._data):
            yield self._data[index]

    def __len__(self) -> int:
        # number of filled items
        return len(self._data)

    def items(self) -> Iterator[tuple[int, T]]:
        """Iterate through (index, value) for filled entries."""
        for index in sorted(self._data):
            yield index, self._data[index]

    def __contains__(self, index: int) -> bool:
        return index in self._data

    def __repr__(self) -> str:
        items = ", ".join(f"{i}: {v}" for i, v in self.items())
        return f"SparseList({{{items}}})"


class Cursor:
    """A pointer to a delta location in the app.

    When adding an element to the app, you should always call
    get_locked_cursor() on that element's respective Cursor.

    Parameters
    ----------
    transient_index: int | None
      The running index of the transient elements.
    transient_elements: SparseList[Element] | None
      The list of active transient elements.
    """

    def __init__(
        self,
        transient_index: int | None = None,
        transient_elements: SparseList[Element] | None = None,
    ) -> None:
        self._transient_index: int | None = transient_index
        self._transient_elements = transient_elements or SparseList[Element]()

    def __repr__(self) -> str:
        return util.repr_(self)

    @property
    def root_container(self) -> int:
        """The top-level container this cursor lives within - either
        RootContainer.MAIN or RootContainer.SIDEBAR.
        """
        raise NotImplementedError()

    @property
    def parent_path(self) -> tuple[int, ...]:
        """The cursor's parent's path within its container."""
        raise NotImplementedError()

    @property
    def index(self) -> int:
        """The index of the Delta within its parent block."""
        raise NotImplementedError()

    @property
    def delta_path(self) -> list[int]:
        """The complete path of the delta pointed to by this cursor - its
        container, parent path, and index.
        """
        return make_delta_path(self.root_container, self.parent_path, self.index)

    @property
    def is_locked(self) -> bool:
        raise NotImplementedError()

    @property
    def transient_elements(self) -> SparseList[Element]:
        return self._transient_elements

    @property
    def transient_index(self) -> int:
        return 0 if self._transient_index is None else self._transient_index

    def get_locked_cursor(self, **props: Any) -> LockedCursor:
        raise NotImplementedError()

    def get_transient_cursor(self) -> Cursor:
        if self._transient_index is None:
            self._transient_index = 0
        else:
            self._transient_index += 1

        return self

    @property
    def props(self) -> Any:
        """Other data in this cursor. This is a temporary measure that will go
        away when we implement improved return values for elements.

        This is only implemented in LockedCursor.
        """
        raise NotImplementedError()


class RunningCursor(Cursor):
    def __init__(
        self,
        root_container: int,
        parent_path: tuple[int, ...] = (),
        transient_index: int | None = None,
        transient_elements: SparseList[Element] | None = None,
    ) -> None:
        """A moving pointer to a delta location in the app.

        RunningCursors auto-increment to the next available location when you
        call get_locked_cursor() on them.

        Parameters
        ----------
        root_container: int
            The root container this cursor lives in.
        parent_path: tuple of ints
          The full path of this cursor, consisting of the IDs of all ancestors.
          The 0th item is the topmost ancestor.
        transient_index: int | None
          The running index of the transient elements.
        transient_elements: SparseList[Element]
          The list of active transient elements.

        """
        super().__init__(transient_index, transient_elements)
        self._root_container = root_container
        self._parent_path = parent_path
        self._index = 0

    @property
    def root_container(self) -> int:
        return self._root_container

    @property
    def parent_path(self) -> tuple[int, ...]:
        return self._parent_path

    @property
    def index(self) -> int:
        return self._index

    @property
    def is_locked(self) -> bool:
        return False

    def get_locked_cursor(self, **props: Any) -> LockedCursor:
        locked_cursor = LockedCursor(
            root_container=self._root_container,
            parent_path=self._parent_path,
            index=self._index,
            **props,
        )

        self._index += 1
        self._transient_index = None
        self._transient_elements = SparseList[Element]()

        return locked_cursor


class LockedCursor(Cursor):
    def __init__(
        self,
        root_container: int,
        parent_path: tuple[int, ...] = (),
        index: int = 0,
        transient_index: int | None = None,
        transient_elements: SparseList[Element] | None = None,
        **props: Any,
    ) -> None:
        """A locked pointer to a location in the app.

        LockedCursors always point to the same location, even when you call
        get_locked_cursor() on them.

        Parameters
        ----------
        root_container: int
            The root container this cursor lives in.
        parent_path: tuple of ints
          The full path of this cursor, consisting of the IDs of all ancestors. The
          0th item is the topmost ancestor.
        index: int
        transient_index: int | None
          The running index of the transient elements.
        transient_elements: SparseList[Element]
          The list of active transient elements.
        **props: any
          Anything else you want to store in this cursor. This is a temporary
          measure that will go away when we implement improved return values
          for elements.

        """
        super().__init__(transient_index, transient_elements)
        self._root_container = root_container
        self._index = index
        self._parent_path = parent_path
        self._props = props

    @property
    def root_container(self) -> int:
        return self._root_container

    @property
    def parent_path(self) -> tuple[int, ...]:
        return self._parent_path

    @property
    def index(self) -> int:
        return self._index

    @property
    def is_locked(self) -> bool:
        return True

    @property
    def props(self) -> Any:
        return self._props

    def get_locked_cursor(self, **props: Any) -> LockedCursor:
        self._props = props
        return self

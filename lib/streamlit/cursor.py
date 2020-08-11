# Copyright 2018-2020 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from typing import Optional, Tuple

from streamlit.report_thread import get_report_ctx


def get_container_cursor(container):
    ctx = get_report_ctx()

    if ctx is None:
        return None

    if container in ctx.cursors:
        return ctx.cursors[container]

    cursor = RunningCursor()
    ctx.cursors[container] = cursor
    return cursor


class AbstractCursor(object):
    """A pointer to a location in the app.

    When adding an element to the app, you should always call
    get_locked_cursor() on that element's respective AbstractCursor.
    """

    def __init__(self):
        self._is_locked = False
        self._index = None  # type: Optional[int]
        self._path = ()  # type: Tuple[int, ...]

    @property
    def index(self):
        return self._index

    @property
    def path(self):
        return self._path

    @property
    def is_locked(self):
        return self._is_locked

    def get_locked_cursor(self, **props):
        raise NotImplementedError()


class RunningCursor(AbstractCursor):
    def __init__(self, path: Tuple[int, ...] = ()):
        """A moving pointer to a location in the app.

        RunningCursors auto-increment to the next available location when you
        call get_locked_cursor() on them.

        Parameters
        ----------
        path: tuple of ints
          The full path of this cursor, consisting of the IDs of all ancestors. The
          0th item is the topmost ancestor.

        """
        self._is_locked = False
        self._index = 0  # type: int
        self._path = path

    def get_locked_cursor(self, **props):
        locked_cursor = LockedCursor(path=self._path, index=self._index, **props)

        self._index += 1

        return locked_cursor


class LockedCursor(AbstractCursor):
    def __init__(
        self, path: Tuple[int, ...] = (), index: Optional[int] = None, **props
    ):
        """A locked pointer to a location in the app.

        LockedCursors always point to the same location, even when you call
        get_locked_cursor() on them.

        Parameters
        ----------
        path: tuple of ints
          The full path of this cursor, consisting of the IDs of all ancestors. The
          0th item is the topmost ancestor.
        index: int or None
        **props: any
          Anything else you want to store in this cursor. This is a temporary
          measure that will go away when we implement improved return values
          for elements.

        """
        self._is_locked = True
        self._index = index
        self._path = path
        self.props = props

    def get_locked_cursor(self, **props):
        self.props = props
        return self

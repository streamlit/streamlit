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

import copy
import threading


class ThreadSafeSet:
    """A thread-safe set wrapper that enforces controlled access via atomic methods.

    This replaces bare ``set[str]`` fields where callers previously did non-atomic
    check-then-add operations. The underlying set is never exposed directly —
    callers interact only through ``check_and_add``, ``__contains__``, ``snapshot``,
    and ``clear``.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._data: set[str] = set()

    def check_and_add(self, value: str) -> bool:
        """Atomically check membership and add. Returns True if the value was new."""
        with self._lock:
            is_new = value not in self._data
            self._data.add(value)
            return is_new

    def __contains__(self, value: object) -> bool:
        with self._lock:
            return value in self._data

    def clear(self) -> None:
        """Reset to empty."""
        with self._lock:
            self._data.clear()

    def snapshot(self) -> frozenset[str]:
        """Return an immutable copy for read-only consumers."""
        with self._lock:
            return frozenset(self._data)

    def __deepcopy__(self, memo: dict) -> ThreadSafeSet:
        new = ThreadSafeSet()
        with self._lock:
            new._data = copy.deepcopy(self._data, memo)
        return new

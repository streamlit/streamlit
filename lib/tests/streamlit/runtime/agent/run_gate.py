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

"""A gate a test app's script waits at, so a test can hold a run open.

The interaction tests' temporary scripts import this module. They run in the
test's process, so the script thread and the test share these events and
counters.
"""

from __future__ import annotations

import threading
from collections import Counter
from typing import Final

# Long enough for any test, short enough that a test that forgets to open the
# gate fails instead of hanging.
_WAIT_SECONDS: Final = 10.0

_lock = threading.Lock()
_counts: Counter[str] = Counter()

# Set once a script reaches `wait()`.
reached = threading.Event()
# While set, `wait()` returns at once.
opened = threading.Event()


def reset() -> None:
    """Open the gate and zero every counter."""
    with _lock:
        _counts.clear()
    reached.clear()
    opened.set()


def close() -> None:
    """Make the next `wait()` block until `opened` is set."""
    reached.clear()
    opened.clear()


def count(name: str) -> int:
    """Increment the counter ``name`` and return its new value."""
    with _lock:
        _counts[name] += 1
        return _counts[name]


def value(name: str) -> int:
    """The current value of the counter ``name``."""
    with _lock:
        return _counts[name]


def wait() -> None:
    """Block the calling script until the test opens the gate."""
    reached.set()
    if not opened.wait(_WAIT_SECONDS):
        raise RuntimeError("The test never opened the run gate.")

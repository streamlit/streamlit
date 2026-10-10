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

"""Side channel for sleep-on-import helpers used by gh-6404 tests.

This module must not sleep on import. Tests reset it between trials and wait
on ``started`` after kicking off an ``importlib.import_module`` of a sibling
helper that *does* sleep.
"""

from __future__ import annotations

import threading

started = threading.Event()
sleep_s = 0.1


def reset(sleep: float = 0.1) -> None:
    """Clear ``started`` and set the import-sleep duration.

    Parameters
    ----------
    sleep : float
        Seconds the next sleeping helper import should block. Default is
        ``0.1``.
    """
    global sleep_s  # noqa: PLW0603
    sleep_s = sleep
    started.clear()

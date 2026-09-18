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

"""Regression tests for process exit while a script thread is hung."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import Final

import pytest

_THIS_DIR: Final = Path(__file__).parent
_TIGHT_LOOP_SCRIPT: Final = _THIS_DIR / "test_data" / "tight_loop.py"
_HUNG_CHILD_SCRIPT: Final = _THIS_DIR / "_hung_script_exit_child.py"

# Interpreter shutdown joins non-daemon threads, so communicate() only returns
# within this budget if the script thread is a daemon while still spinning.
_PROCESS_EXIT_TIMEOUT_SEC: Final = 30


@pytest.mark.slow
def test_process_exits_when_script_thread_is_hung() -> None:
    """The interpreter must exit even if the script thread is stuck in a tight
    loop with no st.* interrupt points.
    """
    proc = subprocess.Popen(
        [sys.executable, str(_HUNG_CHILD_SCRIPT), str(_TIGHT_LOOP_SCRIPT)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        stdout, stderr = proc.communicate(timeout=_PROCESS_EXIT_TIMEOUT_SEC)
    except subprocess.TimeoutExpired:
        proc.kill()
        stdout, stderr = proc.communicate()
        pytest.fail(
            "Process did not exit while the script thread was hung. "
            f"stdout={stdout!r} stderr={stderr!r}"
        )

    assert proc.returncode == 0, (
        f"Hung-script child exited {proc.returncode}. stdout={stdout!r} stderr={stderr!r}"
    )

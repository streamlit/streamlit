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

"""Child process for script_thread_shutdown_test.

Starts a ScriptRunner on a script that never reaches an st.* interrupt point,
requests a cooperative stop (which cannot unwind the loop), then returns.
The parent asserts this process exits; that only happens if the script thread
is a daemon.
"""

from __future__ import annotations

import asyncio
import sys
import threading
import time
from typing import Final
from unittest.mock import MagicMock

from streamlit.runtime.fragment import MemoryFragmentStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.runtime.pages_manager import PagesManager
from streamlit.runtime.runtime import Runtime
from streamlit.runtime.scriptrunner.script_cache import ScriptCache
from streamlit.runtime.scriptrunner.script_runner import ScriptRunner, ScriptRunnerEvent
from streamlit.runtime.scriptrunner_utils.script_requests import RerunData
from streamlit.runtime.state.session_state import SessionState

_SCRIPT_START_TIMEOUT_SEC: Final = 5.0


def main() -> None:
    script_path = sys.argv[1]

    # ScriptRunner calls Runtime.instance() during setup, before user code.
    Runtime._instance = MagicMock()

    loop = asyncio.new_event_loop()
    script_cache = ScriptCache()
    runner = ScriptRunner(
        session_id="test",
        main_script_path=script_path,
        session_state=SessionState(),
        uploaded_file_mgr=MemoryUploadedFileManager("/mock/upload"),
        script_cache=script_cache,
        initial_rerun_data=RerunData(),
        user_info={"email": "test@example.com"},
        fragment_storage=MemoryFragmentStorage(),
        pages_manager=PagesManager(script_path, script_cache),
        event_loop=loop,
    )

    started = threading.Event()
    failed: list[str] = []

    def record_event(
        sender: object,
        event: ScriptRunnerEvent,
        **kwargs: object,
    ) -> None:
        if event == ScriptRunnerEvent.SCRIPT_STARTED:
            started.set()
        elif event in {
            ScriptRunnerEvent.SCRIPT_STOPPED_WITH_COMPILE_ERROR,
            ScriptRunnerEvent.SCRIPT_STOPPED_WITH_SUCCESS,
            ScriptRunnerEvent.SHUTDOWN,
        }:
            failed.append(event.value)

    runner.on_event.connect(record_event, weak=False)
    runner.start()
    if not started.wait(timeout=_SCRIPT_START_TIMEOUT_SEC):
        raise RuntimeError(
            f"script never started (events={failed}, thread={runner._script_thread})"
        )
    # SCRIPT_STARTED is emitted before compile and exec(). Give the tight loop
    # a moment to begin so this matches shutdown-while-hung, not startup.
    time.sleep(0.2)
    # Cooperative stop cannot unwind a tight loop with no st.* calls.
    runner.request_stop()

    thread = runner._script_thread
    if thread is None or not thread.is_alive():
        raise RuntimeError(
            "script thread exited after request_stop(); the loop was not hung "
            f"(events={failed})"
        )
    if failed:
        raise RuntimeError(
            f"script left the hung loop before interpreter shutdown (events={failed})"
        )
    # Returning from main should exit the process because the script thread is
    # a daemon. If it is not, interpreter shutdown blocks on the live thread
    # and the parent test times out.


if __name__ == "__main__":
    main()

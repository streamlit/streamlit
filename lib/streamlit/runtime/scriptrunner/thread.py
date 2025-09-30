# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import threading
import time
from typing import Any, Callable, cast

_OrigThread = threading.Thread  # pyright: ignore
_OrigTimer = threading.Timer  # pyright: ignore


def replace_thread_classes() -> None:
    """Replace Python's threading.Thread an threading.Timer with our versions.

    The originals are stored in _OrigThread and _OrigTimer.
    """
    threading.Thread = StreamlitThread  # type: ignore[assignment,misc] # ty: ignore[invalid-assignment]
    threading.Timer = StreamlitTimer  # type: ignore[assignment,misc] # ty: ignore[invalid-assignment]


class ScriptThread(threading.Thread):
    """Thread class used for Streamlit script runs.

    This class only exists so we can keep track of threads created by the Streamlit
    developer, in order for us to join() them all before the script thread concludes.

    For this to work, all threads created by the developer must be of type StreamlitThread,
    which is a special type that registers itself in this class's self._subthreads when
    started.
    """

    def __init__(
        self,
        group: None = None,
        target: Callable[..., Any] | None = None,
        name: str | None = None,
        args: tuple[Any, ...] = (),
        kwargs: dict[str, Any] | None = None,
        *,
        daemon: bool | None = None,
    ) -> None:
        super().__init__(
            group=group,
            target=target,
            name=name,
            args=args,
            kwargs=kwargs,
            daemon=daemon,
        )
        self._root_thread: ScriptThread = self
        self._subthreads: set[StreamlitThread] = set()

    def register_subthread(self, subthread: StreamlitThread) -> None:
        self._subthreads.add(subthread)

    def unregister_subthread(self, subthread: StreamlitThread) -> None:
        self._subthreads.remove(subthread)

    def wait_for_subthreads(self) -> None:
        while subthreads := self._get_subthreads_to_wait_for():
            for child in subthreads:
                child.join()

                # Give the loop a little breathing time so it doesn't block other threads.
                time.sleep(0.05)

    def _get_subthreads_to_wait_for(self) -> list[StreamlitThread]:
        return [t for t in self._subthreads if t.is_alive() and not t.daemon]


class StreamlitThread(threading.Thread):
    """Thread class that replaces threading.Thread, so it will be used by developers
    inside Streamlit apps.
    """

    def __init__(
        self,
        group: None = None,
        target: Callable[..., Any] | None = None,
        name: str | None = None,
        args: tuple[Any, ...] = (),
        kwargs: dict[str, Any] | None = None,
        *,
        daemon: bool | None = None,
    ) -> None:
        super().__init__(
            group=group,
            target=target,
            name=name,
            args=args,
            kwargs=kwargs,
            daemon=daemon,
        )
        self._init_subthread_properties()

    def start(self) -> None:
        self._before_start()
        return super().start()

    def run(self) -> None:
        super().run()
        self._after_run()

    def _init_subthread_properties(self) -> None:
        curr_thread = cast("StreamlitThread", threading.current_thread())
        self._is_script_subthread = hasattr(curr_thread, "_root_thread")
        self._root_thread: ScriptThread | None = getattr(
            curr_thread, "_root_thread", None
        )
        self._ctx = None

    def _before_start(self) -> None:
        if self._is_script_subthread:
            from streamlit.runtime.scriptrunner import add_script_run_ctx

            add_script_run_ctx(thread=self)

        if self._root_thread:
            self._root_thread.register_subthread(self)

    def _after_run(self) -> None:
        if self._root_thread:
            self._root_thread.unregister_subthread(self)


class StreamlitTimer(threading.Timer, StreamlitThread):
    """Timer class that replaces threading.Timer, so it will be used by developers
    inside Streamlit apps.
    """

    def __init__(
        self,
        interval: float,
        function: Callable[..., Any],
        args: tuple[Any, ...] | None = None,
        kwargs: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(interval, function, args, kwargs)
        self._init_subthread_properties()

    def start(self) -> None:
        self._before_start()
        return super().start()

    def run(self) -> None:
        super().run()
        self._after_run()

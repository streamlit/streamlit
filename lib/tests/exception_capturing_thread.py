# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import threading
from typing import Any, Callable, Optional


def call_on_threads(
    func: Callable[[int], Any], num_threads: int, timeout: Optional[float] = 0.25
) -> None:
    """Call a function on multiple threads simultaneously and assert that no
    thread raises an unhandled exception.

    The function must take single `int` param, which will be the index of
    the thread it's being called on.

    Note that a passing multi-threaded test does not generally guarantee that
    the tested code is thread safe! Because threading issues tend to be
    non-deterministic, a flaky test that fails only occasionally is a good
    indicator of an underlying issue.
    """
    threads = [
        ExceptionCapturingThread(name=f"Thread {ii}", target=func, args=[ii])
        for ii in range(num_threads)
    ]

    for thread in threads:
        thread.start()

    for thread in threads:
        thread.join(timeout=timeout)
        thread.assert_no_unhandled_exception()


class ExceptionCapturingThread(threading.Thread):
    """Thread subclass that captures unhandled exceptions."""

    def __init__(
        self, group=None, target=None, name=None, args=(), kwargs=None, *, daemon=None
    ):
        super().__init__(
            group=group,
            target=target,
            name=name,
            args=args,
            kwargs=kwargs,
            daemon=daemon,
        )
        self._unhandled_exception: Optional[BaseException] = None

    @property
    def unhandled_exception(self) -> Optional[BaseException]:
        """The unhandled exception raised by the thread's target, if it raised one."""
        return self._unhandled_exception

    def assert_no_unhandled_exception(self) -> None:
        """If the thread target raised an unhandled exception, re-raise it.
        Otherwise no-op.
        """
        if self._unhandled_exception is not None:
            raise RuntimeError(
                f"Unhandled exception in thread '{self.name}'"
            ) from self._unhandled_exception

    def run(self) -> None:
        try:
            super().run()
        except Exception as e:
            self._unhandled_exception = e

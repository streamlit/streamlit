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

"""A class that watches a given path via polling."""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import TYPE_CHECKING, Final

from streamlit.errors import StreamlitMaxRetriesError
from streamlit.logger import get_logger
from streamlit.util import repr_
from streamlit.watcher import util

if TYPE_CHECKING:
    from collections.abc import Callable

_LOGGER: Final = get_logger(__name__)

_MAX_WORKERS: Final = 4
_POLLING_PERIOD_SECS: Final = 0.2


class PollingPathWatcher:
    """Watches a path on disk via a polling loop."""

    _executor = ThreadPoolExecutor(max_workers=_MAX_WORKERS)

    @staticmethod
    def close_all() -> None:
        """Close top-level watcher object.

        This is a no-op, and exists for interface parity with
        EventBasedPathWatcher.
        """
        _LOGGER.debug("Watcher closed")

    def __init__(
        self,
        path: str,
        on_changed: Callable[[str], None],
        *,  # keyword-only arguments:
        glob_pattern: str | None = None,
        allow_nonexistent: bool = False,
    ) -> None:
        """Constructor.

        You do not need to retain a reference to a PollingPathWatcher to
        prevent it from being garbage collected. (The global _executor object
        retains references to all active instances.)
        """
        # TODO(vdonato): Modernize this by switching to pathlib.
        self._path = Path(path)  # Changed to pathlib.Path
        self._on_changed = on_changed

        self._glob_pattern = glob_pattern
        self._allow_nonexistent = allow_nonexistent

        self._active = True

        self._modification_time = util.path_modification_time(
            str(self._path), self._allow_nonexistent
        )
        self._md5 = util.calc_md5_with_blocking_retries(
            str(self._path),
            glob_pattern=self._glob_pattern,
            allow_nonexistent=self._allow_nonexistent,
        )
        self._schedule()

    def __repr__(self) -> str:
        return repr_(self)

    def _schedule(self) -> None:
        def task() -> None:
            time.sleep(_POLLING_PERIOD_SECS)
            self._check_if_path_changed()

        PollingPathWatcher._executor.submit(task)

    def _check_if_path_changed(self) -> None:
        if not self._active:
            # Don't call self._schedule()
            return

        try:
            modification_time = util.path_modification_time(
                str(self._path), self._allow_nonexistent
            )
            # We add modification_time != 0.0 check since on some file systems (s3fs/fuse)
            # modification_time is always 0.0 because of file system limitations.
            if (
                modification_time != 0.0
                and modification_time <= self._modification_time
            ):
                self._schedule()
                return

            self._modification_time = modification_time

            md5 = util.calc_md5_with_blocking_retries(
                str(self._path),
                glob_pattern=self._glob_pattern,
                allow_nonexistent=self._allow_nonexistent,
            )
            if md5 == self._md5:
                self._schedule()
                return
        except StreamlitMaxRetriesError as ex:
            _LOGGER.debug(
                "Ignoring file change. Failed to calculate MD5 for path %s",
                self._path,
                exc_info=ex,
            )
            return

        self._md5 = md5

        _LOGGER.debug("Change detected: %s", self._path)
        self._on_changed(str(self._path))

        self._schedule()

    def close(self) -> None:
        """Stop watching the file system."""
        self._active = False

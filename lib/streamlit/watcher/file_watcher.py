# Copyright 2018-2021 Streamlit Inc.
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

from typing import Optional, Union, Type, Callable

import streamlit.watcher
from streamlit import config
from streamlit import env_util
from streamlit.logger import get_logger
from streamlit.watcher.polling_file_watcher import PollingFileWatcher

LOGGER = get_logger(__name__)

try:
    # Check if the watchdog module is installed.
    from streamlit.watcher.event_based_file_watcher import EventBasedFileWatcher

    watchdog_available = True
except ImportError:
    watchdog_available = False
    if not config.get_option("global.disableWatchdogWarning"):
        msg = "\n  $ xcode-select --install" if env_util.IS_DARWIN else ""

        LOGGER.warning(
            """
  For better performance, install the Watchdog module:
  %s
  $ pip install watchdog

        """
            % msg
        )

# EventBasedFileWatcher won't be available if its import failed (due to
# missing watchdog module), so we can't reference it directly in this type.
FileWatcherType = Union[
    Type["streamlit.watcher.event_based_file_watcher.EventBasedFileWatcher"],
    Type[PollingFileWatcher],
]


def watch_file(path: str, on_file_changed: Callable[[str], None]) -> bool:
    """Create a FileWatcher for the given file if we have a viable
    FileWatcher class.

    Parameters
    ----------
    path
        Path of the file to watch.
    on_file_changed
        Function that's called when the file changes.

    Returns
    -------
    bool
        True if the file is being watched, or False if we have no
        FileWatcher class.
    """
    watcher_class = get_file_watcher_class()
    if watcher_class is None:
        return False

    watcher_class(path, on_file_changed)
    return True


def get_file_watcher_class() -> Optional[FileWatcherType]:
    """Return the class to use for being notified of file changes, based on the
    server.fileWatcherType config option.
    """
    watcher_type = config.get_option("server.fileWatcherType")

    if watcher_type == "auto":
        if watchdog_available:
            return EventBasedFileWatcher
        else:
            return PollingFileWatcher
    elif watcher_type == "watchdog" and watchdog_available:
        return EventBasedFileWatcher
    elif watcher_type == "poll":
        return PollingFileWatcher
    else:
        return None

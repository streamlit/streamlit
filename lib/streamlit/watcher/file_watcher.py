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

from typing import Callable, Optional, Type, Union

import click

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

# EventBasedFileWatcher won't be available if its import failed (due to
# missing watchdog module), so we can't reference it directly in this type.
FileWatcherType = Union[
    Type["streamlit.watcher.event_based_file_watcher.EventBasedFileWatcher"],
    Type[PollingFileWatcher],
]


def report_watchdog_availability():
    if not watchdog_available:
        if not config.get_option("global.disableWatchdogWarning"):
            msg = "\n  $ xcode-select --install" if env_util.IS_DARWIN else ""

            click.secho(
                "  %s" % "For better performance, install the Watchdog module:",
                fg="blue",
                bold=True,
            )
            click.secho(
                """%s
  $ pip install watchdog
            """
                % msg
            )


def watch_file(
    path: str,
    on_file_changed: Callable[[str], None],
    watcher_type: Optional[str] = None,
) -> bool:
    """Create a FileWatcher for the given file if we have a viable
    FileWatcher class.

    Parameters
    ----------
    path
        Path of the file to watch.
    on_file_changed
        Function that's called when the file changes.
    watcher_type
        Optional watcher_type string. If None, it will default to the
        'server.fileWatcherType` config option.

    Returns
    -------
    bool
        True if the file is being watched, or False if we have no
        FileWatcher class.
    """

    if watcher_type is None:
        watcher_type = config.get_option("server.fileWatcherType")

    watcher_class = get_file_watcher_class(watcher_type)
    if watcher_class is None:
        return False

    watcher_class(path, on_file_changed)
    return True


def get_default_file_watcher_class() -> Optional[FileWatcherType]:
    """Return the class to use for file changes notifications, based on the
    server.fileWatcherType config option.
    """
    return get_file_watcher_class(config.get_option("server.fileWatcherType"))


def get_file_watcher_class(watcher_type: str) -> Optional[FileWatcherType]:
    """Return the FileWatcher class that corresponds to the given watcher_type
    string. Acceptable values are 'auto', 'watchdog', 'poll' and 'none'.
    """
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

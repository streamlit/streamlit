# Copyright 2018-2022 Streamlit Inc.
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
from streamlit.watcher.polling_path_watcher import PollingPathWatcher

LOGGER = get_logger(__name__)

try:
    # Check if the watchdog module is installed.
    from streamlit.watcher.event_based_path_watcher import EventBasedPathWatcher

    watchdog_available = True
except ImportError:
    watchdog_available = False
    # Stub the EventBasedPathWatcher so it can be mocked by tests

    class EventBasedPathWatcher:  # type: ignore
        pass


# local_sources_watcher.py caches the return value of
# get_default_path_watcher_class(), so it needs to differentiate between the
# cases where it:
#   1. has yet to call get_default_path_watcher_class()
#   2. has called get_default_path_watcher_class(), which returned that no
#      path watcher should be installed.
# This forces us to define this stub class since the cached value equaling
# None corresponds to case 1 above.
class NoOpPathWatcher:
    def __init__(self, _path_str, _on_changed):
        pass


# EventBasedPathWatcher will be a stub and have no functional
# implementation if its import failed (due to missing watchdog module),
# so we can't reference it directly in this type.
PathWatcherType = Union[
    Type["streamlit.watcher.event_based_path_watcher.EventBasedPathWatcher"],
    Type[PollingPathWatcher],
    Type[NoOpPathWatcher],
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


# TODO(vdonato): Add an internal `_watch_path` method, and use it to implement
# `watch_file` and `watch_directory`.
def watch_file(
    path: str,
    on_file_changed: Callable[[str], None],
    watcher_type: Optional[str] = None,
) -> bool:
    """Create a PathWatcher for the given file if we have a viable
    PathWatcher class.

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
        PathWatcher class.
    """

    if watcher_type is None:
        watcher_type = config.get_option("server.fileWatcherType")

    watcher_class = get_path_watcher_class(watcher_type)
    if watcher_class is NoOpPathWatcher:
        return False

    watcher_class(path, on_file_changed)
    return True


def get_default_path_watcher_class() -> PathWatcherType:
    """Return the class to use for path changes notifications, based on the
    server.fileWatcherType config option.
    """
    return get_path_watcher_class(config.get_option("server.fileWatcherType"))


def get_path_watcher_class(watcher_type: str) -> PathWatcherType:
    """Return the PathWatcher class that corresponds to the given watcher_type
    string. Acceptable values are 'auto', 'watchdog', 'poll' and 'none'.
    """
    if watcher_type == "auto":
        if watchdog_available:
            return EventBasedPathWatcher
        else:
            return PollingPathWatcher
    elif watcher_type == "watchdog" and watchdog_available:
        return EventBasedPathWatcher
    elif watcher_type == "poll":
        return PollingPathWatcher
    else:
        return NoOpPathWatcher

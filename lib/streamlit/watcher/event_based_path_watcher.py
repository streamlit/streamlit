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

"""Declares the EventBasedPathWatcher class, which watches given paths in the file system.

How these classes work together
-------------------------------

- EventBasedPathWatcher : each instance of this is able to watch a single
  file or directory at a given path so long as there's a browser interested in
  it. This uses _MultiPathWatcher to watch paths.

- _MultiPathWatcher : singleton that watches multiple paths. It does this by
  holding a watchdog.observer.Observer object, and manages several
  _FolderEventHandler instances. This creates _FolderEventHandlers as needed,
  if the required folder is not already being watched. And it also tells
  existing _FolderEventHandlers which paths it should be watching for.

- _FolderEventHandler : event handler for when a folder is modified. You can
  register paths in that folder that you're interested in. Then this object
  listens to folder events, sees if registered paths changed, and fires
  callbacks if so.

"""

import os
import threading
from typing import Callable, cast, Dict, Optional

from blinker import Signal, ANY

from streamlit.util import repr_
from streamlit.watcher import util
from watchdog import events
from watchdog.observers import Observer

from streamlit.logger import get_logger

LOGGER = get_logger(__name__)


class EventBasedPathWatcher:
    """Watches a single path on disk using watchdog"""

    @staticmethod
    def close_all() -> None:
        """Close the _MultiPathWatcher singleton."""
        path_watcher = _MultiPathWatcher.get_singleton()
        path_watcher.close()
        LOGGER.debug("Watcher closed")

    def __init__(self, path: str, on_changed: Callable[[str], None]) -> None:
        """Constructor.

        Arguments
        ---------
        path
            Absolute path to watch.

        on_changed
            Function to call when the given path changes. This function should
            take the changed path as a parameter.

        """
        self._path = os.path.abspath(path)
        self._on_changed = on_changed

        path_watcher = _MultiPathWatcher.get_singleton()
        path_watcher.watch_path(self._path, on_changed)
        LOGGER.debug("Watcher created for %s", self._path)

    def __repr__(self) -> str:
        return repr_(self)

    def close(self) -> None:
        """Stop watching the path corresponding to this EventBasedPathWatcher."""
        path_watcher = _MultiPathWatcher.get_singleton()
        path_watcher.stop_watching_path(self._path, self._on_changed)


class _MultiPathWatcher(object):
    """Watches multiple paths."""

    _singleton: Optional["_MultiPathWatcher"] = None

    @classmethod
    def get_singleton(cls) -> "_MultiPathWatcher":
        """Return the singleton _MultiPathWatcher object.

        Instantiates one if necessary.
        """
        if cls._singleton is None:
            LOGGER.debug("No singleton. Registering one.")
            _MultiPathWatcher()

        return cast("_MultiPathWatcher", _MultiPathWatcher._singleton)

    # Don't allow constructor to be called more than once.
    def __new__(cls) -> "_MultiPathWatcher":
        """Constructor."""
        if _MultiPathWatcher._singleton is not None:
            raise RuntimeError("Use .get_singleton() instead")
        return super(_MultiPathWatcher, cls).__new__(cls)

    def __init__(self) -> None:
        """Constructor."""
        _MultiPathWatcher._singleton = self

        # Map of folder_to_watch -> _FolderEventHandler.
        self._folder_handlers: Dict[str, _FolderEventHandler] = {}

        # Used for mutation of _folder_handlers dict
        self._lock = threading.Lock()

        # The Observer object from the Watchdog module. Since this class is
        # only instantiated once, we only have a single Observer in Streamlit,
        # and it's in charge of watching all paths we're interested in.
        self._observer = Observer()
        self._observer.start()  # Start observer thread.

    def __repr__(self) -> str:
        return repr_(self)

    def watch_path(self, path: str, callback: Callable[[str], None]) -> None:
        """Start watching a path."""
        folder_path = os.path.abspath(os.path.dirname(path))

        with self._lock:
            folder_handler = self._folder_handlers.get(folder_path)

            if folder_handler is None:
                folder_handler = _FolderEventHandler()
                self._folder_handlers[folder_path] = folder_handler

                folder_handler.watch = self._observer.schedule(
                    folder_handler, folder_path, recursive=False
                )

            folder_handler.add_path_change_listener(path, callback)

    def stop_watching_path(self, path: str, callback: Callable[[str], None]) -> None:
        """Stop watching a path."""
        folder_path = os.path.abspath(os.path.dirname(path))

        with self._lock:
            folder_handler = self._folder_handlers.get(folder_path)

            if folder_handler is None:
                LOGGER.debug(
                    "Cannot stop watching path, because it is already not being "
                    "watched. %s",
                    folder_path,
                )
                return

            folder_handler.remove_path_change_listener(path, callback)

            if not folder_handler.is_watching_paths():
                # Sometimes watchdog's FileSystemEventHandler does not have
                # a .watch property. It's unclear why -- may be due to a
                # race condition.
                if hasattr(folder_handler, "watch"):
                    self._observer.unschedule(folder_handler.watch)
                del self._folder_handlers[folder_path]

    def close(self) -> None:
        with self._lock:
            """Close this _MultiPathWatcher object forever."""
            if len(self._folder_handlers) != 0:
                self._folder_handlers = {}
                LOGGER.debug(
                    "Stopping observer thread even though there is a non-zero "
                    "number of event observers!"
                )
            else:
                LOGGER.debug("Stopping observer thread")

            self._observer.stop()
            self._observer.join(timeout=5)


class WatchedPath(object):
    """Emits notifications when a single path is modified."""

    def __init__(self, md5, modification_time):
        self.md5 = md5
        self.modification_time = modification_time
        self.on_changed = Signal()

    def __repr__(self) -> str:
        return repr_(self)


class _FolderEventHandler(events.FileSystemEventHandler):
    """Listen to folder events. If certain paths change, fire a callback.

    The super class, FileSystemEventHandler, listens to changes to *folders*,
    but we need to listen to changes to *both* folders and files. I believe
    this is a limitation of the Mac FSEvents system API, and the watchdog
    library takes the lower common denominator.

    So in this class we watch for folder events and then filter them based
    on whether or not we care for the path the event is about.
    """

    def __init__(self) -> None:
        """Constructor."""
        super(_FolderEventHandler, self).__init__()
        self._watched_paths: Dict[str, WatchedPath] = {}
        self._lock = threading.Lock()  # for watched_paths mutations

    def __repr__(self) -> str:
        return repr_(self)

    def add_path_change_listener(
        self, path: str, callback: Callable[[str], None]
    ) -> None:
        """Add a path to this object's event filter."""
        with self._lock:
            watched_path = self._watched_paths.get(path, None)
            if watched_path is None:
                md5 = util.calc_md5_with_blocking_retries(path)
                modification_time = os.stat(path).st_mtime
                watched_path = WatchedPath(md5=md5, modification_time=modification_time)
                self._watched_paths[path] = watched_path

            watched_path.on_changed.connect(callback, weak=False)

    def remove_path_change_listener(
        self, path: str, callback: Callable[[str], None]
    ) -> None:
        """Remove a path from this object's event filter."""
        with self._lock:
            watched_path = self._watched_paths.get(path, None)
            if watched_path is None:
                return

            watched_path.on_changed.disconnect(callback)
            if not watched_path.on_changed.has_receivers_for(ANY):
                del self._watched_paths[path]

    def is_watching_paths(self) -> bool:
        """Return true if this object has 1+ paths in its event filter."""
        return len(self._watched_paths) > 0

    def handle_path_change_event(self, event):
        """Handle when a path is changed.

        The events that can call this are modification, creation or moved
        events.

        Parameters
        ----------
        event : FileSystemEvent
            The event object representing the file system event.

        """
        if event.is_directory:
            return

        # NOTE: At this point, we know that the changed path must be a file.

        # Check for both modified and moved files, because many programs write
        # to a backup file then rename (i.e. move) it.
        if event.event_type == events.EVENT_TYPE_MODIFIED:
            file_path = event.src_path
        elif event.event_type == events.EVENT_TYPE_MOVED:
            LOGGER.debug("Move event: src %s; dest %s", event.src_path, event.dest_path)
            file_path = event.dest_path
        # On OSX with VI, on save, the file is deleted, the swap file is
        # modified and then the original file is created hence why we
        # capture EVENT_TYPE_CREATED
        elif event.event_type == events.EVENT_TYPE_CREATED:
            file_path = event.src_path
        else:
            LOGGER.debug("Don't care about event type %s", event.event_type)
            return

        file_path = os.path.abspath(file_path)

        file_info = self._watched_paths.get(file_path, None)
        if file_info is None:
            LOGGER.debug(
                "Ignoring file %s.\nWatched_paths: %s", file_path, self._watched_paths
            )
            return

        modification_time = os.stat(file_path).st_mtime
        if modification_time == file_info.modification_time:
            LOGGER.debug("File timestamp did not change: %s", file_path)
            return

        file_info.modification_time = modification_time

        new_md5 = util.calc_md5_with_blocking_retries(file_path)
        if new_md5 == file_info.md5:
            LOGGER.debug("File MD5 did not change: %s", file_path)
            return

        LOGGER.debug("File MD5 changed: %s", file_path)
        file_info.md5 = new_md5
        file_info.on_changed.send(file_path)

    def on_created(self, event):
        if event.is_directory:
            return
        self.handle_path_change_event(event)

    def on_modified(self, event):
        if event.is_directory:
            return
        self.handle_path_change_event(event)

    def on_moved(self, event):
        if event.is_directory:
            return
        self.handle_path_change_event(event)

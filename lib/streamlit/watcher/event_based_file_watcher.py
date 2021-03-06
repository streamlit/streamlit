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

"""Declares the EventBasedFileWatcher class, that watches the file system.

How these classes work together
-------------------------------

- EventBasedFileWatcher : each instance of this is able to watch a single
  files so long as there's a browser interested in it. This uses
  _MultiFileWatcher to watch files.

- _MultiFileWatcher : singleton that watches multiple files. It does this by
  holding a watchdog.observer.Observer object, and manages several
  _FolderEventHandler instances. This creates _FolderEventHandlers as needed,
  if the required folder is not already being watched. And it also tells
  existing _FolderEventHandlers which files it should be watching for.

- _FolderEventHandler : event handler from when a folder is modified. You can
  register files in that folder that you're interested in. Then this object
  listens to folder events, sees if registered files changed, and fires
  callbacks if so.

"""

import os
import threading
from typing import Callable

from blinker import Signal, ANY

from streamlit.watcher import util
from watchdog import events
from watchdog.observers import Observer

from streamlit.logger import get_logger

LOGGER = get_logger(__name__)


class EventBasedFileWatcher(object):
    """Watches a single file on disk using watchdog"""

    @staticmethod
    def close_all() -> None:
        """Close the EventBasedFileWatcher singleton."""
        file_watcher = _MultiFileWatcher.get_singleton()
        file_watcher.close()
        LOGGER.debug("Watcher closed")

    def __init__(self, file_path: str, on_file_changed: Callable[[str], None]):
        """Constructor.

        Arguments
        ---------
        file_path
            Absolute path of the file to watch.

        on_file_changed
            Function to call when the file changes. This function should
            take the changed file's path as a parameter.

        """
        file_path = os.path.abspath(file_path)
        self._file_path = file_path
        self._on_file_changed = on_file_changed

        file_watcher = _MultiFileWatcher.get_singleton()
        file_watcher.watch_file(file_path, on_file_changed)
        LOGGER.debug("Watcher created for %s", file_path)

    def close(self) -> None:
        """Stop watching the file system."""
        file_watcher = _MultiFileWatcher.get_singleton()
        file_watcher.stop_watching_file(self._file_path, self._on_file_changed)


class _MultiFileWatcher(object):
    """Watches multiple files."""

    _singleton = None

    @classmethod
    def get_singleton(cls):
        """Return the singleton _MultiFileWatcher object.

        Instantiates one if necessary.
        """
        if cls._singleton is None:
            LOGGER.debug("No singleton. Registering one.")
            _MultiFileWatcher()

        return _MultiFileWatcher._singleton

    # Don't allow constructor to be called more than once.
    def __new__(cls):
        """Constructor."""
        if _MultiFileWatcher._singleton is not None:
            raise RuntimeError("Use .get_singleton() instead")
        return super(_MultiFileWatcher, cls).__new__(cls)

    def __init__(self):
        """Constructor."""
        _MultiFileWatcher._singleton = self

        # Map of folder_to_watch -> _FolderEventHandler.
        self._folder_handlers = {}

        # Used for mutation of _folder_handlers dict
        self._lock = threading.Lock()

        # The Observer object from the Watchdog module. Since this class is
        # only instantiated once, we only have a single Observer in Streamlit,
        # and it's in charge of watching all paths we're interested in.
        self._observer = Observer()
        self._observer.start()  # Start observer thread.

    def watch_file(self, file_path, callback):
        """Start watching a file.

        Parameters
        ----------
        file_path : str
            The full path of the file to watch.

        callback : callable
            The function to execute when the file is changed.

        """
        folder_path = os.path.abspath(os.path.dirname(file_path))

        with self._lock:
            folder_handler = self._folder_handlers.get(folder_path)

            if folder_handler is None:
                folder_handler = _FolderEventHandler()
                self._folder_handlers[folder_path] = folder_handler

                folder_handler.watch = self._observer.schedule(
                    folder_handler, folder_path, recursive=False
                )

            folder_handler.add_file_change_listener(file_path, callback)

    def stop_watching_file(self, file_path, callback):
        """Stop watching a file.

        Parameters
        ----------
        file_path : str
            The full path of the file to stop watching.

        callback : callable
            The function to execute when the file is changed.

        """
        folder_path = os.path.abspath(os.path.dirname(file_path))

        with self._lock:
            folder_handler = self._folder_handlers.get(folder_path)

            if folder_handler is None:
                LOGGER.debug(
                    "Cannot stop watching path, because it is already not being "
                    "watched. %s",
                    folder_path,
                )
                return

            folder_handler.remove_file_change_listener(file_path, callback)

            if not folder_handler.is_watching_files():
                # Sometimes watchdog's FileSystemEventHandler does not have
                # a .watch property. It's unclear why -- may be due to a
                # race condition.
                if hasattr(folder_handler, "watch"):
                    self._observer.unschedule(folder_handler.watch)
                del self._folder_handlers[folder_path]

    def close(self):
        with self._lock:
            """Close this _MultiFileWatcher object forever."""
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


class WatchedFile(object):
    """Emits notifications when a single file is modified."""

    def __init__(self, md5, modification_time):
        self.md5 = md5
        self.modification_time = modification_time
        self.on_file_changed = Signal()


class _FolderEventHandler(events.FileSystemEventHandler):
    """Listen to folder events, see if certain files changed, fire callback.

    The super class, FileSystemEventHandler, listens to changes to *folders*,
    but we need to listen to changes to *files*. I believe this is a limitation
    of the Mac FSEvents system API, and the watchdog library takes the lower
    common denominator.

    So in this class we watch for folder events and then filter them based
    on whether or not we care for the file the event is about.
    """

    def __init__(self):
        """Constructor."""
        super(_FolderEventHandler, self).__init__()
        self._watched_files = {}
        self._lock = threading.Lock()  # for watched_files mutations

    def add_file_change_listener(self, file_path, callback):
        """Add a file to this object's event filter.

        Parameters
        ----------
        file_path : str
        callback : callable

        """
        with self._lock:
            watched_file = self._watched_files.get(file_path, None)
            if watched_file is None:
                md5 = util.calc_md5_with_blocking_retries(file_path)
                modification_time = os.stat(file_path).st_mtime
                watched_file = WatchedFile(md5=md5, modification_time=modification_time)
                self._watched_files[file_path] = watched_file

            watched_file.on_file_changed.connect(callback, weak=False)

    def remove_file_change_listener(self, file_path, callback):
        """Remove a file from this object's event filter.

        Parameters
        ----------
        file_path : str
        callback : callable

        """
        with self._lock:
            watched_file = self._watched_files.get(file_path, None)
            if watched_file is None:
                return

            watched_file.on_file_changed.disconnect(callback)
            if not watched_file.on_file_changed.has_receivers_for(ANY):
                del self._watched_files[file_path]

    def is_watching_files(self):
        """Return true if this object has 1+ files in its event filter."""
        return len(self._watched_files) > 0

    def handle_file_change_event(self, event):
        """Handle when file is changed.

        The events that can call this are modification, creation or moved
        events.

        Parameters
        ----------
        event : FileSystemEvent
            The event object representing the file system event.

        """
        if event.is_directory:
            return

        # Check for both modified and moved files, because many programs write
        # to a backup file then rename (i.e. move) it.
        if event.event_type == events.EVENT_TYPE_MODIFIED:
            file_path = event.src_path
        # On OSX with VI, on save, the file is deleted, the swap file is
        # modified and then the original file is created hence why we
        # capture EVENT_TYPE_CREATED
        elif event.event_type == events.EVENT_TYPE_CREATED:
            file_path = event.src_path
        elif event.event_type == events.EVENT_TYPE_MOVED:
            LOGGER.debug("Move event: src %s; dest %s", event.src_path, event.dest_path)
            file_path = event.dest_path
        else:
            LOGGER.debug("Don't care about event type %s", event.event_type),
            return

        file_path = os.path.abspath(file_path)

        file_info = self._watched_files.get(file_path, None)
        if file_info is None:
            LOGGER.debug(
                "Ignoring file %s.\nWatched_files: %s", file_path, self._watched_files
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
        file_info.on_file_changed.send(file_path)

    def on_created(self, event):
        if event.is_directory:
            return
        self.handle_file_change_event(event)

    def on_modified(self, event):
        if event.is_directory:
            return
        self.handle_file_change_event(event)

    def on_moved(self, event):
        if event.is_directory:
            return
        self.handle_file_change_event(event)

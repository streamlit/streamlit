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

"""Provides global MediaFileManager object as `media_file_manager`."""

from __future__ import annotations

import collections
import hashlib
import threading
from typing import TYPE_CHECKING, Any, Final

from streamlit.logger import get_logger
from streamlit.runtime.media_file_storage import MediaFileKind, MediaFileStorage

if TYPE_CHECKING:
    from collections.abc import Callable

_LOGGER: Final = get_logger(__name__)


def _get_session_id() -> str:
    """Get the active AppSession's session_id."""
    from streamlit.runtime.scriptrunner_utils.script_run_context import (
        get_script_run_ctx,
    )

    ctx = get_script_run_ctx()
    if ctx is None:
        # This is only None when running "python myscript.py" rather than
        # "streamlit run myscript.py". In which case the session ID doesn't
        # matter and can just be a constant, as there's only ever "session".
        return "dontcare"
    return ctx.session_id


class MediaFileMetadata:
    """Metadata that the MediaFileManager needs for each file it manages."""

    def __init__(self, kind: MediaFileKind = MediaFileKind.MEDIA) -> None:
        self._kind = kind
        self._is_marked_for_delete = False

    @property
    def kind(self) -> MediaFileKind:
        return self._kind

    @property
    def is_marked_for_delete(self) -> bool:
        return self._is_marked_for_delete

    def mark_for_delete(self) -> None:
        self._is_marked_for_delete = True


class MediaFileManager:
    """In-memory file manager for MediaFile objects.

    This keeps track of:
    - Which files exist, and what their IDs are. This is important so we can
      serve files by ID -- that's the whole point of this class!
    - Which files are being used by which AppSession (by ID). This is
      important so we can remove files from memory when no more sessions need
      them.
    - The exact location in the app where each file is being used (i.e. the
      file's "coordinates"). This is is important so we can mark a file as "not
      being used by a certain session" if it gets replaced by another file at
      the same coordinates. For example, when doing an animation where the same
      image is constantly replace with new frames. (This doesn't solve the case
      where the file's coordinates keep changing for some reason, though! e.g.
      if new elements keep being prepended to the app. Unlikely to happen, but
      we should address it at some point.)
    """

    def __init__(self, storage: MediaFileStorage) -> None:
        self._storage = storage

        # Dict of [file_id -> MediaFileMetadata]
        self._file_metadata: dict[str, MediaFileMetadata] = {}

        # Dict[session ID][coordinates] -> file_id.
        self._files_by_session_and_coord: dict[str, dict[str, str]] = (
            collections.defaultdict(dict)
        )

        # Dict of [file_id -> deferred callable metadata] for deferred downloads
        # Stores callables that will be executed when user clicks download
        self._deferred_callables: dict[str, dict[str, Any]] = {}

        # MediaFileManager is used from multiple threads, so all operations
        # need to be protected with a Lock. (This is not an RLock, which
        # means taking it multiple times from the same thread will deadlock.)
        self._lock = threading.Lock()

    def _get_inactive_file_ids(self) -> set[str]:
        """Compute the set of files that are stored in the manager, but are
        not referenced by any active session. These are files that can be
        safely deleted.

        Thread safety: callers must hold `self._lock`.
        """
        # Get the set of all our file IDs.
        file_ids = set(self._file_metadata.keys())

        # Subtract all IDs that are in use by each session
        for session_file_ids_by_coord in self._files_by_session_and_coord.values():
            file_ids.difference_update(session_file_ids_by_coord.values())

        return file_ids

    def remove_orphaned_files(self) -> None:
        """Remove all files that are no longer referenced by any active session.

        Safe to call from any thread.
        """
        _LOGGER.debug("Removing orphaned files...")

        with self._lock:
            for file_id in self._get_inactive_file_ids():
                file = self._file_metadata[file_id]
                if file.kind == MediaFileKind.MEDIA:
                    self._delete_file(file_id)
                elif file.kind == MediaFileKind.DOWNLOADABLE:
                    if file.is_marked_for_delete:
                        self._delete_file(file_id)
                    else:
                        file.mark_for_delete()

    def _delete_file(self, file_id: str) -> None:
        """Delete the given file from storage, and remove its metadata from
        self._files_by_id.

        Thread safety: callers must hold `self._lock`.
        """
        _LOGGER.debug("Deleting File: %s", file_id)
        self._storage.delete_file(file_id)
        del self._file_metadata[file_id]

    def clear_session_refs(self, session_id: str | None = None) -> None:
        """Remove the given session's file references.

        (This does not remove any files from the manager - you must call
        `remove_orphaned_files` for that.)

        Should be called whenever ScriptRunner completes and when a session ends.

        Safe to call from any thread.
        """
        if session_id is None:
            session_id = _get_session_id()

        _LOGGER.debug("Disconnecting files for session with ID %s", session_id)

        with self._lock:
            # Clean up deferred callables for this session
            deferred_to_remove = [
                fid
                for fid, meta in self._deferred_callables.items()
                if meta.get("session_id") == session_id
            ]
            for fid in deferred_to_remove:
                del self._deferred_callables[fid]

            if session_id in self._files_by_session_and_coord:
                del self._files_by_session_and_coord[session_id]

        _LOGGER.debug(
            "Sessions still active: %r", self._files_by_session_and_coord.keys()
        )

        _LOGGER.debug(
            "Files: %s; Sessions with files: %s",
            len(self._file_metadata),
            len(self._files_by_session_and_coord),
        )

    def add(
        self,
        path_or_data: bytes | str,
        mimetype: str,
        coordinates: str,
        file_name: str | None = None,
        is_for_static_download: bool = False,
    ) -> str:
        """Add a new MediaFile with the given parameters and return its URL.

        If an identical file already exists, return the existing URL
        and registers the current session as a user.

        Safe to call from any thread.

        Parameters
        ----------
        path_or_data : bytes or str
            If bytes: the media file's raw data. If str: the name of a file
            to load from disk.
        mimetype : str
            The mime type for the file. E.g. "audio/mpeg".
            This string will be used in the "Content-Type" header when the file
            is served over HTTP.
        coordinates : str
            Unique string identifying an element's location.
            Prevents memory leak of "forgotten" file IDs when element media
            is being replaced-in-place (e.g. an st.image stream).
            coordinates should be of the form: "1.(3.-14).5"
        file_name : str or None
            Optional file_name. Used to set the filename in the response header.
        is_for_static_download: bool
            Indicate that data stored for downloading as a file,
            not as a media for rendering at page. [default: False]

        Returns
        -------
        str
            The url that the frontend can use to fetch the media.

        Raises
        ------
        If a filename is passed, any Exception raised when trying to read the
        file will be re-raised.
        """

        session_id = _get_session_id()

        with self._lock:
            kind = (
                MediaFileKind.DOWNLOADABLE
                if is_for_static_download
                else MediaFileKind.MEDIA
            )
            file_id = self._storage.load_and_get_id(
                path_or_data, mimetype, kind, file_name
            )
            metadata = MediaFileMetadata(kind=kind)

            self._file_metadata[file_id] = metadata
            self._files_by_session_and_coord[session_id][coordinates] = file_id

            return self._storage.get_url(file_id)

    def add_lazy(
        self,
        element_id: str,
        callable_fn: Callable[[], bytes],
        mimetype: str,
        coordinates: str,
        file_name: str | None = None,
    ) -> str:
        """Add a lazy file (with deferred data generation) and return its URL.

        The callable is NOT invoked here - it will be invoked on-demand when
        the user actually downloads the file.

        Parameters
        ----------
        element_id : str
            The unique widget element ID (used to generate stable file ID).
        callable_fn : Callable[[], bytes]
            Function that generates file content when invoked.
        mimetype : str
            The MIME type of the file.
        coordinates : str
            Unique string identifying the element's location.
        file_name : str or None
            Optional filename for download.

        Returns
        -------
        str
            The URL that the frontend can use to fetch the lazy file.
        """
        session_id = _get_session_id()

        with self._lock:
            # Generate stable file ID based on element_id, not content
            # This allows us to create the ID without invoking the callable
            file_id = self._generate_lazy_file_id(element_id, mimetype, file_name)

            # Store the lazy file in storage (callable not invoked yet)
            self._storage.load_lazy_file(
                file_id, callable_fn, mimetype, MediaFileKind.DOWNLOADABLE, file_name
            )

            # Track metadata and session/coordinate mapping
            metadata = MediaFileMetadata(kind=MediaFileKind.DOWNLOADABLE)
            self._file_metadata[file_id] = metadata
            self._files_by_session_and_coord[session_id][coordinates] = file_id

            return self._storage.get_url(file_id)

    def _generate_lazy_file_id(
        self,
        element_id: str,
        mimetype: str,
        filename: str | None = None,
    ) -> str:
        """Generate a stable file ID for a lazy file without invoking callable.

        Uses element_id (widget key) + mimetype + filename to create a
        deterministic hash, similar to how regular files use content hash.

        Parameters
        ----------
        element_id : str
            The unique widget element ID.
        mimetype : str
            The MIME type of the file.
        filename : str or None
            Optional filename.

        Returns
        -------
        str
            A stable hash-based file ID.
        """
        filehash = hashlib.new("sha224", usedforsecurity=False)
        filehash.update(element_id.encode())
        filehash.update(mimetype.encode())

        if filename is not None:
            filehash.update(filename.encode())

        return filehash.hexdigest()

    def register_deferred(
        self,
        element_id: str,
        callable_fn: Callable[[], bytes],
        mimetype: str,
        coordinates: str,
        file_name: str | None = None,
    ) -> str:
        """Register a callable for deferred execution (BackMsg protocol).

        The callable is NOT invoked here and NOT stored in MediaFileStorage.
        It will be executed when the user clicks download and the frontend
        sends a DeferredFileRequest BackMsg.

        Safe to call from any thread.

        Parameters
        ----------
        element_id : str
            The unique widget element ID (used to generate stable file ID).
        callable_fn : Callable[[], bytes]
            Function that generates file content when invoked.
        mimetype : str
            The MIME type of the file.
        coordinates : str
            Unique string identifying the element's location.
        file_name : str or None
            Optional filename for download.

        Returns
        -------
        str
            The file ID that can be used to request execution later.
        """
        session_id = _get_session_id()

        with self._lock:
            # Generate stable file ID (not content-based, element-based)
            file_id = self._generate_lazy_file_id(element_id, mimetype, file_name)

            # Store callable metadata (NOT in storage yet)
            self._deferred_callables[file_id] = {
                "callable": callable_fn,
                "mimetype": mimetype,
                "filename": file_name,
                "coordinates": coordinates,
                "session_id": session_id,
            }

            # Track in session/coordinate mapping
            self._files_by_session_and_coord[session_id][coordinates] = file_id

            return file_id

    def execute_deferred(self, file_id: str) -> str:
        """Execute deferred callable and return download URL.

        This is called when the frontend sends a DeferredFileRequest BackMsg
        after the user clicks the download button.

        Safe to call from any thread.

        Parameters
        ----------
        file_id : str
            The file ID returned from register_deferred().

        Returns
        -------
        str
            The URL that the frontend can use to download the file.

        Raises
        ------
        MediaFileStorageError
            If file_id not found or callable execution fails.
        """
        from streamlit.runtime.media_file_storage import MediaFileStorageError

        # Get callable metadata (with lock)
        with self._lock:
            if file_id not in self._deferred_callables:
                raise MediaFileStorageError(f"Deferred file {file_id} not found")
            deferred = self._deferred_callables[file_id].copy()

        # Execute outside lock to avoid blocking
        try:
            data = deferred["callable"]()  # Execute user's function
        except Exception as e:
            raise MediaFileStorageError(f"Callable execution failed: {e}") from e

        # Store result using normal storage flow
        with self._lock:
            file_id_actual = self._storage.load_and_get_id(
                data,
                deferred["mimetype"],
                MediaFileKind.DOWNLOADABLE,
                deferred["filename"],
            )

            # Update metadata
            metadata = MediaFileMetadata(kind=MediaFileKind.DOWNLOADABLE)
            self._file_metadata[file_id_actual] = metadata

            # Clean up callable reference
            del self._deferred_callables[file_id]

            return self._storage.get_url(file_id_actual)

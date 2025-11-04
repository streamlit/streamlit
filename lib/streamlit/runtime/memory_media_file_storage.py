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

"""MediaFileStorage implementation that stores files in memory."""

from __future__ import annotations

import contextlib
import hashlib
import mimetypes
import os.path
import threading
from typing import TYPE_CHECKING, Final, NamedTuple

from streamlit.logger import get_logger
from streamlit.runtime.media_file_storage import (
    MediaFileKind,
    MediaFileStorage,
    MediaFileStorageError,
)
from streamlit.runtime.stats import CacheStat, CacheStatsProvider, group_stats

if TYPE_CHECKING:
    from collections.abc import Callable

_LOGGER: Final = get_logger(__name__)

# Mimetype -> filename extension map for the `get_extension_for_mimetype`
# function. We use Python's `mimetypes.guess_extension` for most mimetypes,
# but (as of Python 3.12) `mimetypes.guess_extension("audio/wav")` returns None,
# so we handle it ourselves.
PREFERRED_MIMETYPE_EXTENSION_MAP: Final = {
    "audio/wav": ".wav",
    "text/vtt": ".vtt",
}


def _calculate_file_id(data: bytes, mimetype: str, filename: str | None = None) -> str:
    """Hash data, mimetype, and an optional filename to generate a stable file ID.

    Parameters
    ----------
    data
        Content of in-memory file in bytes. Other types will throw TypeError.
    mimetype
        Any string. Will be converted to bytes and used to compute a hash.
    filename
        Any string. Will be converted to bytes and used to compute a hash.
    """
    filehash = hashlib.new("sha224", usedforsecurity=False)
    filehash.update(data)
    filehash.update(bytes(mimetype.encode()))

    if filename is not None:
        filehash.update(bytes(filename.encode()))

    return filehash.hexdigest()


def get_extension_for_mimetype(mimetype: str) -> str:
    if mimetype in PREFERRED_MIMETYPE_EXTENSION_MAP:
        return PREFERRED_MIMETYPE_EXTENSION_MAP[mimetype]

    extension = mimetypes.guess_extension(mimetype, strict=False)
    if extension is None:
        return ""

    return extension


class MemoryFile(NamedTuple):
    """A MediaFile stored in memory.

    For regular files, content is bytes and callable_fn is None.
    For lazy files, callable_fn is set and content may be None (not yet materialized)
    or bytes (already materialized).
    """

    content: bytes | None
    mimetype: str
    kind: MediaFileKind
    filename: str | None
    callable_fn: Callable[[], bytes] | None = None

    @property
    def content_size(self) -> int:
        """Return size of materialized content, or 0 if not yet materialized."""
        if self.content is not None:
            return len(self.content)
        return 0

    @property
    def is_lazy(self) -> bool:
        """Return True if this is a lazy file (has a callable)."""
        return self.callable_fn is not None

    @property
    def is_materialized(self) -> bool:
        """Return True if lazy file has been materialized (callable invoked)."""
        return self.content is not None


class MemoryMediaFileStorage(MediaFileStorage, CacheStatsProvider):
    def __init__(self, media_endpoint: str) -> None:
        """Create a new MemoryMediaFileStorage instance.

        Parameters
        ----------
        media_endpoint
            The name of the local endpoint that media is served from.
            This endpoint should start with a forward-slash (e.g. "/media").
        """
        self._files_by_id: dict[str, MemoryFile] = {}
        self._media_endpoint = media_endpoint
        # Lock for thread-safe lazy file materialization
        self._lock = threading.Lock()

    def load_and_get_id(
        self,
        path_or_data: str | bytes,
        mimetype: str,
        kind: MediaFileKind,
        filename: str | None = None,
    ) -> str:
        """Add a file to the manager and return its ID."""
        file_data: bytes
        file_data = (
            self._read_file(path_or_data)
            if isinstance(path_or_data, str)
            else path_or_data
        )

        # Because our file_ids are stable, if we already have a file with the
        # given ID, we don't need to create a new one.
        file_id = _calculate_file_id(file_data, mimetype, filename)
        if file_id not in self._files_by_id:
            _LOGGER.debug("Adding media file %s", file_id)
            media_file = MemoryFile(
                content=file_data, mimetype=mimetype, kind=kind, filename=filename
            )
            self._files_by_id[file_id] = media_file

        return file_id

    def load_lazy_file(
        self,
        file_id: str,
        callable_fn: Callable[[], bytes],
        mimetype: str,
        kind: MediaFileKind,
        filename: str | None = None,
    ) -> str:
        """Add a lazy file (with callable) to storage and return its ID.

        The callable is NOT invoked here - it will be invoked on-demand
        when the file is first accessed.

        Parameters
        ----------
        file_id : str
            The stable file ID (pre-generated, not based on content hash).
        callable_fn : Callable[[], bytes]
            Function that generates file content when invoked.
        mimetype : str
            The MIME type of the file.
        kind : MediaFileKind
            The kind of media file.
        filename : str or None
            Optional filename for download.

        Returns
        -------
        str
            The file ID.
        """
        if file_id not in self._files_by_id:
            _LOGGER.debug("Adding lazy media file %s", file_id)
            lazy_file = MemoryFile(
                content=None,  # Not yet materialized
                mimetype=mimetype,
                kind=kind,
                filename=filename,
                callable_fn=callable_fn,
            )
            self._files_by_id[file_id] = lazy_file

        return file_id

    def materialize_file(self, file_id: str) -> bytes:
        """Materialize a lazy file by invoking its callable and caching the result.

        Thread-safe: Only one thread will invoke the callable, others will wait
        and receive the cached result.

        Parameters
        ----------
        file_id : str
            The file ID.

        Returns
        -------
        bytes
            The materialized file content.

        Raises
        ------
        MediaFileStorageError
            If file doesn't exist or isn't lazy.
        RuntimeError
            If callable invocation fails.
        """
        with self._lock:
            try:
                memory_file = self._files_by_id[file_id]
            except KeyError as e:
                raise MediaFileStorageError(
                    f"File '{file_id}' not found in storage"
                ) from e

            if not memory_file.is_lazy:
                raise MediaFileStorageError(f"File '{file_id}' is not a lazy file")

            # If already materialized, return cached content
            if memory_file.is_materialized:
                _LOGGER.debug("Lazy file %s already materialized, using cache", file_id)
                return memory_file.content  # type: ignore[return-value]

            # Invoke the callable to generate content
            _LOGGER.debug("Materializing lazy file %s", file_id)
            try:
                content = memory_file.callable_fn()  # type: ignore[misc]

                # Update with materialized content (keep callable for future reference)
                materialized_file = MemoryFile(
                    content=content,
                    mimetype=memory_file.mimetype,
                    kind=memory_file.kind,
                    filename=memory_file.filename,
                    callable_fn=memory_file.callable_fn,
                )
                self._files_by_id[file_id] = materialized_file

                return content
            except Exception as e:
                _LOGGER.exception("Failed to materialize lazy file %s", file_id)
                raise RuntimeError(f"Failed to generate download data: {e}") from e

    def get_file(self, filename: str) -> MemoryFile:
        """Return the MemoryFile with the given filename. Filenames are of the
        form "file_id.extension". (Note that this is *not* the optional
        user-specified filename for download files.).

        Raises a MediaFileStorageError if no such file exists.
        """
        file_id = os.path.splitext(filename)[0]
        try:
            return self._files_by_id[file_id]
        except KeyError as e:
            raise MediaFileStorageError(
                f"Bad filename '{filename}'. (No media file with id '{file_id}')"
            ) from e

    def get_url(self, file_id: str) -> str:
        """Get a URL for a given media file. Raise a MediaFileStorageError if
        no such file exists.
        """
        media_file = self.get_file(file_id)
        extension = get_extension_for_mimetype(media_file.mimetype)
        return f"{self._media_endpoint}/{file_id}{extension}"

    def delete_file(self, file_id: str) -> None:
        """Delete the file with the given ID."""
        # We swallow KeyErrors here - it's not an error to delete a file
        # that doesn't exist.
        with contextlib.suppress(KeyError):
            del self._files_by_id[file_id]

    def _read_file(self, filename: str) -> bytes:
        """Read a file into memory. Raise MediaFileStorageError if we can't."""
        try:
            with open(filename, "rb") as f:
                return f.read()
        except Exception as ex:
            raise MediaFileStorageError(f"Error opening '{filename}'") from ex

    def get_stats(self) -> list[CacheStat]:
        # We operate on a copy of our dict, to avoid race conditions
        # with other threads that may be manipulating the cache.
        files_by_id = self._files_by_id.copy()

        stats: list[CacheStat] = [
            CacheStat(
                category_name="st_memory_media_file_storage",
                cache_name="",
                byte_length=len(file.content),
            )
            for _, file in files_by_id.items()
        ]
        return group_stats(stats)

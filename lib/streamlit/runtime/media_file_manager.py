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

"""Provides global MediaFileManager object as `media_file_manager`."""

import collections
import hashlib
import mimetypes
import threading
from enum import Enum
from typing import Dict, Set, Optional, List

from streamlit import util
from streamlit.logger import get_logger
from .stats import CacheStatsProvider, CacheStat

LOGGER = get_logger(__name__)

STATIC_MEDIA_ENDPOINT = "/media"
PREFERRED_MIMETYPE_EXTENSION_MAP = {
    "image/jpeg": ".jpeg",
    "audio/wav": ".wav",
}


class MediaFileType(Enum):
    # used for images and videos in st.image() and st.video()
    MEDIA = "media"

    # used for st.download_button files
    DOWNLOADABLE = "downloadable"


def _get_session_id() -> str:
    """Semantic wrapper to retrieve current AppSession ID."""
    from streamlit.runtime.scriptrunner import get_script_run_ctx

    ctx = get_script_run_ctx()
    if ctx is None:
        # This is only None when running "python myscript.py" rather than
        # "streamlit run myscript.py". In which case the session ID doesn't
        # matter and can just be a constant, as there's only ever "session".
        return "dontcare"
    else:
        return ctx.session_id


def _calculate_file_id(
    data: bytes, mimetype: str, file_name: Optional[str] = None
) -> str:
    """Return an ID by hashing the data and mime.

    Parameters
    ----------
    data : bytes
        Content of in-memory file in bytes. Other types will throw TypeError.
    mimetype : str
        Any string. Will be converted to bytes and used to compute a hash.
        None will be converted to empty string.  [default: None]
    file_name : str
        Any string. Will be converted to bytes and used to compute a hash.
        None will be converted to empty string. [default: None]
    """
    filehash = hashlib.new("sha224")
    filehash.update(data)
    filehash.update(bytes(mimetype.encode()))

    if file_name is not None:
        filehash.update(bytes(file_name.encode()))

    return filehash.hexdigest()


def _get_extension_for_mimetype(mimetype: str) -> str:
    # Python mimetypes preference was changed in Python versions, so we specify
    # a preference first and let Python's mimetypes library guess the rest.
    # See https://bugs.python.org/issue4963
    #
    # Note: Removing Python 3.6 support would likely eliminate this code
    if mimetype in PREFERRED_MIMETYPE_EXTENSION_MAP:
        return PREFERRED_MIMETYPE_EXTENSION_MAP[mimetype]

    extension = mimetypes.guess_extension(mimetype)
    if extension is None:
        return ""

    return extension


class MediaFile:
    """Abstraction for file objects."""

    def __init__(
        self,
        file_id: str,
        content: bytes,
        mimetype: str,
        file_name: Optional[str] = None,
        file_type: MediaFileType = MediaFileType.MEDIA,
    ):
        self._file_id = file_id
        self._content = content
        self._mimetype = mimetype
        self._file_name = file_name
        self._file_type = file_type
        self._is_marked_for_delete = False

    def __repr__(self) -> str:
        return util.repr_(self)

    @property
    def url(self) -> str:
        return f"{STATIC_MEDIA_ENDPOINT}/{self.id}{self.extension}"

    @property
    def id(self) -> str:
        return self._file_id

    @property
    def extension(self) -> str:
        return _get_extension_for_mimetype(self.mimetype)

    @property
    def content(self) -> bytes:
        return self._content

    @property
    def mimetype(self) -> str:
        return self._mimetype

    @property
    def content_size(self) -> int:
        return len(self._content)

    @property
    def file_type(self) -> MediaFileType:
        return self._file_type

    @property
    def file_name(self) -> Optional[str]:
        return self._file_name

    def _mark_for_delete(self) -> None:
        self._is_marked_for_delete = True


class MediaFileManager(CacheStatsProvider):
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

    def __init__(self):
        # Dict of file ID to MediaFile.
        self._files_by_id: Dict[str, MediaFile] = dict()

        # Dict[session ID][coordinates] -> MediaFile.
        self._files_by_session_and_coord: Dict[
            str, Dict[str, MediaFile]
        ] = collections.defaultdict(dict)

        # MediaFileManager is used from multiple threads, so all operations
        # need to be protected with a Lock. (This is not an RLock, which
        # means taking it multiple times from the same thread will deadlock.)
        self._lock = threading.Lock()

    def _get_inactive_file_ids(self) -> Set[str]:
        """Compute the set of files that are stored in the manager, but are
        not referenced by any active session. These are files that can be
        safely deleted.

        Thread safety: callers must hold `self._lock`.
        """
        # Get the set of all our file IDs.
        file_ids = set(self._files_by_id.keys())

        # Subtract all IDs that are in use by each session
        for session_id, files_by_coord in self._files_by_session_and_coord.items():
            file_ids_in_session = map(lambda file: file.id, files_by_coord.values())
            file_ids.difference_update(file_ids_in_session)

        return file_ids

    def remove_orphaned_files(self) -> None:
        """Remove all files that are no longer referenced by any active session.

        Safe to call from any thread.
        """
        LOGGER.debug("Removing orphaned files...")

        with self._lock:
            for file_id in self._get_inactive_file_ids():
                file = self._files_by_id[file_id]
                if file.file_type == MediaFileType.MEDIA:
                    LOGGER.debug(f"Deleting File: {file_id}")
                    del self._files_by_id[file_id]
                elif file.file_type == MediaFileType.DOWNLOADABLE:
                    if file._is_marked_for_delete:
                        LOGGER.debug(f"Deleting File: {file_id}")
                        del self._files_by_id[file_id]
                    else:
                        file._mark_for_delete()

    def clear_session_refs(self, session_id: Optional[str] = None) -> None:
        """Remove the given session's file references.

        (This does not remove any files from the manager - you must call
        `remove_orphaned_files` for that.)

        Should be called whenever ScriptRunner completes and when a session ends.

        Safe to call from any thread.
        """
        if session_id is None:
            session_id = _get_session_id()

        LOGGER.debug("Disconnecting files for session with ID %s", session_id)

        with self._lock:
            if session_id in self._files_by_session_and_coord:
                del self._files_by_session_and_coord[session_id]

        LOGGER.debug(
            "Sessions still active: %r", self._files_by_session_and_coord.keys()
        )

        LOGGER.debug(
            "Files: %s; Sessions with files: %s",
            len(self._files_by_id),
            len(self._files_by_session_and_coord),
        )

    def add(
        self,
        content: bytes,
        mimetype: str,
        coordinates: str,
        file_name: Optional[str] = None,
        is_for_static_download: bool = False,
    ) -> MediaFile:
        """Adds new MediaFile with given parameters; returns the object.

        If an identical file already exists, returns the existing object
        and registers the current session as a user.

        mimetype must be set, as this string will be used in the
        "Content-Type" header when the file is sent via HTTP GET.

        coordinates should look like this: "1.(3.-14).5"

        Safe to call from any thread.

        Parameters
        ----------
        content : bytes
            Raw data to store in file object.
        mimetype : str
            The mime type for the file. E.g. "audio/mpeg"
        coordinates : str
            Unique string identifying an element's location.
            Prevents memory leak of "forgotten" file IDs when element media
            is being replaced-in-place (e.g. an st.image stream).
        file_name : str
            Optional file_name. Used to set filename in response header. [default: None]
        is_for_static_download: bool
            Indicate that data stored for downloading as a file,
            not as a media for rendering at page. [default: None]
        """
        file_id = _calculate_file_id(content, mimetype, file_name=file_name)
        session_id = _get_session_id()

        with self._lock:
            file = self._files_by_id.get(file_id, None)

            if file is None:
                LOGGER.debug("Adding media file %s", file_id)

                if is_for_static_download:
                    file_type = MediaFileType.DOWNLOADABLE
                else:
                    file_type = MediaFileType.MEDIA

                file = MediaFile(
                    file_id=file_id,
                    content=content,
                    mimetype=mimetype,
                    file_name=file_name,
                    file_type=file_type,
                )
            else:
                LOGGER.debug("Overwriting media file %s", file_id)

            self._files_by_id[file.id] = file
            self._files_by_session_and_coord[session_id][coordinates] = file

            LOGGER.debug(
                "Files: %s; Sessions with files: %s",
                len(self._files_by_id),
                len(self._files_by_session_and_coord),
            )

            return file

    def get(self, filename: str) -> MediaFile:
        """Returns the MediaFile for the given filename.

        Raises KeyError if not found.

        Safe to call from any thread.
        """
        # Filename is {file_id}.{extension} but MediaFileManager
        # is indexed by requested_hash.
        file_id = filename.split(".")[0]

        # dictionary access is atomic, so no need to take a lock.
        return self._files_by_id[file_id]

    def get_stats(self) -> List[CacheStat]:
        # We operate on a copy of our dict, to avoid race conditions
        # with other threads that may be manipulating the cache.
        with self._lock:
            files_by_id = self._files_by_id.copy()

        stats: List[CacheStat] = []
        for file_id, file in files_by_id.items():
            stats.append(
                CacheStat(
                    category_name="st_media_file_manager",
                    cache_name="",
                    byte_length=file.content_size,
                )
            )
        return stats

    def __contains__(self, file_id: str) -> bool:
        return file_id in self._files_by_id

    def __len__(self):
        return len(self._files_by_id)


media_file_manager = MediaFileManager()

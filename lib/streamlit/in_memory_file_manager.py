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

"""Provides global InMemoryFileManager object as `in_memory_file_manager`."""

from typing import Dict, Set, Optional, List
import collections
import hashlib
import mimetypes

from streamlit.script_run_context import get_script_run_ctx
from streamlit.logger import get_logger
from streamlit import util
from streamlit.stats import CacheStatsProvider, CacheStat

LOGGER = get_logger(__name__)

STATIC_MEDIA_ENDPOINT = "/media"
PREFERRED_MIMETYPE_EXTENSION_MAP = {
    "image/jpeg": ".jpeg",
    "audio/wav": ".wav",
}

# used for images and videos in st.image() and st.video()
FILE_TYPE_MEDIA = "media_file"

# used for st.download_button files
FILE_TYPE_DOWNLOADABLE = "downloadable_file"


def _get_session_id() -> str:
    """Semantic wrapper to retrieve current AppSession ID."""
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


class InMemoryFile:
    """Abstraction for file objects."""

    def __init__(
        self,
        file_id: str,
        content: bytes,
        mimetype: str,
        file_name: Optional[str] = None,
        file_type: str = FILE_TYPE_MEDIA,
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
        extension = _get_extension_for_mimetype(self._mimetype)
        return f"{STATIC_MEDIA_ENDPOINT}/{self.id}{extension}"

    @property
    def id(self) -> str:
        return self._file_id

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
    def file_type(self) -> str:
        return self._file_type

    @property
    def file_name(self) -> Optional[str]:
        return self._file_name

    def _mark_for_delete(self) -> None:
        self._is_marked_for_delete = True


class InMemoryFileManager(CacheStatsProvider):
    """In-memory file manager for InMemoryFile objects.

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
        # Dict of file ID to InMemoryFile.
        self._files_by_id: Dict[str, InMemoryFile] = dict()

        # Dict[session ID][coordinates] -> InMemoryFile.
        self._files_by_session_and_coord: Dict[
            str, Dict[str, InMemoryFile]
        ] = collections.defaultdict(dict)

    def __repr__(self) -> str:
        return util.repr_(self)

    def del_expired_files(self) -> None:
        LOGGER.debug("Deleting expired files...")

        # Get a flat set of every file ID in the session ID map.
        active_file_ids: Set[str] = set()

        for files_by_coord in self._files_by_session_and_coord.values():
            file_ids = map(lambda imf: imf.id, files_by_coord.values())
            active_file_ids = active_file_ids.union(file_ids)

        for file_id, imf in list(self._files_by_id.items()):
            if imf.id not in active_file_ids:

                if imf.file_type == FILE_TYPE_MEDIA:
                    LOGGER.debug(f"Deleting File: {file_id}")
                    del self._files_by_id[file_id]
                elif imf.file_type == FILE_TYPE_DOWNLOADABLE:
                    if imf._is_marked_for_delete:
                        LOGGER.debug(f"Deleting File: {file_id}")
                        del self._files_by_id[file_id]
                    else:
                        imf._mark_for_delete()

    def clear_session_files(self, session_id: Optional[str] = None) -> None:
        """Removes AppSession-coordinate mapping immediately, and id-file mapping later.

        Should be called whenever ScriptRunner completes and when a session ends.
        """
        if session_id is None:
            session_id = _get_session_id()

        LOGGER.debug("Disconnecting files for session with ID %s", session_id)

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
    ) -> InMemoryFile:
        """Adds new InMemoryFile with given parameters; returns the object.

        If an identical file already exists, returns the existing object
        and registers the current session as a user.

        mimetype must be set, as this string will be used in the
        "Content-Type" header when the file is sent via HTTP GET.

        coordinates should look like this: "1.(3.-14).5"

        Parameters
        ----------
        content : bytes
            Raw data to store in file object.
        mimetype : str
            The mime type for the in-memory file. E.g. "audio/mpeg"
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
        imf = self._files_by_id.get(file_id, None)

        if imf is None:
            LOGGER.debug("Adding media file %s", file_id)

            if is_for_static_download:
                file_type = FILE_TYPE_DOWNLOADABLE
            else:
                file_type = FILE_TYPE_MEDIA

            imf = InMemoryFile(
                file_id=file_id,
                content=content,
                mimetype=mimetype,
                file_name=file_name,
                file_type=file_type,
            )
        else:
            LOGGER.debug("Overwriting media file %s", file_id)

        session_id = _get_session_id()
        self._files_by_id[imf.id] = imf
        self._files_by_session_and_coord[session_id][coordinates] = imf

        LOGGER.debug(
            "Files: %s; Sessions with files: %s",
            len(self._files_by_id),
            len(self._files_by_session_and_coord),
        )

        return imf

    def get(self, inmemory_filename: str) -> InMemoryFile:
        """Returns InMemoryFile object for given file_id or InMemoryFile object.

        Raises KeyError if not found.
        """
        # Filename is {requested_hash}.{extension} but InMemoryFileManager
        # is indexed by requested_hash.
        hash = inmemory_filename.split(".")[0]
        return self._files_by_id[hash]

    def get_stats(self) -> List[CacheStat]:
        # We operate on a copy of our dict, to avoid race conditions
        # with other threads that may be manipulating the cache.
        files_by_id = self._files_by_id.copy()

        stats: List[CacheStat] = []
        for file_id, file in files_by_id.items():
            stats.append(
                CacheStat(
                    category_name="st_in_memory_file_manager",
                    cache_name="",
                    byte_length=file.content_size,
                )
            )
        return stats

    def __contains__(self, inmemory_file_or_id):
        return inmemory_file_or_id in self._files_by_id

    def __len__(self):
        return len(self._files_by_id)


in_memory_file_manager = InMemoryFileManager()

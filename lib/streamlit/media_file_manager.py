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

"""Provides global MediaFileManager object as `media_file_manager`."""

from typing import Dict, DefaultDict, Set
import collections
import hashlib

from streamlit.report_thread import get_report_ctx
from streamlit.logger import get_logger
from streamlit import util

LOGGER = get_logger(__name__)

STATIC_MEDIA_ENDPOINT = "/media"


def _get_session_id():
    """Semantic wrapper to retrieve current ReportSession ID."""
    ctx = get_report_ctx()
    if ctx is None:
        # This is only None when running "python myscript.py" rather than
        # "streamlit run myscript.py". In which case the session ID doesn't
        # matter and can just be a constant, as there's only ever "session".
        return "dontcare"
    else:
        return ctx.session_id


def _calculate_file_id(data, mimetype):
    """Return an ID by hashing the data and mime.

    Parameters
    ----------
    data : bytes
        Content of media file in bytes. Other types will throw TypeError.
    mimetype : str
        Any string. Will be converted to bytes and used to compute a hash.
        None will be converted to empty string.  [default: None]

    """
    filehash = hashlib.new("sha224")
    filehash.update(data)
    filehash.update(bytes(mimetype.encode()))

    return filehash.hexdigest()


class MediaFile(object):
    """Abstraction for audiovisual/image file objects."""

    def __init__(self, file_id=None, content=None, mimetype=None):
        self._file_id = file_id
        self._content = content
        self._mimetype = mimetype

    def __repr__(self) -> str:
        return util.repr_(self)

    @property
    def url(self):
        return "{}/{}.{}".format(
            STATIC_MEDIA_ENDPOINT, self.id, self.mimetype.split("/")[1]
        )

    @property
    def id(self):
        return self._file_id

    @property
    def content(self):
        return self._content

    @property
    def mimetype(self):
        return self._mimetype

    @property
    def content_size(self):
        return len(self._content)


class MediaFileManager(object):
    """In-memory file manager for MediaFile objects.

    This keeps track of:
    - Which files exist, and what their IDs are. This is important so we can
      serve files by ID -- that's the whole point of this class!
    - Which files are being used by which ReportSession (by ID). This is
      important so we can remove files from memory when no more sessions need
      them.
    - The exact location in the report where each file is being used (i.e. the
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
        self._files_by_id = dict()

        # Dict[session ID][coordinates] -> MediaFile.
        self._files_by_session_and_coord = collections.defaultdict(
            dict
        )  # type: DefaultDict[str, Dict[str, MediaFile]]

    def __repr__(self) -> str:
        return util.repr_(self)

    def del_expired_files(self):
        LOGGER.debug("Deleting expired files...")

        # Get a flat set of every file ID in the session ID map.
        active_file_ids = set()  # type: Set[MediaFile]

        for files_by_coord in self._files_by_session_and_coord.values():
            file_ids = map(lambda mf: mf.id, files_by_coord.values())  # type: ignore[no-any-return]
            active_file_ids = active_file_ids.union(file_ids)

        for file_id, mf in list(self._files_by_id.items()):
            if mf.id not in active_file_ids:
                LOGGER.debug(f"Deleting File: {file_id}")
                del self._files_by_id[file_id]

    def clear_session_files(self, session_id=None):
        """Removes ReportSession-coordinate mapping immediately, and id-file mapping later.

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

    def add(self, content, mimetype, coordinates):
        """Adds new MediaFile with given parameters; returns the object.

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
            The mime type for the media file. E.g. "audio/mpeg"
        coordinates : str
            Unique string identifying an element's location.
            Prevents memory leak of "forgotten" file IDs when element media
            is being replaced-in-place (e.g. an st.image stream).

        """
        file_id = _calculate_file_id(content, mimetype)
        mf = self._files_by_id.get(file_id, None)

        if mf is None:
            LOGGER.debug("Adding media file %s", file_id)
            mf = MediaFile(file_id=file_id, content=content, mimetype=mimetype)
        else:
            LOGGER.debug("Overwriting media file %s", file_id)

        session_id = _get_session_id()
        self._files_by_id[mf.id] = mf
        self._files_by_session_and_coord[session_id][coordinates] = mf

        LOGGER.debug(
            "Files: %s; Sessions with files: %s",
            len(self._files_by_id),
            len(self._files_by_session_and_coord),
        )

        return mf

    def get(self, media_filename):
        """Returns MediaFile object for given file_id or MediaFile object.

        Raises KeyError if not found.
        """
        # Filename is {requested_hash}.{extension} but MediaFileManager
        # is indexed by requested_hash.
        hash = media_filename.split(".")[0]
        return self._files_by_id[hash]

    def __contains__(self, mediafile_or_id):
        return mediafile_or_id in self._files_by_id

    def __len__(self):
        return len(self._files_by_id)


media_file_manager = MediaFileManager()

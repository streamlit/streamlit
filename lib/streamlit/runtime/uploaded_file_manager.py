# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from __future__ import annotations

import io
from abc import abstractmethod
from typing import TYPE_CHECKING, NamedTuple, Protocol

from streamlit import util
from streamlit.runtime.stats import StatsProvider

if TYPE_CHECKING:
    from collections.abc import Sequence

    from streamlit.proto.Common_pb2 import FileURLs as FileURLsProto


class UploadedFileRec(NamedTuple):
    """Metadata and raw bytes for an uploaded file. Immutable."""

    file_id: str
    name: str
    type: str
    data: bytes


class UploadFileUrlInfo(NamedTuple):
    """Information we provide for single file in get_upload_urls."""

    file_id: str
    upload_url: str
    delete_url: str


class DeletedFile(NamedTuple):
    """Represents a deleted file in deserialized values for st.file_uploader and
    st.camera_input.

    Return this from st.file_uploader and st.camera_input deserialize (so they can
    be used in session_state), when widget value contains file record that is missing
    from the storage.
    DeleteFile instances filtered out before return final value to the user in script,
    or before sending to frontend.
    """

    file_id: str


class UploadedFile(io.BytesIO):
    """A file uploaded by a user.

    To use this type in an annotation, import it from ``streamlit.typing``.

    ``st.file_uploader``, ``st.camera_input``, and ``st.audio_input`` return
    ``UploadedFile`` objects. ``st.chat_input`` returns them in the ``files``
    and ``audio`` attributes of its ``ChatInputValue``.

    ``UploadedFile`` is a subclass of ``io.BytesIO`` and therefore supports
    Python's file-like interface. You can pass it anywhere a binary file-like
    object is accepted.

    .. note::
        After you read the file to the end, another ``read()`` returns no data.
        Use ``getvalue()`` to read the full contents without changing the
        position, or ``seek(0)`` to rewind.

    Attributes
    ----------
    name : str
        The name of the uploaded file. For directory uploads, this is the file's
        path within the selected directory, including the directory name (for
        example, ``"photos/2024/a.jpg"``). Streamlit does not sanitize this
        value. Don't use it directly as a path when writing the file to disk;
        choose an app-controlled destination instead.
    type : str
        The MIME type of the uploaded file.

        - For user-selected files, this is the type reported by the user's
          browser, or ``"application/octet-stream"`` if the browser doesn't
          report one.
        - For ``st.camera_input``, this is ``"image/jpeg"``.
        - For ``st.audio_input`` and ``ChatInputValue.audio``, this is
          ``"audio/wav"``.
    size : int
        The size of the uploaded file in bytes.
    """

    def __init__(self, record: UploadedFileRec, file_urls: FileURLsProto) -> None:
        # BytesIO's copy-on-write semantics doesn't seem to be mentioned in
        # the Python docs - possibly because it's a CPython-only optimization
        # and not guaranteed to be in other Python runtimes. But it's detailed
        # here: https://hg.python.org/cpython/rev/79a5fbe2c78f
        super().__init__(record.data)
        self.file_id = record.file_id
        self.name = record.name
        self.type = record.type
        self.size = len(record.data)
        self._file_urls = file_urls

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, UploadedFile):
            return NotImplemented
        return self.file_id == other.file_id

    def __hash__(self) -> int:
        return hash(self.file_id)

    def __repr__(self) -> str:
        return util.repr_(self)


class UploadedFileManager(StatsProvider, Protocol):
    """UploadedFileManager protocol, that should be implemented by the concrete
    uploaded file managers.

    It is responsible for:
        - retrieving files by session_id and file_id for st.file_uploader and
            st.camera_input
        - cleaning up uploaded files associated with session on session end

    It should be created during Runtime initialization.

    Optionally UploadedFileManager could be responsible for issuing URLs which will be
    used by frontend to upload files to.
    """

    @abstractmethod
    def get_files(
        self, session_id: str, file_ids: Sequence[str]
    ) -> list[UploadedFileRec]:
        """Return a  list of UploadedFileRec for a given sequence of file_ids.

        Parameters
        ----------
        session_id
            The ID of the session that owns the files.
        file_ids
            The sequence of ids associated with files to retrieve.

        Returns
        -------
        List[UploadedFileRec]
            A list of URL UploadedFileRec instances, each instance contains information
            about uploaded file.
        """
        raise NotImplementedError  # pragma: no cover - abstract

    @abstractmethod
    def remove_session_files(self, session_id: str) -> None:
        """Remove all files associated with a given session."""
        raise NotImplementedError  # pragma: no cover - abstract

    def get_upload_urls(
        self, session_id: str, file_names: Sequence[str]
    ) -> list[UploadFileUrlInfo]:
        """Return a list of UploadFileUrlInfo for a given sequence of file_names.
        Optional to implement, issuing of URLs could be done by other service.

        Parameters
        ----------
        session_id
            The ID of the session that request URLs.
        file_names
            The sequence of file names for which URLs are requested

        Returns
        -------
        List[UploadFileUrlInfo]
            A list of UploadFileUrlInfo instances, each instance contains information
            about uploaded file URLs.
        """
        raise NotImplementedError  # pragma: no cover - optional default

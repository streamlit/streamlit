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
import io
from abc import abstractmethod
from typing import List, NamedTuple, Sequence

from typing_extensions import Protocol

from streamlit import util
from streamlit.proto.Common_pb2 import FileURLs as FileURLsProto
from streamlit.runtime.stats import CacheStatsProvider


class UploadedFileRec(NamedTuple):
    """Metadata and raw bytes for an uploaded file. Immutable."""

    file_id: str
    name: str
    type: str
    data: bytes


class UploadFileUrlInfo(NamedTuple):
    """Information we provide for single file in get_upload_urls"""

    file_id: str
    upload_url: str
    delete_url: str


class UploadedFile(io.BytesIO):
    """A mutable uploaded file.

    This class extends BytesIO, which has copy-on-write semantics when
    initialized with `bytes`.
    """

    def __init__(self, record: UploadedFileRec, file_urls: FileURLsProto):
        # BytesIO's copy-on-write semantics doesn't seem to be mentioned in
        # the Python docs - possibly because it's a CPython-only optimization
        # and not guaranteed to be in other Python runtimes. But it's detailed
        # here: https://hg.python.org/cpython/rev/79a5fbe2c78f
        super(UploadedFile, self).__init__(record.data)
        self.file_id = record.file_id
        self.name = record.name
        self.type = record.type
        self.size = len(record.data)
        self._file_urls = file_urls

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, UploadedFile):
            return NotImplemented
        return self.file_id == other.file_id

    def __repr__(self) -> str:
        return util.repr_(self)


class UploadedFileManager(CacheStatsProvider, Protocol):
    """UploadedFileManager protocol, that should be implemented by the concrete
    cache storage managers.

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
    ) -> List[UploadedFileRec]:
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
        raise NotImplementedError

    @abstractmethod
    def remove_session_files(self, session_id: str) -> None:
        raise NotImplementedError

    def get_upload_urls(
        self, session_id: str, file_names: Sequence[str]
    ) -> List[UploadFileUrlInfo]:
        raise NotImplementedError

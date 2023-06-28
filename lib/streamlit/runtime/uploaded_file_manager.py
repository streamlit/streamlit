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
    """# TODO(kajarenc): Docstrings for this protocol + its methods."""

    @abstractmethod
    def get_files(
        self, session_id: str, file_ids: Sequence[str]
    ) -> List[UploadedFileRec]:
        raise NotImplementedError

    @abstractmethod
    def remove_session_files(self, session_id: str) -> None:
        raise NotImplementedError

    def get_upload_urls(
        self, session_id: str, file_names: Sequence[str]
    ) -> List[UploadFileUrlInfo]:
        raise NotImplementedError

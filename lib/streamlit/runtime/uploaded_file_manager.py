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

from abc import abstractmethod
from typing import List, NamedTuple

from typing_extensions import Protocol


class UploadedFileRec(NamedTuple):
    """Metadata and raw bytes for an uploaded file. Immutable."""

    file_url: str
    name: str
    type: str
    data: bytes


class UploadedFileManager(Protocol):
    @abstractmethod
    def get_files(self, session_id: str, file_urls: List[str]) -> List[UploadedFileRec]:
        raise NotImplementedError

    @abstractmethod
    def remove_session_files(self, session_id: str) -> None:
        raise NotImplementedError

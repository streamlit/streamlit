# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import uuid
from collections import defaultdict
from typing import Dict, List, Sequence

from streamlit import util
from streamlit.logger import get_logger
from streamlit.runtime.stats import CacheStat, group_stats
from streamlit.runtime.uploaded_file_manager import (
    UploadedFileManager,
    UploadedFileRec,
    UploadFileUrlInfo,
)

LOGGER = get_logger(__name__)


class MemoryUploadedFileManager(UploadedFileManager):
    """Holds files uploaded by users of the running Streamlit app.
    This class can be used safely from multiple threads simultaneously.
    """

    def __init__(self, upload_endpoint: str):
        self.file_storage: Dict[str, Dict[str, UploadedFileRec]] = defaultdict(dict)
        self.endpoint = upload_endpoint

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
        session_storage = self.file_storage[session_id]
        file_recs = []

        for file_id in file_ids:
            file_rec = session_storage.get(file_id, None)
            if file_rec is not None:
                file_recs.append(file_rec)

        return file_recs

    def remove_session_files(self, session_id: str) -> None:
        """Remove all files associated with a given session."""
        self.file_storage.pop(session_id, None)

    def __repr__(self) -> str:
        return util.repr_(self)

    def add_file(
        self,
        session_id: str,
        file: UploadedFileRec,
    ) -> None:
        """
        Safe to call from any thread.

        Parameters
        ----------
        session_id
            The ID of the session that owns the file.
        file
            The file to add.
        """

        self.file_storage[session_id][file.file_id] = file

    def remove_file(self, session_id, file_id):
        """Remove file with given file_id associated with a given session."""
        session_storage = self.file_storage[session_id]
        session_storage.pop(file_id, None)

    def get_upload_urls(
        self, session_id: str, file_names: Sequence[str]
    ) -> List[UploadFileUrlInfo]:
        """Return a list of UploadFileUrlInfo for a given sequence of file_names."""
        result = []
        for _ in file_names:
            file_id = str(uuid.uuid4())
            result.append(
                UploadFileUrlInfo(
                    file_id=file_id,
                    upload_url=f"{self.endpoint}/{session_id}/{file_id}",
                    delete_url=f"{self.endpoint}/{session_id}/{file_id}",
                )
            )
        return result

    def get_stats(self) -> List[CacheStat]:
        """Return the manager's CacheStats.

        Safe to call from any thread.
        """
        # Flatten all files into a single list
        all_files: List[UploadedFileRec] = []
        # Make copy of self.file_storage for thread safety, to be sure
        # that main storage won't be changed form other thread
        file_storage_copy = self.file_storage.copy()

        for session_storage in file_storage_copy.values():
            all_files.extend(session_storage.values())

        stats: List[CacheStat] = [
            CacheStat(
                category_name="UploadedFileManager",
                cache_name="",
                byte_length=len(file.data),
            )
            for file in all_files
        ]
        return group_stats(stats)

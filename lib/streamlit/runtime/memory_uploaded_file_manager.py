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

import threading
import uuid
from collections import defaultdict
from typing import TYPE_CHECKING

from streamlit import util
from streamlit.runtime.stats import CACHE_MEMORY_FAMILY, CacheStat, group_cache_stats
from streamlit.runtime.uploaded_file_manager import (
    UploadedFileManager,
    UploadedFileRec,
    UploadFileUrlInfo,
)

if TYPE_CHECKING:
    from collections.abc import Sequence


class MemoryUploadedFileManager(UploadedFileManager):
    """Holds files uploaded by users of the running Streamlit app.
    This class can be used safely from multiple threads simultaneously.
    """

    def __init__(self, upload_endpoint: str) -> None:
        self.file_storage: dict[str, dict[str, UploadedFileRec]] = defaultdict(dict)
        self.endpoint = upload_endpoint
        self._total_bytes = 0
        self._file_count = 0
        self._lock = threading.Lock()

    @property
    def stats_families(self) -> Sequence[str]:
        return (CACHE_MEMORY_FAMILY,)

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
        with self._lock:
            # Use `.get` instead of indexing so that reading files for an
            # unknown session does not create an empty entry in the defaultdict.
            session_storage = self.file_storage.get(session_id)
            if session_storage is None:
                return []

            return [
                file_rec
                for file_id in file_ids
                if (file_rec := session_storage.get(file_id)) is not None
            ]

    def remove_session_files(self, session_id: str) -> None:
        """Remove all files associated with a given session."""
        with self._lock:
            session_storage = self.file_storage.pop(session_id, None)
            if session_storage is not None:
                self._total_bytes -= sum(
                    len(file.data) for file in session_storage.values()
                )
                self._file_count -= len(session_storage)

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
        with self._lock:
            session_storage = self.file_storage[session_id]
            old_file = session_storage.get(file.file_id)
            if old_file is not None:
                self._total_bytes -= len(old_file.data)
            else:
                self._file_count += 1

            session_storage[file.file_id] = file
            self._total_bytes += len(file.data)

    def remove_file(self, session_id: str, file_id: str) -> None:
        """Remove file with given file_id associated with a given session."""
        with self._lock:
            # Use `.get` instead of indexing so that removing a file for an
            # unknown session does not create an empty entry in the defaultdict.
            session_storage = self.file_storage.get(session_id)
            if session_storage is None:
                return

            file = session_storage.pop(file_id, None)
            if file is not None:
                self._total_bytes -= len(file.data)
                self._file_count -= 1

    def get_upload_urls(
        self, session_id: str, file_names: Sequence[str]
    ) -> list[UploadFileUrlInfo]:
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

    def get_stats(
        self, _family_names: Sequence[str] | None = None
    ) -> dict[str, list[CacheStat]]:
        """Return the manager's CacheStats.

        Safe to call from any thread.
        """
        with self._lock:
            total_bytes = self._total_bytes
            file_count = self._file_count

        # Emit a stat whenever any files are tracked, even if they are all
        # zero-byte uploads (matching the previous per-file behavior). Gating on
        # total_bytes alone would drop zero-byte uploads from the metrics.
        if file_count == 0:
            return {}

        stats = [
            CacheStat(
                category_name="UploadedFileManager",
                cache_name="",
                byte_length=total_bytes,
            )
        ]
        # In general, get_stats methods need to be able to return only requested stat
        # families, but this method only returns a single family, and we're guaranteed
        # that it was one of those requested if we make it here.
        return {CACHE_MEMORY_FAMILY: group_cache_stats(stats)}

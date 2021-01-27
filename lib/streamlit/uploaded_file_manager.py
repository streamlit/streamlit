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

import io
import threading
from typing import Dict, NamedTuple, Optional, List, Tuple
from blinker import Signal
from streamlit.logger import get_logger

LOGGER = get_logger(__name__)


class UploadedFileRec(NamedTuple):
    """Metadata and raw bytes for an uploaded file. Immutable."""

    id: str
    name: str
    type: str
    data: bytes


class UploadedFile(io.BytesIO):
    """A mutable uploaded file.

    This class extends BytesIO, which has copy-on-write semantics when
    initialized with `bytes`.
    """

    def __init__(self, record: UploadedFileRec):
        # BytesIO's copy-on-write semantics doesn't seem to be mentioned in
        # the Python docs - possibly because it's a CPython-only optimization
        # and not guaranteed to be in other Python runtimes. But it's detailed
        # here: https://hg.python.org/cpython/rev/79a5fbe2c78f
        super(UploadedFile, self).__init__(record.data)
        self.id = record.id
        self.name = record.name
        self.type = record.type
        self.size = len(record.data)


class UploadedFileManager(object):
    """Holds files uploaded by users of the running Streamlit app,
    and emits an event signal when a file is added.
    """

    def __init__(self):
        # List of files for a given widget in a given session
        self._files_by_id: Dict[Tuple[str, str], List[UploadedFileRec]] = {}

        # Count of how many files should be uploaded for a given widget in a given
        # session. This is in place to allow us to trigger rerun once all files have
        # received when working with multiple file uploader. Files are uploaded in
        # in parallel. Since the sequence of requests is not reliable, the client
        # informs us how many files have ben sent for a specific widget in a session
        self._file_counts_by_id: Dict[Tuple[str, str], int] = {}

        # Prevents concurrent access to the _files_by_id dict.
        # In remove_session_files(), we iterate over the dict's keys. It's
        # an error to mutate a dict while iterating; this lock prevents that.
        self._files_lock = threading.Lock()
        self.on_files_updated = Signal(
            doc="""Emitted when a file list is added to the manager or updated.

            Parameters
            ----------
            session_id : str
                The session_id for the session whose files were updated.
            """
        )

    def _on_files_updated(self, session_id: str, widget_id: str):
        files_by_widget = session_id, widget_id
        LOGGER.debug(f"Files updated, checking for rerun for {files_by_widget}")
        if files_by_widget in self._file_counts_by_id:
            expected_file_count: int = self._file_counts_by_id[files_by_widget]
            actual_file_count: int = (
                len(self._files_by_id[files_by_widget])
                if files_by_widget in self._files_by_id
                else 0
            )
            if expected_file_count == actual_file_count:
                # All the files that the client is planning to send have been received.
                # and added to our list. Trigger a rerun.
                self.on_files_updated.send(session_id)
                LOGGER.debug(
                    f"Files for {files_by_widget} updated and ready to be rerun."
                )
            else:
                # All the files that the client is planning to send have not been received.
                # Do not rerun and instead wait for more files to be uploaded.
                LOGGER.debug(
                    f"Files for {files_by_widget} updated but not ready to be rerun. {expected_file_count} {actual_file_count}"
                )
        else:
            # We do not have any idea of how many files should be uploaded.
            # This likely does not have a valid session or did not receive
            # information from the client about expected number files.
            # Rerun to be safe.
            LOGGER.debug(f"Files updated, {files_by_widget} not in list.")
            self.on_files_updated.send(session_id)

    def _add_files(
        self,
        session_id: str,
        widget_id: str,
        files: List[UploadedFileRec],
    ):
        """
        Add a list of files to the FileManager. Does not emit any signals
        """
        files_by_widget = session_id, widget_id

        with self._files_lock:
            file_list = self._files_by_id.get(files_by_widget, None)
            if file_list:
                files = file_list + files
            self._files_by_id[files_by_widget] = files

    def add_files(
        self,
        session_id: str,
        widget_id: str,
        files: List[UploadedFileRec],
    ) -> None:
        """Add a list of files to the FileManager.

        The "on_file_added" Signal will be emitted after the list is added.

        Parameters
        ----------
        session_id : str
            The session ID of the report that owns the files.
        widget_id : str
            The widget ID of the FileUploader that created the files.
        files : List[UploadedFileRec]
            The file records to add.
        """
        self._add_files(session_id, widget_id, files)
        self._on_files_updated(session_id, widget_id)

    def get_files(
        self, session_id: str, widget_id: str
    ) -> Optional[List[UploadedFileRec]]:
        """Return the file list with the given ID, or None if the ID doesn't exist.

        Parameters
        ----------
        session_id : str
            The session ID of the report that owns the file.
        widget_id : str
            The widget ID of the FileUploader that created the file.

        Returns
        -------
        list of UploadedFileRec or None
        """
        files_by_widget = session_id, widget_id
        with self._files_lock:
            return self._files_by_id.get(files_by_widget, None)

    def remove_file(self, session_id: str, widget_id: str, file_id: str) -> None:
        """Remove the file list with the given ID, if it exists."""
        files_by_widget = session_id, widget_id
        with self._files_lock:
            file_list = self._files_by_id[files_by_widget]
            self._files_by_id[files_by_widget] = [
                file for file in file_list if file.id != file_id
            ]
            if len(file_list) != len(self._files_by_id[files_by_widget]):
                self._on_files_updated(session_id, widget_id)

    def _remove_files(self, session_id: str, widget_id: str) -> None:
        """Remove the file list for the provided widget in the
        provided session, if it exists.

        Does not emit any signals.
        """
        files_by_widget = session_id, widget_id
        with self._files_lock:
            self._files_by_id.pop(files_by_widget, None)

    def remove_files(self, session_id: str, widget_id: str) -> None:
        """Remove the file list for the provided widget in the
        provided session, if it exists.

        Parameters
        ----------
        session_id : str
            The session ID of the report that owns the file.
        widget_id : str
            The widget ID of the FileUploader that created the file.
        """
        self.update_file_count(session_id, widget_id, 0)
        self._remove_files(session_id, widget_id)
        self._on_files_updated(session_id, widget_id)

    def remove_session_files(self, session_id: str) -> None:
        """Remove all files that belong to the given report.

        Parameters
        ----------
        session_id : str
            The session ID of the report whose files we're removing.

        """
        # Copy the keys into a list, because we'll be mutating the dictionary.
        with self._files_lock:
            all_ids = list(self._files_by_id.keys())

        for files_id in all_ids:
            if files_id[0] == session_id:
                self.remove_files(*files_id)

    def replace_files(
        self,
        session_id: str,
        widget_id: str,
        files: List[UploadedFileRec],
    ) -> None:
        """Removes the file list for the provided widget in the
        provided session, if it exists and add the provided files
        to the widget in the session

        Parameters
        ----------
        session_id : str
            The session ID of the report that owns the file.
        widget_id : str
            The widget ID of the FileUploader that created the file.
        files : List[UploadedFileRec]
            The files to add.
        """
        self._remove_files(session_id, widget_id)
        self._add_files(session_id, widget_id, files)
        self._on_files_updated(session_id, widget_id)

    def update_file_count(
        self,
        session_id: str,
        widget_id: str,
        file_count: int,
    ) -> None:
        files_by_widget = session_id, widget_id
        self._file_counts_by_id[files_by_widget] = file_count

    def decrement_file_count(
        self,
        session_id: str,
        widget_id: str,
        decrement_by: int,
    ) -> None:
        files_by_widget = session_id, widget_id
        self._file_counts_by_id[files_by_widget] -= decrement_by

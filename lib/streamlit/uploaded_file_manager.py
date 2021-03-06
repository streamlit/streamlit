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
        # List of files for a given widget in a given session.
        self._files_by_id: Dict[Tuple[str, str], List[UploadedFileRec]] = {}

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

        The "on_files_updated" Signal will be emitted.

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
        self.on_files_updated.send(session_id)

    def get_files(
        self, session_id: str, widget_id: str
    ) -> Optional[List[UploadedFileRec]]:
        """Return the file list with the given ID, or None if the ID doesn't
        exist.

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
        file_list_id = (session_id, widget_id)
        with self._files_lock:
            return self._files_by_id.get(file_list_id, None)

    def remove_file(self, session_id: str, widget_id: str, file_id: str) -> bool:
        """Remove the file list with the given ID, if it exists.

        The "on_files_updated" Signal will be emitted.

        Returns
        -------
        bool
            True if the file was removed, or False if no such file exists.
        """
        file_list_id = (session_id, widget_id)
        with self._files_lock:
            file_list = self._files_by_id.get(file_list_id, None)
            if file_list is None:
                return False

            # Remove the file from its list.
            new_file_list = [file for file in file_list if file.id != file_id]
            self._files_by_id[file_list_id] = new_file_list

        self.on_files_updated.send(session_id)
        return True

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

        The "on_files_updated" Signal will be emitted.

        Parameters
        ----------
        session_id : str
            The session ID of the report that owns the file.
        widget_id : str
            The widget ID of the FileUploader that created the file.
        """
        self._remove_files(session_id, widget_id)
        self.on_files_updated.send(session_id)

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
        """Remove the file list for the provided widget in the
        provided session, if it exists, and add the provided files
        to the widget in the session.

        The "on_files_updated" Signal will be emitted.

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
        self.on_files_updated.send(session_id)

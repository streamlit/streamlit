# Copyright 2018-2020 Streamlit Inc.
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
from typing import Dict
from typing import List
from typing import NamedTuple
from typing import Tuple
from blinker import Signal


class UploadedFile(io.BytesIO):
    def __init__(self, id, name, type, data, **kwargs):
        super(UploadedFile, self).__init__(data)
        self.id = id
        self.name = name
        self.type = type
        self.size = self.getbuffer().nbytes


class UploadedFileManager(object):
    """Holds files uploaded by users of the running Streamlit app,
    and emits an event signal when a file is added.
    """

    def __init__(self):
        self._files_by_id = {}  # type: Dict[Tuple[str, str], List[UploadedFile] ]
        self._file_counts_by_id: Dict[Tuple[str, str], int] = {}
        # Prevents concurrent access to the _files_by_id dict.
        # In remove_session_files(), we iterate over the dict's keys. It's
        # an error to mutate a dict while iterating; this lock prevents that.
        self._files_lock = threading.Lock()
        self.on_files_updated = Signal(
            doc="""Emitted when a file list is added to the manager or updated.

            Parameters
            ----------
            files : UploadedFileList
                The file list that was added or updated.
            """
        )

    def _on_files_updated(self, session_id: str, widget_id: str):
        files_by_widget = session_id, widget_id
        if files_by_widget in self._file_counts_by_id:
            expected_file_count: int = self._file_counts_by_id[files_by_widget]
            actual_file_count: int = (
                len(self._files_by_id[files_by_widget])
                if files_by_widget in self._files_by_id
                else 0
            )
            if expected_file_count == actual_file_count:
                self.on_files_updated.send(session_id)
        else:
            self.on_files_updated.send(session_id)

    def _add_files(
        self,
        session_id: str,
        widget_id: str,
        files: List[UploadedFile],
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
        files: List[UploadedFile],
    ):
        """Add a list of files to the FileManager.

        The "on_file_added" Signal will be emitted after the list is added.

        Parameters
        ----------
        session_id : str
            The session ID of the report that owns the files.
        widget_id : str
            The widget ID of the FileUploader that created the files.
        files : List[UploadedFile]
            The files to add.
        """

        self._add_files(session_id, widget_id, files)
        self._on_files_updated(session_id, widget_id)

    def get_files(self, session_id: str, widget_id: str):
        """Return the file list with the given ID, or None if the ID doesn't exist.

        Parameters
        ----------
        session_id : str
            The session ID of the report that owns the file.
        widget_id : str
            The widget ID of the FileUploader that created the file.

        Returns
        -------
        list of UploadedFile or None
        """
        files_by_widget = session_id, widget_id
        with self._files_lock:
            file_list = self._files_by_id.get(files_by_widget, None)
        return file_list

    def remove_file(self, session_id: str, widget_id: str, file_id: str):
        """Remove the file list with the given ID, if it exists."""
        files_by_widget = session_id, widget_id
        with self._files_lock:
            file_list = self._files_by_id[files_by_widget]
            self._files_by_id[files_by_widget] = [
                file for file in file_list if file.id != file_id
            ]
            if len(file_list) != len(self._files_by_id[files_by_widget]):
                self._on_files_updated(session_id, widget_id)

    def _remove_files(self, session_id: str, widget_id: str):
        """Remove the file list for the provided widget in the
        provided session, if it exists.

        Does not emit any signals.
        """
        files_by_widget = session_id, widget_id
        self.update_file_count(session_id, widget_id, 0)
        with self._files_lock:
            self._files_by_id.pop(files_by_widget, None)

    def remove_files(self, session_id: str, widget_id: str):
        """Remove the file list for the provided widget in the
        provided session, if it exists.

        Parameters
        ----------
        session_id : str
            The session ID of the report that owns the file.
        widget_id : str
            The widget ID of the FileUploader that created the file.
        """
        self._remove_files(session_id, widget_id)
        self._on_files_updated(session_id, widget_id)

    def remove_session_files(self, session_id: str):
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
        files: List[UploadedFile],
    ):
        """Removes the file list for the provided widget in the
        provided session, if it exists and add the provided files
        to the widget in the session

        Parameters
        ----------
        session_id : str
            The session ID of the report that owns the file.
        widget_id : str
            The widget ID of the FileUploader that created the file.
        files : List[UploadedFile]
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
    ):
        files_by_widget = session_id, widget_id
        self._file_counts_by_id[files_by_widget] = file_count
        self._on_files_updated(session_id, widget_id)

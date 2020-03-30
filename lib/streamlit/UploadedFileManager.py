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

import threading
from typing import Dict
from typing import List
from typing import NamedTuple
from typing import Tuple

from blinker import Signal

# An uploaded file's data and metadata
UploadedFile = NamedTuple("UploadedFile", [("name", str), ("data", bytes)])

# A list of UploadedFiles, and associated ID
_UploadedFileListBase = NamedTuple(
    "_UploadedFileListBase",
    [("session_id", str), ("widget_id", str), ("files", List[UploadedFile])],
)


class UploadedFileList(_UploadedFileListBase):
    @property
    def id(self):
        """The list's unique ID."""
        return self.session_id, self.widget_id


class UploadedFileManager(object):
    """Holds files uploaded by users of the running Streamlit app,
    and emits an event signal when a file is added.
    """

    def __init__(self):
        self._files_by_id = {}  # type: Dict[Tuple[str, str], UploadedFileList]
        # Prevents concurrent access to the _files_by_id dict.
        # In remove_session_files(), we iterate over the dict's keys. It's
        # an error to mutate a dict while iterating; this lock prevents that.
        self._files_lock = threading.Lock()
        self.on_files_added = Signal(
            doc="""Emitted when a file list is added to the manager.

            Parameters
            ----------
            files : UploadedFileList
                The file list that was added.
            """
        )

    def add_files(self, session_id, widget_id, files):
        """Add a list of files to the FileManager.

        If another list with the same (session_id, widget_id) key exists,
        it will be replaced with this one.

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
        file_list = UploadedFileList(
            session_id=session_id, widget_id=widget_id, files=files
        )
        with self._files_lock:
            self._files_by_id[file_list.id] = file_list
        self.on_files_added.send(file_list)

    def get_files(self, session_id, widget_id):
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
        files_id = session_id, widget_id
        with self._files_lock:
            file_list = self._files_by_id.get(files_id, None)
        return file_list.files if file_list is not None else None

    def remove_files(self, session_id, widget_id):
        """Remove the file list with the given ID, if it exists.

        Parameters
        ----------
        session_id : str
            The session ID of the report that owns the file.
        widget_id : str
            The widget ID of the FileUploader that created the file.
        """
        files_id = session_id, widget_id
        with self._files_lock:
            self._files_by_id.pop(files_id, None)

    def remove_session_files(self, session_id):
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

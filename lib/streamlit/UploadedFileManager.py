# -*- coding: utf-8 -*-
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

from blinker import Signal


class UploadedFile(object):
    """Encapsulates an uploaded file's data and metadata."""

    def __init__(self, session_id, widget_id, name, data):
        """Construct a new File object.

        Parameters
        ----------
        session_id : str
            The session ID of the report that created owns the file.
        widget_id : str
            The widget ID of the FileUploader that uploaded the file.
        name : str
            The file's name.
        data : bytes
            The file's data.

        """
        self.session_id = session_id
        self.widget_id = widget_id
        self.name = name
        self.data = data

    @property
    def id(self):
        """The file's unique ID."""
        return self.session_id, self.widget_id


class UploadedFileManager(object):
    """Holds files uploaded by users of the running Streamlit app,
    and emits an event signal when a file is added.
    """

    def __init__(self):
        self._files = {}
        self._files_lock = threading.Lock()
        self.on_file_added = Signal(
            doc="""Emitted when a file is added to the manager.

            Parameters
            ----------
            file : UploadedFile
                The file that was added.
            """
        )

    def add_file(self, file):
        """Add a new file to the FileManager.

        If another file with the same ID exists, it will be replaced with this
        one.

        The "on_file_added" Signal will be emitted after the file is added.

        Parameters
        ----------
        file : UploadedFile
            The file to add.

        """
        with self._files_lock:
            self._files[file.id] = file
        self.on_file_added.send(file)

    def get_file_data(self, session_id, widget_id):
        """Return the file data for a file with the given ID, or None
        if the file doesn't exist.

        Parameters
        ----------
        session_id : str
            The session ID of the report that owns the file.
        widget_id : str
            The widget ID of the FileUploader that created the file.

        Returns
        -------
        bytes or None
            The file's data, or None if the file does not exist.

        """
        file_id = session_id, widget_id
        with self._files_lock:
            file = self._files.get(file_id, None)
        return file.data if file is not None else None

    def remove_file(self, session_id, widget_id):
        """Remove the file with the given ID, if it exists.

        Parameters
        ----------
        session_id : str
            The session ID of the report that owns the file.
        widget_id : str
            The widget ID of the FileUploader that created the file.
        """
        file_id = session_id, widget_id
        with self._files_lock:
            self._files.pop(file_id, None)

    def remove_session_files(self, session_id):
        """Remove all files that belong to the given report.

        Parameters
        ----------
        session_id : str
            The session ID of the report whose files we're removing.

        """
        # Copy the keys into a list, because we'll be mutating the dictionary.
        for file_id in list(self._files.keys()):
            if file_id[0] == session_id:
                self.remove_file(*file_id)

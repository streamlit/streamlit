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


import tornado.web
import tornado.httputil

from streamlit.logger import get_logger

LOGGER = get_logger(__name__)


class File(object):
    def __init__(self, report_session_id, widget_id, name, data):
        """Construct a new File object.

        Parameters
        ----------
        report_session_id : str
            The session ID of the report that created owns the file.
        widget_id : str
            The widget ID of the FileUploader that uploaded the file.
        name : str
            The file's name.
        data : bytes
            The file's data.
        """
        self.report_session_id = report_session_id
        self.widget_id = widget_id
        self.name = name
        self.data = data

    @property
    def id(self):
        """The file's unique ID."""
        return self.report_session_id, self.widget_id


class HTTPUploadedFileManager(object):
    def __init__(self):
        self._files = {}

    def add_file(self, file):
        """Add a new file to the FileManager.

        If another file with the same ID exists, it will be replaced with this
        one.

        Parameters
        ----------
        file : File
            The file to add.

        """
        self._files[file.id] = file

    def get_file_data(self, report_session_id, widget_id):
        """Return the file data for a file with the given ID, or None
        if the file doesn't exist.

        Parameters
        ----------
        report_session_id : str
            The session ID of the report that owns the file.
        widget_id : str
            The widget ID of the FileUploader that created the file.

        Returns
        -------
        bytes or None
            The file's data, or None if the file does not exist.

        """
        file_id = report_session_id, widget_id
        file = self._files.get(file_id, None)
        return file.data if file is not None else None

    def remove_file(self, report_session_id, widget_id):
        """Remove the file with the given ID, if it exists.

        Parameters
        ----------
        report_session_id : str
            The session ID of the report that owns the file.
        widget_id : str
            The widget ID of the FileUploader that created the file.
        """
        file_id = report_session_id, widget_id
        del self._files[file_id]

    def remove_all_files(self, report_session_id):
        """Remove all files that belong to the given report_session_id.

        Parameters
        ----------
        report_session_id : str
            The session ID of the report whose files we're removing.

        """
        for file_id in self._files.keys():
            if file_id[0] == report_session_id:
                self.remove_file(file_id[0], file_id[1])


class UploadFileHandler(tornado.web.RequestHandler):
    """
    Implements the PUT /upload_file endpoint.
    """

    def initialize(self, file_mgr):
        """
        Parameters
        ----------
        file_mgr : HTTPUploadedFileManager

        """
        self._file_mgr = file_mgr

    @staticmethod
    def _require_arg(args, name):
        """Return the value of the argument with the given name.

        A human-readable exception will be raised if the argument doesn't
        exist. This will be used as the body for the error response returned
        from the request.
        """
        try:
            arg = args[name]
        except KeyError:
            raise Exception("Missing '%s'" % name)

        if len(arg) != 1:
            raise Exception("Expected 1 '%s' arg, but got %s" % (name, len(arg)))

        # Convert bytes to string
        return arg[0].decode("utf-8")

    def post(self):
        args = {}
        files = {}

        tornado.httputil.parse_body_arguments(
            content_type=self.request.headers["Content-Type"],
            body=self.request.body,
            arguments=args,
            files=files,
        )

        if len(files) != 1:
            self.send_error(400, reason="Expected 1 file, but got %s" % len(files))
            return

        # Grab the first file entry. Because multiple files with the same
        # name can be uploaded, this entry is itself a list. Ensure
        # there's only one in there as well.
        file_list = list(files.values())[0]
        if len(file_list) != 1:
            self.send_error(400, reason="Expected 1 file, but got %s" % len(file_list))
            return

        file = file_list[0]

        try:
            report_session_id = self._require_arg(args, "reportSessionId")
            widget_id = self._require_arg(args, "widgetId")
        except Exception as e:
            self.send_error(400, reason=str(e))
            return

        self._file_mgr.add_file(
            File(
                report_session_id=report_session_id,
                widget_id=widget_id,
                name=file["filename"],
                data=file["body"],
            )
        )

        self.set_status(200)

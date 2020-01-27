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
    def __init__(self, report_session_id, widget_id, name, size, last_modified):
        self.report_session_id = report_session_id
        self.widget_id = widget_id
        self.name = name
        self.size = size
        self.last_modified = last_modified
        self.data = None


class HTTPUploadedFileManager(object):
    def __init__(self):
        self._files = {}

    def create_new_file(self, report_session_id, widget_id, name, size, last_modified):
        file_id = (report_session_id, widget_id)
        file = self._files.get(file_id, None)
        if file is None:
            file = File(report_session_id, widget_id, name, size, last_modified)
            self._files[file_id] = file

        # Clear the file's data, if the file already existed
        file.data = None

    def get_file(self, report_session_id, widget_id):
        return self._files.get((report_session_id, widget_id), None)


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
            return args[name]
        except KeyError:
            raise Exception("Missing '%s'" % name)

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

        try:
            report_session_id = self._require_arg(args, "reportSessionId")
            widget_id = self._require_arg(args, "widgetId")
            last_modified = self._require_arg(args, "lastModified")
        except Exception as e:
            self.send_error(400, reason=str(e))
            return

        self.set_status(200)

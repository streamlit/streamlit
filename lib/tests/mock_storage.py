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

from unittest import mock
import hashlib

import tornado.gen

from streamlit.storage.abstract_storage import AbstractStorage


class MockStorage(AbstractStorage):
    """A mock AbstractStorage implementation, for testing."""

    @mock.patch("streamlit.storage.abstract_storage._get_static_files")
    def __init__(self, static_files_patch):
        static_files_patch.return_value = [("index.html", "some data")], hashlib.md5()
        super(MockStorage, self).__init__()
        self.files = []

    def get_filename(self, index):
        """Return the filename of stored file.

        Parameters
        ----------
        index : int
            The index of the stored file.

        Returns
        -------
        str
            The name of the stored file.

        """
        return self.files[index][0]

    def get_message(self, index, message_class):
        """Deserialize a stored file into its protobuf object, and return it.

        Parameters
        ----------
        index : int
            The index of the stored file.
        message_class : class
            The protobuf class that the file should have been serialized from.

        Returns
        -------
        message_class
            The protobuf message object for the given file.

        """
        msg = message_class()
        msg.ParseFromString(self.files[index][1])
        return msg

    @tornado.gen.coroutine
    def _save_report_files(
        self, report_id, files, progress_coroutine=None, manifest_save_order=None
    ):
        self.files += files
        raise tornado.gen.Return("https://a.fake.url")

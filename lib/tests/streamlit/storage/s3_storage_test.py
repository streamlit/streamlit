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

"""S3 Storage Unittest.

Copyright 2019 Streamlit Inc. All rights reserved.
"""
from unittest.mock import patch
import hashlib
import unittest

from streamlit.storage.s3_storage import S3Storage
from streamlit.config import set_option


class S3StorageTest(unittest.TestCase):
    def tearDown(self):
        set_option("global.sharingMode", "off")

    @patch("streamlit.storage.abstract_storage._get_static_files")
    def test_private_url(self, static_files):
        static_files.return_value = [("index.html", "some data")], hashlib.md5()

        set_option("global.sharingMode", "s3")
        set_option("s3.bucket", "buckets")
        set_option("s3.accessKeyId", "ACCESS_KEY_ID")
        set_option("s3.secretAccessKey", "SECRET_ACCESS_KEY")
        s3 = S3Storage()
        self.assertEqual(s3._url, None)
        idx = s3._web_app_url.index("/", 8)
        self.assertEqual(s3._web_app_url[0:idx], "https://buckets.s3.amazonaws.com")

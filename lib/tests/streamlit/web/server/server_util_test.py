# Copyright 2018-2022 Streamlit Inc.
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

"""Unit tests for server_util.py."""

import unittest
from typing import Optional
from unittest.mock import patch

from parameterized import parameterized

from streamlit import config
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.web.server.server_util import (
    get_url,
    is_url_from_allowed_origins,
    is_cacheable_msg,
    serialize_forward_msg,
)
from tests import testutil
from tests.testutil import patch_config_options
from .message_mocks import create_dataframe_msg


class ServerUtilTest(unittest.TestCase):
    def test_is_url_from_allowed_origins_allowed_domains(self):
        self.assertTrue(is_url_from_allowed_origins("localhost"))
        self.assertTrue(is_url_from_allowed_origins("127.0.0.1"))

    def test_is_url_from_allowed_origins_CORS_off(self):
        with patch(
            "streamlit.web.server.server_util.config.get_option", side_effect=[False]
        ):
            self.assertTrue(is_url_from_allowed_origins("does not matter"))

    def test_is_url_from_allowed_origins_browser_serverAddress(self):
        with patch(
            "streamlit.web.server.server_util.config.is_manually_set",
            side_effect=[True],
        ), patch(
            "streamlit.web.server.server_util.config.get_option",
            side_effect=[True, "browser.server.address"],
        ):
            self.assertTrue(is_url_from_allowed_origins("browser.server.address"))

    def test_should_cache_msg(self):
        """Test server_util.should_cache_msg"""
        with patch_config_options({"global.minCachedMessageSize": 0}):
            self.assertTrue(is_cacheable_msg(create_dataframe_msg([1, 2, 3])))

        with patch_config_options({"global.minCachedMessageSize": 1000}):
            self.assertFalse(is_cacheable_msg(create_dataframe_msg([1, 2, 3])))

    def test_should_limit_msg_size(self):
        max_message_size_mb = 50
        # Set max message size to defined value
        from streamlit.web.server import server_util

        server_util._max_message_size_bytes = None  # Reset cached value
        config._set_option("server.maxMessageSize", max_message_size_mb, "test")

        # Set up a larger than limit ForwardMsg string
        large_msg = create_dataframe_msg([1, 2, 3])
        large_msg.delta.new_element.markdown.body = (
            "X" * (max_message_size_mb + 10) * 1000 * 1000
        )
        # Create a copy, since serialize_forward_msg modifies the original proto
        large_msg_copy = ForwardMsg()
        large_msg_copy.CopyFrom(large_msg)
        deserialized_msg = ForwardMsg()
        deserialized_msg.ParseFromString(serialize_forward_msg(large_msg_copy))

        # The metadata should be the same, but contents should be replaced
        self.assertEqual(deserialized_msg.metadata, large_msg.metadata)
        self.assertNotEqual(deserialized_msg, large_msg)
        self.assertTrue(
            "exceeds the message size limit"
            in deserialized_msg.delta.new_element.exception.message
        )

    @parameterized.expand(
        [
            (None, None, "http://the_ip_address:8501"),
            (None, 9988, "http://the_ip_address:9988"),
            ("foo", None, "http://the_ip_address:8501/foo"),
            ("foo/", None, "http://the_ip_address:8501/foo"),
            ("/foo/bar/", None, "http://the_ip_address:8501/foo/bar"),
            ("/foo/bar/", 9988, "http://the_ip_address:9988/foo/bar"),
        ]
    )
    def test_get_url(
        self, base_url: Optional[str], port: Optional[int], expected_url: str
    ):
        options = {"server.headless": False, "global.developmentMode": False}

        if base_url:
            options["server.baseUrlPath"] = base_url

        if port:
            options["server.port"] = port

        mock_get_option = testutil.build_mock_config_get_option(options)

        with patch.object(config, "get_option", new=mock_get_option):
            actual_url = get_url("the_ip_address")

        self.assertEqual(expected_url, actual_url)

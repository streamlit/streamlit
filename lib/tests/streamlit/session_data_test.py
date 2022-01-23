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

"""Unit tests for session_data.py."""

from unittest.mock import patch
import copy
import unittest

from parameterized import parameterized

from streamlit import config, RootContainer
from streamlit.cursor import make_delta_path
from streamlit.session_data import get_url
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.Empty_pb2 import Empty as EmptyProto
from tests import testutil

NEW_SESSION_MSG = ForwardMsg()
NEW_SESSION_MSG.metadata.delta_path[:] = make_delta_path(RootContainer.MAIN, (), 0)

TEXT_DELTA_MSG = ForwardMsg()
TEXT_DELTA_MSG.delta.new_element.text.body = "text1"
TEXT_DELTA_MSG.metadata.delta_path[:] = make_delta_path(RootContainer.MAIN, (), 0)

EMPTY_DELTA_MSG = ForwardMsg()
EMPTY_DELTA_MSG.delta.new_element.empty.CopyFrom(EmptyProto())
EMPTY_DELTA_MSG.metadata.delta_path[:] = make_delta_path(RootContainer.MAIN, (), 0)


def _enqueue(report, msg):
    msg = copy.deepcopy(msg)
    msg.metadata.delta_path[-1] = len(list(report._master_queue))
    report.enqueue(msg)


def _parse_msg(msg_string):
    """Parse a ForwardMsg from a string"""
    msg = ForwardMsg()
    msg.ParseFromString(msg_string)
    return msg


class SessionDataTest(unittest.TestCase):
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
    def test_get_url(self, baseUrl, port, expected_url):
        options = {"server.headless": False, "global.developmentMode": False}

        if baseUrl:
            options["server.baseUrlPath"] = baseUrl

        if port:
            options["server.port"] = port

        mock_get_option = testutil.build_mock_config_get_option(options)

        with patch.object(config, "get_option", new=mock_get_option):
            actual_url = get_url("the_ip_address")

        self.assertEqual(expected_url, actual_url)

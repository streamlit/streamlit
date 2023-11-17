# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import unittest

import requests
import requests_mock

from streamlit import net_util


class UtilTest(unittest.TestCase):
    def setUp(self):
        net_util._external_ip = None

    def test_get_external_ip(self):
        # Test success
        with requests_mock.mock() as m:
            m.get(net_util._AWS_CHECK_IP, text="1.2.3.4")
            self.assertEqual("1.2.3.4", net_util.get_external_ip())

        net_util._external_ip = None

        # Test failure
        with requests_mock.mock() as m:
            m.get(net_util._AWS_CHECK_IP, exc=requests.exceptions.ConnectTimeout)
            self.assertEqual(None, net_util.get_external_ip())

    def test_get_external_ip_use_http_by_default(self):
        with requests_mock.mock() as m:
            m.get(net_util._AWS_CHECK_IP, text="1.2.3.4")
            m.get(net_util._AWS_CHECK_IP_HTTPS, text="5.6.7.8")
            self.assertEqual("1.2.3.4", net_util.get_external_ip())
            self.assertEqual(m.call_count, 1)

    def test_get_external_ip_https_if_http_fails(self):
        with requests_mock.mock() as m:
            m.get(net_util._AWS_CHECK_IP, exc=requests.exceptions.ConnectTimeout)
            m.get(net_util._AWS_CHECK_IP_HTTPS, text="5.6.7.8")
            self.assertEqual("5.6.7.8", net_util.get_external_ip())
            self.assertEqual(m.call_count, 2)

    def test_get_external_ip_html(self):
        # This tests the case where the external URL returns a web page.
        # https://github.com/streamlit/streamlit/issues/554#issuecomment-604847244

        response_text = """
        <html>
            ... stuff
        </html>
        """

        with requests_mock.mock() as m:
            m.get(net_util._AWS_CHECK_IP, text=response_text)
            self.assertEqual(None, net_util.get_external_ip())

        net_util._external_ip = None

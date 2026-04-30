# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from __future__ import annotations

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
            assert net_util.get_external_ip() == "1.2.3.4"

        net_util._external_ip = None

        # Test failure
        with requests_mock.mock() as m:
            m.get(net_util._AWS_CHECK_IP, exc=requests.exceptions.ConnectTimeout)
            assert None is net_util.get_external_ip()

    def test_get_external_ip_use_http_by_default(self):
        with requests_mock.mock() as m:
            m.get(net_util._AWS_CHECK_IP, text="1.2.3.4")
            m.get(net_util._AWS_CHECK_IP_HTTPS, text="5.6.7.8")
            assert net_util.get_external_ip() == "1.2.3.4"
            assert m.call_count == 1

    def test_get_external_ip_https_if_http_fails(self):
        with requests_mock.mock() as m:
            m.get(net_util._AWS_CHECK_IP, exc=requests.exceptions.ConnectTimeout)
            m.get(net_util._AWS_CHECK_IP_HTTPS, text="5.6.7.8")
            assert net_util.get_external_ip() == "5.6.7.8"
            assert m.call_count == 2

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
            assert None is net_util.get_external_ip()

        net_util._external_ip = None


class BackgroundFetchTest(unittest.TestCase):
    """Tests for background external IP fetch functionality."""

    def setUp(self):
        net_util._external_ip = None
        net_util._external_ip_fetch_started = False
        net_util._external_ip_fetch_thread = None

    def tearDown(self):
        net_util._external_ip = None
        net_util._external_ip_fetch_started = False
        net_util._external_ip_fetch_thread = None

    def test_get_external_ip_nonblocking_returns_none_when_not_fetched(self):
        """Returns None when external IP has not been fetched yet."""
        assert net_util.get_external_ip_nonblocking() is None

    def test_get_external_ip_nonblocking_returns_cached_value(self):
        """Returns the cached external IP when available."""
        net_util._external_ip = "1.2.3.4"
        assert net_util.get_external_ip_nonblocking() == "1.2.3.4"

    def test_start_external_ip_fetch_starts_background_thread(self):
        """Starts a background thread to fetch the external IP."""
        with requests_mock.mock() as m:
            m.get(net_util._AWS_CHECK_IP, text="5.6.7.8")

            net_util.start_external_ip_fetch()

            assert net_util._external_ip_fetch_started is True
            assert net_util._external_ip_fetch_thread is not None
            assert net_util._external_ip_fetch_thread.name == "external-ip-fetch"
            assert net_util._external_ip_fetch_thread.daemon is True

            net_util._external_ip_fetch_thread.join(timeout=10)
            assert net_util._external_ip == "5.6.7.8"

    def test_start_external_ip_fetch_is_idempotent(self):
        """Calling start_external_ip_fetch multiple times only starts one thread."""
        with requests_mock.mock() as m:
            m.get(net_util._AWS_CHECK_IP, text="1.2.3.4")

            net_util.start_external_ip_fetch()
            first_thread = net_util._external_ip_fetch_thread

            net_util.start_external_ip_fetch()
            second_thread = net_util._external_ip_fetch_thread

            assert first_thread is second_thread
            first_thread.join(timeout=10)

    def test_start_external_ip_fetch_skips_if_already_cached(self):
        """Does not start a thread if the external IP is already cached."""
        net_util._external_ip = "already-cached"

        net_util.start_external_ip_fetch()

        assert net_util._external_ip_fetch_thread is None
        assert net_util._external_ip_fetch_started is False

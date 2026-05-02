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
from unittest.mock import MagicMock

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


def test_get_external_ip_uses_short_timeout(monkeypatch) -> None:
    """Verify get_external_ip uses 1s timeout for both HTTP and HTTPS calls."""
    # Reset cache to force new request
    monkeypatch.setattr(net_util, "_external_ip", None)

    mock_get = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "1.2.3.4"
    mock_get.return_value = mock_response

    monkeypatch.setattr("requests.get", mock_get)

    net_util.get_external_ip()

    # Verify timeout=1 was passed on the HTTP call
    mock_get.assert_called_once()
    _, kwargs = mock_get.call_args
    assert kwargs.get("timeout") == 1, (
        f"Expected timeout=1, got {kwargs.get('timeout')}"
    )


def test_get_external_ip_https_fallback_uses_short_timeout(monkeypatch) -> None:
    """Verify HTTPS fallback in get_external_ip also uses 1s timeout."""
    # Reset cache to force new request
    monkeypatch.setattr(net_util, "_external_ip", None)

    mock_get = MagicMock()

    def side_effect(url: str, timeout: float = 5) -> MagicMock:
        """Simulate HTTP failure, HTTPS success."""
        if url == net_util._AWS_CHECK_IP:
            raise requests.exceptions.ConnectTimeout()
        mock_response = MagicMock()
        mock_response.text = "1.2.3.4"
        return mock_response

    mock_get.side_effect = side_effect
    monkeypatch.setattr("requests.get", mock_get)

    result = net_util.get_external_ip()

    # Verify both calls were made with timeout=1
    assert result == "1.2.3.4"
    assert mock_get.call_count == 2

    # Check first call (HTTP)
    first_call_kwargs = mock_get.call_args_list[0].kwargs
    assert first_call_kwargs.get("timeout") == 1, (
        f"HTTP call: Expected timeout=1, got {first_call_kwargs.get('timeout')}"
    )

    # Check second call (HTTPS fallback)
    second_call_kwargs = mock_get.call_args_list[1].kwargs
    assert second_call_kwargs.get("timeout") == 1, (
        f"HTTPS fallback: Expected timeout=1, got {second_call_kwargs.get('timeout')}"
    )

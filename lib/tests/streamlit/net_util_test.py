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
import urllib.error
from unittest.mock import MagicMock, patch

from streamlit import net_util


def _mock_response(body: str) -> MagicMock:
    """Build a urlopen return value usable as a context manager."""
    response = MagicMock()
    response.read.return_value = body.encode("utf-8")
    response.__enter__.return_value = response
    response.__exit__.return_value = False
    return response


class UtilTest(unittest.TestCase):
    def setUp(self):
        net_util._external_ip = None

    def test_get_external_ip(self):
        # Test success
        with patch("urllib.request.urlopen", return_value=_mock_response("1.2.3.4")):
            assert net_util.get_external_ip() == "1.2.3.4"

        net_util._external_ip = None

        # Test failure
        with patch(
            "urllib.request.urlopen", side_effect=urllib.error.URLError("timeout")
        ):
            assert net_util.get_external_ip() is None

    def test_get_external_ip_use_http_by_default(self):
        mock_urlopen = MagicMock(return_value=_mock_response("1.2.3.4"))
        with patch("urllib.request.urlopen", mock_urlopen):
            assert net_util.get_external_ip() == "1.2.3.4"
            # HTTPS fallback is not attempted when HTTP succeeds.
            assert mock_urlopen.call_count == 1

    def test_get_external_ip_https_if_http_fails(self):
        def side_effect(url: str, timeout: float | None = None) -> MagicMock:
            if url == net_util._AWS_CHECK_IP:
                raise urllib.error.URLError("timeout")
            return _mock_response("5.6.7.8")

        mock_urlopen = MagicMock(side_effect=side_effect)
        with patch("urllib.request.urlopen", mock_urlopen):
            assert net_util.get_external_ip() == "5.6.7.8"
            assert mock_urlopen.call_count == 2

    def test_get_external_ip_html(self):
        # This tests the case where the external URL returns a web page.
        # https://github.com/streamlit/streamlit/issues/554#issuecomment-604847244

        response_text = """
        <html>
            ... stuff
        </html>
        """

        with patch(
            "urllib.request.urlopen", return_value=_mock_response(response_text)
        ):
            assert net_util.get_external_ip() is None

        net_util._external_ip = None


def test_get_external_ip_uses_short_timeout(monkeypatch) -> None:
    """Verify get_external_ip uses a 1s timeout for the HTTP call."""
    # Reset cache to force a new request.
    monkeypatch.setattr(net_util, "_external_ip", None)

    mock_urlopen = MagicMock(return_value=_mock_response("1.2.3.4"))
    monkeypatch.setattr("urllib.request.urlopen", mock_urlopen)

    net_util.get_external_ip()

    mock_urlopen.assert_called_once()
    _, kwargs = mock_urlopen.call_args
    assert kwargs.get("timeout") == 1, (
        f"Expected timeout=1, got {kwargs.get('timeout')}"
    )


def test_get_external_ip_https_fallback_uses_short_timeout(monkeypatch) -> None:
    """Verify the HTTPS fallback in get_external_ip also uses a 1s timeout."""
    # Reset cache to force a new request.
    monkeypatch.setattr(net_util, "_external_ip", None)

    def side_effect(url: str, timeout: float | None = None) -> MagicMock:
        """Simulate HTTP failure, HTTPS success."""
        if url == net_util._AWS_CHECK_IP:
            raise urllib.error.URLError("timeout")
        return _mock_response("1.2.3.4")

    mock_urlopen = MagicMock(side_effect=side_effect)
    monkeypatch.setattr("urllib.request.urlopen", mock_urlopen)

    result = net_util.get_external_ip()

    assert result == "1.2.3.4"
    assert mock_urlopen.call_count == 2
    # Both the HTTP call and the HTTPS fallback use timeout=1.
    for mock_call in mock_urlopen.call_args_list:
        assert mock_call.kwargs.get("timeout") == 1

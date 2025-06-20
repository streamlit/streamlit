# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

"""Unit tests for server_util.py."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from parameterized import parameterized

from streamlit import config
from streamlit.web.server import server_util
from tests import testutil


class ServerUtilTest(unittest.TestCase):
    def test_allowlisted_origins_empty_string(self):
        with testutil.patch_config_options({"server.corsAllowedOrigins": []}):
            assert server_util.allowlisted_origins() == set()

    def test_allowlisted_origins_singleton(self):
        with testutil.patch_config_options(
            {"server.corsAllowedOrigins": ["http://example.com"]}
        ):
            assert server_util.allowlisted_origins() == {"http://example.com"}

    def test_allowlisted_origins_multiple_entries(self):
        with testutil.patch_config_options(
            {
                "server.corsAllowedOrigins": [
                    "http://example.com",
                    "https://streamlit.io",
                ]
            }
        ):
            assert server_util.allowlisted_origins() == {
                "http://example.com",
                "https://streamlit.io",
            }

    def test_allowlisted_origins_string_with_whitespace(self):
        with testutil.patch_config_options(
            {
                "server.corsAllowedOrigins": [
                    " http://example.com       ",
                    "       https://streamlit.io ",
                ]
            }
        ):
            assert server_util.allowlisted_origins() == {
                "http://example.com",
                "https://streamlit.io",
            }

    def test_is_url_from_allowed_origins_allowed_domains(self):
        with testutil.patch_config_options(
            {
                "server.corsAllowedOrigins": [
                    "http://example.com",
                    "https://streamlit.io",
                ]
            }
        ):
            for origin in [
                "localhost",
                "127.0.0.1",
                "http://example.com",
                "https://streamlit.io",
            ]:
                assert server_util.is_url_from_allowed_origins(origin)

            assert not server_util.is_url_from_allowed_origins(
                "http://some-other-origin.com"
            )

    def test_is_url_from_allowed_origins_CORS_off(self):
        with patch(
            "streamlit.web.server.server_util.config.get_option", side_effect=[False]
        ):
            assert server_util.is_url_from_allowed_origins("does not matter")

    def test_is_url_from_allowed_origins_browser_serverAddress(self):
        with (
            patch(
                "streamlit.web.server.server_util.config.is_manually_set",
                side_effect=[True],
            ),
            patch(
                "streamlit.web.server.server_util.config.get_option",
                side_effect=[True, [], "browser.server.address"],
            ),
        ):
            assert server_util.is_url_from_allowed_origins("browser.server.address")

    @parameterized.expand(
        [
            (None, 8501, "http://the_ip_address:8501"),
            (None, 9988, "http://the_ip_address:9988"),
            ("foo", 8501, "http://the_ip_address:8501/foo"),
            ("foo/", 8501, "http://the_ip_address:8501/foo"),
            ("/foo/bar/", 8501, "http://the_ip_address:8501/foo/bar"),
            ("/foo/bar/", 9988, "http://the_ip_address:9988/foo/bar"),
        ]
    )
    def test_get_url(self, base_url: str | None, port: int, expected_url: str):
        options = {"server.headless": False, "global.developmentMode": False}

        if base_url:
            options["server.baseUrlPath"] = base_url

        options["server.port"] = port

        mock_get_option = testutil.build_mock_config_get_option(options)

        with patch.object(config, "get_option", new=mock_get_option):
            actual_url = server_util.get_url("the_ip_address")

        assert expected_url == actual_url

    def test_make_url_path_regex(self):
        assert (
            server_util.make_url_path_regex("foo") == r"^/foo/?$"
        )  # defaults to optional
        assert (
            server_util.make_url_path_regex("foo", trailing_slash="optional")
            == r"^/foo/?$"
        )
        assert (
            server_util.make_url_path_regex("foo", trailing_slash="required")
            == r"^/foo/$"
        )
        assert (
            server_util.make_url_path_regex("foo", trailing_slash="prohibited")
            == r"^/foo$"
        )

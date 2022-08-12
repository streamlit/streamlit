"""Unit tests for server_util.py."""

import unittest
from typing import Optional
from unittest.mock import patch

from parameterized import parameterized

import streamlit.web.server.server_util as server_util
from streamlit import config
from tests import testutil


class ServerUtilTest(unittest.TestCase):
    def test_is_url_from_allowed_origins_allowed_domains(self):
        self.assertTrue(server_util.is_url_from_allowed_origins("localhost"))
        self.assertTrue(server_util.is_url_from_allowed_origins("127.0.0.1"))

    def test_is_url_from_allowed_origins_CORS_off(self):
        with patch(
            "streamlit.web.server.server_util.config.get_option", side_effect=[False]
        ):
            self.assertTrue(server_util.is_url_from_allowed_origins("does not matter"))

    def test_is_url_from_allowed_origins_browser_serverAddress(self):
        with patch(
            "streamlit.web.server.server_util.config.is_manually_set",
            side_effect=[True],
        ), patch(
            "streamlit.web.server.server_util.config.get_option",
            side_effect=[True, "browser.server.address"],
        ):
            self.assertTrue(
                server_util.is_url_from_allowed_origins("browser.server.address")
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
            actual_url = server_util.get_url("the_ip_address")

        self.assertEqual(expected_url, actual_url)

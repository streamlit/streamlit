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

from __future__ import annotations

import json
import mimetypes
import os
import tempfile

import tornado.httpserver
import tornado.testing
import tornado.web
import tornado.websocket

from streamlit.web.server import Server
from streamlit.web.server.routes import _DEFAULT_ALLOWED_MESSAGE_ORIGINS
from streamlit.web.server.server import (
    HEALTH_ENDPOINT,
    HOST_CONFIG_ENDPOINT,
    NEW_HEALTH_ENDPOINT,
    AddSlashHandler,
    HealthHandler,
    HostConfigHandler,
    RemoveSlashHandler,
    StaticFileHandler,
)
from tests.testutil import patch_config_options


class HealthHandlerTest(tornado.testing.AsyncHTTPTestCase):
    """Tests the /_stcore/health endpoint"""

    def setUp(self):
        super().setUp()
        self._is_healthy = True

    async def is_healthy(self):
        return self._is_healthy, "ok"

    def get_app(self):
        return tornado.web.Application(
            [(rf"/{HEALTH_ENDPOINT}", HealthHandler, dict(callback=self.is_healthy))]
        )

    def test_health(self):
        response = self.fetch("/_stcore/health")
        assert response.code == 200
        assert response.body == b"ok"

        self._is_healthy = False
        response = self.fetch("/_stcore/health")
        assert response.code == 503

    def test_health_head(self):
        response = self.fetch("/_stcore/health", method="HEAD")
        assert response.code == 200

        self._is_healthy = False
        response = self.fetch("/_stcore/health", method="HEAD")
        assert response.code == 503

    @patch_config_options({"server.enableXsrfProtection": False})
    def test_health_without_csrf(self):
        response = self.fetch("/_stcore/health")
        assert response.code == 200
        assert response.body == b"ok"
        assert "Set-Cookie" not in response.headers

    @patch_config_options({"server.enableXsrfProtection": True})
    def test_health_with_csrf(self):
        response = self.fetch("/_stcore/health")
        assert response.code == 200
        assert response.body == b"ok"
        assert "Set-Cookie" in response.headers

    def test_health_deprecated(self):
        response = self.fetch("/healthz")
        assert (
            response.headers["link"]
            == f'<http://127.0.0.1:{self.get_http_port()}/_stcore/health>; rel="alternate"'
        )
        assert response.headers["deprecation"] == "True"

    def test_new_health_endpoint_should_not_display_deprecation_warning(self):
        response = self.fetch("/_stcore/health")
        assert "link" not in response.headers
        assert "deprecation" not in response.headers


class StaticFileHandlerTest(tornado.testing.AsyncHTTPTestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        self._tmpfile = tempfile.NamedTemporaryFile(dir=self._tmpdir.name, delete=False)
        self._tmp_js_file = tempfile.NamedTemporaryFile(
            dir=self._tmpdir.name, suffix="script.js", delete=False
        )
        self._tmp_html_file = tempfile.NamedTemporaryFile(
            dir=self._tmpdir.name, suffix="file.html", delete=False
        )
        self._tmp_css_file = tempfile.NamedTemporaryFile(
            dir=self._tmpdir.name, suffix="stylesheet.css", delete=False
        )
        self._filename = os.path.basename(self._tmpfile.name)
        self._js_filename = os.path.basename(self._tmp_js_file.name)
        self._html_filename = os.path.basename(self._tmp_html_file.name)
        self._css_filename = os.path.basename(self._tmp_css_file.name)

        super().setUp()

    def tearDown(self) -> None:
        super().tearDown()

        self._tmpfile.close()
        self._tmpdir.cleanup()

    def get_app(self):
        return tornado.web.Application(
            [
                (
                    r"/(.*)",
                    StaticFileHandler,
                    {
                        "path": self._tmpdir.name,
                        "default_filename": self._filename,
                        "reserved_paths": [
                            NEW_HEALTH_ENDPOINT,
                            HOST_CONFIG_ENDPOINT,
                        ],
                    },
                )
            ]
        )

    def test_parse_url_path_200(self):
        responses = [
            self.fetch("/"),
            self.fetch(f"/{self._filename}"),
            self.fetch("/page1/"),
            self.fetch(f"/page1/{self._filename}"),
            self.fetch("/page2/"),
            self.fetch(f"/page2/{self._filename}"),
        ]

        for r in responses:
            assert r.code == 200

    def test_nonexistent_urls_return_default_page(self):
        responses = [
            self.fetch("/nonexistent"),
            self.fetch("/page2/nonexistent"),
            self.fetch(f"/page3/{self._filename}"),
        ]

        for r in responses:
            assert r.code == 200

    def test_reserved_paths_serve_404(self):
        responses = [
            self.fetch("/nonexistent/_stcore/health"),
            self.fetch("/page2/_stcore/host-config"),
        ]

        for r in responses:
            assert r.code == 404

    def test_mimetype_is_overridden_by_server(self):
        """Test get_content_type function."""
        mimetypes.add_type("custom/html", ".html")
        mimetypes.add_type("custom/js", ".js")
        mimetypes.add_type("custom/css", ".css")

        r = self.fetch(f"/{self._html_filename}")
        assert r.headers["Content-Type"] == "custom/html"

        r = self.fetch(f"/{self._js_filename}")
        assert r.headers["Content-Type"] == "custom/js"

        r = self.fetch(f"/{self._css_filename}")
        assert r.headers["Content-Type"] == "custom/css"

        Server.initialize_mimetypes()

        r = self.fetch(f"/{self._html_filename}")
        assert r.headers["Content-Type"] == "text/html"

        r = self.fetch(f"/{self._js_filename}")
        assert r.headers["Content-Type"] == "application/javascript"

        r = self.fetch(f"/{self._css_filename}")
        assert r.headers["Content-Type"] == "text/css"


class RemoveSlashHandlerTest(tornado.testing.AsyncHTTPTestCase):
    def get_app(self):
        return tornado.web.Application(
            [
                (
                    r"^/(?!/)(.*)",
                    RemoveSlashHandler,
                )
            ]
        )

    def test_parse_url_path_301(self):
        paths = ["/page1/", "/page2/page3/"]
        responses = [self.fetch(path, follow_redirects=False) for path in paths]

        for idx, r in enumerate(responses):
            assert r.code == 301
            assert r.headers["Location"] == paths[idx].rstrip("/")

    def test_parse_url_path_404(self):
        paths = ["//page1/", "//page2/page3/"]
        responses = [self.fetch(path, follow_redirects=False) for path in paths]

        for r in responses:
            assert r.code == 404


class AddSlashHandlerTest(tornado.testing.AsyncHTTPTestCase):
    def get_app(self):
        return tornado.web.Application(
            [
                (
                    r"/(.*)",
                    AddSlashHandler,
                )
            ]
        )

    def test_parse_url_path_301(self):
        paths = ["/page1"]
        responses = [self.fetch(path, follow_redirects=False) for path in paths]

        for idx, r in enumerate(responses):
            assert r.code == 301
            assert r.headers["Location"] == paths[idx] + "/"


class HostConfigHandlerTest(tornado.testing.AsyncHTTPTestCase):
    def setUp(self):
        super().setUp()

    def get_app(self):
        return tornado.web.Application(
            [
                (
                    rf"/{HOST_CONFIG_ENDPOINT}",
                    HostConfigHandler,
                )
            ]
        )

    @patch_config_options({"global.developmentMode": False})
    def test_allowed_message_origins(self):
        response = self.fetch("/_stcore/host-config")
        response_body = json.loads(response.body)
        assert response.code == 200
        assert response_body == {
            "allowedOrigins": _DEFAULT_ALLOWED_MESSAGE_ORIGINS,
            "useExternalAuthToken": False,
            # Default host configuration settings:
            "enableCustomParentMessages": False,
            "enforceDownloadInNewTab": False,
            "metricsUrl": "",
            "blockErrorDialogs": False,
        }
        # Check that localhost NOT appended/allowed outside dev mode
        assert "http://localhost" not in response_body["allowedOrigins"]

    @patch_config_options({"global.developmentMode": True})
    def test_allowed_message_origins_dev_mode(self):
        response = self.fetch("/_stcore/host-config")
        assert response.code == 200
        # Check that localhost has been appended/allowed in dev mode
        origins_list = json.loads(response.body)["allowedOrigins"]
        assert "http://localhost" in origins_list

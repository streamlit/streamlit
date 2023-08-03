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

import json
import os
import tempfile
from unittest.mock import MagicMock

import tornado.httpserver
import tornado.testing
import tornado.web
import tornado.websocket
from PIL import Image

from streamlit import config
from streamlit.runtime.forward_msg_cache import ForwardMsgCache, populate_hash_if_needed
from streamlit.runtime.runtime_util import serialize_forward_msg
from streamlit.web.server.routes import ALLOWED_MESSAGE_ORIGINS
from streamlit.web.server.server import (
    ALLOWED_MESSAGE_ORIGIN_ENDPOINT,
    HEALTH_ENDPOINT,
    MESSAGE_ENDPOINT,
    METADATA_MANIFEST_ENDPOINT,
    AllowedMessageOriginsHandler,
    HealthHandler,
    MessageCacheHandler,
    MetadataWebManifestHandler,
    StaticFileHandler,
)
from tests.streamlit.message_mocks import create_dataframe_msg
from tests.testutil import patch_config_options


class HealthHandlerTest(tornado.testing.AsyncHTTPTestCase):
    """Tests the /_stcore/health endpoint"""

    def setUp(self):
        super(HealthHandlerTest, self).setUp()
        self._is_healthy = True

    async def is_healthy(self):
        return self._is_healthy, "ok"

    def get_app(self):
        return tornado.web.Application(
            [(rf"/{HEALTH_ENDPOINT}", HealthHandler, dict(callback=self.is_healthy))]
        )

    def test_health(self):
        response = self.fetch("/_stcore/health")
        self.assertEqual(200, response.code)
        self.assertEqual(b"ok", response.body)

        self._is_healthy = False
        response = self.fetch("/_stcore/health")
        self.assertEqual(503, response.code)

    @patch_config_options({"server.enableXsrfProtection": False})
    def test_health_without_csrf(self):
        response = self.fetch("/_stcore/health")
        self.assertEqual(200, response.code)
        self.assertEqual(b"ok", response.body)
        self.assertNotIn("Set-Cookie", response.headers)

    @patch_config_options({"server.enableXsrfProtection": True})
    def test_health_with_csrf(self):
        response = self.fetch("/_stcore/health")
        self.assertEqual(200, response.code)
        self.assertEqual(b"ok", response.body)
        self.assertIn("Set-Cookie", response.headers)

    def test_health_deprecated(self):
        response = self.fetch("/healthz")
        self.assertEqual(
            response.headers["link"],
            f'<http://127.0.0.1:{self.get_http_port()}/_stcore/health>; rel="alternate"',
        )
        self.assertEqual(response.headers["deprecation"], "True")

    def test_new_health_endpoint_should_not_display_deprecation_warning(self):
        response = self.fetch("/_stcore/health")
        self.assertNotIn("link", response.headers)
        self.assertNotIn("deprecation", response.headers)


class MetadataWebManifestHandlerTest(tornado.testing.AsyncHTTPTestCase):
    def setUp(self) -> None:
        self.original_name = config.get_option("metadata.name")
        self.original_short_name = config.get_option("metadata.shortName")
        self.original_description = config.get_option("metadata.description")
        self.original_start_url = config.get_option("metadata.startUrl")
        self.original_display = config.get_option("metadata.display")
        self.original_icon = config.get_option("metadata.icon")
        self.original_theme_color = config.get_option("metadata.themeColor")
        self.original_background_color = config.get_option("metadata.backgroundColor")

        self.original_static_serving = config.get_option("server.enableStaticServing")

        self._tmpdir = tempfile.TemporaryDirectory()
        self._tmp_static_dir_name = os.path.join(self._tmpdir.name, "static")
        self._tmp_runner_script_name = os.path.join(self._tmpdir.name, "server.py")

        os.mkdir(self._tmp_static_dir_name)

        self._tmpfile = tempfile.NamedTemporaryFile(
            dir=self._tmp_static_dir_name, suffix=".png", delete=False
        )
        self._tmpfile_name = os.path.relpath(
            self._tmpfile.name, self._tmp_static_dir_name
        )

        self._txt_tmpfile = tempfile.NamedTemporaryFile(
            dir=self._tmp_static_dir_name, suffix=".txt", delete=False
        )
        self._txt_tmpfile_name = os.path.relpath(
            self._tmpfile.name, self._tmp_static_dir_name
        )

        return super().setUp()

    def tearDown(self):
        config.set_option("metadata.name", self.original_name)
        config.set_option("metadata.shortName", self.original_short_name)
        config.set_option("metadata.description", self.original_description)
        config.set_option("metadata.startUrl", self.original_start_url)
        config.set_option("metadata.display", self.original_display)
        config.set_option("metadata.icon", self.original_icon)
        config.set_option("metadata.themeColor", self.original_theme_color)
        config.set_option("metadata.backgroundColor", self.original_background_color)

        config.set_option("server.enableStaticServing", self.original_static_serving)

        self._tmpdir.cleanup()
        super().tearDown()

    def get_app(self):
        return tornado.web.Application(
            [
                (
                    METADATA_MANIFEST_ENDPOINT,
                    MetadataWebManifestHandler,
                    {"path": self._tmp_runner_script_name, "base": "/"},
                )
            ]
        )

    def test_default_web_manifest(self):
        config._set_option("metadata.icon", None, "test")

        response = self.fetch("/manifest.webmanifest")

        self.assertEqual(200, response.code)
        self.assertEqual("application/manifest+json", response.headers["Content-Type"])
        self.assertEqual(
            "max-age=0, must-revalidate", response.headers["Cache-Control"]
        )
        self.assertEqual(
            {
                "$schema": "https://json.schemastore.org/web-manifest-combined.json",
                "name": "Streamlit",
                "short_name": "Streamlit",
                "description": "Streamlit is an open-source app framework for Machine Learning and Data Science teams. Create beautiful web apps in minutes.",
                "start_url": ".",
                "display": "standalone",
                "theme_color": "#ffffff",
                "background_color": "#262730",
                "serviceworker": {"src": "./sw.js", "scope": "/"},
                "icons": [
                    {"src": "/logo512.png", "sizes": "512x512", "type": "image/png"}
                ],
            },
            json.loads(response.body),
        )

    def test_custom_metadata_web_manifest(self):
        config._set_option("metadata.name", "My application", "test")
        config._set_option("metadata.shortName", "My app", "test")
        config._set_option(
            "metadata.description", "This is just my new cool applicatino!", "test"
        )
        config._set_option("metadata.startUrl", "/app", "test")
        config._set_option("metadata.display", "fullscreen", "test")
        config._set_option("metadata.icon", None, "test")
        config._set_option("metadata.themeColor", "#000000", "test")
        config._set_option("metadata.backgroundColor", "#000000", "test")

        response = self.fetch("/manifest.webmanifest")

        self.assertEqual(200, response.code)
        self.assertEqual("application/manifest+json", response.headers["Content-Type"])
        self.assertEqual(
            "max-age=0, must-revalidate", response.headers["Cache-Control"]
        )
        self.assertEqual(
            {
                "$schema": "https://json.schemastore.org/web-manifest-combined.json",
                "name": "My application",
                "short_name": "My app",
                "description": "This is just my new cool applicatino!",
                "start_url": "/app",
                "display": "fullscreen",
                "theme_color": "#000000",
                "background_color": "#000000",
                "serviceworker": {"src": "./sw.js", "scope": "/"},
                "icons": [
                    {"src": "/logo512.png", "sizes": "512x512", "type": "image/png"}
                ],
            },
            json.loads(response.body),
        )

    def test_server_error_if_static_file_is_not_enabled(self):
        config._set_option("metadata.icon", "./icon.png", "test")
        config._set_option("server.enableStaticServing", False, "test")

        response = self.fetch("/manifest.webmanifest")

        self.assertEqual(500, response.code)
        self.assertEqual(
            "Static file serving is not enabled.", response.body.decode("utf-8")
        )

    def test_server_error_if_static_file_is_enabled_and_icon_file_does_not_exist(self):
        config._set_option("metadata.icon", "./icon.png", "test")
        config._set_option("server.enableStaticServing", True, "test")

        response = self.fetch("/manifest.webmanifest")

        self.assertEqual(500, response.code)
        self.assertEqual("The custom icon file not found.", response.body.decode("utf-8"))

    def test_server_error_if_icon_has_invalid_extension(self):
        config._set_option("metadata.icon", self._txt_tmpfile_name, "test")
        config._set_option("server.enableStaticServing", True, "test")

        response = self.fetch("/manifest.webmanifest")

        self.assertEqual(500, response.code)
        self.assertEqual(
            "The custom icon has invalid extension.", response.body.decode("utf-8")
        )

    def test_server_error_if_icon_has_invalid_size(self):
        config._set_option("metadata.icon", self._tmpfile_name, "test")
        config._set_option("server.enableStaticServing", True, "test")

        invalid_img_size = (100, 100)
        temp_img = Image.new("RGB", invalid_img_size, "red")
        temp_img.save(self._tmpfile.name, "PNG")

        response = self.fetch("/manifest.webmanifest")

        self.assertEqual(500, response.code)
        self.assertEqual("The custom icon has invalid size.", response.body.decode("utf-8"))

    def test_custom_icon_web_manifest(self):
        config._set_option("metadata.icon", self._tmpfile_name, "test")
        config._set_option("server.enableStaticServing", True, "test")

        valid_img_size = (192, 192)  # Valid default size for Android devices
        temp_img = Image.new("RGB", valid_img_size, "red")
        temp_img.save(self._tmpfile.name, "PNG")

        response = self.fetch("/manifest.webmanifest")

        self.assertEqual(200, response.code)
        self.assertEqual("application/manifest+json", response.headers["Content-Type"])
        self.assertEqual(
            "max-age=0, must-revalidate", response.headers["Cache-Control"]
        )
        self.assertEqual(
            {
                "$schema": "https://json.schemastore.org/web-manifest-combined.json",
                "name": "Streamlit",
                "short_name": "Streamlit",
                "description": "Streamlit is an open-source app framework for Machine Learning and Data Science teams. Create beautiful web apps in minutes.",
                "start_url": ".",
                "display": "standalone",
                "theme_color": "#ffffff",
                "background_color": "#262730",
                "serviceworker": {"src": "./sw.js", "scope": "/"},
                "icons": [
                    {
                        "src": "/app/static/" + self._tmpfile_name,
                        "sizes": "192x192",
                        "type": "image/png",
                    }
                ],
            },
            json.loads(response.body),
        )


class MessageCacheHandlerTest(tornado.testing.AsyncHTTPTestCase):
    def get_app(self):
        self._cache = ForwardMsgCache()
        return tornado.web.Application(
            [(rf"/{MESSAGE_ENDPOINT}", MessageCacheHandler, dict(cache=self._cache))]
        )

    def test_message_cache(self):
        # Create a new ForwardMsg and cache it
        msg = create_dataframe_msg([1, 2, 3])
        msg_hash = populate_hash_if_needed(msg)
        self._cache.add_message(msg, MagicMock(), 0)

        # Cache hit
        response = self.fetch("/_stcore/message?hash=%s" % msg_hash)
        self.assertEqual(200, response.code)
        self.assertEqual(serialize_forward_msg(msg), response.body)

        # Cache misses
        self.assertEqual(404, self.fetch("/_stcore/message").code)
        self.assertEqual(404, self.fetch("/_stcore/message?id=non_existent").code)


class StaticFileHandlerTest(tornado.testing.AsyncHTTPTestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        self._tmpfile = tempfile.NamedTemporaryFile(dir=self._tmpdir.name, delete=False)
        self._filename = os.path.basename(self._tmpfile.name)

        super().setUp()

    def tearDown(self) -> None:
        super().tearDown()

        self._tmpdir.cleanup()

    def get_pages(self):
        return {"page1": "page_info1", "page2": "page_info2"}

    def get_app(self):
        return tornado.web.Application(
            [
                (
                    r"/(.*)",
                    StaticFileHandler,
                    {
                        "path": self._tmpdir.name,
                        "default_filename": self._filename,
                        "get_pages": self.get_pages,
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

    def test_parse_url_path_404(self):
        responses = [
            self.fetch("/nonexistent"),
            self.fetch("/page2/nonexistent"),
            self.fetch(f"/page3/{self._filename}"),
        ]

        for r in responses:
            assert r.code == 404


class AllowedMessageOriginsHandlerTest(tornado.testing.AsyncHTTPTestCase):
    def setUp(self):
        super(AllowedMessageOriginsHandlerTest, self).setUp()

    def get_app(self):
        return tornado.web.Application(
            [
                (
                    rf"/{ALLOWED_MESSAGE_ORIGIN_ENDPOINT}",
                    AllowedMessageOriginsHandler,
                )
            ]
        )

    @patch_config_options({"global.developmentMode": False})
    def test_allowed_message_origins(self):
        response = self.fetch("/_stcore/allowed-message-origins")
        response_body = json.loads(response.body)
        self.assertEqual(200, response.code)
        self.assertEqual(
            {"allowedOrigins": ALLOWED_MESSAGE_ORIGINS, "useExternalAuthToken": False},
            response_body,
        )
        # Check that localhost NOT appended/allowed outside dev mode
        local_host_appended = "http://localhost" in response_body["allowedOrigins"]
        self.assertEqual(
            local_host_appended,
            False,
        )

    @patch_config_options({"global.developmentMode": True})
    def test_allowed_message_origins_dev_mode(self):
        response = self.fetch("/_stcore/allowed-message-origins")
        self.assertEqual(200, response.code)
        # Check that localhost has been appended/allowed in dev mode
        origins_list = json.loads(response.body)["allowedOrigins"]
        local_host_appended = "http://localhost" in origins_list
        self.assertEqual(
            local_host_appended,
            True,
        )

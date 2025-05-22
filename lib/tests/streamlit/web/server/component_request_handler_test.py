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

import mimetypes
import threading
from unittest import mock

import tornado.testing
import tornado.web

from streamlit.components.lib.local_component_registry import LocalComponentRegistry
from streamlit.components.v1.component_registry import declare_component
from streamlit.runtime import Runtime, RuntimeConfig
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.runtime.scriptrunner import add_script_run_ctx
from streamlit.web.server import ComponentRequestHandler, Server
from tests.testutil import create_mock_script_run_ctx, patch_config_options

URL = "http://not.a.real.url:3001"
PATH = "/not/a/real/path"

MOCK_IS_DIR_PATH = "streamlit.components.lib.local_component_registry.os.path.isdir"


class ComponentRequestHandlerTest(tornado.testing.AsyncHTTPTestCase):
    """Test /component endpoint."""

    def setUp(self) -> None:
        config = RuntimeConfig(
            script_path="mock/script/path.py",
            command_line=None,
            component_registry=LocalComponentRegistry(),
            media_file_storage=MemoryMediaFileStorage("/mock/media"),
            uploaded_file_manager=MemoryUploadedFileManager("/mock/upload"),
        )
        self.runtime = Runtime(config)
        super().setUp()

        # declare_component needs a script_run_ctx to be set
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())

    def tearDown(self) -> None:
        super().tearDown()
        Runtime._instance = None

    # get_app is called in the super constructor
    def get_app(self) -> tornado.web.Application:
        return tornado.web.Application(
            [
                (
                    "/component/(.*)",
                    ComponentRequestHandler,
                    dict(registry=self.runtime.component_registry),
                )
            ]
        )

    def _request_component(self, path, headers=None):
        if headers is None:
            headers = {}
        return self.fetch("/component/%s" % path, method="GET", headers=headers)

    def test_success_request(self):
        """Test request success when valid parameters are provided."""

        with mock.patch(MOCK_IS_DIR_PATH):
            # We don't need the return value in this case.
            declare_component("test", path=PATH)

        with mock.patch(
            "streamlit.web.server.component_request_handler.open",
            mock.mock_open(read_data="Test Content"),
        ):
            response = self._request_component(
                "tests.streamlit.web.server.component_request_handler_test.test"
            )

        assert response.code == 200
        assert response.body == b"Test Content"
        assert response.headers["Access-Control-Allow-Origin"] == "*"

    @mock.patch(
        "streamlit.web.server.routes.allow_all_cross_origin_requests",
        mock.MagicMock(return_value=False),
    )
    @patch_config_options({"server.corsAllowedOrigins": ["http://example.com"]})
    def test_success_request_allowlisted_origin(self):
        """Test request success when valid parameters are provided with an allowlisted origin."""

        with mock.patch(MOCK_IS_DIR_PATH):
            # We don't need the return value in this case.
            declare_component("test", path=PATH)

        with mock.patch(
            "streamlit.web.server.component_request_handler.open",
            mock.mock_open(read_data="Test Content"),
        ):
            response = self._request_component(
                "tests.streamlit.web.server.component_request_handler_test.test",
                headers={"Origin": "http://example.com"},
            )

        assert response.code == 200
        assert response.body == b"Test Content"
        assert response.headers["Access-Control-Allow-Origin"] == "http://example.com"

    def test_outside_component_root_request(self):
        """Tests to ensure a path based on the root directory (and therefore
        outside of the component root) is disallowed."""

        with mock.patch(MOCK_IS_DIR_PATH):
            # We don't need the return value in this case.
            declare_component("test", path=PATH)

        response = self._request_component(
            "tests.streamlit.web.server.component_request_handler_test.test//etc/hosts"
        )

        assert response.code == 403
        assert response.body == b"forbidden"

    def test_outside_component_dir_with_same_prefix_request(self):
        """Tests to ensure a path based on the same prefix but a different
        directory test folder is forbidden."""

        with mock.patch(MOCK_IS_DIR_PATH):
            # We don't need the return value in this case.
            declare_component("test", path=PATH)

        response = self._request_component(
            f"tests.streamlit.web.server.component_request_handler_test.test/{PATH}_really"
        )

        assert response.code == 403
        assert response.body == b"forbidden"

    def test_relative_outside_component_root_request(self):
        """Tests to ensure a path relative to the component root directory
        (and specifically outside of the component root) is disallowed."""

        with mock.patch(MOCK_IS_DIR_PATH):
            # We don't need the return value in this case.
            declare_component("test", path=PATH)

        response = self._request_component(
            "tests.streamlit.web.server.component_request_handler_test.test/../foo"
        )

        assert response.code == 403
        assert response.body == b"forbidden"

    def test_invalid_component_request(self):
        """Test request failure when invalid component name is provided."""

        response = self._request_component("invalid_component")

        assert response.code == 404
        assert response.body == b"not found"

    def test_invalid_content_request(self):
        """Test request failure when invalid content (file) is provided."""

        with mock.patch(MOCK_IS_DIR_PATH):
            declare_component("test", path=PATH)

        with mock.patch("streamlit.web.server.component_request_handler.open") as m:
            m.side_effect = OSError("Invalid content")
            response = self._request_component(
                "tests.streamlit.web.server.component_request_handler_test.test"
            )

        assert response.code == 404
        assert response.body == b"read error"

    def test_support_binary_files_request(self):
        """Test support for binary files reads."""

        def _open_read(m, payload):
            is_binary = False
            args, kwargs = m.call_args
            if len(args) > 1 and "b" in args[1]:
                is_binary = True
            encoding = "utf-8"
            if "encoding" in kwargs:
                encoding = kwargs["encoding"]

            if is_binary:
                from io import BytesIO

                return BytesIO(payload)
            from io import TextIOWrapper

            return TextIOWrapper(str(payload, encoding=encoding))

        with mock.patch(MOCK_IS_DIR_PATH):
            declare_component("test", path=PATH)

        payload = b"\x00\x01\x00\x00\x00\x0d\x00\x80"  # binary non utf-8 payload

        with mock.patch("streamlit.web.server.component_request_handler.open") as m:
            m.return_value.__enter__ = lambda _: _open_read(m, payload)
            response = self._request_component(
                "tests.streamlit.web.server.component_request_handler_test.test"
            )

        assert response.code == 200
        assert response.body == payload

    def test_mimetype_is_overridden_by_server(self):
        """Test get_content_type function."""
        mimetypes.add_type("custom/html", ".html")
        mimetypes.add_type("custom/js", ".js")
        mimetypes.add_type("custom/css", ".css")

        assert ComponentRequestHandler.get_content_type("test.html") == "custom/html"
        assert ComponentRequestHandler.get_content_type("test.js") == "custom/js"
        assert ComponentRequestHandler.get_content_type("test.css") == "custom/css"

        # Have the server reinitialize the mimetypes
        Server.initialize_mimetypes()

        assert ComponentRequestHandler.get_content_type("test.html") == "text/html"
        assert (
            ComponentRequestHandler.get_content_type("test.js")
            == "application/javascript"
        )
        assert ComponentRequestHandler.get_content_type("test.css") == "text/css"

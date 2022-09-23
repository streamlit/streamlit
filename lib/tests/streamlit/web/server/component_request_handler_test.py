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

from unittest import mock

import tornado.testing
import tornado.web

from streamlit.components.v1.components import (
    ComponentRegistry,
    declare_component,
)
from streamlit.web.server import ComponentRequestHandler

URL = "http://not.a.real.url:3001"
PATH = "not/a/real/path"


class ComponentRequestHandlerTest(tornado.testing.AsyncHTTPTestCase):
    """Test /component endpoint."""

    def tearDown(self) -> None:
        ComponentRegistry._instance = None
        super().tearDown()

    def get_app(self):
        ComponentRegistry._instance = None
        return tornado.web.Application(
            [
                (
                    "/component/(.*)",
                    ComponentRequestHandler,
                    dict(registry=ComponentRegistry.instance()),
                )
            ]
        )

    def _request_component(self, path):
        return self.fetch("/component/%s" % path, method="GET")

    def test_success_request(self):
        """Test request success when valid parameters are provided."""

        with mock.patch("streamlit.components.v1.components.os.path.isdir"):
            # We don't need the return value in this case.
            declare_component("test", path=PATH)

        with mock.patch(
            "streamlit.web.server.component_request_handler.open",
            mock.mock_open(read_data="Test Content"),
        ):
            response = self._request_component(
                "tests.streamlit.web.server.component_request_handler_test.test"
            )

        self.assertEqual(200, response.code)
        self.assertEqual(b"Test Content", response.body)

    def test_outside_component_root_request(self):
        """Tests to ensure a path based on the root directory (and therefore
        outside of the component root) is disallowed."""

        with mock.patch("streamlit.components.v1.components.os.path.isdir"):
            # We don't need the return value in this case.
            declare_component("test", path=PATH)

        response = self._request_component(
            "tests.streamlit.web.server.component_request_handler_test.test//etc/hosts"
        )

        self.assertEqual(403, response.code)
        self.assertEqual(b"forbidden", response.body)

    def test_relative_outside_component_root_request(self):
        """Tests to ensure a path relative to the component root directory
        (and specifically outside of the component root) is disallowed."""

        with mock.patch("streamlit.components.v1.components.os.path.isdir"):
            # We don't need the return value in this case.
            declare_component("test", path=PATH)

        response = self._request_component(
            "tests.streamlit.web.server.component_request_handler_test.test/../foo"
        )

        self.assertEqual(403, response.code)
        self.assertEqual(b"forbidden", response.body)

    def test_symlink_outside_component_root_request(self):
        """Tests to ensure a path symlinked to a file outside the component
        root directory is disallowed."""

        with mock.patch("streamlit.components.v1.components.os.path.isdir"):
            # We don't need the return value in this case.
            declare_component("test", path=PATH)

        with mock.patch(
            "streamlit.web.server.component_request_handler.os.path.realpath",
            side_effect=[PATH, "/etc/hosts"],
        ):
            response = self._request_component(
                "tests.streamlit.web.server.component_request_handler_test.test"
            )

        self.assertEqual(403, response.code)
        self.assertEqual(b"forbidden", response.body)

    def test_invalid_component_request(self):
        """Test request failure when invalid component name is provided."""

        response = self._request_component("invalid_component")
        self.assertEqual(404, response.code)
        self.assertEqual(b"not found", response.body)

    def test_invalid_content_request(self):
        """Test request failure when invalid content (file) is provided."""

        with mock.patch("streamlit.components.v1.components.os.path.isdir"):
            declare_component("test", path=PATH)

        with mock.patch("streamlit.web.server.component_request_handler.open") as m:
            m.side_effect = OSError("Invalid content")
            response = self._request_component(
                "tests.streamlit.web.server.component_request_handler_test.test"
            )

        self.assertEqual(404, response.code)
        self.assertEqual(
            b"read error",
            response.body,
        )

    def test_support_binary_files_request(self):
        """Test support for binary files reads."""

        def _open_read(m, payload):
            is_binary = False
            args, kwargs = m.call_args
            if len(args) > 1:
                if "b" in args[1]:
                    is_binary = True
            encoding = "utf-8"
            if "encoding" in kwargs:
                encoding = kwargs["encoding"]

            if is_binary:
                from io import BytesIO

                return BytesIO(payload)
            else:
                from io import TextIOWrapper

                return TextIOWrapper(str(payload, encoding=encoding))

        with mock.patch("streamlit.components.v1.components.os.path.isdir"):
            declare_component("test", path=PATH)

        payload = b"\x00\x01\x00\x00\x00\x0D\x00\x80"  # binary non utf-8 payload

        with mock.patch("streamlit.web.server.component_request_handler.open") as m:
            m.return_value.__enter__ = lambda _: _open_read(m, payload)
            response = self._request_component(
                "tests.streamlit.web.server.component_request_handler_test.test"
            )

        self.assertEqual(200, response.code)
        self.assertEqual(
            payload,
            response.body,
        )

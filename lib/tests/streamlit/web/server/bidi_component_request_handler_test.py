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

import os
import tempfile
from pathlib import Path
from unittest import mock

import tornado.testing
import tornado.web

from streamlit.components.v2.component_manager import BidiComponentManager
from streamlit.components.v2.manifest_scanner import ComponentConfig, ComponentManifest
from streamlit.web.server.bidi_component_request_handler import (
    BidiComponentRequestHandler,
)
from tests.testutil import patch_config_options


class BidiComponentRequestHandlerTest(tornado.testing.AsyncHTTPTestCase):
    def setUp(self) -> None:
        self.component_manager = BidiComponentManager()
        self.temp_dir = tempfile.TemporaryDirectory()
        super().setUp()

        # Create a fake package root with a component asset_dir
        self.package_root = Path(self.temp_dir.name) / "pkgroot"
        self.package_root.mkdir(parents=True, exist_ok=True)

        self.component_assets_dir = self.package_root / "test_component"
        self.component_assets_dir.mkdir(parents=True, exist_ok=True)

        # Create assets
        (self.component_assets_dir / "index.js").write_text(
            "console.log('test component');"
        )
        (self.component_assets_dir / "index.html").write_text(
            "<div>Test Component</div>"
        )
        (self.component_assets_dir / "styles.css").write_text("div { color: red; }")
        # Create a subdirectory to validate directory path handling
        (self.component_assets_dir / "subdir").mkdir(parents=True, exist_ok=True)

        # Register from a manifest that declares the asset_dir
        manifest = ComponentManifest(
            name="pkg",
            version="0.0.1",
            components=[
                ComponentConfig(name="test_component", asset_dir="test_component")
            ],
        )
        self.component_manager.register_from_manifest(manifest, self.package_root)

    def tearDown(self) -> None:
        super().tearDown()
        self.temp_dir.cleanup()

    def get_app(self) -> tornado.web.Application:
        return tornado.web.Application(
            [
                (
                    r"/_stcore/bidi-components/(.*)",
                    BidiComponentRequestHandler,
                    {"component_manager": self.component_manager},
                )
            ]
        )

    def test_get_component_file(self) -> None:
        # JS should be accessible
        response = self.fetch("/_stcore/bidi-components/pkg.test_component/index.js")
        assert response.code == 200
        assert response.body.decode() == "console.log('test component');"

        # HTML files should be accessible
        response = self.fetch("/_stcore/bidi-components/pkg.test_component/index.html")
        assert response.code == 200
        assert response.body.decode() == "<div>Test Component</div>"

        # CSS should be accessible
        response = self.fetch("/_stcore/bidi-components/pkg.test_component/styles.css")
        assert response.code == 200
        assert response.body.decode() == "div { color: red; }"

    def test_component_not_found(self) -> None:
        response = self.fetch("/_stcore/bidi-components/nonexistent_component/index.js")
        assert response.code == 404

        response = self.fetch(
            "/_stcore/bidi-components/pkg.nonexistent_component/index.js"
        )
        assert response.code == 404

    def test_disallow_path_traversal(self) -> None:
        # Attempt path traversal attack
        response = self.fetch(
            "/_stcore/bidi-components/pkg.test_component/../../../etc/passwd"
        )
        assert response.code == 400

    def test_file_not_found_in_component_dir(self) -> None:
        response = self.fetch(
            "/_stcore/bidi-components/pkg.test_component/nonexistent.js"
        )
        assert response.code == 404

    def test_get_url(self) -> None:
        url = BidiComponentRequestHandler.get_url("pkg.test_component/index.js")
        assert url == "_stcore/bidi-components/pkg.test_component/index.js"

    def test_missing_file_segment_returns_404_not_found(self) -> None:
        """Requesting component without a file should return 404 not found."""
        response = self.fetch("/_stcore/bidi-components/pkg.test_component")
        assert response.code == 404
        assert response.body == b"not found"

    def test_trailing_slash_returns_404_not_found(self) -> None:
        """Requesting component with trailing slash should return 404 not found."""
        response = self.fetch("/_stcore/bidi-components/pkg.test_component/")
        assert response.code == 404
        assert response.body == b"not found"

    def test_directory_path_returns_404_not_found(self) -> None:
        """Requesting a directory within component should return 404 not found."""
        response = self.fetch("/_stcore/bidi-components/pkg.test_component/subdir/")
        assert response.code == 404
        assert response.body == b"not found"

    def test_cors_all_origins_star(self) -> None:
        """When CORS allows all, Access-Control-Allow-Origin should be '*'."""
        with mock.patch(
            "streamlit.web.server.routes.allow_all_cross_origin_requests",
            mock.MagicMock(return_value=True),
        ):
            response = self.fetch(
                "/_stcore/bidi-components/pkg.test_component/index.js"
            )
        assert response.code == 200
        assert response.headers["Access-Control-Allow-Origin"] == "*"

    @mock.patch(
        "streamlit.web.server.routes.allow_all_cross_origin_requests",
        mock.MagicMock(return_value=False),
    )
    @patch_config_options({"server.corsAllowedOrigins": ["http://example.com"]})
    def test_cors_allowlisted_origin_echo(self) -> None:
        """When origin is allowlisted, it should be echoed in the header."""
        response = self.fetch(
            "/_stcore/bidi-components/pkg.test_component/index.js",
            headers={"Origin": "http://example.com"},
        )
        assert response.code == 200
        assert response.headers["Access-Control-Allow-Origin"] == "http://example.com"


class BidiComponentRequestHandlerAssetDirTest(tornado.testing.AsyncHTTPTestCase):
    def setUp(self) -> None:  # type: ignore[override]
        self.manager = BidiComponentManager()
        self.temp_dir = tempfile.TemporaryDirectory()
        super().setUp()

        # Prepare a package with asset_dir and a file to be served
        self.package_root = Path(self.temp_dir.name) / "pkg"
        self.package_root.mkdir(parents=True, exist_ok=True)
        self.assets_dir = self.package_root / "assets"
        self.assets_dir.mkdir(parents=True, exist_ok=True)

        self.js_file_path = self.assets_dir / "bundle.js"
        with open(self.js_file_path, "w", encoding="utf-8") as f:
            f.write("console.log('served from asset_dir');")

        manifest = ComponentManifest(
            name="pkg",
            version="0.0.1",
            components=[ComponentConfig(name="slider", asset_dir="assets")],
        )
        self.manager.register_from_manifest(manifest, self.package_root)

    def tearDown(self) -> None:  # type: ignore[override]
        super().tearDown()
        self.temp_dir.cleanup()

    def get_app(self) -> tornado.web.Application:  # type: ignore[override]
        return tornado.web.Application(
            [
                (
                    r"/_stcore/bidi-components/(.*)",
                    BidiComponentRequestHandler,
                    {"component_manager": self.manager},
                )
            ]
        )

    def test_serves_within_asset_dir(self) -> None:
        """Handler should serve files under manifest-declared asset_dir."""
        resp = self.fetch("/_stcore/bidi-components/pkg.slider/bundle.js")
        assert resp.code == 200
        assert resp.body.decode() == "console.log('served from asset_dir');"

    def test_forbids_traversal_outside_asset_dir(self) -> None:
        """Traversal outside asset_dir is forbidden and returns 400."""
        resp = self.fetch("/_stcore/bidi-components/pkg.slider/../../etc/passwd")
        assert resp.code == 400

    def test_absolute_path_injection_forbidden(self) -> None:
        """Absolute path injection via double-slash should be forbidden (400)."""
        # When the requested filename begins with a slash due to a double-slash in the URL,
        # joining with the component root would otherwise discard the root. We must reject it.
        resp = self.fetch("/_stcore/bidi-components/pkg.slider//etc/passwd")
        assert resp.code == 400

    def test_symlink_escape_outside_asset_dir_forbidden(self) -> None:
        """Symlink in asset_dir pointing outside should be forbidden (400)."""
        # Create a real file outside of the component asset_dir
        outside_file = Path(self.temp_dir.name) / "outside.js"
        outside_file.write_text("console.log('outside');")

        # Create a symlink inside the asset_dir pointing to the outside file
        link_path = self.assets_dir / "link_out.js"
        try:
            # On Windows, creating symlinks may require elevated permissions; skip if unsupported
            os.symlink(outside_file, link_path)
        except (OSError, NotImplementedError):
            self.skipTest("Symlinks not supported in this environment")

        # Attempt to fetch the symlinked file via the handler
        resp = self.fetch("/_stcore/bidi-components/pkg.slider/link_out.js")
        assert resp.code == 400

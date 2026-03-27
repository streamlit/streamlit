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

import mimetypes
import os
import sys
import tempfile
import unittest
from unittest.mock import MagicMock, patch

import tornado.testing
import tornado.web
from parameterized import parameterized

from streamlit.web.server.app_static_file_handler import (
    MAX_APP_STATIC_FILE_SIZE,
    AppStaticFileHandler,
)


@unittest.skipIf(
    "win32" in sys.platform,
    "Most windows installs do not support symlinks except as admin",
)
class AppStaticFileHandlerTest(tornado.testing.AsyncHTTPTestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory(dir=os.getcwd())
        self._tmpfile = tempfile.NamedTemporaryFile(dir=self._tmpdir.name, delete=False)
        self._tmp_js_file = tempfile.NamedTemporaryFile(
            dir=self._tmpdir.name, suffix="script.js", delete=False
        )
        self._tmp_webp_file = tempfile.NamedTemporaryFile(
            dir=self._tmpdir.name, suffix="file.webp", delete=False
        )
        self._tmp_png_image_file = tempfile.NamedTemporaryFile(
            dir=self._tmpdir.name, suffix="image.png", delete=False
        )
        self._tmp_jpeg_image_file = tempfile.NamedTemporaryFile(
            dir=self._tmpdir.name, suffix="image.jpeg", delete=False
        )
        self._tmp_jpg_image_file = tempfile.NamedTemporaryFile(
            dir=self._tmpdir.name, suffix="image.jpg", delete=False
        )
        self._tmp_pdf_document_file = tempfile.NamedTemporaryFile(
            dir=self._tmpdir.name, suffix="document.pdf", delete=False
        )
        self._tmp_webp_image_file = tempfile.NamedTemporaryFile(
            dir=self._tmpdir.name, suffix="image.webp", delete=False
        )
        self._tmp_woff2_file = tempfile.NamedTemporaryFile(
            dir=self._tmpdir.name, suffix="file.woff2", delete=False
        )
        self._tmp_woff_file = tempfile.NamedTemporaryFile(
            dir=self._tmpdir.name, suffix="file.woff", delete=False
        )
        self._tmp_ttf_file = tempfile.NamedTemporaryFile(
            dir=self._tmpdir.name, suffix="file.ttf", delete=False
        )
        self._tmp_otf_file = tempfile.NamedTemporaryFile(
            dir=self._tmpdir.name, suffix="file.otf", delete=False
        )
        self._tmp_xml_file = tempfile.NamedTemporaryFile(
            dir=self._tmpdir.name, suffix="file.xml", delete=False
        )

        self._tmp_json_file = tempfile.NamedTemporaryFile(
            dir=self._tmpdir.name, suffix="file.json", delete=False
        )

        self._tmp_html_file = tempfile.NamedTemporaryFile(
            dir=self._tmpdir.name, suffix="file.html", delete=False
        )

        self._tmp_css_file = tempfile.NamedTemporaryFile(
            dir=self._tmpdir.name, suffix="file.css", delete=False
        )

        self._tmp_dir_inside_static_folder = tempfile.TemporaryDirectory(
            dir=self._tmpdir.name
        )

        self._symlink_outside_directory = "symlink_outside"
        self._symlink_inside_directory = "symlink_inside"

        os.symlink(
            "/", os.path.join(self._tmpdir.name, self._symlink_outside_directory)
        )
        os.symlink(
            self._tmpfile.name,
            os.path.join(self._tmpdir.name, self._symlink_inside_directory),
        )

        self._temp_filenames = {
            "js": os.path.basename(self._tmp_js_file.name),
            "png": os.path.basename(self._tmp_png_image_file.name),
            "jpeg": os.path.basename(self._tmp_jpeg_image_file.name),
            "jpg": os.path.basename(self._tmp_jpg_image_file.name),
            "pdf": os.path.basename(self._tmp_pdf_document_file.name),
            "webp": os.path.basename(self._tmp_webp_image_file.name),
            "xml": os.path.basename(self._tmp_xml_file.name),
            "json": os.path.basename(self._tmp_json_file.name),
            "woff2": os.path.basename(self._tmp_woff2_file.name),
            "woff": os.path.basename(self._tmp_woff_file.name),
            "ttf": os.path.basename(self._tmp_ttf_file.name),
            "otf": os.path.basename(self._tmp_otf_file.name),
            "html": os.path.basename(self._tmp_html_file.name),
            "css": os.path.basename(self._tmp_css_file.name),
        }
        self._filename = os.path.basename(self._tmpfile.name)

        super().setUp()

    def tearDown(self) -> None:
        super().tearDown()
        self._tmpdir.cleanup()

    def get_app(self):
        return tornado.web.Application(
            [
                (
                    r"/app/static/(.*)",
                    AppStaticFileHandler,
                    {"path": self._tmpdir.name},
                )
            ]
        )

    def test_static_files_200(self):
        """Files are served with Content-Type based on extension and nosniff header."""
        # File without extension
        r = self.fetch(f"/app/static/{self._filename}")
        assert r.code == 200
        assert r.headers["X-Content-Type-Options"] == "nosniff"

        # .js file gets javascript content type (text/ or application/ varies by platform)
        r = self.fetch(f"/app/static/{self._temp_filenames['js']}")
        assert r.code == 200
        assert "javascript" in r.headers["Content-Type"]
        assert r.headers["X-Content-Type-Options"] == "nosniff"

        # Symlink inside directory
        r = self.fetch(f"/app/static/{self._symlink_inside_directory}")
        assert r.code == 200
        assert r.headers["X-Content-Type-Options"] == "nosniff"

    @parameterized.expand(
        [
            ("png", "image/png"),
            ("webp", "image/webp"),
            ("jpg", "image/jpeg"),
            ("jpeg", "image/jpeg"),
            ("pdf", "application/pdf"),
            ("xml", "application/xml"),
            ("woff2", "font/woff2"),
            ("woff", "font/woff"),
            ("ttf", "font/ttf"),
            ("otf", "font/otf"),
            ("json", "application/json"),
            ("html", "text/html"),
            ("css", "text/css"),
        ],
    )
    def test_static_files_with_common_extensions_200(
        self, filename: str, expected_content_type: str
    ):
        """Files have the correct Content-Type header based on their extension."""
        response = self.fetch(f"/app/static/{self._temp_filenames[filename]}")

        assert response.code == 200
        assert response.headers["Content-Type"] == expected_content_type
        assert response.headers["X-Content-Type-Options"] == "nosniff"

    @patch("os.path.getsize", MagicMock(return_value=MAX_APP_STATIC_FILE_SIZE + 1))
    def test_big_file_404(self):
        """Files with size greater than MAX_APP_STATIC_FILE_SIZE should return 404."""
        response = self.fetch(f"/app/static/{self._temp_filenames['png']}")
        assert response.code == 404
        assert (
            response.body
            == b"<html><title>404: File is too large</title><body>404: File is too large</body></html>"
        )

    def test_staticfiles_404(self):
        """Non-existent files, files outside static directory and symlinks pointing to
        files outside static directory and directories should return 404.
        """
        responses = [
            # Access to directory without trailing slash
            self.fetch("/app/static"),
            # Access to non-existent file
            self.fetch("/app/static/nonexistent.jpg"),
        ]
        for r in responses:
            assert r.code == 404
            assert (
                r.body == b"<html><title>404: Not Found</title>"
                b"<body>404: Not Found</body></html>"
            )

    def test_staticfiles_403(self):
        """Directories and symlinks pointing outside should return 403.

        This tests Tornado's built-in directory/symlink handling which correctly
        returns 403 for these cases.
        """
        responses = [
            # Access to directory with trailing slash
            self.fetch("/app/static/"),
            # Access to symlink outside static directory
            self.fetch(f"/app/static/{self._symlink_outside_directory}"),
        ]
        for r in responses:
            assert r.code == 403
            assert (
                r.body == b"<html><title>403: Forbidden</title>"
                b"<body>403: Forbidden</body></html>"
            )

    def test_staticfiles_400_for_path_security(self):
        """Path traversal and absolute paths should return 400.

        These are caught by our path security check which runs before Tornado's
        built-in handling.
        """
        responses = [
            # Access to directory inside static folder without trailing slash
            # Note: _tmp_dir_inside_static_folder.name is an absolute path like /tmp/...
            self.fetch(f"/app/static/{self._tmp_dir_inside_static_folder.name}"),
            # Access to directory inside static folder with trailing slash
            self.fetch(f"/app/static/{self._tmp_dir_inside_static_folder.name}/"),
            # Access to file outside static directory (path traversal)
            self.fetch("/app/static/../test_file_outside_directory.py"),
            # Access to file outside static directory with same prefix
            self.fetch(
                f"/app/static/{self._tmpdir.name}_foo/test_file_outside_directory.py"
            ),
        ]
        for r in responses:
            assert r.code == 400
            assert (
                r.body == b"<html><title>400: Bad Request</title>"
                b"<body>400: Bad Request</body></html>"
            )

    def test_mimetype_is_overridden_by_server(self):
        """Test content type of webps are set correctly"""
        mimetypes.add_type("custom/webp", ".webp")

        r = self.fetch(f"/app/static/{self._temp_filenames['webp']}")
        assert r.headers["Content-Type"] == "custom/webp"

        from streamlit.web.bootstrap import _initialize_mimetypes

        _initialize_mimetypes()

        r = self.fetch(f"/app/static/{self._temp_filenames['webp']}")
        assert r.headers["Content-Type"] == "image/webp"

    @parameterized.expand(
        [
            # UNC paths (Windows network shares)
            ("unc_backslash", "\\\\server\\share\\file.txt"),
            ("unc_forward", "//server/share/file.txt"),
            # Windows drive paths
            ("drive_absolute", "C:\\Windows\\file.txt"),
            ("drive_forward", "C:/Windows/file.txt"),
            ("drive_relative", "D:file.txt"),
            # Absolute paths
            ("absolute_forward", "/etc/passwd"),
            ("absolute_backslash", "\\etc\\passwd"),
            # Path traversal
            ("traversal_simple", "../secret.txt"),
            ("traversal_complex", "foo/../../../etc/passwd"),
            # Windows special prefixes
            ("win_extended", "\\\\?\\C:\\file.txt"),
            ("win_device", "\\\\.\\device\\file.txt"),
        ],
    )
    def test_unsafe_path_patterns_rejected(self, name: str, unsafe_path: str) -> None:
        """Unsafe path patterns should be rejected with 400 before filesystem access."""
        response = self.fetch(f"/app/static/{unsafe_path}")
        assert response.code == 400, f"Expected 400 for {name}: {unsafe_path}"

    def test_null_byte_path_rejected(self) -> None:
        """Null byte in path should be rejected with 400."""
        response = self.fetch("/app/static/file.txt\x00.jpg")
        # Tornado rejects null bytes at the HTTP layer with 400
        assert response.code == 400, f"Expected 400, got {response.code}"

    def test_safe_paths_not_rejected_by_security_check(self) -> None:
        """Safe paths should not be rejected by the security check."""
        # This file exists, so it should return 200
        response = self.fetch(f"/app/static/{self._filename}")
        assert response.code == 200

        # Files with dots in the name should be allowed
        response = self.fetch("/app/static/file..name.txt")
        # 404 because file doesn't exist, not 400 (security rejection)
        assert response.code == 404

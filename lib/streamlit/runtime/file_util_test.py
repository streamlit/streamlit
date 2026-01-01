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

import tempfile
import unittest
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from streamlit.runtime.file_util import http_down, local_file_down, s3_file_down


class LocalFileDownTest(unittest.TestCase):
    def test_reads_file_successfully(self):
        with tempfile.NamedTemporaryFile(delete=False, mode="wb") as f:
            f.write(b"test content")
            path = f.name

        try:
            result = local_file_down(path)
            self.assertEqual(result, b"test content")  # noqa: PT009
        finally:
            Path(path).unlink()

    def test_file_not_found_raises_error(self):
        with pytest.raises(FileNotFoundError):
            local_file_down("/nonexistent/path/file.txt")


class S3FileDownTest(unittest.TestCase):
    def test_downloads_from_s3(self):
        import sys
        import types

        mock_boto3 = MagicMock()
        sys.modules["boto3"] = mock_boto3

        botocore_mod = types.ModuleType("botocore")
        botocore_exceptions_mod = types.ModuleType("botocore.exceptions")
        botocore_exceptions_mod.ClientError = Exception
        botocore_mod.exceptions = botocore_exceptions_mod
        sys.modules["botocore"] = botocore_mod
        sys.modules["botocore.exceptions"] = botocore_exceptions_mod

        try:
            mock_client = MagicMock()
            mock_boto3.client.return_value = mock_client
            mock_client.get_object.return_value = {
                "Body": MagicMock(read=lambda: b"s3 data")
            }

            result = s3_file_down("s3://bucket/key.txt")

            self.assertEqual(result, b"s3 data")  # noqa: PT009
            mock_client.get_object.assert_called_once_with(
                Bucket="bucket", Key="key.txt"
            )
        finally:
            sys.modules.pop("boto3", None)
            sys.modules.pop("botocore", None)
            sys.modules.pop("botocore.exceptions", None)

    def test_boto3_not_installed(self):
        import builtins

        orig_import = builtins.__import__

        def fake_import(
            name: str,
            globals: Any = None,
            locals: Any = None,
            fromlist: Any = (),
            level: int = 0,
        ) -> Any:
            if name == "boto3":
                raise ImportError("No module named boto3")
            return orig_import(name, globals, locals, fromlist, level)

        with patch("builtins.__import__", side_effect=fake_import):
            with pytest.raises(ImportError, match="boto3 is required"):
                s3_file_down("s3://bucket/file.txt")

    def test_handles_s3a_scheme(self):
        import sys
        import types

        mock_boto3 = MagicMock()
        sys.modules["boto3"] = mock_boto3

        botocore_mod = types.ModuleType("botocore")
        botocore_exceptions_mod = types.ModuleType("botocore.exceptions")
        botocore_exceptions_mod.ClientError = Exception
        botocore_mod.exceptions = botocore_exceptions_mod
        sys.modules["botocore"] = botocore_mod
        sys.modules["botocore.exceptions"] = botocore_exceptions_mod

        try:
            mock_client = MagicMock()
            mock_boto3.client.return_value = mock_client
            mock_client.get_object.return_value = {
                "Body": MagicMock(read=lambda: b"s3a data")
            }

            result = s3_file_down("s3a://bucket/key.txt")
            self.assertEqual(result, b"s3a data")  # noqa: PT009
        finally:
            sys.modules.pop("boto3", None)
            sys.modules.pop("botocore", None)
            sys.modules.pop("botocore.exceptions", None)

    def test_invalid_s3_uri(self):
        import sys
        import types

        mock_boto3 = MagicMock()
        sys.modules["boto3"] = mock_boto3

        botocore_mod = types.ModuleType("botocore")
        botocore_exceptions_mod = types.ModuleType("botocore.exceptions")
        botocore_exceptions_mod.ClientError = Exception
        botocore_mod.exceptions = botocore_exceptions_mod
        sys.modules["botocore"] = botocore_mod
        sys.modules["botocore.exceptions"] = botocore_exceptions_mod

        try:
            with pytest.raises(ValueError, match="Invalid S3 link"):
                s3_file_down("s3://bucket/")
        finally:
            sys.modules.pop("boto3", None)
            sys.modules.pop("botocore", None)
            sys.modules.pop("botocore.exceptions", None)

    def test_s3_file_not_found(self):
        import sys
        import types

        mock_boto3 = MagicMock()
        sys.modules["boto3"] = mock_boto3

        botocore_mod = types.ModuleType("botocore")
        botocore_exceptions_mod = types.ModuleType("botocore.exceptions")
        botocore_exceptions_mod.ClientError = Exception
        botocore_mod.exceptions = botocore_exceptions_mod
        sys.modules["botocore"] = botocore_mod
        sys.modules["botocore.exceptions"] = botocore_exceptions_mod

        try:
            from botocore.exceptions import ClientError

            mock_client = MagicMock()
            mock_boto3.client.return_value = mock_client
            mock_client.get_object.side_effect = ClientError(
                {"Error": {"Code": "NoSuchKey"}}, "GetObject"
            )

            with pytest.raises(FileNotFoundError, match="S3 file not found"):
                s3_file_down("s3://bucket/missing.txt")
        finally:
            sys.modules.pop("boto3", None)
            sys.modules.pop("botocore", None)
            sys.modules.pop("botocore.exceptions", None)


class HttpDownTest(unittest.TestCase):
    @patch("urllib.request.urlopen")
    def test_downloads_from_http(self, mock_urlopen: MagicMock):
        mock_response = MagicMock()
        mock_response.read.return_value = b"http data"
        mock_response.__enter__.return_value = mock_response
        mock_response.__exit__ = MagicMock()
        mock_urlopen.return_value = mock_response

        result = http_down("http://example.com/file.txt")

        self.assertEqual(result, b"http data")  # noqa: PT009
        mock_urlopen.assert_called_once_with("http://example.com/file.txt", timeout=30)

    @patch("urllib.request.urlopen")
    def test_downloads_from_https(self, mock_urlopen: MagicMock):
        mock_response = MagicMock()
        mock_response.read.return_value = b"https data"
        mock_response.__enter__.return_value = mock_response
        mock_response.__exit__ = MagicMock()
        mock_urlopen.return_value = mock_response

        result = http_down("https://example.com/file.txt")
        self.assertEqual(result, b"https data")  # noqa: PT009

    def test_invalid_url_scheme(self):
        with pytest.raises(ValueError, match="Invalid url scheme: ftp"):
            http_down("ftp://example.com/file.txt")

    @patch("urllib.request.urlopen")
    def test_network_errors_propagate(self, mock_urlopen: MagicMock):
        from urllib.error import URLError

        mock_urlopen.side_effect = URLError("Connection failed")

        with pytest.raises(URLError):
            http_down("https://example.com/file.txt")

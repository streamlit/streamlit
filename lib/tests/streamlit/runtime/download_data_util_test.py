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

"""Unit tests for convert_data_to_bytes_and_infer_mime"""

from __future__ import annotations

import io
import os
import tempfile
import unittest

import pytest

from streamlit.runtime.download_data_util import convert_data_to_bytes_and_infer_mime


class ConvertDataToBytesAndInferMimeTest(unittest.TestCase):
    @unittest.mock.patch("streamlit.runtime.download_data_util.os.path.isfile")
    @unittest.mock.patch(
        "streamlit.runtime.download_data_util.file_util.local_file_down"
    )
    def test_local_file_downloads_and_infers_mime_type(
        self, mock_local_file_down, mock_isfile
    ):
        """Local file path is downloaded and MIME type is inferred from filename."""
        mock_isfile.return_value = True  # Pretend the file exists
        mock_local_file_down.return_value = b"file content"
        data_as_bytes, mime = convert_data_to_bytes_and_infer_mime(
            "/path/to/file.txt", unsupported_error=RuntimeError("unsupported")
        )
        assert data_as_bytes == b"file content"
        assert mime == "text/plain"
        mock_local_file_down.assert_called_once_with("/path/to/file.txt")

    @unittest.mock.patch("streamlit.runtime.download_data_util.os.path.isfile")
    @unittest.mock.patch(
        "streamlit.runtime.download_data_util.file_util.local_file_down"
    )
    def test_local_file_unknown_extension_defaults_to_octet_stream(
        self, mock_local_file_down, mock_isfile
    ):
        """Local file with unknown extension defaults to application/octet-stream."""
        mock_isfile.return_value = True  # Pretend the file exists
        mock_local_file_down.return_value = b"data"
        data_as_bytes, mime = convert_data_to_bytes_and_infer_mime(
            "/path/to/file.unknown", unsupported_error=RuntimeError("unsupported")
        )
        assert data_as_bytes == b"data"
        assert mime == "application/octet-stream"

    @unittest.mock.patch("streamlit.runtime.download_data_util.file_util.s3_file_down")
    def test_s3_file_downloads_and_infers_mime_type(self, mock_s3_file_down):
        """S3 file URL is downloaded and MIME type is inferred from filename."""
        mock_s3_file_down.return_value = b"s3 content"
        data_as_bytes, mime = convert_data_to_bytes_and_infer_mime(
            "s3://bucket/folder/document.pdf",
            unsupported_error=RuntimeError("unsupported"),
        )
        assert data_as_bytes == b"s3 content"
        assert mime == "application/pdf"
        mock_s3_file_down.assert_called_once_with("s3://bucket/folder/document.pdf")

    @unittest.mock.patch("streamlit.runtime.download_data_util.file_util.s3_file_down")
    def test_s3a_file_downloads_and_infers_mime_type(self, mock_s3_file_down):
        """S3a file URL is downloaded and MIME type is inferred from filename."""
        mock_s3_file_down.return_value = b"s3a content"
        data_as_bytes, mime = convert_data_to_bytes_and_infer_mime(
            "s3a://bucket/file.csv", unsupported_error=RuntimeError("unsupported")
        )
        assert data_as_bytes == b"s3a content"
        assert mime == "text/csv"
        mock_s3_file_down.assert_called_once_with("s3a://bucket/file.csv")

    @unittest.mock.patch("streamlit.runtime.download_data_util.file_util.s3_file_down")
    def test_s3_url_with_query_params_strips_params_for_mime_inference(
        self, mock_s3_file_down
    ):
        """S3 URL query parameters are stripped before MIME inference."""
        mock_s3_file_down.return_value = b"data"
        data_as_bytes, mime = convert_data_to_bytes_and_infer_mime(
            "s3://bucket/image.png?versionId=abc123",
            unsupported_error=RuntimeError("unsupported"),
        )
        assert data_as_bytes == b"data"
        assert mime == "image/png"

    @unittest.mock.patch("streamlit.runtime.download_data_util.file_util.http_down")
    def test_http_file_downloads_and_infers_mime_type(self, mock_http_down):
        """HTTP URL is downloaded and MIME type is inferred from filename."""
        mock_http_down.return_value = b"http content"
        data_as_bytes, mime = convert_data_to_bytes_and_infer_mime(
            "http://example.com/file.json",
            unsupported_error=RuntimeError("unsupported"),
        )
        assert data_as_bytes == b"http content"
        assert mime == "application/json"
        mock_http_down.assert_called_once_with("http://example.com/file.json")

    @unittest.mock.patch("streamlit.runtime.download_data_util.file_util.http_down")
    def test_https_file_downloads_and_infers_mime_type(self, mock_http_down):
        """HTTPS URL is downloaded and MIME type is inferred from filename."""
        mock_http_down.return_value = b"https content"
        data_as_bytes, mime = convert_data_to_bytes_and_infer_mime(
            "https://example.com/sheet.xlsx",
            unsupported_error=RuntimeError("unsupported"),
        )
        assert data_as_bytes == b"https content"
        assert (
            mime == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        mock_http_down.assert_called_once_with("https://example.com/sheet.xlsx")

    @unittest.mock.patch("streamlit.runtime.download_data_util.file_util.http_down")
    def test_http_url_with_query_params_strips_params_for_mime_inference(
        self, mock_http_down
    ):
        """HTTP URL query parameters are stripped before MIME inference."""
        mock_http_down.return_value = b"data"
        data_as_bytes, mime = convert_data_to_bytes_and_infer_mime(
            "https://example.com/file.zip?token=xyz",
            unsupported_error=RuntimeError("unsupported"),
        )
        assert data_as_bytes == b"data"
        assert mime == "application/zip"

    @unittest.mock.patch("streamlit.runtime.download_data_util.os.path.isfile")
    @unittest.mock.patch(
        "streamlit.runtime.download_data_util.file_util.local_file_down"
    )
    def test_local_file_down_error_propagates(self, mock_local_file_down, mock_isfile):
        """Error from local_file_down is propagated."""
        mock_isfile.return_value = True  # Pretend the file exists
        mock_local_file_down.side_effect = OSError("Download failed")
        with pytest.raises(IOError, match="Download failed"):
            convert_data_to_bytes_and_infer_mime(
                "/path/to/file.txt", unsupported_error=RuntimeError("unsupported")
            )

    @unittest.mock.patch("streamlit.runtime.download_data_util.file_util.s3_file_down")
    def test_s3_file_down_error_propagates(self, mock_s3_file_down):
        """Error from s3_file_down is propagated."""
        mock_s3_file_down.side_effect = RuntimeError("S3 access denied")
        with pytest.raises(RuntimeError, match="S3 access denied"):
            convert_data_to_bytes_and_infer_mime(
                "s3://bucket/file.txt", unsupported_error=RuntimeError("unsupported")
            )

    @unittest.mock.patch("streamlit.runtime.download_data_util.file_util.http_down")
    def test_http_down_error_propagates(self, mock_http_down):
        """Error from http_down is propagated."""
        mock_http_down.side_effect = ConnectionError("Network timeout")
        with pytest.raises(ConnectionError, match="Network timeout"):
            convert_data_to_bytes_and_infer_mime(
                "https://example.com/file.txt",
                unsupported_error=RuntimeError("unsupported"),
            )

    def test_text_io_wrapper_is_converted_to_bytes_and_text_plain(self):
        """io.TextIOWrapper is read fully and inferred as text/plain."""
        content = "Line 1\nLine 2"
        fd, path = tempfile.mkstemp(text=True)
        os.close(fd)
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            with open(path, encoding="utf-8") as text_io:
                data_as_bytes, mime = convert_data_to_bytes_and_infer_mime(
                    text_io, unsupported_error=RuntimeError("unsupported")
                )
            assert data_as_bytes == content.encode("utf-8")
            assert mime == "text/plain"
        finally:
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass

    def test_bytes_passthrough_and_octet_stream(self):
        """Bytes are returned as-is, with application/octet-stream."""
        payload = b"\x00\x01\x02"
        data_as_bytes, mime = convert_data_to_bytes_and_infer_mime(
            payload, unsupported_error=RuntimeError("unsupported")
        )
        assert data_as_bytes == payload
        assert mime == "application/octet-stream"

    def test_bytesio_rewinds_and_reads_all(self):
        """BytesIO is rewound and read fully."""
        payload = b"abcdef"
        bio = io.BytesIO(payload)
        bio.seek(3)  # simulate prior read
        data_as_bytes, mime = convert_data_to_bytes_and_infer_mime(
            bio, unsupported_error=RuntimeError("unsupported")
        )
        assert data_as_bytes == payload
        assert mime == "application/octet-stream"

    def test_buffered_reader_rewinds_and_reads_all(self):
        """BufferedReader (rb open) is rewound and read fully."""
        fd, path = tempfile.mkstemp()
        os.close(fd)
        payload = b"\x10\x20\x30\x40"
        try:
            with open(path, "wb") as f:
                f.write(payload)
            with open(path, "rb") as f:
                f.read(2)  # simulate prior read
                data_as_bytes, mime = convert_data_to_bytes_and_infer_mime(
                    f, unsupported_error=RuntimeError("unsupported")
                )
            assert data_as_bytes == payload
            assert mime == "application/octet-stream"
        finally:
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass

    def test_raw_io_base_fileio_rewinds_and_reads_all(self):
        """FileIO (RawIOBase) is rewound and read fully."""
        fd, path = tempfile.mkstemp()
        os.close(fd)
        payload = b"\xaa\xbb\xcc"
        try:
            with open(path, "wb") as f:
                f.write(payload)
            with io.FileIO(path, "rb") as raw:  # type: ignore[arg-type]
                raw.read(1)  # simulate prior read
                data_as_bytes, mime = convert_data_to_bytes_and_infer_mime(
                    raw, unsupported_error=RuntimeError("unsupported")
                )
            assert data_as_bytes == payload
            assert mime == "application/octet-stream"
        finally:
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass

    def test_raw_io_base_empty_file_returns_empty_bytes(self):
        """Empty RawIOBase should return empty bytes and application/octet-stream."""
        fd, path = tempfile.mkstemp()
        os.close(fd)
        try:
            # Ensure empty file
            with io.FileIO(path, "rb") as raw:  # type: ignore[arg-type]
                data_as_bytes, mime = convert_data_to_bytes_and_infer_mime(
                    raw, unsupported_error=RuntimeError("unsupported")
                )
            assert data_as_bytes == b""
            assert mime == "application/octet-stream"
        finally:
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass

    def test_unsupported_type_raises_given_exception(self):
        """Unsupported types raise the provided exception."""
        with pytest.raises(RuntimeError, match="custom unsupported"):
            convert_data_to_bytes_and_infer_mime(
                ["not", "supported"],
                unsupported_error=RuntimeError("custom unsupported"),
            )

    def test_supported_type_ignores_unsupported_error_and_returns_normally(self):
        """Supported types do not raise, even if unsupported_error is provided."""
        data_as_bytes, mime = convert_data_to_bytes_and_infer_mime(
            b"ok", unsupported_error=RuntimeError("should not raise")
        )
        assert data_as_bytes == b"ok"
        assert mime == "application/octet-stream"

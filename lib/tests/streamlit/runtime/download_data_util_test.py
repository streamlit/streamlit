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
    def test_str_is_converted_to_bytes_and_text_plain(self):
        """Strings are encoded to bytes and inferred as text/plain."""
        data_as_bytes, mime = convert_data_to_bytes_and_infer_mime(
            "hello", unsupported_error=RuntimeError("unsupported")
        )
        assert data_as_bytes == b"hello"
        assert mime == "text/plain"

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

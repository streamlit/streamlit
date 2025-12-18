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

import io
import mimetypes
import os
from pathlib import Path

from streamlit.runtime import file_util


def convert_data_to_bytes_and_infer_mime(
    data: object, unsupported_error: Exception
) -> tuple[bytes, str]:
    # Convert data to bytes and infer mimetype if needed
    data_as_bytes: bytes
    inferred_mime_type: str
    if isinstance(data, Path):
        data_as_bytes = file_util.local_file_down(str(data))
        inferred_mime_type = (
            mimetypes.guess_type(str(data))[0] or "application/octet-stream"
        )
    elif isinstance(data, str):
        if data.startswith(("s3://", "s3a://")):
            data_as_bytes = file_util.s3_file_down(data)
            filename = data.split("/")[-1].split("?")[0]
            inferred_mime_type = (
                mimetypes.guess_type(filename)[0] or "application/octet-stream"
            )
        elif data.startswith(("http://", "https://")):
            data_as_bytes = file_util.http_down(data)
            filename = data.split("/")[-1].split("?")[0]
            inferred_mime_type = (
                mimetypes.guess_type(filename)[0] or "application/octet-stream"
            )
        elif os.path.isfile(data):  # ← YOU'RE MISSING THIS CHECK!
            data_as_bytes = file_util.local_file_down(data)
            inferred_mime_type = (
                mimetypes.guess_type(data)[0] or "application/octet-stream"
            )
        else:
            data_as_bytes = data.encode()
            inferred_mime_type = "text/plain"
    elif isinstance(data, io.TextIOWrapper):
        string_data = data.read()
        data_as_bytes = string_data.encode()
        inferred_mime_type = "text/plain"
    # Assume bytes; try methods until we run out.
    elif isinstance(data, bytes):
        data_as_bytes = data
        inferred_mime_type = "application/octet-stream"
    elif isinstance(data, io.BytesIO):
        data.seek(0)
        data_as_bytes = data.getvalue()
        inferred_mime_type = "application/octet-stream"
    elif isinstance(data, io.BufferedReader):
        data.seek(0)
        data_as_bytes = data.read()
        inferred_mime_type = "application/octet-stream"
    elif isinstance(data, io.RawIOBase):
        data.seek(0)
        data_as_bytes = data.read() or b""
        inferred_mime_type = "application/octet-stream"
    else:
        raise unsupported_error

    return data_as_bytes, inferred_mime_type

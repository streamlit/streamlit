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
import os
import re
from pathlib import Path

from streamlit import runtime
from streamlit.runtime import caching
from streamlit.util import calc_md5

# Regular expression to match the SRT timestamp format
# It matches the
# "hours:minutes:seconds,milliseconds --> hours:minutes:seconds,milliseconds" format
SRT_VALIDATION_REGEX = r"\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}"

SRT_CONVERSION_REGEX = r"(\d{2}:\d{2}:\d{2}),(\d{3})"

SUBTITLE_ALLOWED_FORMATS = (".srt", ".vtt")


def _is_srt(stream: str | io.BytesIO | bytes) -> bool:
    # Handle raw bytes
    if isinstance(stream, bytes):
        stream = io.BytesIO(stream)

    # Convert str to io.BytesIO if 'stream' is a string
    if isinstance(stream, str):
        stream = io.BytesIO(stream.encode("utf-8"))

    # Set the stream position to the beginning in case it's been moved
    stream.seek(0)

    # Read enough bytes to reliably check for SRT patterns
    # This might be adjusted, but 33 bytes should be enough to read the first numeric
    # line, the full timestamp line, and a bit of the next line
    header = stream.read(33)

    try:
        header_str = header.decode("utf-8").strip()  # Decode and strip whitespace
    except UnicodeDecodeError:
        # If it's not valid utf-8, it's probably not a valid SRT file
        return False

    # Split the header into lines and process them
    lines = header_str.split("\n")

    # Check for the pattern of an SRT file: digit(s), newline, timestamp
    if len(lines) >= 2 and lines[0].isdigit():
        match = re.search(SRT_VALIDATION_REGEX, lines[1])
        if match:
            return True

    return False


def _srt_to_vtt(srt_data: str | bytes) -> bytes:
    """
    Convert subtitles from SubRip (.srt) format to WebVTT (.vtt) format.
    This function accepts the content of the .srt file either as a string
    or as a BytesIO stream.

    Parameters
    ----------
    srt_data : str or bytes
        The content of the .srt file as a string or a bytes stream.

    Returns
    -------
    bytes
        The content converted into .vtt format.
    """

    # If the input is a bytes stream, convert it to a string
    if isinstance(srt_data, bytes):
        # Decode the bytes to a UTF-8 string
        try:
            srt_data = srt_data.decode("utf-8")
        except UnicodeDecodeError as e:
            raise ValueError("Could not decode the input stream as UTF-8.") from e
    if not isinstance(srt_data, str):
        # If it's not a string by this point, something is wrong.
        raise TypeError(
            f"Input must be a string or a bytes stream, not {type(srt_data)}."
        )

    # Replace SubRip timing with WebVTT timing
    vtt_data = re.sub(SRT_CONVERSION_REGEX, r"\1.\2", srt_data)

    # Add WebVTT file header
    vtt_content = "WEBVTT\n\n" + vtt_data
    # Convert the vtt content to bytes
    return vtt_content.strip().encode("utf-8")


def _handle_string_or_path_data(data_or_path: str | Path) -> bytes:
    """Handles string data, either as a file path or raw content."""
    if os.path.isfile(data_or_path):
        path = Path(data_or_path)
        file_extension = path.suffix.lower()

        if file_extension not in SUBTITLE_ALLOWED_FORMATS:
            raise ValueError(
                f"Incorrect subtitle format {file_extension}. Subtitles must be in "
                f"one of the following formats: {', '.join(SUBTITLE_ALLOWED_FORMATS)}"
            )
        with open(data_or_path, "rb") as file:
            content = file.read()
        return _srt_to_vtt(content) if file_extension == ".srt" else content
    if isinstance(data_or_path, Path):
        raise ValueError(f"File {data_or_path} does not exist.")  # noqa: TRY004

    content_string = data_or_path.strip()

    if content_string.startswith("WEBVTT") or content_string == "":
        return content_string.encode("utf-8")
    if _is_srt(content_string):
        return _srt_to_vtt(content_string)
    raise ValueError("The provided string neither matches valid VTT nor SRT format.")


def _handle_stream_data(stream: io.BytesIO) -> bytes:
    """Handles io.BytesIO data, converting SRT to VTT content if needed."""
    stream.seek(0)
    stream_data = stream.getvalue()
    return _srt_to_vtt(stream_data) if _is_srt(stream) else stream_data


def _handle_bytes_data(data: bytes) -> bytes:
    """Handles io.BytesIO data, converting SRT to VTT content if needed."""
    return _srt_to_vtt(data) if _is_srt(data) else data


def process_subtitle_data(
    coordinates: str,
    data: str | bytes | Path | io.BytesIO,
    label: str,
) -> str:
    # Determine the type of data and process accordingly
    if isinstance(data, (str, Path)):
        subtitle_data = _handle_string_or_path_data(data)
    elif isinstance(data, io.BytesIO):
        subtitle_data = _handle_stream_data(data)
    elif isinstance(data, bytes):
        subtitle_data = _handle_bytes_data(data)
    else:
        raise TypeError(f"Invalid binary data format for subtitle: {type(data)}.")

    if runtime.exists():
        filename = calc_md5(label.encode())
        # Save the processed data and return the file URL
        file_url = runtime.get_instance().media_file_mgr.add(
            path_or_data=subtitle_data,
            mimetype="text/vtt",
            coordinates=coordinates,
            file_name=f"{filename}.vtt",
        )
        caching.save_media_data(subtitle_data, "text/vtt", coordinates)
        return file_url
    # When running in "raw mode", we can't access the MediaFileManager.
    return ""

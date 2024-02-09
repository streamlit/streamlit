# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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


def _is_srt(stream: str | io.BytesIO) -> bool:
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

    # Regular expression to match the SRT timestamp format
    # It matches the
    # "hours:minutes:seconds,milliseconds --> hours:minutes:seconds,milliseconds" format
    timestamp_regex = re.compile(r"\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}")

    # Split the header into lines and process them
    lines = header_str.split("\n")

    # Check for the pattern of an SRT file: digit(s), newline, timestamp
    if len(lines) >= 2 and lines[0].isdigit():
        match = timestamp_regex.search(lines[1])
        if match:
            return True

    return False


def srt_to_vtt(srt_data: str | bytes) -> bytes:
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
    vtt_data = re.sub(r"(\d{2}:\d{2}:\d{2}),(\d{3})", r"\1.\2", srt_data)

    # Add WebVTT file header
    vtt_content = "WEBVTT\n\n" + vtt_data
    # Convert the vtt content to bytes
    vtt_content = vtt_content.strip().encode("utf-8")

    return vtt_content


def process_subtitle_data(
    coordinates: str,
    data: str | bytes | io.BytesIO,
) -> str:
    allowed_formats = {".srt", ".vtt"}

    def handle_string_data(data_str: str) -> bytes:
        """Handles string data, either as a file path or raw content."""
        if os.path.isfile(data_str):
            path = Path(data_str)
            file_extension = path.suffix.lower()

            if file_extension not in allowed_formats:
                # TODO [kajarenc]: maybe raise a StreamlitAPIException instead
                raise ValueError(
                    f"Incorrect subtitle format {file_extension}. Subtitles must be in "
                    f"one of the following formats: {', '.join(allowed_formats)}"
                )
            with open(data_str, "rb") as file:
                content = file.read()
            return srt_to_vtt(content) if file_extension == ".srt" else content

        content_string = data_str.strip()

        if content_string.startswith("WEBVTT"):
            return content_string.encode("utf-8")
        elif _is_srt(content_string):
            return srt_to_vtt(content_string)
        raise ValueError(
            "The provided string neither matches valid VTT nor SRT format."
        )

    def handle_stream_data(stream: io.BytesIO) -> bytes:
        """Handles io.BytesIO data, assuming it's SRT content."""
        stream.seek(0)
        stream_data = stream.getvalue()
        return srt_to_vtt(stream_data) if _is_srt(stream) else stream_data

    # Determine the type of data and process accordingly
    if isinstance(data, str):
        subtitle_data = handle_string_data(data)
    elif isinstance(data, bytes):
        subtitle_data = data  # Assume bytes are already in the correct format.
    elif isinstance(data, io.BytesIO):
        subtitle_data = handle_stream_data(data)
    else:
        raise RuntimeError(f"Invalid binary data format for subtitle: {type(data)}.")

    if runtime.exists():
        # Save the processed data and return the file URL
        file_url = runtime.get_instance().media_file_mgr.add(
            path_or_data=subtitle_data,
            mimetype="text/vtt",
            coordinates=coordinates,
            file_name=f"{coordinates}.vtt",
        )
        caching.save_media_data(subtitle_data, "text/vtt", coordinates)

        return file_url
    else:
        # When running in "raw mode", we can't access the MediaFileManager.
        return ""

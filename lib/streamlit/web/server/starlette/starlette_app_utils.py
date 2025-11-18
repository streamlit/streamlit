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

"""Utility functions for the Starlette server implementation."""

from __future__ import annotations

import binascii
import os
import time
from typing import Any

from tornado.util import _websocket_mask as _tornado_websocket_mask
from tornado.web import decode_signed_value as _tornado_decode_signed_value


def parse_range_header(range_header: str, total_size: int) -> tuple[int, int]:
    """Parse the Range header and return the start and end byte positions.

    Parameters
    ----------
    range_header : str
        The value of the Range header (e.g. "bytes=0-1023").
    total_size : int
        The total size of the resource in bytes.

    Returns
    -------
    tuple[int, int]
        A tuple containing (start, end) byte positions.
    """
    if total_size <= 0:
        raise ValueError("empty content")

    units, sep, range_spec = range_header.partition("=")
    if units.strip().lower() != "bytes" or sep == "" or "," in range_spec:
        raise ValueError("invalid range")

    range_spec = range_spec.strip()
    if range_spec.startswith("-"):
        try:
            suffix = int(range_spec[1:])
        except ValueError:
            raise ValueError("invalid suffix range") from None
        if suffix <= 0:
            raise ValueError("invalid suffix range")
        if suffix >= total_size:
            return 0, total_size - 1
        return total_size - suffix, total_size - 1

    start_str, sep, end_str = range_spec.partition("-")
    if not start_str:
        raise ValueError("missing range start")

    start = int(start_str)
    if start < 0 or start >= total_size:
        raise ValueError("start out of range")

    if sep == "" or not end_str:
        end = total_size - 1
    else:
        end = int(end_str)
        if end < start:
            raise ValueError("end before start")
        end = min(end, total_size - 1)

    return start, end


def websocket_mask(mask: bytes, data: bytes) -> bytes:
    """Mask or unmask data for WebSocket transmission.

    This is a bidirectional operation (XOR).
    """
    # TODO(lukasmasuch): Replace with implementation that doesn't require Tornado.
    return _tornado_websocket_mask(mask, data)


def decode_signed_value(
    secret: str,
    name: str,
    value: str | bytes,
    max_age_days: float = 31,
    clock: Any = None,
    min_version: int | None = None,
) -> bytes | None:
    """Decode a signed cookie value.

    Currently wraps Tornado's implementation for compatibility.
    """
    # TODO(lukasmasuch): Replace with implementation that doesn't require Tornado.
    return _tornado_decode_signed_value(
        secret,
        name,
        value,
        max_age_days=max_age_days,
        clock=clock,
        min_version=min_version,
    )


def generate_xsrf_token_string(
    token_bytes: bytes | None = None, timestamp: int | None = None
) -> str:
    """Generate a version 2 XSRF token string compatible with Tornado.

    Format: 2|mask|masked_token|timestamp
    """
    if token_bytes is None:
        token_bytes = os.urandom(16)
    if timestamp is None:
        timestamp = int(time.time())

    mask = os.urandom(4)
    masked_token = websocket_mask(mask, token_bytes)
    return "2|{}|{}|{}".format(
        binascii.b2a_hex(mask).decode("ascii"),
        binascii.b2a_hex(masked_token).decode("ascii"),
        timestamp,
    )


def decode_xsrf_token_string(
    cookie_value: str,
) -> tuple[bytes | None, int | None]:
    """Decode a Tornado XSRF token string.

    Supports version 2 (masked) and version 1 (unmasked) tokens.
    """
    value = cookie_value.strip("\"'")
    try:
        if value.startswith("2|"):
            _, mask_hex, masked_hex, timestamp_str = value.split("|")
            mask = binascii.a2b_hex(mask_hex.encode("ascii"))
            masked = binascii.a2b_hex(masked_hex.encode("ascii"))
            token = websocket_mask(mask, masked)
            return token, int(timestamp_str)

        token = binascii.a2b_hex(value.encode("ascii"))
        return token, int(time.time())
    except (binascii.Error, ValueError):
        return None, None

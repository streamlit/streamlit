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

"""Utility functions for the Starlette server implementation."""

from __future__ import annotations

import binascii
import os
import time


def parse_range_header(range_header: str, total_size: int) -> tuple[int, int]:
    """Parse the Range header and return the start and end byte positions.

    This is used for serving media files with range requests.

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
    """Mask or unmask data for WebSocket transmission per RFC 6455.

    Each byte of data is XORed with mask[i % 4]. This operation is
    bidirectional - applying it twice with the same mask returns the
    original data.

    Parameters
    ----------
    mask : bytes
        A 4-byte masking key.
    data : bytes
        The data to mask or unmask.

    Returns
    -------
    bytes
        The masked/unmasked data.
    """
    if len(mask) != 4:
        raise ValueError("mask must be 4 bytes")

    result = bytearray(len(data))
    for i, byte in enumerate(data):
        result[i] = byte ^ mask[i % 4]
    return bytes(result)


def create_signed_value(
    secret: str,
    name: str,
    value: str | bytes,
) -> bytes:
    """Create a signed cookie value using itsdangerous.

    Note: This uses itsdangerous for signing, which is NOT compatible with
    Tornado's secure cookie format. Cookies signed by this function cannot
    be read by Tornado's get_signed_cookie/get_secure_cookie, and vice versa.
    Switching between Tornado and Starlette backends will invalidate existing
    auth cookies (_streamlit_user), requiring users to re-authenticate.
    This is expected behavior when switching between Tornado and Starlette backends.

    Parameters
    ----------
    secret
        The secret key used for signing.
    name
        The cookie name (used as salt for additional security).
    value
        The value to sign.

    Returns
    -------
    bytes
        The signed value as bytes.
    """
    from itsdangerous import URLSafeTimedSerializer

    serializer = URLSafeTimedSerializer(secret, salt=name)
    if isinstance(value, bytes):
        value = value.decode("utf-8")
    return serializer.dumps(value).encode("utf-8")


def decode_signed_value(
    secret: str,
    name: str,
    value: str | bytes,
    max_age_days: float = 31,
) -> bytes | None:
    """Decode a signed cookie value using itsdangerous.

    Parameters
    ----------
    secret
        The secret key used for signing.
    name
        The cookie name (used as salt for additional security).
    value
        The signed value to decode.
    max_age_days
        Maximum age of the cookie in days (default: 31).

    Returns
    -------
    bytes | None
        The decoded value as bytes, or None if invalid/expired.
    """
    from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

    if not value:
        return None

    try:
        if isinstance(value, bytes):
            value = value.decode("utf-8")

        serializer = URLSafeTimedSerializer(secret, salt=name)
        decoded = serializer.loads(value, max_age=int(max_age_days * 86400))
        if isinstance(decoded, str):
            return decoded.encode("utf-8")
        if isinstance(decoded, bytes):
            return decoded
        # Unexpected type from deserializer — treat as invalid
        return None
    except (BadSignature, SignatureExpired, UnicodeDecodeError):
        return None


def generate_xsrf_token_string(
    token_bytes: bytes | None = None, timestamp: int | None = None
) -> str:
    """Generate a version 2 XSRF token string compatible with Tornado.

    Format: 2|mask|masked_token|timestamp

    Parameters
    ----------
    token_bytes
        The raw token bytes to encode. If None, generates 16 random bytes.
    timestamp
        The Unix timestamp to include in the token. If None, uses current time.

    Returns
    -------
    str
        The encoded XSRF token string in version 2 format.
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

    Parameters
    ----------
    cookie_value
        The XSRF token cookie value to decode.

    Returns
    -------
    tuple[bytes | None, int | None]
        A tuple of (token_bytes, timestamp). Both values are None if decoding fails.
    """
    if not cookie_value:
        return None, None

    value = cookie_value.strip("\"'")
    if not value:
        return None, None

    try:
        # V2 tokens:
        if value.startswith("2|"):
            _, mask_hex, masked_hex, timestamp_str = value.split("|")
            mask = binascii.a2b_hex(mask_hex.encode("ascii"))
            masked = binascii.a2b_hex(masked_hex.encode("ascii"))
            token = websocket_mask(mask, masked)
            return token, int(timestamp_str)

        # V1 tokens:
        # TODO(lukasmasuch): This is likely unused in Streamlit since only V2 tokens
        # are used. We might be able to just remove this part.
        token = binascii.a2b_hex(value.encode("ascii"))
        if not token:
            return None, None
        # V1 tokens don't have an embedded timestamp, so we use current time
        # as a placeholder (matches Tornado's behavior). This timestamp is
        # informational only and not used for token validation.
        return token, int(time.time())
    except (binascii.Error, ValueError):
        return None, None


def generate_random_hex_string(num_bytes: int = 32) -> str:
    """Generate a cryptographically secure random hex string.

    Parameters
    ----------
    num_bytes
        Number of random bytes to generate (default: 32).
        The resulting hex string will be twice this length.

    Returns
    -------
    str
        A hex-encoded random string.
    """
    return binascii.b2a_hex(os.urandom(num_bytes)).decode("ascii")


def validate_xsrf_token(supplied_token: str | None, xsrf_cookie: str | None) -> bool:
    """Validate the XSRF token from the WebSocket subprotocol against the cookie.

    This mirrors Tornado's XSRF validation logic to ensure the frontend can share
    XSRF logic between WebSocket handshake and HTTP uploads regardless of backend.
    """

    if not supplied_token or not xsrf_cookie:
        return False

    # Decode the supplied token from the subprotocol
    supplied_token_bytes, _ = decode_xsrf_token_string(supplied_token)
    # Decode the expected token from the cookie
    expected_token_bytes, _ = decode_xsrf_token_string(xsrf_cookie)

    if not supplied_token_bytes or not expected_token_bytes:
        return False

    import hmac

    return hmac.compare_digest(supplied_token_bytes, expected_token_bytes)

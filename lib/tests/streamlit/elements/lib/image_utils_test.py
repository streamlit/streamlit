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

"""Unit tests for streamlit/elements/lib/image_utils.py."""

from __future__ import annotations

from unittest.mock import MagicMock

import numpy as np
import pytest

from streamlit.elements.lib.image_utils import (
    _clip_image,
    _validate_image_format_string,
    _verify_np_shape,
)
from streamlit.errors import StreamlitAPIException


@pytest.mark.parametrize(
    ("format_str", "expected"),
    [
        ("JPEG", "JPEG"),
        ("JPG", "JPEG"),  # JPG is converted to JPEG
        ("PNG", "PNG"),
    ],
)
def test_validate_image_format_string_explicit_format(
    format_str: str, expected: str
) -> None:
    """Test explicit format strings are returned correctly."""
    result = _validate_image_format_string(b"dummy", format_str)
    assert result == expected


@pytest.mark.parametrize(
    ("pil_format", "pil_mode", "expected"),
    [
        ("GIF", "P", "GIF"),  # GIF images stay as GIF
        ("PNG", "RGBA", "PNG"),  # RGBA images stay as PNG
        ("PNG", "RGB", "JPEG"),  # RGB images convert to JPEG
    ],
)
def test_validate_image_format_string_auto_detection(
    pil_format: str, pil_mode: str, expected: str
) -> None:
    """Test auto format detection based on PIL image properties."""
    mock_image = MagicMock()
    mock_image.format = pil_format
    mock_image.mode = pil_mode

    result = _validate_image_format_string(mock_image, "auto")
    assert result == expected


@pytest.mark.parametrize(
    ("shape", "expected_shape"),
    [
        ((100, 100), (100, 100)),  # 2D grayscale
        ((100, 100, 3), (100, 100, 3)),  # RGB
        ((100, 100, 4), (100, 100, 4)),  # RGBA
        ((100, 100, 1), (100, 100)),  # Single channel converted to 2D
    ],
)
def test_verify_np_shape_valid(
    shape: tuple[int, ...], expected_shape: tuple[int, ...]
) -> None:
    """Test that valid array shapes are accepted."""
    array = np.zeros(shape)
    result = _verify_np_shape(array)
    assert result.shape == expected_shape


@pytest.mark.parametrize(
    ("shape", "error_substr"),
    [
        ((100,), "length 2 or 3"),  # 1D invalid
        ((10, 10, 10, 10), "length 2 or 3"),  # 4D invalid
        ((100, 100, 2), "Channel can only be 1, 3, or 4"),  # Invalid channel count
    ],
)
def test_verify_np_shape_invalid(shape: tuple[int, ...], error_substr: str) -> None:
    """Test that invalid array shapes raise exceptions."""
    array = np.zeros(shape)
    with pytest.raises(StreamlitAPIException) as exc:
        _verify_np_shape(array)
    assert error_substr in str(exc.value)


def test_clip_image_float_with_clamp() -> None:
    """Test _clip_image clamps float values to [0.0, 1.0] then scales to [0, 255]."""
    array = np.array([[-0.5, 0.5], [1.5, 0.8]])
    result = _clip_image(array, clamp=True)
    # -0.5 -> 0, 0.5 -> 127.5, 1.5 -> 255, 0.8 -> 204
    expected = np.array([[0.0, 127.5], [255.0, 204.0]])
    np.testing.assert_array_almost_equal(result, expected)


def test_clip_image_float_without_clamp_valid_range() -> None:
    """Test _clip_image scales valid float range to [0, 255]."""
    array = np.array([[0.0, 0.5], [0.8, 1.0]])
    result = _clip_image(array, clamp=False)
    # 0.0 -> 0, 0.5 -> 127.5, 0.8 -> 204, 1.0 -> 255
    expected = np.array([[0.0, 127.5], [204.0, 255.0]])
    np.testing.assert_array_almost_equal(result, expected)


def test_clip_image_int_with_clamp() -> None:
    """Test _clip_image clamps int values to [0, 255]."""
    array = np.array([[-10, 100], [300, 200]], dtype=np.int32)
    result = _clip_image(array, clamp=True)
    # -10 -> 0, 100 -> 100, 300 -> 255, 200 -> 200
    expected = np.array([[0, 100], [255, 200]], dtype=np.uint8)
    np.testing.assert_array_equal(result, expected)


def test_clip_image_int_without_clamp_valid_range() -> None:
    """Test _clip_image keeps valid int range unchanged."""
    array = np.array([[0, 100], [200, 255]], dtype=np.int32)
    result = _clip_image(array, clamp=False)
    expected = np.array([[0, 100], [200, 255]], dtype=np.uint8)
    np.testing.assert_array_equal(result, expected)


@pytest.mark.parametrize(
    ("array", "error_substr"),
    [
        # Float outside [0.0, 1.0] without clamp
        (np.array([[-0.5, 0.5], [1.5, 0.8]]), "outside [0.0, 1.0]"),
        # Int outside [0, 255] without clamp
        (np.array([[-10, 100], [300, 200]], dtype=np.int32), "outside [0, 255]"),
    ],
)
def test_clip_image_invalid_without_clamp(array: np.ndarray, error_substr: str) -> None:
    """Test _clip_image raises error for out-of-range values without clamping."""
    with pytest.raises(RuntimeError) as exc:
        _clip_image(array, clamp=False)
    assert error_substr in str(exc.value)

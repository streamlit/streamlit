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


class TestValidateImageFormatString:
    """Tests for _validate_image_format_string."""

    def test_jpeg_format(self) -> None:
        """Test that JPEG format is returned correctly."""
        result = _validate_image_format_string(b"dummy", "JPEG")
        assert result == "JPEG"

    def test_jpg_format(self) -> None:
        """Test that JPG format is converted to JPEG."""
        result = _validate_image_format_string(b"dummy", "JPG")
        assert result == "JPEG"

    def test_png_format(self) -> None:
        """Test that PNG format is returned correctly."""
        result = _validate_image_format_string(b"dummy", "PNG")
        assert result == "PNG"

    def test_auto_format_with_pil_image_gif(self) -> None:
        """Test auto format detection for GIF images."""
        # Create a mock PIL image that reports as GIF
        mock_image = MagicMock()
        mock_image.format = "GIF"
        mock_image.mode = "P"  # Palette mode, common for GIFs

        result = _validate_image_format_string(mock_image, "auto")
        assert result == "GIF"

    def test_auto_format_with_pil_image_rgba(self) -> None:
        """Test auto format detection for images with alpha channel."""
        mock_image = MagicMock()
        mock_image.format = "PNG"
        mock_image.mode = "RGBA"

        result = _validate_image_format_string(mock_image, "auto")
        assert result == "PNG"

    def test_auto_format_with_pil_image_rgb(self) -> None:
        """Test auto format detection for RGB images without alpha."""
        mock_image = MagicMock()
        mock_image.format = "PNG"
        mock_image.mode = "RGB"

        result = _validate_image_format_string(mock_image, "auto")
        assert result == "JPEG"


class TestVerifyNpShape:
    """Tests for _verify_np_shape."""

    def test_valid_2d_shape(self) -> None:
        """Test that 2D arrays are accepted."""
        array = np.zeros((100, 100))
        result = _verify_np_shape(array)
        assert result.shape == (100, 100)

    def test_valid_3d_shape_3_channels(self) -> None:
        """Test that 3D arrays with 3 channels are accepted."""
        array = np.zeros((100, 100, 3))
        result = _verify_np_shape(array)
        assert result.shape == (100, 100, 3)

    def test_valid_3d_shape_4_channels(self) -> None:
        """Test that 3D arrays with 4 channels are accepted."""
        array = np.zeros((100, 100, 4))
        result = _verify_np_shape(array)
        assert result.shape == (100, 100, 4)

    def test_single_channel_conversion(self) -> None:
        """Test that single channel 3D arrays are converted to 2D."""
        array = np.zeros((100, 100, 1))
        result = _verify_np_shape(array)
        assert result.shape == (100, 100)

    def test_invalid_1d_shape(self) -> None:
        """Test that 1D arrays raise an exception."""
        array = np.zeros((100,))
        with pytest.raises(StreamlitAPIException) as exc:
            _verify_np_shape(array)
        assert "length 2 or 3" in str(exc.value)

    def test_invalid_4d_shape(self) -> None:
        """Test that 4D arrays raise an exception."""
        array = np.zeros((10, 10, 10, 10))
        with pytest.raises(StreamlitAPIException) as exc:
            _verify_np_shape(array)
        assert "length 2 or 3" in str(exc.value)

    def test_invalid_channel_count(self) -> None:
        """Test that 3D arrays with invalid channel count raise an exception."""
        array = np.zeros((100, 100, 2))
        with pytest.raises(StreamlitAPIException) as exc:
            _verify_np_shape(array)
        assert "Channel can only be 1, 3, or 4" in str(exc.value)


class TestClipImage:
    """Tests for _clip_image."""

    def test_float_image_with_clamp(self) -> None:
        """Test clamping float images to [0.0, 1.0]."""
        array = np.array([[-0.5, 0.5], [1.5, 0.8]])
        result = _clip_image(array, clamp=True)
        assert result.min() >= 0
        assert result.max() <= 255

    def test_float_image_without_clamp_valid_range(self) -> None:
        """Test float images in valid range without clamping."""
        array = np.array([[0.0, 0.5], [0.8, 1.0]])
        result = _clip_image(array, clamp=False)
        # Values should be scaled to 0-255
        assert result.max() == 255

    def test_float_image_without_clamp_invalid_range(self) -> None:
        """Test float images outside valid range without clamping raises error."""
        array = np.array([[-0.5, 0.5], [1.5, 0.8]])
        with pytest.raises(RuntimeError) as exc:
            _clip_image(array, clamp=False)
        assert "outside [0.0, 1.0]" in str(exc.value)

    def test_int_image_with_clamp(self) -> None:
        """Test clamping integer images to [0, 255]."""
        array = np.array([[-10, 100], [300, 200]], dtype=np.int32)
        result = _clip_image(array, clamp=True)
        assert result.min() >= 0
        assert result.max() <= 255

    def test_int_image_without_clamp_valid_range(self) -> None:
        """Test integer images in valid range without clamping."""
        array = np.array([[0, 100], [200, 255]], dtype=np.int32)
        result = _clip_image(array, clamp=False)
        np.testing.assert_array_equal(result, array)

    def test_int_image_without_clamp_invalid_range(self) -> None:
        """Test integer images outside valid range without clamping raises error."""
        array = np.array([[-10, 100], [300, 200]], dtype=np.int32)
        with pytest.raises(RuntimeError) as exc:
            _clip_image(array, clamp=False)
        assert "outside [0, 255]" in str(exc.value)

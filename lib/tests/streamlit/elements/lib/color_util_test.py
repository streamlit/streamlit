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

from __future__ import annotations

import unittest

import pytest

from streamlit import errors
from streamlit.elements.lib import color_util

valid_hex_colors = ["#123", "#1234", "#112233", "#11223344"]

valid_css_rgb_colors = ["rgb(1, 2, 3)", "rgba(1, 2, 3, 4)"]

valid_color_tuples = [
    [0, 1, 2],
    [0, 1, 2, 4],
    [0.0, 0.5, 1.0],
    [0.0, 0.5, 1.0, 0.5],
    (0, 1, 2),
    (0, 1, 2, 4),
    (0.0, 0.5, 1.0),
    (0.0, 0.5, 1.0, 0.5),
]

# Built-in color names that map to Streamlit theme colors
valid_builtin_color_names = [
    "red",
    "orange",
    "yellow",
    "green",
    "blue",
    "violet",
    "gray",
    "grey",
    "primary",
    # Case variations
    "Red",
    "RED",
    "Blue",
    "GRAY",
    "Grey",
]

invalid_colors = [
    # Funny number of components
    "#12345",
    "#12",
    [1, 2],
    [1, 2, 3, 4, 5],
    # Malformed color
    "#0z0",
    "# NAs",
    "0f0",
    [1, "foo", 3],
    # Invalid data type
    {1, 2, 3},
    100,
    # Unsupported CSS strings (not a builtin color name)
    "foo",
    # This is only unsupported as user input, but it its used internally.
    "rgb(1, 2, 3)",
]


class ColorUtilTest(unittest.TestCase):
    def test_to_int_color_tuple(self):
        """Test to_int_color_tuple with good inputs"""
        test_combinations = [
            # Hex-3, 4, 6, 8
            ("#0f0", (0, 255, 0, 255)),
            ("#0f08", (0, 255, 0, 136)),
            ("#00ff00", (0, 255, 0, 255)),
            ("#00ff0088", (0, 255, 0, 136)),
            # Capitalization
            ("#00FF00", (0, 255, 0, 255)),
            # All-int lists/tuples
            ([0, 255, 0], (0, 255, 0)),
            ((0, 255, 0), (0, 255, 0)),
            ([0, 255, 0, 128], (0, 255, 0, 128)),
            ((0, 255, 0, 128), (0, 255, 0, 128)),
            # All-float lists/tuples
            ([0.0, 0.2, 1.0], (0, 51, 255)),
            ((0.0, 0.2, 1.0), (0, 51, 255)),
            ([0.0, 0.2, 1.0, 0.2], (0, 51, 255, 51)),
            ((0.0, 0.2, 1.0, 0.2), (0, 51, 255, 51)),
            # Float-int lists/tuples
            ([0, 255, 0, 0.2], (0, 255, 0, 51)),
            ((0, 255, 0, 0.2), (0, 255, 0, 51)),
            # Values beyond 0-255 or 0.0-1.0 bounds
            ([600, -100, 50], (255, 0, 50)),
            ((600, -100, 50), (255, 0, 50)),
            ([2.0, -1.0, 50], (255, 0, 50)),
            ((2.0, -1.0, 50), (255, 0, 50)),
        ]

        for test_arg, expected_out in test_combinations:
            out = color_util.to_int_color_tuple(test_arg)
            assert out == expected_out

    def test_to_int_color_tuple_fails(self):
        """Test to_int_color_tuple with bad inputs"""
        for test_arg in invalid_colors:
            with pytest.raises(errors.StreamlitInvalidColorError):
                color_util.to_int_color_tuple(test_arg)

    def test_to_css_color(self):
        """Test to_css_color with good inputs."""

        test_combinations = [
            # Hex-3, 4, 6, 8
            ("#0f0", "#0f0"),
            ("#0f08", "#0f08"),
            ("#00ff00", "#00ff00"),
            ("#00ff0088", "#00ff0088"),
            # Capitalization
            ("#00FF00", "#00FF00"),
            # All-int lists
            ([0, 255, 0], "rgb(0, 255, 0)"),
            ([0, 255, 0, 51], "rgba(0, 255, 0, 0.2)"),
            # All-float lists
            ([0.0, 0.2, 1.0], "rgb(0, 51, 255)"),
            ([0.0, 0.2, 1.0, 0.2], "rgba(0, 51, 255, 0.2)"),
            # Float-int lists
            ([0, 255, 0, 0.2], "rgba(0, 255, 0, 0.2)"),
            # Values beyond 0-255 or 0.0-1.0 bounds
            ([600, -100, 50], "rgb(255, 0, 50)"),
            ([2.0, -1.0, 50], "rgb(255, 0, 50)"),
            # Accept tuples
            ((0, 255, 0), "rgb(0, 255, 0)"),
        ]

        for test_arg, expected_out in test_combinations:
            out = color_util.to_css_color(test_arg)
            assert out == expected_out

    def test_to_css_color_fails(self):
        """Test to_css_color with bad inputs."""

        test_args = list(invalid_colors)

        # Checking for this in our code is not worth the cost.
        test_args.remove("#0z0")

        # This is only unsupported as user input, but it its used internally.
        test_args.remove("rgb(1, 2, 3)")

        for test_arg in test_args:
            with pytest.raises(errors.StreamlitInvalidColorError):
                color_util.to_css_color(test_arg)

    def test_is_hex_color_like_true(self):
        for test_arg in valid_hex_colors:
            out = color_util.is_hex_color_like(test_arg)
            assert out

    def test_is_hex_color_like_false(self):
        test_args = list(invalid_colors)

        # Checking for this in our code is not worth the cost.
        test_args.remove("#0z0")

        for test_arg in test_args:
            out = color_util.is_hex_color_like(test_arg)
            assert not out

    def test_is_css_color_like_true(self):
        for test_arg in [*valid_hex_colors, *valid_css_rgb_colors]:
            out = color_util.is_css_color_like(test_arg)
            assert out

    def test_is_css_color_like_false(self):
        test_args = list(invalid_colors)

        # Checking for this in our code is not worth the cost.
        test_args.remove("#0z0")

        # This is only unsupported as user input, but it its used internally.
        test_args.remove("rgb(1, 2, 3)")

        for test_arg in test_args:
            out = color_util.is_css_color_like(test_arg)
            assert not out

    def test_is_color_tuple_like_true(self):
        for test_arg in valid_color_tuples:
            out = color_util.is_color_tuple_like(test_arg)
            assert out

    def test_is_color_tuple_like_false(self):
        for test_arg in invalid_colors:
            out = color_util.is_color_tuple_like(test_arg)
            assert not out

    def test_is_builtin_color_name_true(self):
        """Test is_builtin_color_name returns True for valid built-in color names."""
        for test_arg in valid_builtin_color_names:
            out = color_util.is_builtin_color_name(test_arg)
            assert out, f"Expected {test_arg!r} to be a valid builtin color name"

    def test_is_builtin_color_name_false(self):
        """Test is_builtin_color_name returns False for invalid inputs."""
        invalid_builtin_names = [
            # Not builtin names
            "foo",
            "bar",
            "pink",
            "cyan",
            "magenta",
            # Hex colors are not builtin names
            "#f00",
            "#ff0000",
            # Tuples are not builtin names
            (255, 0, 0),
            [0, 255, 0],
            # Other invalid types
            None,
            123,
            [],
        ]
        for test_arg in invalid_builtin_names:
            out = color_util.is_builtin_color_name(test_arg)
            assert not out, (
                f"Expected {test_arg!r} to NOT be a valid builtin color name"
            )

    def test_is_color_like_true(self):
        """Test is_color_like returns True for hex colors and tuples.

        Note: is_color_like does NOT include built-in color names because those
        require special handling and cannot be converted via to_css_color().
        """
        for test_arg in [*valid_color_tuples, *valid_hex_colors]:
            out = color_util.is_color_like(test_arg)
            assert out, f"Expected {test_arg!r} to be color-like"

    def test_is_color_like_false(self):
        """Test is_color_like returns False for invalid colors.

        Note: Built-in color names are intentionally NOT considered color-like
        by this function because they require special frontend handling.
        """
        test_args = list(invalid_colors)

        # Checking for this in our code is not worth the cost.
        test_args.remove("#0z0")

        # This is only unsupported as user input, but it its used internally.
        test_args.remove("rgb(1, 2, 3)")

        for test_arg in test_args:
            out = color_util.is_color_like(test_arg)
            assert not out

    def test_is_color_like_excludes_builtin_names(self):
        """Test that is_color_like returns False for built-in color names.

        Built-in color names are handled separately via is_builtin_color_name()
        because they cannot be converted via to_css_color() - they are resolved
        on the frontend instead.
        """
        for test_arg in valid_builtin_color_names:
            out = color_util.is_color_like(test_arg)
            assert not out, (
                f"Expected is_color_like({test_arg!r}) to be False "
                "(builtin names need special handling)"
            )

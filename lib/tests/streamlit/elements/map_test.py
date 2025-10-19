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

"""Unit tests for st.map()."""

from __future__ import annotations

import itertools
import json
import re
from unittest import mock

import numpy as np
import pandas as pd
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.map import _DEFAULT_MAP, _DEFAULT_ZOOM_LEVEL, _get_default_color
from streamlit.errors import StreamlitAPIException
from streamlit.testing.v1.util import patch_config_options
from tests.delta_generator_test_case import DeltaGeneratorTestCase

mock_df = pd.DataFrame({"lat": [1, 2, 3, 4], "lon": [10, 20, 30, 40]})


class StMapTest(DeltaGeneratorTestCase):
    """Test ability to marshall deck_gl_json_chart protos via st.map."""

    def test_no_args(self):
        """Test that it can be called with no args."""
        st.map()

        c = self.get_delta_from_queue().new_element.deck_gl_json_chart
        assert json.loads(c.json) == _DEFAULT_MAP

    def test_basic(self):
        """Test that it can be called with lat/lon."""
        st.map(mock_df)

        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)

        assert c.get("initialViewState") is not None
        assert c.get("layers") is not None
        assert c.get("mapStyle") is None
        assert len(c.get("layers")) == 1
        assert c.get("initialViewState").get("latitude") == 2.5
        assert c.get("initialViewState").get("longitude") == 25
        assert c.get("initialViewState").get("zoom") == 3
        assert c.get("initialViewState").get("pitch") == 0
        assert c.get("layers")[0].get("@@type") == "ScatterplotLayer"

    def test_alternative_names_columns(self):
        """Test that it can be called with alternative names of lat/lon columns."""
        name_combination = itertools.product(
            {"lat", "latitude", "LAT", "LATITUDE"},
            {"lon", "longitude", "LON", "LONGITUDE"},
        )

        for lat_column_name, lon_column_name in name_combination:
            df = mock_df.rename(
                columns={"lat": lat_column_name, "lon": lon_column_name}
            )
            st.map(df)

            c = json.loads(
                self.get_delta_from_queue().new_element.deck_gl_json_chart.json
            )
            assert len(c.get("layers")[0].get("data")) == 4

    def test_map_uses_convert_anything_to_df(self):
        """Test that st.map uses convert_anything_to_df to convert input data."""
        with mock.patch(
            "streamlit.dataframe_util.convert_anything_to_pandas_df"
        ) as convert_anything_to_df:
            convert_anything_to_df.return_value = mock_df

            st.map(mock_df)
            convert_anything_to_df.assert_called_once()

    def test_main_kwargs(self):
        """Test that latitude, longitude, color and size propagate correctly."""
        df = pd.DataFrame(
            {
                "lat": [38.8762997, 38.8742997, 38.9025842],
                "lon": [-77.0037, -77.0057, -77.0556545],
                "color": [[255, 0, 0, 128], [0, 255, 0, 128], [0, 0, 255, 128]],
                "size": [100, 50, 30],
                "xlat": [-38.8762997, -38.8742997, -38.9025842],
                "xlon": [77.0037, 77.0057, 77.0556545],
            }
        )

        st.map(df, latitude="xlat", longitude="xlon", color="color", size="size")
        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)

        assert c.get("layers")[0].get("getPosition") == "@@=[xlon, xlat]"
        assert c.get("layers")[0].get("getFillColor") == "@@=color"
        assert c.get("layers")[0].get("getRadius") == "@@=size"

        # Also test that the radius property is set up correctly.
        assert c.get("layers")[0].get("radiusMinPixels") == 3

    @parameterized.expand(
        [
            ("string_index", ["a", "b", "c"]),
            ("indexed_from_1", [1, 2, 3]),
        ]
    )
    def test_alternative_dataframe_index(self, _, index):
        """Test that the map method does not error with non-standard dataframe indexes"""
        df = pd.DataFrame(
            {
                "lat": [38.8762997, 38.8742997, 38.9025842],
                "lon": [-77.0037, -77.0057, -77.0556545],
                "color": [[255, 0, 0, 128], [0, 255, 0, 128], [0, 0, 255, 128]],
                "size": [100, 50, 30],
            },
            index=index,
        )

        st.map(df, size="size", color="color")
        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)

        assert c.get("layers")[0].get("getFillColor") == "@@=color"
        assert c.get("layers")[0].get("getRadius") == "@@=size"

    def test_named_dataframe_index(self):
        """Test that the map method does not error with a dataframe with a named index"""
        df = pd.DataFrame(
            {
                "lat": [38.8762997, 38.8742997, 38.9025842],
                "lon": [-77.0037, -77.0057, -77.0556545],
                "color": [[255, 0, 0, 128], [0, 255, 0, 128], [0, 0, 255, 128]],
                "size": [100, 50, 30],
            }
        )
        df.index.name = "my index"

        st.map(df, color="color", size="size")
        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)

        assert c.get("layers")[0].get("getFillColor") == "@@=color"
        assert c.get("layers")[0].get("getRadius") == "@@=size"

        # Also test that the radius property is set up correctly.
        assert c.get("layers")[0].get("radiusMinPixels") == 3

    def test_common_color_formats(self):
        """Test that users can pass colors in different formats."""
        df = pd.DataFrame(
            {
                "lat": [38.8762997, 38.8742997, 38.9025842],
                "lon": [-77.0037, -77.0057, -77.0556545],
                "tuple3_int_color": [[255, 0, 0], [0, 255, 0], [0, 0, 255]],
                "tuple4_int_int_color": [
                    [255, 0, 0, 51],
                    [0, 255, 0, 51],
                    [0, 0, 255, 51],
                ],
                "tuple4_int_float_color": [
                    [255, 0, 0, 0.2],
                    [0, 255, 0, 0.2],
                    [0, 0, 255, 0.2],
                ],
                "tuple3_float_color": [
                    [1.0, 0.0, 0.0],
                    [0.0, 1.0, 0.0],
                    [0.0, 0.0, 1.0],
                ],
                "tuple4_float_float_color": [
                    [1.0, 0.0, 0.0, 0.2],
                    [0.0, 1.0, 0.0, 0.2],
                    [0.0, 0.0, 1.0, 0.2],
                ],
                "hex3_color": ["#f00", "#0f0", "#00f"],
                "hex4_color": ["#f008", "#0f08", "#00f8"],
                "hex6_color": ["#ff0000", "#00ff00", "#0000ff"],
                "hex8_color": ["#ff000088", "#00ff0088", "#0000ff88"],
                "named_color": ["red", "green", "blue"],
            }
        )

        color_columns = sorted(set(df.columns))
        color_columns.remove("lat")
        color_columns.remove("lon")

        expected_values = {
            "tuple3": [[255, 0, 0], [0, 255, 0], [0, 0, 255]],
            "tuple4": [[255, 0, 0, 51], [0, 255, 0, 51], [0, 0, 255, 51]],
            "hex3": [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255]],
            "hex6": [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255]],
            # 88 in hex = 136
            "hex4": [[255, 0, 0, 136], [0, 255, 0, 136], [0, 0, 255, 136]],
            "hex8": [[255, 0, 0, 136], [0, 255, 0, 136], [0, 0, 255, 136]],
            "named": None,
        }

        def get_expected_color_values(col_name):
            for prefix, expected_color_values in expected_values.items():
                if col_name.startswith(prefix):
                    return expected_color_values
            return None

        for color_column in color_columns:
            expected_color_values = get_expected_color_values(color_column)

            if expected_color_values is None:
                with pytest.raises(StreamlitAPIException):
                    st.map(df, color=color_column)

            else:
                st.map(df, color=color_column)
                c = json.loads(
                    self.get_delta_from_queue().new_element.deck_gl_json_chart.json
                )

                rows = c.get("layers")[0].get("data")

                for i, row in enumerate(rows):
                    assert row[color_column] == expected_color_values[i]

    def test_unused_columns_get_dropped(self):
        """Test that unused columns don't get transmitted."""
        df = pd.DataFrame(
            {
                "lat": [38.8762997, 38.8742997, 38.9025842],
                "lon": [-77.0037, -77.0057, -77.0556545],
                "int_color": [[255, 0, 0, 128], [0, 255, 0, 128], [0, 0, 255, 128]],
                "size": [100, 50, 30],
                "xlat": [-38.8762997, -38.8742997, -38.9025842],
                "xlon": [77.0037, 77.0057, 77.0556545],
            }
        )

        st.map(df)
        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)
        assert len(c.get("layers")[0].get("data")[0]) == 2

        st.map(df, latitude="xlat", longitude="xlon")
        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)
        assert len(c.get("layers")[0].get("data")[0]) == 2

        st.map(df, latitude="xlat", longitude="xlon", color="int_color")
        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)
        assert len(c.get("layers")[0].get("data")[0]) == 3

        st.map(df, latitude="xlat", longitude="xlon", size="size")
        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)
        assert len(c.get("layers")[0].get("data")[0]) == 3

        st.map(df, latitude="xlat", longitude="xlon", color="int_color", size="size")
        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)
        assert len(c.get("layers")[0].get("data")[0]) == 4

    def test_original_df_is_untouched(self):
        """Test that when we modify the outgoing DF we don't mutate the input DF."""
        df = pd.DataFrame(
            {
                "lat": [38.8762997, 38.8742997, 38.9025842],
                "lon": [-77.0037, -77.0057, -77.0556545],
                "foo": [0, 1, 2],
            }
        )

        st.map(df)
        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)
        assert len(c.get("layers")[0].get("data")[0]) == 2
        assert len(df.columns) == 3

    def test_default_map_copy(self):
        """Test that _DEFAULT_MAP is not modified as other work occurs."""
        assert _DEFAULT_MAP["initialViewState"]["latitude"] == 0

        st.map(mock_df)
        assert _DEFAULT_MAP["initialViewState"]["latitude"] == 0

    def test_default_zoom_level(self):
        """Test that _DEFAULT_ZOOM_LEVEL is set if zoom is not provided and distance is too small."""
        df = pd.DataFrame({"lat": [1], "lon": [1]})
        st.map(df)

        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)
        assert c.get("initialViewState").get("zoom") == _DEFAULT_ZOOM_LEVEL

    def test_map_leak(self):
        """Test that maps don't stay in memory when you create a new blank one.

        This is testing for an actual (fixed) bug.
        """
        st.map(mock_df)
        st.map()

        c = self.get_delta_from_queue().new_element.deck_gl_json_chart
        assert json.loads(c.json) == _DEFAULT_MAP

    @parameterized.expand(
        [
            [
                "lat",
                "Map data must contain a latitude column named: 'LAT', 'LATITUDE', 'lat', 'latitude'. "
                "Existing columns: 'lon'",
            ],
            [
                "lon",
                "Map data must contain a longitude column named: 'LON', 'LONGITUDE', 'lon', 'longitude'. "
                "Existing columns: 'lat'",
            ],
        ]
    )
    def test_missing_column(self, column_name, exception_message):
        """Test st.map with wrong lat column label."""
        df = mock_df.drop(columns=[column_name])
        with pytest.raises(StreamlitAPIException, match=re.escape(exception_message)):
            st.map(df)

    def test_nan_exception(self):
        """Test st.map with NaN in data."""
        df = pd.DataFrame({"lat": [1, 2, np.nan], "lon": [11, 12, 13]})
        with pytest.raises(
            StreamlitAPIException, match="not allowed to contain null values"
        ):
            st.map(df)

    def test_mapbox_token_is_set_in_proto(self):
        """Test that mapbox token is set in proto if configured."""

        with patch_config_options({"mapbox.token": "test_mapbox_token"}):
            st.map(mock_df)
            c = self.get_delta_from_queue().new_element.deck_gl_json_chart
            assert c.mapbox_token == "test_mapbox_token"

    def test_default_color_uses_theme_chart_colors(self):
        """Test that _get_default_color uses theme chart categorical colors."""
        # Test with default configuration (should use fallback blue)
        default_color = _get_default_color()
        assert default_color == (0, 104, 201, 160)  # #0068c9 with alpha 160

        # Test with custom chart categorical colors
        with patch_config_options(
            {"theme.chartCategoricalColors": ["#ff0000", "#00ff00"]}
        ):
            custom_color = _get_default_color()
            assert custom_color == (255, 0, 0, 160)  # Red with alpha 160

        # Test with empty chart categorical colors (should fall back to default)
        with patch_config_options({"theme.chartCategoricalColors": []}):
            fallback_color = _get_default_color()
            assert fallback_color == (0, 104, 201, 160)

    def test_map_uses_theme_color_by_default(self):
        """Test that st.map uses theme colors for default marker color."""
        # Test with custom theme colors
        with patch_config_options({"theme.chartCategoricalColors": ["#ff6b35"]}):
            st.map(mock_df)
            c = json.loads(
                self.get_delta_from_queue().new_element.deck_gl_json_chart.json
            )

            # The color should be applied as getFillColor in the layer
            layer = c.get("layers")[0]
            # Since no color column is specified, the color should be the direct tuple value
            assert layer.get("getFillColor") == [
                255,
                107,
                53,
                160,
            ]  # #ff6b35 with alpha 160

    def test_default_color_from_theme(self):
        """Test that default color uses theme chart colors when available."""
        # Test with theme chart colors configured
        with patch_config_options(
            {"theme.chartCategoricalColors": ["#ff0000", "#00ff00", "#0000ff"]}
        ):
            # Call the function directly
            color = _get_default_color()
            # Should use first color (red) with transparency
            assert color == (255, 0, 0, 160)

        # Test with empty chart colors
        with patch_config_options({"theme.chartCategoricalColors": []}):
            color = _get_default_color()
            # Should fallback to default blue
            assert color == (0, 104, 201, 160)

        # Test without chart colors configured (None)
        with patch_config_options({"theme.chartCategoricalColors": None}):
            color = _get_default_color()
            # Should fallback to default blue
            assert color == (0, 104, 201, 160)

    def test_map_uses_theme_color(self):
        """Test that st.map uses theme color for default markers."""
        # Test with custom theme color
        with patch_config_options(
            {"theme.chartCategoricalColors": ["#ff5722"]}  # Deep orange
        ):
            st.map(mock_df)
            c = json.loads(
                self.get_delta_from_queue().new_element.deck_gl_json_chart.json
            )
            # The color should be applied in the default conversion
            layer = c.get("layers")[0]
            # Default color is applied when no color is specified
            assert layer.get("getFillColor") == [
                255,
                87,
                34,
                160,
            ]  # #ff5722 with alpha


class StMapWidthHeightTest(DeltaGeneratorTestCase):
    """Test st.map width and height parameter functionality."""

    @parameterized.expand(
        [
            # width, expected_width_spec, expected_width_value
            ("stretch", "use_stretch", True),
            (500, "pixel_width", 500),
        ]
    )
    def test_width_parameter(
        self,
        width: str | int,
        expected_width_spec: str,
        expected_width_value: bool | int,
    ):
        """Test st.map with various width combinations."""
        st.map(mock_df, width=width)

        delta = self.get_delta_from_queue()
        el = delta.new_element

        assert el.width_config.WhichOneof("width_spec") == expected_width_spec
        assert getattr(el.width_config, expected_width_spec) == expected_width_value

    @parameterized.expand(
        [
            # height, expected_height_spec, expected_height_value
            ("stretch", "use_stretch", True),
            (400, "pixel_height", 400),
        ]
    )
    def test_height_parameter(
        self,
        height: str | int,
        expected_height_spec: str,
        expected_height_value: bool | int,
    ):
        """Test st.map with various height combinations."""
        st.map(mock_df, height=height)

        delta = self.get_delta_from_queue()
        el = delta.new_element

        assert el.height_config.WhichOneof("height_spec") == expected_height_spec
        assert getattr(el.height_config, expected_height_spec) == expected_height_value

    def test_default_width_stretch(self):
        """Test that default width is 'stretch'."""
        st.map(mock_df)

        delta = self.get_delta_from_queue()
        el = delta.new_element

        assert el.width_config.WhichOneof("width_spec") == "use_stretch"
        assert el.width_config.use_stretch

    def test_default_height_500(self):
        """Test that default height is 500."""
        st.map(mock_df)

        delta = self.get_delta_from_queue()
        el = delta.new_element

        assert el.height_config.WhichOneof("height_spec") == "pixel_height"
        assert el.height_config.pixel_height == 500

    @parameterized.expand(
        [
            # use_container_width, width, expected_width_spec, expected_width_value
            (True, None, "use_stretch", True),  # use_container_width=True -> stretch
            (
                False,
                None,
                "use_stretch",
                True,
            ),  # use_container_width=False, no width provided -> uses default "stretch"
            (
                True,
                500,
                "use_stretch",
                True,
            ),  # use_container_width=True overrides width -> stretch
            (
                True,
                "stretch",
                "use_stretch",
                True,
            ),  # use_container_width=True overrides width -> stretch
            (
                False,
                "stretch",
                "use_stretch",
                True,
            ),  # use_container_width=False, width="stretch" -> stretch
            (
                False,
                400,
                "pixel_width",
                400,
            ),  # use_container_width=False, integer width -> preserve integer
        ]
    )
    @mock.patch("streamlit.elements.map.show_deprecation_warning")
    def test_use_container_width_deprecation(
        self,
        use_container_width: bool,
        width: str | int | None,
        expected_width_spec: str,
        expected_width_value: bool | int,
        mock_show_warning,
    ):
        """Test deprecation warning and translation logic."""
        kwargs = {"use_container_width": use_container_width}
        if width is not None:
            kwargs["width"] = width

        st.map(mock_df, **kwargs)

        # Check that deprecation warning was called
        mock_show_warning.assert_called_once()

        delta = self.get_delta_from_queue()
        el = delta.new_element

        # Check width_config reflects the expected width (NOT deprecated proto fields) - NO conditionals!
        assert el.width_config.WhichOneof("width_spec") == expected_width_spec
        assert getattr(el.width_config, expected_width_spec) == expected_width_value

    @parameterized.expand(
        [
            ("width", "invalid_width"),
            ("width", "content"),  # content not supported for maps
            ("width", 0),  # width must be positive
            ("width", -100),  # negative width
            ("height", "invalid_height"),
            ("height", "content"),  # content not supported for maps
            ("height", 0),  # height must be positive
            ("height", -100),  # negative height
        ]
    )
    def test_validation_errors(self, param_name: str, invalid_value: str | int):
        """Test that invalid width/height values raise validation errors."""
        kwargs = {param_name: invalid_value}
        with pytest.raises(StreamlitAPIException):
            st.map(mock_df, **kwargs)


class StMapThemeColorTest(DeltaGeneratorTestCase):
    """Test st.map theme color functionality."""

    def test_get_default_color_fallback(self):
        """Test _get_default_color returns fallback when theme colors unavailable."""
        with patch_config_options({"theme.chartCategoricalColors": None}):
            default_color = _get_default_color()
            assert default_color == (0, 104, 201, 160)

    def test_get_default_color_with_theme_colors(self):
        """Test _get_default_color uses first theme color with alpha 160."""
        theme_colors = ["#ff0000", "#00ff00", "#0000ff"]  # Red, Green, Blue
        with patch_config_options({"theme.chartCategoricalColors": theme_colors}):
            default_color = _get_default_color()
            # Should return red (255, 0, 0) with alpha 160
            assert default_color == (255, 0, 0, 160)

    def test_get_default_color_alpha_override(self):
        """Test _get_default_color always sets alpha to 160, even for RGBA colors."""
        # Theme color with different alpha
        theme_colors = ["#ff000080"]  # Red with alpha 128
        with patch_config_options({"theme.chartCategoricalColors": theme_colors}):
            default_color = _get_default_color()
            # Should return red (255, 0, 0) with alpha 160 (overridden)
            assert default_color == (255, 0, 0, 160)

    def test_get_default_color_invalid_color(self):
        """Test _get_default_color handles invalid theme colors gracefully."""
        theme_colors = ["invalid_color", "#ff0000"]
        with patch_config_options({"theme.chartCategoricalColors": theme_colors}):
            default_color = _get_default_color()
            # Should fall back to default blue color
            assert default_color == (0, 104, 201, 160)

    def test_map_uses_theme_color_by_default(self):
        """Test that st.map uses theme color when no color specified."""
        theme_colors = ["#ff0000"]  # Red
        with patch_config_options({"theme.chartCategoricalColors": theme_colors}):
            st.map(mock_df)
            c = json.loads(
                self.get_delta_from_queue().new_element.deck_gl_json_chart.json
            )
            # The layer should use the theme color
            layer = c.get("layers")[0]
            # For a default map, the color should be applied to getFillColor
            # After JSON round-trip, this will be a list, not tuple
            assert layer.get("getFillColor") == [255, 0, 0, 160]

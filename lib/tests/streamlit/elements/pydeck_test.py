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

import json
import os
from unittest import mock

import pandas as pd
import pydeck as pdk
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements import deck_gl_json_chart
from streamlit.errors import StreamlitAPIException
from streamlit.proto.DeckGlJsonChart_pb2 import DeckGlJsonChart as PydeckProto
from streamlit.testing.v1.util import patch_config_options
from tests.delta_generator_test_case import DeltaGeneratorTestCase

df1 = pd.DataFrame({"lat": [1, 2, 3, 4], "lon": [10, 20, 30, 40]})


class PyDeckTest(DeltaGeneratorTestCase):
    def test_basic(self):
        """Test that pydeck object works."""

        st.pydeck_chart(
            pdk.Deck(
                layers=[
                    pdk.Layer("ScatterplotLayer", data=df1),
                ]
            )
        )

        el = self.get_delta_from_queue().new_element
        actual = json.loads(el.deck_gl_json_chart.json)

        assert actual["layers"][0]["@@type"] == "ScatterplotLayer"
        assert actual["layers"][0]["data"] == [
            {"lat": 1, "lon": 10},
            {"lat": 2, "lon": 20},
            {"lat": 3, "lon": 30},
            {"lat": 4, "lon": 40},
        ]
        assert el.deck_gl_json_chart.tooltip == ""

    def test_with_tooltip(self):
        """Test that pydeck object with tooltip works."""

        tooltip = {
            "html": "<b>Elevation Value:</b> {elevationValue}",
            "style": {"color": "white"},
        }
        st.pydeck_chart(
            pdk.Deck(
                layers=[
                    pdk.Layer("ScatterplotLayer", data=df1),
                ],
                tooltip=tooltip,
            )
        )

        el = self.get_delta_from_queue().new_element
        actual = json.loads(el.deck_gl_json_chart.tooltip)

        assert actual == tooltip

    def test_pydeck_with_tooltip_pydeck_0_7_1(self):
        """Test that pydeck object with tooltip created by pydeck v0.7.1 works."""

        tooltip = {
            "html": "<b>Elevation Value:</b> {elevationValue}",
            "style": {"color": "white"},
        }

        mock_desk = mock.Mock(
            spec=["to_json", "_tooltip"],
            **{"to_json.return_value": json.dumps({"layers": []}), "_tooltip": tooltip},
        )
        st.pydeck_chart(mock_desk)

        el = self.get_delta_from_queue().new_element
        actual = json.loads(el.deck_gl_json_chart.tooltip)

        assert actual == tooltip

    def test_pydeck_with_tooltip_pydeck_0_8_1(self):
        """Test that pydeck object with tooltip created by pydeck v0.8.1 works."""

        tooltip = {
            "html": "<b>Elevation Value:</b> {elevationValue}",
            "style": {"color": "white"},
        }

        mock_desk = mock.Mock(
            spec=["to_json", "deck_widget"],
            **{
                "to_json.return_value": json.dumps({"layers": []}),
                "deck_widget.tooltip": tooltip,
            },
        )
        st.pydeck_chart(mock_desk)

        el = self.get_delta_from_queue().new_element
        actual = json.loads(el.deck_gl_json_chart.tooltip)

        assert actual == tooltip

    def test_no_args(self):
        """Test that it can be called with no args."""
        st.pydeck_chart()

        el = self.get_delta_from_queue().new_element
        actual = json.loads(el.deck_gl_json_chart.json)

        assert actual == deck_gl_json_chart.EMPTY_MAP

    def test_on_select_ignore(self):
        """
        Test that it can be called with on_select="ignore" and the expected proto
        is generated.
        """

        st.pydeck_chart(
            pdk.Deck(
                layers=[
                    pdk.Layer("ScatterplotLayer", data=df1),
                ]
            ),
            on_select="ignore",
        )

        el = self.get_delta_from_queue().new_element

        assert el.deck_gl_json_chart.selection_mode == []

    def test_on_select_rerun(self):
        """
        Test that it can be called with on_select="rerun" and the expected proto
        is generated.
        """

        st.pydeck_chart(
            pdk.Deck(
                layers=[
                    pdk.Layer("ScatterplotLayer", data=df1),
                ]
            ),
            on_select="rerun",
        )

        el = self.get_delta_from_queue().new_element

        assert el.deck_gl_json_chart.selection_mode == [
            PydeckProto.SelectionMode.SINGLE_OBJECT
        ]

    def test_selection_mode_multiselect(self):
        """
        Test that it can be called with selection_mode="multi-object" and the
        expected proto is generated.
        """

        st.pydeck_chart(
            pdk.Deck(
                layers=[
                    pdk.Layer("ScatterplotLayer", data=df1),
                ]
            ),
            on_select="rerun",
            selection_mode="multi-object",
        )

        el = self.get_delta_from_queue().new_element

        assert el.deck_gl_json_chart.selection_mode == [
            PydeckProto.SelectionMode.MULTI_OBJECT
        ]

    def test_unknown_selection_mode_raises_exception(self):
        """
        Test that it throws an StreamlitAPIException when an unknown
        selection_mode is given
        """

        with pytest.raises(StreamlitAPIException) as e:
            st.pydeck_chart(
                pdk.Deck(
                    layers=[
                        pdk.Layer("ScatterplotLayer", data=df1),
                    ]
                ),
                on_select="rerun",
                selection_mode="multi-row",
            )

        assert "Invalid selection mode: multi-row" in str(e.value)

    def test_selection_mode_set(self):
        """
        Test that it throws an StreamlitAPIException when a set is given for
        selection_mode
        """

        with pytest.raises(StreamlitAPIException) as e:
            st.pydeck_chart(
                pdk.Deck(
                    layers=[
                        pdk.Layer("ScatterplotLayer", data=df1),
                    ]
                ),
                on_select="rerun",
                selection_mode={"multi-object"},
            )

        assert "Invalid selection mode: {'multi-object'}." in str(e.value)

    @patch_config_options({"mapbox.token": "MOCK_CONFIG_KEY"})
    def test_mapbox_token_config(self):
        """Test a Mapbox token is passed in proto when provided in config."""

        old_value = getattr(os.environ, "MAPBOX_API_KEY", None)
        if old_value:
            del os.environ["MAPBOX_API_KEY"]

        st.pydeck_chart(
            pdk.Deck(
                layers=[
                    pdk.Layer("ScatterplotLayer", data=df1),
                ]
            )
        )

        el = self.get_delta_from_queue().new_element
        assert el.deck_gl_json_chart.mapbox_token == "MOCK_CONFIG_KEY"

        if old_value:
            os.environ["MAPBOX_API_KEY"] = old_value


class PyDeckChartWidthTest(DeltaGeneratorTestCase):
    """Test pydeck_chart width parameter functionality."""

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
    ) -> None:
        """Test pydeck_chart with new width parameter."""
        st.pydeck_chart(None, width=width)

        delta = self.get_delta_from_queue()
        el = delta.new_element

        assert el.width_config.WhichOneof("width_spec") == expected_width_spec
        assert getattr(el.width_config, expected_width_spec) == expected_width_value

    @parameterized.expand(
        [
            # use_container_width, width, expected_width_spec, expected_width_value
            (
                True,
                "stretch",
                "use_stretch",
                True,
            ),  # use_container_width=True -> stretch (overrides width)
            (
                True,
                500,
                "use_stretch",
                True,
            ),  # use_container_width=True -> stretch (overrides width)
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
            ),  # use_container_width=False, width=int -> preserve integer
        ]
    )
    @mock.patch("streamlit.elements.deck_gl_json_chart.show_deprecation_warning")
    def test_use_container_width_backward_compatibility(
        self,
        use_container_width: bool,
        width: str | int,
        expected_width_spec: str,
        expected_width_value: bool | int,
        mock_show_warning: mock.Mock,
    ) -> None:
        """Test that use_container_width still works with deprecation warning."""
        st.pydeck_chart(None, use_container_width=use_container_width, width=width)

        mock_show_warning.assert_called_once()

        delta = self.get_delta_from_queue()
        el = delta.new_element

        assert el.width_config.WhichOneof("width_spec") == expected_width_spec
        assert getattr(el.width_config, expected_width_spec) == expected_width_value

    @parameterized.expand(
        [
            # use_container_width, expected_width_spec, expected_width_value
            (True, "use_stretch", True),  # use_container_width=True -> stretch
            (
                False,
                "use_stretch",
                True,
            ),  # use_container_width=False, no width -> stretch
        ]
    )
    @mock.patch("streamlit.elements.deck_gl_json_chart.show_deprecation_warning")
    def test_use_container_width_deprecation_alone(
        self,
        use_container_width: bool,
        expected_width_spec: str,
        expected_width_value: bool | int,
        mock_show_warning: mock.Mock,
    ) -> None:
        """Test deprecation warning and translation logic when only use_container_width is provided."""
        st.pydeck_chart(None, use_container_width=use_container_width)

        # Check that deprecation warning was called
        mock_show_warning.assert_called_once()

        delta = self.get_delta_from_queue()
        el = delta.new_element

        assert el.width_config.WhichOneof("width_spec") == expected_width_spec
        assert getattr(el.width_config, expected_width_spec) == expected_width_value

    @parameterized.expand(
        [
            "invalid_width",
            "content",  # content width not supported for pydeck
            0,  # width must be positive
            -100,  # negative width
        ]
    )
    def test_validation_errors(self, invalid_width: str | int) -> None:
        """Test that invalid width values raise validation errors."""
        with pytest.raises(StreamlitAPIException):
            st.pydeck_chart(None, width=invalid_width)

    def test_mapbox_token_env_var(self):
        """Test a Mapbox token is passed in proto when provided in env var."""

        old_value = getattr(os.environ, "MAPBOX_API_KEY", None)
        os.environ["MAPBOX_API_KEY"] = "MOCK_ENV_KEY"

        st.pydeck_chart(
            pdk.Deck(
                layers=[
                    pdk.Layer("ScatterplotLayer", data=df1),
                ]
            )
        )

        el = self.get_delta_from_queue().new_element
        assert el.deck_gl_json_chart.mapbox_token == "MOCK_ENV_KEY"

        if old_value:
            os.environ["MAPBOX_API_KEY"] = old_value

    def test_mapbox_token_direct(self):
        """Test a Mapbox token is passed in proto when provided directly."""

        old_value = getattr(os.environ, "MAPBOX_API_KEY", None)
        if old_value:
            del os.environ["MAPBOX_API_KEY"]

        st.pydeck_chart(
            pdk.Deck(
                api_keys={"mapbox": "MOCK_API_KEY"},
                map_provider="mapbox",
                layers=[
                    pdk.Layer("ScatterplotLayer", data=df1),
                ],
            )
        )

        el = self.get_delta_from_queue().new_element
        assert el.deck_gl_json_chart.mapbox_token == "MOCK_API_KEY"

        if old_value:
            os.environ["MAPBOX_API_KEY"] = old_value

    @patch_config_options({"mapbox.token": "MOCK_CONFIG_KEY"})
    def test_native_mapbox_token_wins(self):
        """Test that PyDecks' native Mapbox token wins against out config."""

        old_value = getattr(os.environ, "MAPBOX_API_KEY", None)
        if old_value:
            del os.environ["MAPBOX_API_KEY"]

        st.pydeck_chart(
            pdk.Deck(
                api_keys={"mapbox": "MOCK_API_KEY"},
                map_provider="mapbox",
                layers=[
                    pdk.Layer("ScatterplotLayer", data=df1),
                ],
            )
        )

        el = self.get_delta_from_queue().new_element
        assert el.deck_gl_json_chart.mapbox_token == "MOCK_API_KEY"

        if old_value:
            os.environ["MAPBOX_API_KEY"] = old_value


class PyDeckChartHeightTest(DeltaGeneratorTestCase):
    """Test pydeck_chart height parameter functionality."""

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
    ) -> None:
        """Test pydeck_chart with new height parameter."""
        st.pydeck_chart(None, height=height)

        delta = self.get_delta_from_queue()
        el = delta.new_element

        assert el.height_config.WhichOneof("height_spec") == expected_height_spec
        assert getattr(el.height_config, expected_height_spec) == expected_height_value

    @parameterized.expand(
        [
            "invalid_height",
            "content",  # content not supported for pydeck
            0,  # height must be positive
            -100,  # negative height
        ]
    )
    def test_height_validation_errors(self, invalid_height: str | int) -> None:
        """Test that invalid height values raise validation errors."""
        with pytest.raises(StreamlitAPIException):
            st.pydeck_chart(None, height=invalid_height)

    def test_default_height(self) -> None:
        """Test that default height is 500."""
        st.pydeck_chart(None)  # No height specified

        delta = self.get_delta_from_queue()
        el = delta.new_element

        assert el.height_config.WhichOneof("height_spec") == "pixel_height"
        assert el.height_config.pixel_height == 500


class PyDeckKeyAsMainIdentityTest(DeltaGeneratorTestCase):
    """Tests for key-as-main-identity behavior with pydeck_chart."""

    def _clear_widget_registry(self) -> None:
        """Clear the widget registry to simulate a new script run."""
        from streamlit.runtime.scriptrunner_utils.script_run_context import (
            get_script_run_ctx,
        )

        ctx = get_script_run_ctx()
        if ctx is not None:
            ctx.widget_ids_this_run.clear()
            ctx.widget_user_keys_this_run.clear()

    def test_element_id_stable_with_key_and_same_structure(self) -> None:
        """Test that element ID stays stable when key is provided and structure is same."""
        # First call with initial data
        st.pydeck_chart(
            pdk.Deck(layers=[pdk.Layer("ScatterplotLayer", data=df1, id="my-layer")]),
            on_select="rerun",
            key="my-chart",
        )
        el1 = self.get_delta_from_queue().new_element
        id1 = el1.deck_gl_json_chart.id

        # Clear registry to simulate new script run
        self._clear_widget_registry()

        # Second call with different data but same structure (same length)
        df2 = pd.DataFrame({"lat": [5, 6, 7, 8], "lon": [50, 60, 70, 80]})
        st.pydeck_chart(
            pdk.Deck(layers=[pdk.Layer("ScatterplotLayer", data=df2, id="my-layer")]),
            on_select="rerun",
            key="my-chart",
        )
        el2 = self.get_delta_from_queue().new_element
        id2 = el2.deck_gl_json_chart.id

        # IDs should be the same because structure is unchanged
        assert id1 == id2

    def test_element_id_changes_with_key_and_different_structure(self) -> None:
        """Test that element ID changes when structure changes even with same key."""
        # First call with 4 data points
        st.pydeck_chart(
            pdk.Deck(layers=[pdk.Layer("ScatterplotLayer", data=df1, id="my-layer")]),
            on_select="rerun",
            key="my-chart",
        )
        el1 = self.get_delta_from_queue().new_element
        id1 = el1.deck_gl_json_chart.id

        # Clear registry to simulate new script run
        self._clear_widget_registry()

        # Second call with different data length (5 instead of 4)
        df2 = pd.DataFrame({"lat": [1, 2, 3, 4, 5], "lon": [10, 20, 30, 40, 50]})
        st.pydeck_chart(
            pdk.Deck(layers=[pdk.Layer("ScatterplotLayer", data=df2, id="my-layer")]),
            on_select="rerun",
            key="my-chart",
        )
        el2 = self.get_delta_from_queue().new_element
        id2 = el2.deck_gl_json_chart.id

        # IDs should be different because data length changed
        assert id1 != id2

    def test_element_id_changes_with_key_and_different_layer_id(self) -> None:
        """Test that element ID changes when layer ID changes even with same key."""
        st.pydeck_chart(
            pdk.Deck(layers=[pdk.Layer("ScatterplotLayer", data=df1, id="layer-a")]),
            on_select="rerun",
            key="my-chart",
        )
        el1 = self.get_delta_from_queue().new_element
        id1 = el1.deck_gl_json_chart.id

        # Clear registry to simulate new script run
        self._clear_widget_registry()

        st.pydeck_chart(
            pdk.Deck(layers=[pdk.Layer("ScatterplotLayer", data=df1, id="layer-b")]),
            on_select="rerun",
            key="my-chart",
        )
        el2 = self.get_delta_from_queue().new_element
        id2 = el2.deck_gl_json_chart.id

        # IDs should be different because layer ID changed
        assert id1 != id2

    def test_element_id_changes_without_key(self) -> None:
        """Test that element ID changes when spec changes and no key is provided."""
        st.pydeck_chart(
            pdk.Deck(layers=[pdk.Layer("ScatterplotLayer", data=df1, id="my-layer")]),
            on_select="rerun",
        )
        el1 = self.get_delta_from_queue().new_element
        id1 = el1.deck_gl_json_chart.id

        # Clear registry to simulate new script run
        self._clear_widget_registry()

        # Different data content (same length)
        df2 = pd.DataFrame({"lat": [5, 6, 7, 8], "lon": [50, 60, 70, 80]})
        st.pydeck_chart(
            pdk.Deck(layers=[pdk.Layer("ScatterplotLayer", data=df2, id="my-layer")]),
            on_select="rerun",
        )
        el2 = self.get_delta_from_queue().new_element
        id2 = el2.deck_gl_json_chart.id

        # IDs should be different without a key, even with same structure
        assert id1 != id2


class StructuralFingerprintTest(DeltaGeneratorTestCase):
    """Tests for _extract_structural_fingerprint function."""

    def test_basic_fingerprint_with_layers(self) -> None:
        """Test that fingerprint extracts layer IDs and data lengths."""
        spec = json.dumps(
            {
                "layers": [
                    {"id": "layer-a", "data": [1, 2, 3]},
                    {"id": "layer-b", "data": [1, 2, 3, 4, 5]},
                ]
            }
        )
        fingerprint = deck_gl_json_chart._extract_structural_fingerprint(spec)

        # Should contain both layer IDs and data lengths
        assert "layer-a" in fingerprint
        assert "layer-b" in fingerprint
        assert "3" in fingerprint  # data length of layer-a
        assert "5" in fingerprint  # data length of layer-b

    def test_fingerprint_with_no_layers(self) -> None:
        """Test that fingerprint handles empty layers array."""
        spec = json.dumps({"layers": []})
        fingerprint = deck_gl_json_chart._extract_structural_fingerprint(spec)

        assert fingerprint == "layers:|lengths:"

    def test_fingerprint_with_missing_layers(self) -> None:
        """Test that fingerprint handles missing layers key."""
        spec = json.dumps({"initialViewState": {"latitude": 0}})
        fingerprint = deck_gl_json_chart._extract_structural_fingerprint(spec)

        assert fingerprint == "layers:|lengths:"

    def test_fingerprint_with_auto_generated_layer_ids(self) -> None:
        """Test that fingerprint generates IDs for layers without explicit IDs."""
        spec = json.dumps(
            {
                "layers": [
                    {"data": [1, 2]},  # No ID - should get "layer_0"
                    {"id": "my-layer", "data": [3, 4, 5]},
                ]
            }
        )
        fingerprint = deck_gl_json_chart._extract_structural_fingerprint(spec)

        assert "layer_0" in fingerprint
        assert "my-layer" in fingerprint

    def test_fingerprint_with_url_data(self) -> None:
        """Test that fingerprint handles URL data sources with hash."""
        spec = json.dumps(
            {
                "layers": [
                    {"id": "layer-a", "data": "https://example.com/data.csv"},
                ]
            }
        )
        fingerprint = deck_gl_json_chart._extract_structural_fingerprint(spec)

        # Should contain layer ID and a hash value for the URL
        assert "layer-a" in fingerprint
        # The hash should be a number
        parts = fingerprint.split("|")
        lengths_part = parts[1].replace("lengths:", "")
        assert lengths_part.isdigit() or lengths_part == ""

    def test_fingerprint_with_none_data(self) -> None:
        """Test that fingerprint handles layers with no data."""
        spec = json.dumps(
            {
                "layers": [
                    {"id": "layer-a"},  # No data key
                ]
            }
        )
        fingerprint = deck_gl_json_chart._extract_structural_fingerprint(spec)

        assert "layer-a" in fingerprint
        assert "0" in fingerprint  # Default length for missing data

    def test_fingerprint_is_deterministic(self) -> None:
        """Test that fingerprint is deterministic for same input."""
        spec = json.dumps(
            {
                "layers": [
                    {"id": "layer-b", "data": [1, 2]},
                    {"id": "layer-a", "data": [3, 4, 5]},
                ]
            }
        )
        fingerprint1 = deck_gl_json_chart._extract_structural_fingerprint(spec)
        fingerprint2 = deck_gl_json_chart._extract_structural_fingerprint(spec)

        assert fingerprint1 == fingerprint2

    def test_fingerprint_layer_ids_are_sorted(self) -> None:
        """Test that layer IDs are sorted for deterministic output."""
        spec = json.dumps(
            {
                "layers": [
                    {"id": "z-layer", "data": []},
                    {"id": "a-layer", "data": []},
                    {"id": "m-layer", "data": []},
                ]
            }
        )
        fingerprint = deck_gl_json_chart._extract_structural_fingerprint(spec)

        # IDs should be sorted alphabetically
        assert "a-layer,m-layer,z-layer" in fingerprint

    def test_fingerprint_changes_with_different_layer_ids(self) -> None:
        """Test that fingerprint changes when layer IDs change."""
        spec1 = json.dumps({"layers": [{"id": "layer-a", "data": [1, 2, 3]}]})
        spec2 = json.dumps({"layers": [{"id": "layer-b", "data": [1, 2, 3]}]})

        fingerprint1 = deck_gl_json_chart._extract_structural_fingerprint(spec1)
        fingerprint2 = deck_gl_json_chart._extract_structural_fingerprint(spec2)

        assert fingerprint1 != fingerprint2

    def test_fingerprint_changes_with_different_data_lengths(self) -> None:
        """Test that fingerprint changes when data lengths change."""
        spec1 = json.dumps({"layers": [{"id": "layer-a", "data": [1, 2, 3]}]})
        spec2 = json.dumps({"layers": [{"id": "layer-a", "data": [1, 2, 3, 4, 5]}]})

        fingerprint1 = deck_gl_json_chart._extract_structural_fingerprint(spec1)
        fingerprint2 = deck_gl_json_chart._extract_structural_fingerprint(spec2)

        assert fingerprint1 != fingerprint2

    def test_fingerprint_same_with_different_data_content(self) -> None:
        """Test that fingerprint stays same when only data content changes."""
        spec1 = json.dumps({"layers": [{"id": "layer-a", "data": [1, 2, 3]}]})
        spec2 = json.dumps({"layers": [{"id": "layer-a", "data": [4, 5, 6]}]})

        fingerprint1 = deck_gl_json_chart._extract_structural_fingerprint(spec1)
        fingerprint2 = deck_gl_json_chart._extract_structural_fingerprint(spec2)

        # Same structure (same ID, same length) should produce same fingerprint
        assert fingerprint1 == fingerprint2

    def test_fingerprint_handles_invalid_json(self) -> None:
        """Test that fingerprint returns empty string for invalid JSON."""
        fingerprint = deck_gl_json_chart._extract_structural_fingerprint(
            "not valid json"
        )

        assert fingerprint == ""

    def test_fingerprint_handles_null_layers(self) -> None:
        """Test that fingerprint handles null values in layers array."""
        spec = json.dumps(
            {
                "layers": [
                    None,
                    {"id": "layer-a", "data": [1, 2]},
                    None,
                ]
            }
        )
        fingerprint = deck_gl_json_chart._extract_structural_fingerprint(spec)

        # Should only include the valid layer
        assert "layer-a" in fingerprint
        # The fingerprint format is "layers:layer-a|lengths:2"
        # Extract the layers part to check only one layer ID is present
        layers_part = fingerprint.split("|")[0].replace("layers:", "")
        assert layers_part == "layer-a"  # Only one layer ID

    def test_fingerprint_url_is_deterministic(self) -> None:
        """Test that URL data fingerprint is deterministic across calls."""
        spec = json.dumps(
            {
                "layers": [
                    {"id": "layer-a", "data": "https://example.com/data.csv"},
                ]
            }
        )
        # Call multiple times to ensure deterministic behavior
        fingerprint1 = deck_gl_json_chart._extract_structural_fingerprint(spec)
        fingerprint2 = deck_gl_json_chart._extract_structural_fingerprint(spec)
        fingerprint3 = deck_gl_json_chart._extract_structural_fingerprint(spec)

        assert fingerprint1 == fingerprint2 == fingerprint3

    def test_fingerprint_different_urls_produce_different_fingerprints(self) -> None:
        """Test that different URLs produce different fingerprints."""
        spec1 = json.dumps(
            {"layers": [{"id": "layer-a", "data": "https://example.com/data1.csv"}]}
        )
        spec2 = json.dumps(
            {"layers": [{"id": "layer-a", "data": "https://example.com/data2.csv"}]}
        )

        fingerprint1 = deck_gl_json_chart._extract_structural_fingerprint(spec1)
        fingerprint2 = deck_gl_json_chart._extract_structural_fingerprint(spec2)

        # Different URLs should produce different fingerprints
        assert fingerprint1 != fingerprint2

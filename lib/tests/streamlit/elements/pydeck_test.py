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
from unittest.mock import MagicMock, patch

import pandas as pd
import pydeck as pdk
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements import deck_gl_json_chart
from streamlit.elements.deck_gl_json_chart import (
    PydeckMixin,
    PydeckSelectionSerde,
    _get_pydeck_width,
    parse_selection_mode,
)
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


class PyDeckElementIdStabilityTest(DeltaGeneratorTestCase):
    """Test that pydeck element ID remains stable when key is provided."""

    def test_element_id_stable_with_key_when_spec_changes(self):
        """Test that element ID stays the same when key is provided but spec changes.

        When selections are enabled and a key is provided, the element ID should remain
        stable across data changes to preserve selection state.
        """
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # First chart with some data
            st.pydeck_chart(
                pdk.Deck(
                    layers=[
                        pdk.Layer("ScatterplotLayer", data=df1, id="layer1"),
                    ]
                ),
                on_select="rerun",
                key="my_stable_chart",
            )

            el1 = self.get_delta_from_queue().new_element
            id1 = el1.deck_gl_json_chart.id

            # Second chart with different data but same key
            df2 = pd.DataFrame({"lat": [5, 6, 7], "lon": [50, 60, 70]})
            st.pydeck_chart(
                pdk.Deck(
                    layers=[
                        pdk.Layer("ScatterplotLayer", data=df2, id="layer1"),
                    ]
                ),
                on_select="rerun",
                key="my_stable_chart",  # Same key to test ID stability
            )

            el2 = self.get_delta_from_queue().new_element
            id2 = el2.deck_gl_json_chart.id

            # IDs should be identical since key and selection_mode are the same
            assert id1 == id2

    def test_element_id_changes_without_key(self):
        """Test that element ID changes when no key is provided and spec changes."""
        # First chart
        st.pydeck_chart(
            pdk.Deck(
                layers=[
                    pdk.Layer("ScatterplotLayer", data=df1, id="layer1"),
                ]
            ),
            on_select="rerun",
        )

        el1 = self.get_delta_from_queue().new_element
        id1 = el1.deck_gl_json_chart.id

        # Second chart with different data (no key)
        df2 = pd.DataFrame({"lat": [5, 6, 7], "lon": [50, 60, 70]})
        st.pydeck_chart(
            pdk.Deck(
                layers=[
                    pdk.Layer("ScatterplotLayer", data=df2, id="layer1"),
                ]
            ),
            on_select="rerun",
        )

        el2 = self.get_delta_from_queue().new_element
        id2 = el2.deck_gl_json_chart.id

        # IDs should be different because spec changed and no key was provided
        assert id1 != id2

    def test_element_id_changes_when_selection_mode_changes(self):
        """Test that element ID changes when selection_mode changes even with key.

        selection_mode is part of key_as_main_identity, so changing it should
        result in a different element ID even when the same key is provided.
        """
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # Chart with single-object selection
            st.pydeck_chart(
                pdk.Deck(
                    layers=[
                        pdk.Layer("ScatterplotLayer", data=df1, id="layer1"),
                    ]
                ),
                on_select="rerun",
                selection_mode="single-object",
                key="mode_test_chart",
            )

            el1 = self.get_delta_from_queue().new_element
            id1 = el1.deck_gl_json_chart.id

            # Chart with multi-object selection (same key)
            st.pydeck_chart(
                pdk.Deck(
                    layers=[
                        pdk.Layer("ScatterplotLayer", data=df1, id="layer1"),
                    ]
                ),
                on_select="rerun",
                selection_mode="multi-object",
                key="mode_test_chart",  # Same key
            )

            el2 = self.get_delta_from_queue().new_element
            id2 = el2.deck_gl_json_chart.id

            # IDs should be different because selection_mode is in key_as_main_identity
            assert id1 != id2


class PydeckSelectionSerdeTest(DeltaGeneratorTestCase):
    """Test PydeckSelectionSerde serialization and deserialization."""

    def test_deserialize_none_returns_empty_state(self):
        """Test that deserializing None returns an empty selection state."""
        serde = PydeckSelectionSerde()
        result = serde.deserialize(None)

        assert result["selection"]["indices"] == {}
        assert result["selection"]["objects"] == {}

    def test_deserialize_valid_json(self):
        """Test that deserializing valid JSON returns the correct state."""
        serde = PydeckSelectionSerde()
        json_str = (
            '{"selection": {"indices": {"layer1": [0, 1]}, '
            '"objects": {"layer1": [{"name": "obj1"}, {"name": "obj2"}]}}}'
        )
        result = serde.deserialize(json_str)

        assert result["selection"]["indices"]["layer1"] == [0, 1]
        assert result["selection"]["objects"]["layer1"] == [
            {"name": "obj1"},
            {"name": "obj2"},
        ]

    def test_deserialize_empty_dict_returns_empty_state(self):
        """Test that deserializing an empty dict returns empty selection state."""
        serde = PydeckSelectionSerde()
        result = serde.deserialize("{}")

        # Should return empty state when selection key is missing
        assert result["selection"]["indices"] == {}
        assert result["selection"]["objects"] == {}

    def test_serialize_selection_state(self):
        """Test that serializing a selection state returns valid JSON."""
        serde = PydeckSelectionSerde()
        state = {
            "selection": {
                "indices": {"my_layer": [2, 5]},
                "objects": {"my_layer": [{"id": "a"}, {"id": "b"}]},
            }
        }
        result = serde.serialize(state)
        parsed = json.loads(result)

        assert parsed["selection"]["indices"]["my_layer"] == [2, 5]
        assert parsed["selection"]["objects"]["my_layer"] == [{"id": "a"}, {"id": "b"}]

    def test_deserialize_supports_attribute_notation(self):
        """Test that deserialized state supports attribute notation."""
        serde = PydeckSelectionSerde()
        json_str = (
            '{"selection": {"indices": {"layer1": [0]}, "objects": {"layer1": [{}]}}}'
        )
        result = serde.deserialize(json_str)

        # Should support both dict and attribute access
        assert result.selection.indices["layer1"] == [0]


class ParseSelectionModeTest(DeltaGeneratorTestCase):
    """Test parse_selection_mode function."""

    def test_parse_single_object_mode(self):
        """Test parsing single-object selection mode."""
        result = parse_selection_mode("single-object")
        assert PydeckProto.SelectionMode.SINGLE_OBJECT in result
        assert len(result) == 1

    def test_parse_multi_object_mode(self):
        """Test parsing multi-object selection mode."""
        result = parse_selection_mode("multi-object")
        assert PydeckProto.SelectionMode.MULTI_OBJECT in result
        assert len(result) == 1

    def test_invalid_selection_mode_raises_exception(self):
        """Test that an invalid selection mode raises StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException) as e:
            parse_selection_mode("invalid-mode")
        assert "Invalid selection mode" in str(e.value)

    def test_set_selection_mode_raises_exception(self):
        """Test that a set of selection modes raises StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException) as e:
            parse_selection_mode({"single-object", "multi-object"})
        assert "Selection mode must be a single value" in str(e.value)

    def test_list_selection_mode_raises_exception(self):
        """Test that a list of selection modes raises StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException) as e:
            parse_selection_mode(["single-object"])
        assert "Selection mode must be a single value" in str(e.value)


def test_get_pydeck_width_returns_none_for_none_input() -> None:
    """`None` pydeck object returns `None`."""
    assert _get_pydeck_width(None) is None


def test_get_pydeck_width_returns_none_when_width_not_set() -> None:
    """Object without a `width` attribute returns `None`."""

    class _NoWidth:
        pass

    assert _get_pydeck_width(_NoWidth()) is None


def test_get_pydeck_width_returns_none_when_width_is_none() -> None:
    """`width=None` returns `None`."""

    class _HasWidth:
        width = None

    assert _get_pydeck_width(_HasWidth()) is None


def test_get_pydeck_width_returns_none_when_width_is_invalid_type() -> None:
    """Non-numeric width values are ignored."""

    class _StringWidth:
        width = "not_a_number"

    assert _get_pydeck_width(_StringWidth()) is None


def test_get_pydeck_width_returns_int_when_width_is_int() -> None:
    """Integer widths are returned as-is."""

    class _IntWidth:
        width = 600

    assert _get_pydeck_width(_IntWidth()) == 600


def test_get_pydeck_width_returns_int_when_width_is_float() -> None:
    """Float widths are truncated to int."""

    class _FloatWidth:
        width = 600.7

    assert _get_pydeck_width(_FloatWidth()) == 600


def test_pydeck_mixin_dg_returns_self() -> None:
    """``PydeckMixin.dg`` returns the mixin instance."""

    class _OnlyPydeck(PydeckMixin):
        pass

    pydeck_mixin = _OnlyPydeck()
    assert pydeck_mixin.dg is pydeck_mixin


class PydeckCallbackTest(DeltaGeneratorTestCase):
    """Test pydeck_chart with callback functions."""

    def test_on_select_with_callable(self):
        """Test that pydeck_chart works with a callable for on_select."""
        callback_called = []

        def my_callback():
            callback_called.append(True)

        st.pydeck_chart(
            pdk.Deck(
                layers=[
                    pdk.Layer("ScatterplotLayer", data=df1, id="layer1"),
                ]
            ),
            on_select=my_callback,
        )

        el = self.get_delta_from_queue().new_element
        # Should have an ID when selections are enabled
        assert el.deck_gl_json_chart.id != ""
        assert el.deck_gl_json_chart.selection_mode == [
            PydeckProto.SelectionMode.SINGLE_OBJECT
        ]

    def test_key_with_on_select_ignore_has_no_id(self):
        """Test that key has no effect when on_select is 'ignore'."""
        st.pydeck_chart(
            pdk.Deck(
                layers=[
                    pdk.Layer("ScatterplotLayer", data=df1),
                ]
            ),
            on_select="ignore",
            key="my_key",  # Key should have no effect
        )

        el = self.get_delta_from_queue().new_element
        # Should not have an ID when selections are not enabled
        assert el.deck_gl_json_chart.id == ""
        assert el.deck_gl_json_chart.selection_mode == []

    def test_invalid_on_select_raises_exception(self):
        """Test that an invalid on_select value raises StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException) as e:
            st.pydeck_chart(
                pdk.Deck(
                    layers=[
                        pdk.Layer("ScatterplotLayer", data=df1),
                    ]
                ),
                on_select="invalid",
            )
        assert "only 'ignore', 'rerun', or a callable is supported" in str(e.value)


class TestPreparePydeckForJson:
    """Tests for _prepare_pydeck_for_json helper function."""

    def test_none_input_is_noop(self) -> None:
        """Test that None input is handled gracefully."""
        # Should not raise
        deck_gl_json_chart._prepare_pydeck_for_json(None)

    def test_converts_dataframe_to_dict(self) -> None:
        """Test that DataFrame layer data is converted to list of dicts."""
        df = pd.DataFrame({"lat": [1, 2], "lon": [10, 20]})
        deck = pdk.Deck(layers=[pdk.Layer("ScatterplotLayer", data=df)])

        deck_gl_json_chart._prepare_pydeck_for_json(deck)

        # Data should now be a list of dicts
        assert deck.layers[0].data == [
            {"lat": 1, "lon": 10},
            {"lat": 2, "lon": 20},
        ]

    def test_handles_weakref_to_dataframe(self) -> None:
        """Test that weakref-wrapped DataFrames are handled correctly."""
        import weakref

        df = pd.DataFrame({"lat": [1], "lon": [10]})
        layer = pdk.Layer("ScatterplotLayer", data=df)
        # Simulate pydeck's weakref wrapping
        layer.data = weakref.ref(df)

        deck = pdk.Deck(layers=[layer])
        deck_gl_json_chart._prepare_pydeck_for_json(deck)

        # Data should be converted (weakref dereferenced and converted)
        assert deck.layers[0].data == [{"lat": 1, "lon": 10}]

    def test_handles_dead_weakref(self) -> None:
        """Test that dead weakrefs are skipped without error."""
        import weakref

        layer = pdk.Layer("ScatterplotLayer", data=None)
        # Create a weakref to a DataFrame that will be garbage collected
        df = pd.DataFrame({"lat": [1], "lon": [10]})
        layer.data = weakref.ref(df)
        del df  # DataFrame is now garbage collected

        deck = pdk.Deck(layers=[layer])
        # Should not raise when weakref returns None
        deck_gl_json_chart._prepare_pydeck_for_json(deck)

    def test_non_dataframe_data_unchanged(self) -> None:
        """Test that non-DataFrame data is left unchanged."""
        list_data = [{"lat": 1, "lon": 10}]
        deck = pdk.Deck(layers=[pdk.Layer("ScatterplotLayer", data=list_data)])

        deck_gl_json_chart._prepare_pydeck_for_json(deck)

        # Data should be unchanged
        assert deck.layers[0].data == list_data

    def test_multiple_layers(self) -> None:
        """Test that all layers with DataFrame data are converted."""
        df1 = pd.DataFrame({"lat": [1], "lon": [10]})
        df2 = pd.DataFrame({"lat": [2], "lon": [20]})
        list_data = [{"lat": 3, "lon": 30}]

        deck = pdk.Deck(
            layers=[
                pdk.Layer("ScatterplotLayer", data=df1),
                pdk.Layer("ScatterplotLayer", data=df2),
                pdk.Layer("ScatterplotLayer", data=list_data),
            ]
        )

        deck_gl_json_chart._prepare_pydeck_for_json(deck)

        assert deck.layers[0].data == [{"lat": 1, "lon": 10}]
        assert deck.layers[1].data == [{"lat": 2, "lon": 20}]
        assert deck.layers[2].data == list_data  # Unchanged

    def test_deck_without_layers_attribute(self) -> None:
        """Test that Deck without layers attribute is handled gracefully."""
        deck = MagicMock(spec=[])  # Mock without 'layers' attribute

        # Should not raise
        deck_gl_json_chart._prepare_pydeck_for_json(deck)

    def test_layer_without_data_attribute(self) -> None:
        """Test that layers without data attribute are skipped."""
        layer = MagicMock(spec=[])  # Mock without 'data' attribute
        deck = MagicMock()
        deck.layers = [layer]

        # Should not raise
        deck_gl_json_chart._prepare_pydeck_for_json(deck)

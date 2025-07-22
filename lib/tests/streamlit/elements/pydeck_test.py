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

import json
import os
from unittest import mock

import pandas as pd
import pydeck as pdk
import pytest

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

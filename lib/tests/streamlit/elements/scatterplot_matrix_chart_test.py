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

"""st.scatterplot_matrix_chart unit tests."""

from __future__ import annotations

import json

import numpy as np
import pandas as pd
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit import dataframe_util
from streamlit.elements.scatterplot_matrix_chart import (
    ScatterplotMatrixSelectionSerde,
    ScatterplotMatrixState,
)
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase


def _test_data() -> pd.DataFrame:
    rng = np.random.default_rng(0)
    df = pd.DataFrame(rng.standard_normal((20, 3)), columns=["alpha", "beta", "gamma"])
    df["name"] = [f"point {index}" for index in range(20)]
    return df


class TestScatterplotMatrixSelectionSerde:
    """Tests for the selection state serializer/deserializer."""

    def test_deserialize_none_returns_empty_selection(self):
        """Deserializing None returns an empty selection state."""
        serde = ScatterplotMatrixSelectionSerde()
        state = serde.deserialize(None)
        assert state["selection"]["indices"] == []
        assert state["selection"]["query_layers"] == []

    def test_deserialize_roundtrip(self):
        """A serialized selection state deserializes to the same value."""
        serde = ScatterplotMatrixSelectionSerde()
        state: ScatterplotMatrixState = {
            "selection": {
                "indices": [1, 3],
                "query_layers": [
                    {"label": "Query 1", "indices": [1, 3]},
                    {"label": "Query 2", "indices": []},
                ],
            },
        }
        deserialized = serde.deserialize(serde.serialize(state))
        assert deserialized["selection"]["indices"] == [1, 3]
        assert deserialized["selection"]["query_layers"][0]["label"] == "Query 1"
        assert deserialized["selection"]["query_layers"][0]["indices"] == [1, 3]

    def test_deserialize_supports_attribute_notation(self):
        """The deserialized state supports attribute access."""
        serde = ScatterplotMatrixSelectionSerde()
        state = serde.deserialize(
            json.dumps({"selection": {"indices": [2], "query_layers": []}})
        )
        assert state.selection.indices == [2]


class TestScatterplotMatrixChart(DeltaGeneratorTestCase):
    """Tests for the st.scatterplot_matrix_chart command."""

    def test_basic_element(self):
        """The command marshalls data, columns, and defaults into the proto."""
        st.scatterplot_matrix_chart(_test_data())

        proto = self.get_delta_from_queue().new_element.scatterplot_matrix_chart
        assert proto.columns == ["alpha", "beta", "gamma"]
        assert proto.label == ""
        assert proto.title == ""
        assert list(proto.query_colors) == []
        assert proto.roll_speed == 1.0
        assert proto.selections_activated is False
        assert proto.id != ""

        # The marshalled data only contains the dimension columns:
        marshalled = dataframe_util.convert_arrow_bytes_to_pandas_df(proto.data.data)
        assert list(marshalled.columns) == ["alpha", "beta", "gamma"]
        assert len(marshalled) == 20

    def test_explicit_parameters(self):
        """Explicit columns, label, title, and colors are marshalled."""
        st.scatterplot_matrix_chart(
            _test_data(),
            columns=["beta", "alpha"],
            label="name",
            title="My matrix",
            query_colors=["#ff0000", "#00ff00"],
            roll_speed=2.5,
        )

        proto = self.get_delta_from_queue().new_element.scatterplot_matrix_chart
        assert proto.columns == ["beta", "alpha"]
        assert proto.label == "name"
        assert proto.title == "My matrix"
        assert list(proto.query_colors) == ["#ff0000", "#00ff00"]
        assert proto.roll_speed == 2.5

        # The label column is included in the marshalled data:
        marshalled = dataframe_util.convert_arrow_bytes_to_pandas_df(proto.data.data)
        assert list(marshalled.columns) == ["beta", "alpha", "name"]

    def test_supports_non_string_column_names(self):
        """DataFrames with default integer column names work."""
        st.scatterplot_matrix_chart(
            pd.DataFrame(np.random.default_rng(0).standard_normal((10, 3)))
        )

        proto = self.get_delta_from_queue().new_element.scatterplot_matrix_chart
        assert proto.columns == ["0", "1", "2"]
        marshalled = dataframe_util.convert_arrow_bytes_to_pandas_df(proto.data.data)
        assert list(marshalled.columns) == ["0", "1", "2"]

    def test_does_not_mutate_user_dataframe(self):
        """Marshalling must not rename the columns of the user's DataFrame."""
        df = pd.DataFrame(np.zeros((5, 2)))
        st.scatterplot_matrix_chart(df)
        assert list(df.columns) == [0, 1]

    def test_non_numeric_columns_are_excluded_by_default(self):
        """Auto-detected dimensions must not include non-numeric columns."""
        st.scatterplot_matrix_chart(_test_data())

        proto = self.get_delta_from_queue().new_element.scatterplot_matrix_chart
        assert "name" not in proto.columns

    def test_on_select_rerun_registers_widget(self):
        """Activating selections registers the element as a widget."""
        state = st.scatterplot_matrix_chart(_test_data(), on_select="rerun")

        proto = self.get_delta_from_queue().new_element.scatterplot_matrix_chart
        assert proto.selections_activated is True
        assert state.selection.indices == []
        assert state.selection.query_layers == []

    def test_on_select_ignore_returns_delta_generator(self):
        """With on_select='ignore' no selection state is returned."""
        return_value = st.scatterplot_matrix_chart(_test_data())
        assert not isinstance(return_value, dict)

    def test_throws_on_unknown_columns(self):
        """Unknown dimension columns raise a StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException, match="not found in the data"):
            st.scatterplot_matrix_chart(_test_data(), columns=["alpha", "unknown"])

    def test_throws_on_non_numeric_columns(self):
        """Non-numeric dimension columns raise a StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException, match="not numeric"):
            st.scatterplot_matrix_chart(_test_data(), columns=["alpha", "name"])

    def test_throws_on_too_few_columns(self):
        """Fewer than two dimensions raise a StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException, match="at least 2"):
            st.scatterplot_matrix_chart(_test_data(), columns=["alpha"])

    def test_throws_on_too_many_explicit_columns(self):
        """More than ten explicit dimensions raise a StreamlitAPIException."""
        column_names = [f"col{index}" for index in range(11)]
        many_columns = pd.DataFrame(np.zeros((5, 11)), columns=column_names)
        with pytest.raises(StreamlitAPIException, match="at most 10"):
            st.scatterplot_matrix_chart(many_columns, columns=column_names)

    def test_auto_detected_columns_are_capped(self):
        """Auto-detected dimensions are capped at ten columns."""
        many_columns = pd.DataFrame(
            np.zeros((5, 12)), columns=[f"col{index}" for index in range(12)]
        )
        st.scatterplot_matrix_chart(many_columns)

        proto = self.get_delta_from_queue().new_element.scatterplot_matrix_chart
        assert len(proto.columns) == 10

    def test_throws_on_unknown_label_column(self):
        """An unknown label column raises a StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException, match="label column"):
            st.scatterplot_matrix_chart(_test_data(), label="unknown")

    def test_throws_on_too_many_query_colors(self):
        """More than eight query colors raise a StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException, match="at most 8 query layers"):
            st.scatterplot_matrix_chart(
                _test_data(), query_colors=[f"#00000{index}" for index in range(9)]
            )

    @parameterized.expand([(0,), (-1.5,)])
    def test_throws_on_invalid_roll_speed(self, roll_speed: float):
        """A non-positive roll speed raises a StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException, match="roll_speed"):
            st.scatterplot_matrix_chart(_test_data(), roll_speed=roll_speed)

    @parameterized.expand([(0,), (-100,), ("content",)])
    def test_throws_on_invalid_height(self, height: int | str):
        """A non-positive or unsupported height raises a StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException, match="height"):
            st.scatterplot_matrix_chart(_test_data(), height=height)  # type: ignore[call-overload]

    def test_accepts_stretch_height(self):
        """A "stretch" height is valid and does not raise."""
        st.scatterplot_matrix_chart(_test_data(), height="stretch")

        proto = self.get_delta_from_queue().new_element.scatterplot_matrix_chart
        assert proto.id != ""

    def test_throws_on_invalid_on_select(self):
        """An invalid on_select value raises a StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException, match="on_select"):
            st.scatterplot_matrix_chart(_test_data(), on_select="invalid")  # type: ignore[call-overload]

    def test_form_id_is_marshalled_inside_form(self):
        """The enclosing form id is marshalled into the proto."""
        with st.form("my_form"):
            st.scatterplot_matrix_chart(_test_data())

        # The form element is enqueued first; the chart is the last delta.
        proto = self.get_delta_from_queue().new_element.scatterplot_matrix_chart
        assert proto.form_id != ""

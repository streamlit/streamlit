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

"""st.filter_bar unit tests."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pyarrow as pa
import pytest

from streamlit.elements.lib.column_config_utils import ColumnDataKind
from streamlit.elements.widgets.filter_bar import (
    FILTER_TYPE_TEXT,
    FilterBarSerde,
    FilterConfig,
    _apply_filter_config,
    _apply_filters,
    _compute_filter_bar_signature,
    _determine_filter_columns,
    _get_filter_logic,
    _reconcile_state,
    _resolve_columns_param,
    _resolve_relative_date_range,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.FilterBar_pb2 import (
    FILTER_TYPE_DATE_RANGE,
    FILTER_TYPE_DATETIME_RANGE,
    FILTER_TYPE_MULTISELECT,
    FILTER_TYPE_RANGE,
    FILTER_TYPE_TOGGLE,
)


def _make_arrow_schema(df: pd.DataFrame) -> pa.Schema:
    """Convert a pandas DataFrame to a PyArrow schema."""
    return pa.Table.from_pandas(df).schema


# --- FilterBarSerde tests ---


class TestFilterBarSerde:
    """Tests for FilterBarSerde serialization/deserialization."""

    def test_deserialize_none_returns_empty(self) -> None:
        """Deserializing None returns an empty dict."""
        serde = FilterBarSerde()
        assert serde.deserialize(None) == {}

    def test_deserialize_empty_string_returns_empty(self) -> None:
        """Deserializing an empty string returns an empty dict."""
        serde = FilterBarSerde()
        assert serde.deserialize("") == {}

    def test_deserialize_valid_json(self) -> None:
        """Deserializing valid JSON returns the parsed state."""
        serde = FilterBarSerde()
        state = '{"status": {"type": "multiselect", "values": ["active"]}}'
        result = serde.deserialize(state)
        assert result == {"status": {"type": "multiselect", "values": ["active"]}}

    def test_deserialize_invalid_json_returns_empty(self) -> None:
        """Deserializing invalid JSON returns an empty dict."""
        serde = FilterBarSerde()
        assert serde.deserialize("not valid json{") == {}

    def test_serialize_empty_state(self) -> None:
        """Serializing an empty state returns '{}'."""
        serde = FilterBarSerde()
        assert serde.serialize({}) == "{}"

    def test_serialize_roundtrip(self) -> None:
        """Serialize then deserialize produces the same state."""
        serde = FilterBarSerde()
        state = {
            "price": {"type": "range", "min": 10, "max": 100},
            "status": {"type": "multiselect", "values": ["a", "b"]},
        }
        result = serde.deserialize(serde.serialize(state))
        assert result == state


# --- _compute_filter_bar_signature tests ---


class TestComputeFilterBarSignature:
    """Tests for filter bar signature computation."""

    def test_same_schema_produces_same_signature(self) -> None:
        """Identical schemas produce the same signature."""
        schema = {"col_a": ColumnDataKind.STRING, "col_b": ColumnDataKind.INTEGER}
        sig1 = _compute_filter_bar_signature(schema)
        sig2 = _compute_filter_bar_signature(schema)
        assert sig1 == sig2

    def test_different_schema_produces_different_signature(self) -> None:
        """Different schemas produce different signatures."""
        schema1 = {"col_a": ColumnDataKind.STRING}
        schema2 = {"col_a": ColumnDataKind.INTEGER}
        assert _compute_filter_bar_signature(schema1) != _compute_filter_bar_signature(
            schema2
        )

    def test_column_order_does_not_affect_signature(self) -> None:
        """Column order does not matter — schemas are sorted internally."""
        schema1 = {"b": ColumnDataKind.STRING, "a": ColumnDataKind.INTEGER}
        schema2 = {"a": ColumnDataKind.INTEGER, "b": ColumnDataKind.STRING}
        assert _compute_filter_bar_signature(schema1) == _compute_filter_bar_signature(
            schema2
        )

    def test_adding_column_changes_signature(self) -> None:
        """Adding a column changes the signature."""
        schema1 = {"a": ColumnDataKind.STRING}
        schema2 = {"a": ColumnDataKind.STRING, "b": ColumnDataKind.FLOAT}
        assert _compute_filter_bar_signature(schema1) != _compute_filter_bar_signature(
            schema2
        )

    def test_signature_stable_when_values_change(self) -> None:
        """Same column names and types with different values produce same signature."""
        schema = {"name": ColumnDataKind.STRING, "age": ColumnDataKind.INTEGER}
        sig1 = _compute_filter_bar_signature(schema)
        sig2 = _compute_filter_bar_signature(schema)
        assert sig1 == sig2

    def test_signature_stable_regardless_of_row_count(self) -> None:
        """Signature is schema-only — row count is not included."""
        schema = {"x": ColumnDataKind.FLOAT, "y": ColumnDataKind.STRING}
        sig = _compute_filter_bar_signature(schema)
        assert sig == _compute_filter_bar_signature(schema)

    def test_signature_changes_when_column_renamed(self) -> None:
        """Renaming a column changes the signature."""
        schema1 = {"revenue": ColumnDataKind.FLOAT}
        schema2 = {"income": ColumnDataKind.FLOAT}
        assert _compute_filter_bar_signature(schema1) != _compute_filter_bar_signature(
            schema2
        )

    def test_signature_changes_when_column_type_changes(self) -> None:
        """Changing a column's data kind changes the signature."""
        schema1 = {"price": ColumnDataKind.FLOAT}
        schema2 = {"price": ColumnDataKind.STRING}
        assert _compute_filter_bar_signature(schema1) != _compute_filter_bar_signature(
            schema2
        )

    def test_signature_distinguishes_column_name_boundaries(self) -> None:
        """Columns ['a', 'bc'] vs ['ab', 'c'] produce different signatures."""
        schema1 = {"a": ColumnDataKind.STRING, "bc": ColumnDataKind.STRING}
        schema2 = {"ab": ColumnDataKind.STRING, "c": ColumnDataKind.STRING}
        assert _compute_filter_bar_signature(schema1) != _compute_filter_bar_signature(
            schema2
        )


# --- _determine_filter_columns tests ---


class TestDetermineFilterColumns:
    """Tests for automatic filter type inference."""

    def test_string_column_becomes_multiselect(self) -> None:
        """String columns are assigned MULTISELECT filter type."""
        df = pd.DataFrame({"status": ["active", "inactive", "pending"]})
        cols = _determine_filter_columns(df, _make_arrow_schema(df))
        assert len(cols) == 1
        assert cols[0].name == "status"
        assert cols[0].filter_type == FILTER_TYPE_MULTISELECT

    def test_integer_column_becomes_range(self) -> None:
        """Integer columns are assigned RANGE filter type."""
        df = pd.DataFrame({"count": [1, 2, 3, 4, 5]})
        cols = _determine_filter_columns(df, _make_arrow_schema(df))
        assert len(cols) == 1
        assert cols[0].filter_type == FILTER_TYPE_RANGE
        assert cols[0].min_value == 1.0
        assert cols[0].max_value == 5.0

    def test_float_column_becomes_range(self) -> None:
        """Float columns are assigned RANGE filter type with correct bounds."""
        df = pd.DataFrame({"price": [1.5, 10.0, 99.9]})
        cols = _determine_filter_columns(df, _make_arrow_schema(df))
        assert cols[0].filter_type == FILTER_TYPE_RANGE
        assert cols[0].min_value == pytest.approx(1.5)
        assert cols[0].max_value == pytest.approx(99.9)

    def test_boolean_column_becomes_toggle(self) -> None:
        """Boolean columns are assigned TOGGLE filter type."""
        df = pd.DataFrame({"active": [True, False, True]})
        cols = _determine_filter_columns(df, _make_arrow_schema(df))
        assert cols[0].filter_type == FILTER_TYPE_TOGGLE

    def test_date_column_becomes_date_range(self) -> None:
        """Date columns are assigned DATE_RANGE filter type."""
        df = pd.DataFrame(
            {"created": pd.to_datetime(["2024-01-01", "2024-06-15", "2024-12-31"])}
        )
        cols = _determine_filter_columns(df, _make_arrow_schema(df))
        assert cols[0].filter_type in {
            FILTER_TYPE_DATE_RANGE,
            FILTER_TYPE_DATETIME_RANGE,
        }

    def test_multiselect_options_are_populated(self) -> None:
        """Multiselect columns have their unique values in options."""
        df = pd.DataFrame({"color": ["red", "blue", "red", "green"]})
        cols = _determine_filter_columns(df, _make_arrow_schema(df))
        assert set(cols[0].options) == {"red", "blue", "green"}

    def test_multiselect_options_exclude_nan(self) -> None:
        """NaN values are not included in multiselect options."""
        df = pd.DataFrame({"color": ["red", None, "blue", np.nan]})
        cols = _determine_filter_columns(df, _make_arrow_schema(df))
        options = list(cols[0].options)
        assert "nan" not in options
        assert "None" not in options

    def test_index_column_excluded(self) -> None:
        """The _index column is excluded from filter columns."""
        df = pd.DataFrame({"a": [1, 2], "b": ["x", "y"]})
        cols = _determine_filter_columns(df, _make_arrow_schema(df))
        names = [c.name for c in cols]
        assert "_index" not in names

    def test_multiple_column_types(self) -> None:
        """Multiple columns with different types are correctly inferred."""
        df = pd.DataFrame(
            {
                "name": ["Alice", "Bob"],
                "age": [30, 25],
                "active": [True, False],
                "score": [3.5, 4.2],
            }
        )
        cols = _determine_filter_columns(df, _make_arrow_schema(df))
        type_map = {c.name: c.filter_type for c in cols}
        assert type_map["name"] == FILTER_TYPE_MULTISELECT
        assert type_map["age"] == FILTER_TYPE_RANGE
        assert type_map["active"] == FILTER_TYPE_TOGGLE
        assert type_map["score"] == FILTER_TYPE_RANGE


# --- _apply_filters tests ---


class TestApplyFilters:
    """Tests for filter execution logic."""

    @pytest.fixture
    def sample_df(self) -> pd.DataFrame:
        """Sample DataFrame for filter tests."""
        return pd.DataFrame(
            {
                "status": ["active", "inactive", "active", "pending", "inactive"],
                "price": [10.0, 20.0, 30.0, 40.0, 50.0],
                "active": [True, False, True, False, True],
                "created": pd.to_datetime(
                    [
                        "2024-01-01",
                        "2024-03-15",
                        "2024-06-01",
                        "2024-09-01",
                        "2024-12-31",
                    ]
                ),
            }
        )

    def test_empty_filter_state_returns_all_rows(self, sample_df: pd.DataFrame) -> None:
        """No filters active returns the original DataFrame unchanged."""
        result = _apply_filters(sample_df, {})
        pd.testing.assert_frame_equal(result, sample_df)

    def test_multiselect_single_value(self, sample_df: pd.DataFrame) -> None:
        """Multiselect with one value filters correctly."""
        state = {"status": {"type": "multiselect", "values": ["active"]}}
        result = _apply_filters(sample_df, state)
        assert len(result) == 2
        assert all(result["status"] == "active")

    def test_multiselect_multiple_values(self, sample_df: pd.DataFrame) -> None:
        """Multiselect with multiple values uses OR within the filter."""
        state = {"status": {"type": "multiselect", "values": ["active", "pending"]}}
        result = _apply_filters(sample_df, state)
        assert len(result) == 3
        assert set(result["status"].unique()) == {"active", "pending"}

    def test_multiselect_empty_values_returns_all(
        self, sample_df: pd.DataFrame
    ) -> None:
        """Multiselect with empty values list does not filter."""
        state = {"status": {"type": "multiselect", "values": []}}
        result = _apply_filters(sample_df, state)
        assert len(result) == len(sample_df)

    def test_range_min_only(self, sample_df: pd.DataFrame) -> None:
        """Range filter with min only excludes rows below threshold."""
        state = {"price": {"type": "range", "min": 25, "max": None}}
        result = _apply_filters(sample_df, state)
        assert len(result) == 3
        assert all(result["price"] >= 25)

    def test_range_max_only(self, sample_df: pd.DataFrame) -> None:
        """Range filter with max only excludes rows above threshold."""
        state = {"price": {"type": "range", "min": None, "max": 30}}
        result = _apply_filters(sample_df, state)
        assert len(result) == 3
        assert all(result["price"] <= 30)

    def test_range_min_and_max(self, sample_df: pd.DataFrame) -> None:
        """Range filter with both bounds filters to the range."""
        state = {"price": {"type": "range", "min": 20, "max": 40}}
        result = _apply_filters(sample_df, state)
        assert len(result) == 3
        assert all(result["price"] >= 20)
        assert all(result["price"] <= 40)

    def test_toggle_true(self, sample_df: pd.DataFrame) -> None:
        """Toggle filter with True keeps only true rows."""
        state = {"active": {"type": "toggle", "value": True}}
        result = _apply_filters(sample_df, state)
        assert len(result) == 3
        assert result["active"].all()

    def test_toggle_false(self, sample_df: pd.DataFrame) -> None:
        """Toggle filter with False keeps only false rows."""
        state = {"active": {"type": "toggle", "value": False}}
        result = _apply_filters(sample_df, state)
        assert len(result) == 2
        assert not any(result["active"])

    def test_toggle_null_returns_all(self, sample_df: pd.DataFrame) -> None:
        """Toggle filter with None (All) does not filter."""
        state = {"active": {"type": "toggle", "value": None}}
        result = _apply_filters(sample_df, state)
        assert len(result) == len(sample_df)

    def test_date_range_start_only(self, sample_df: pd.DataFrame) -> None:
        """Date range with start only excludes earlier rows."""
        state = {"created": {"type": "date_range", "start": "2024-06-01", "end": None}}
        result = _apply_filters(sample_df, state)
        assert len(result) == 3
        assert all(pd.to_datetime(result["created"]) >= pd.Timestamp("2024-06-01"))

    def test_date_range_end_only(self, sample_df: pd.DataFrame) -> None:
        """Date range with end only excludes later rows."""
        state = {"created": {"type": "date_range", "start": None, "end": "2024-06-01"}}
        result = _apply_filters(sample_df, state)
        assert len(result) == 3
        assert all(pd.to_datetime(result["created"]) <= pd.Timestamp("2024-06-01"))

    def test_date_range_both_bounds(self, sample_df: pd.DataFrame) -> None:
        """Date range with both bounds filters to the interval."""
        state = {
            "created": {
                "type": "date_range",
                "start": "2024-03-01",
                "end": "2024-09-30",
            }
        }
        result = _apply_filters(sample_df, state)
        assert len(result) == 3

    def test_multiple_filters_compose_with_and(self, sample_df: pd.DataFrame) -> None:
        """Multiple filters are composed with AND logic."""
        state = {
            "status": {"type": "multiselect", "values": ["active", "inactive"]},
            "price": {"type": "range", "min": 25, "max": None},
        }
        result = _apply_filters(sample_df, state)
        assert len(result) == 2
        assert all(result["status"].isin(["active", "inactive"]))
        assert all(result["price"] >= 25)

    def test_unknown_column_is_skipped(self, sample_df: pd.DataFrame) -> None:
        """Filters referencing columns not in the DataFrame are skipped."""
        state = {"nonexistent": {"type": "multiselect", "values": ["x"]}}
        result = _apply_filters(sample_df, state)
        assert len(result) == len(sample_df)

    def test_all_rows_filtered_out(self, sample_df: pd.DataFrame) -> None:
        """When all rows are filtered out, an empty DataFrame is returned."""
        state = {"price": {"type": "range", "min": 999, "max": None}}
        result = _apply_filters(sample_df, state)
        assert len(result) == 0
        assert list(result.columns) == list(sample_df.columns)


# --- _resolve_columns_param tests ---


class TestResolveColumnsParam:
    """Tests for the columns parameter resolution logic."""

    @pytest.fixture
    def sample_df(self) -> pd.DataFrame:
        """Sample DataFrame with multiple column types."""
        return pd.DataFrame(
            {
                "name": ["Alice", "Bob", "Carol"],
                "age": [25, 30, 35],
                "active": [True, False, True],
                "score": [3.5, 4.0, 4.5],
            }
        )

    @pytest.fixture
    def all_columns(self, sample_df: pd.DataFrame) -> list:
        """All filter columns from the sample DataFrame."""
        return _determine_filter_columns(sample_df, _make_arrow_schema(sample_df))

    def test_none_returns_all_columns(
        self, sample_df: pd.DataFrame, all_columns: list
    ) -> None:
        """columns=None returns all auto-detected filter columns."""
        result = _resolve_columns_param(None, all_columns, sample_df)
        assert len(result) == len(all_columns)

    def test_sequence_filters_to_subset(
        self, sample_df: pd.DataFrame, all_columns: list
    ) -> None:
        """A list of column names returns only those columns."""
        result = _resolve_columns_param(["name", "age"], all_columns, sample_df)
        names = [c.name for c in result]
        assert names == ["name", "age"]

    def test_sequence_preserves_order(
        self, sample_df: pd.DataFrame, all_columns: list
    ) -> None:
        """Column order in the sequence is preserved in the result."""
        result = _resolve_columns_param(["score", "name"], all_columns, sample_df)
        names = [c.name for c in result]
        assert names == ["score", "name"]

    def test_mapping_includes_non_none_values(
        self, sample_df: pd.DataFrame, all_columns: list
    ) -> None:
        """Mapping with non-None values includes those columns."""
        result = _resolve_columns_param(
            {"name": {}, "age": {}, "active": None}, all_columns, sample_df
        )
        names = [c.name for c in result]
        assert "name" in names
        assert "age" in names
        assert "active" not in names

    def test_mapping_excludes_none_values(
        self, sample_df: pd.DataFrame, all_columns: list
    ) -> None:
        """Mapping with None values excludes those columns."""
        result = _resolve_columns_param(
            {"name": None, "age": {}, "score": {}}, all_columns, sample_df
        )
        names = [c.name for c in result]
        assert "name" not in names
        assert len(names) == 2

    def test_missing_column_raises_error(
        self, sample_df: pd.DataFrame, all_columns: list
    ) -> None:
        """Column names not in the DataFrame raise StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException, match="not found"):
            _resolve_columns_param(["nonexistent"], all_columns, sample_df)

    def test_missing_column_in_mapping_raises_error(
        self, sample_df: pd.DataFrame, all_columns: list
    ) -> None:
        """Mapping keys not in the DataFrame raise StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException, match="not found"):
            _resolve_columns_param({"name": {}, "ghost": {}}, all_columns, sample_df)


# --- FilterConfig tests ---


class TestFilterConfig:
    """Tests for FilterConfig-based column configuration."""

    @pytest.fixture
    def sample_df(self) -> pd.DataFrame:
        """Sample DataFrame with multiple column types."""
        return pd.DataFrame(
            {
                "name": ["Alice", "Bob", "Carol", "Dave"],
                "age": [25, 30, 35, 40],
                "score": [3.5, 4.0, 4.5, 5.0],
                "active": [True, False, True, False],
            }
        )

    @pytest.fixture
    def all_columns(self, sample_df: pd.DataFrame) -> list:
        """All filter columns from the sample DataFrame."""
        return _determine_filter_columns(sample_df, _make_arrow_schema(sample_df))

    def test_filter_config_overrides_type(
        self, sample_df: pd.DataFrame, all_columns: list
    ) -> None:
        """FilterConfig(type=...) overrides the auto-inferred filter type."""
        result = _resolve_columns_param(
            {"age": FilterConfig(type="multiselect")}, all_columns, sample_df
        )
        assert len(result) == 1
        assert result[0].name == "age"
        assert result[0].filter_type == FILTER_TYPE_MULTISELECT

    def test_filter_config_overrides_options(
        self, sample_df: pd.DataFrame, all_columns: list
    ) -> None:
        """FilterConfig(options=...) overrides the auto-detected options."""
        result = _resolve_columns_param(
            {"name": FilterConfig(options=["Alice", "Bob"])},
            all_columns,
            sample_df,
        )
        assert list(result[0].options) == ["Alice", "Bob"]

    def test_filter_config_overrides_min_max(
        self, sample_df: pd.DataFrame, all_columns: list
    ) -> None:
        """FilterConfig(min_value, max_value) overrides detected bounds."""
        result = _resolve_columns_param(
            {"age": FilterConfig(min_value=0, max_value=100)},
            all_columns,
            sample_df,
        )
        assert result[0].min_value == 0.0
        assert result[0].max_value == 100.0

    def test_filter_config_overrides_label(
        self, sample_df: pd.DataFrame, all_columns: list
    ) -> None:
        """FilterConfig(label=...) sets a custom display label."""
        result = _resolve_columns_param(
            {"name": FilterConfig(label="Full Name")},
            all_columns,
            sample_df,
        )
        assert result[0].custom_label == "Full Name"

    def test_empty_filter_config_uses_auto_inference(
        self, sample_df: pd.DataFrame, all_columns: list
    ) -> None:
        """An empty FilterConfig() uses auto-inferred settings."""
        result = _resolve_columns_param({"age": FilterConfig()}, all_columns, sample_df)
        assert result[0].filter_type == FILTER_TYPE_RANGE
        assert result[0].min_value == 25.0
        assert result[0].max_value == 40.0

    def test_filter_config_type_multiselect_populates_options(
        self, sample_df: pd.DataFrame, all_columns: list
    ) -> None:
        """Overriding type to multiselect populates options from data."""
        result = _resolve_columns_param(
            {"age": FilterConfig(type="multiselect")}, all_columns, sample_df
        )
        assert set(result[0].options) == {"25", "30", "35", "40"}

    def test_mixed_filter_config_and_none(
        self, sample_df: pd.DataFrame, all_columns: list
    ) -> None:
        """Mapping with FilterConfig and None values works together."""
        result = _resolve_columns_param(
            {
                "name": FilterConfig(options=["Alice"]),
                "age": None,
                "score": FilterConfig(type="range", min_value=1, max_value=10),
                "active": FilterConfig(),
            },
            all_columns,
            sample_df,
        )
        names = [c.name for c in result]
        assert "name" in names
        assert "age" not in names
        assert "score" in names
        assert "active" in names
        assert len(result) == 3


# --- Operator dispatch tests ---


class TestApplyFiltersWithOperators:
    """Tests for operator-aware filter dispatch."""

    @pytest.fixture
    def sample_df(self) -> pd.DataFrame:
        """Sample DataFrame with nulls for operator tests."""
        return pd.DataFrame(
            {
                "status": ["active", "inactive", "active", "pending", None],
                "price": [10.0, 20.0, 30.0, 40.0, None],
                "active": [True, False, True, False, None],
                "created": pd.to_datetime(
                    [
                        "2024-01-01",
                        "2024-03-15",
                        "2024-06-01",
                        "2024-09-01",
                        pd.NaT,
                    ]
                ),
                "description": [
                    "Hello world",
                    "Goodbye moon",
                    "Hello again",
                    "Start here",
                    None,
                ],
            }
        )

    # --- Null operators (universal) ---

    def test_is_null_keeps_only_null_rows(self, sample_df: pd.DataFrame) -> None:
        """is_null operator keeps only rows where the column is null."""
        state = {"status": {"type": "multiselect", "operator": "is_null"}}
        result = _apply_filters(sample_df, state)
        assert len(result) == 1
        assert result["status"].isna().all()

    def test_is_not_null_excludes_null_rows(self, sample_df: pd.DataFrame) -> None:
        """is_not_null operator excludes rows where the column is null."""
        state = {"price": {"type": "range", "operator": "is_not_null"}}
        result = _apply_filters(sample_df, state)
        assert len(result) == 4
        assert result["price"].notna().all()

    def test_is_null_on_date_column(self, sample_df: pd.DataFrame) -> None:
        """is_null works on date columns."""
        state = {"created": {"type": "date_range", "operator": "is_null"}}
        result = _apply_filters(sample_df, state)
        assert len(result) == 1
        assert result["created"].isna().all()

    # --- Multiselect operators ---

    def test_multiselect_is_operator(self, sample_df: pd.DataFrame) -> None:
        """Explicit 'is' operator behaves same as default (inclusion)."""
        state = {
            "status": {"type": "multiselect", "operator": "is", "values": ["active"]}
        }
        result = _apply_filters(sample_df, state)
        assert len(result) == 2
        assert all(result["status"] == "active")

    def test_multiselect_is_not_operator(self, sample_df: pd.DataFrame) -> None:
        """'is_not' operator excludes the selected values."""
        state = {
            "status": {
                "type": "multiselect",
                "operator": "is_not",
                "values": ["active"],
            }
        }
        result = _apply_filters(sample_df, state)
        assert "active" not in result["status"].values

    def test_multiselect_no_operator_defaults_to_is(
        self, sample_df: pd.DataFrame
    ) -> None:
        """Missing operator field defaults to 'is' (backward compat)."""
        state = {"status": {"type": "multiselect", "values": ["active"]}}
        result = _apply_filters(sample_df, state)
        assert len(result) == 2
        assert all(result["status"] == "active")

    def test_multiselect_is_not_with_multiple_values(
        self, sample_df: pd.DataFrame
    ) -> None:
        """'is_not' with multiple values excludes all of them."""
        state = {
            "status": {
                "type": "multiselect",
                "operator": "is_not",
                "values": ["active", "pending"],
            }
        }
        result = _apply_filters(sample_df, state)
        assert not any(result["status"].isin(["active", "pending"]))

    # --- Text operators ---

    def test_text_contains(self, sample_df: pd.DataFrame) -> None:
        """'contains' operator matches substring (case-insensitive)."""
        state = {
            "description": {"type": "text", "operator": "contains", "query": "hello"}
        }
        result = _apply_filters(sample_df, state)
        assert len(result) == 2

    def test_text_equals(self, sample_df: pd.DataFrame) -> None:
        """'equals' operator matches exact string."""
        state = {
            "description": {
                "type": "text",
                "operator": "equals",
                "query": "Hello world",
            }
        }
        result = _apply_filters(sample_df, state)
        assert len(result) == 1
        assert result.iloc[0]["description"] == "Hello world"

    def test_text_starts_with(self, sample_df: pd.DataFrame) -> None:
        """'starts_with' operator matches prefix."""
        state = {
            "description": {
                "type": "text",
                "operator": "starts_with",
                "query": "Hello",
            }
        }
        result = _apply_filters(sample_df, state)
        assert len(result) == 2

    def test_text_ends_with(self, sample_df: pd.DataFrame) -> None:
        """'ends_with' operator matches suffix."""
        state = {
            "description": {
                "type": "text",
                "operator": "ends_with",
                "query": "here",
            }
        }
        result = _apply_filters(sample_df, state)
        assert len(result) == 1
        assert result.iloc[0]["description"] == "Start here"

    def test_text_default_operator_is_contains(self, sample_df: pd.DataFrame) -> None:
        """Missing operator defaults to 'contains'."""
        state = {"description": {"type": "text", "query": "hello"}}
        result = _apply_filters(sample_df, state)
        assert len(result) == 2

    def test_text_empty_query_returns_all(self, sample_df: pd.DataFrame) -> None:
        """Empty query string does not filter."""
        state = {"description": {"type": "text", "operator": "contains", "query": ""}}
        result = _apply_filters(sample_df, state)
        assert len(result) == len(sample_df)

    def test_text_not_contains_operator(self, sample_df: pd.DataFrame) -> None:
        """'not_contains' excludes rows matching the query."""
        state = {
            "description": {
                "type": "text",
                "operator": "not_contains",
                "query": "hello",
            }
        }
        result = _apply_filters(sample_df, state)
        assert len(result) == 3
        assert all(
            "hello" not in str(v).lower() for v in result["description"].dropna()
        )

    def test_text_not_equals_operator(self, sample_df: pd.DataFrame) -> None:
        """'not_equals' excludes rows with exact match."""
        state = {
            "description": {
                "type": "text",
                "operator": "not_equals",
                "query": "Hello world",
            }
        }
        result = _apply_filters(sample_df, state)
        assert "Hello world" not in result["description"].values
        assert len(result) == 4

    # --- Range operators ---

    def test_range_between_default(self, sample_df: pd.DataFrame) -> None:
        """Default range behavior (between) unchanged."""
        state = {"price": {"type": "range", "min": 20, "max": 40}}
        result = _apply_filters(sample_df, state)
        assert len(result) == 3
        assert all(result["price"] >= 20)
        assert all(result["price"] <= 40)

    def test_range_equals_operator(self, sample_df: pd.DataFrame) -> None:
        """'equals' operator matches exact value."""
        state = {"price": {"type": "range", "operator": "equals", "min": 30.0}}
        result = _apply_filters(sample_df, state)
        assert len(result) == 1
        assert result.iloc[0]["price"] == 30.0

    def test_range_greater_than_operator(self, sample_df: pd.DataFrame) -> None:
        """'greater_than' operator uses strict comparison."""
        state = {"price": {"type": "range", "operator": "greater_than", "min": 30.0}}
        result = _apply_filters(sample_df, state)
        assert len(result) == 1
        assert all(result["price"] > 30.0)

    def test_range_less_than_operator(self, sample_df: pd.DataFrame) -> None:
        """'less_than' operator uses strict comparison."""
        state = {"price": {"type": "range", "operator": "less_than", "max": 30.0}}
        result = _apply_filters(sample_df, state)
        assert len(result) == 2
        assert all(result["price"] < 30.0)

    def test_range_not_equals_operator(self, sample_df: pd.DataFrame) -> None:
        """'not_equals' excludes rows matching the value (NaN passes)."""
        state = {"price": {"type": "range", "operator": "not_equals", "min": 30.0}}
        result = _apply_filters(sample_df, state)
        assert 30.0 not in result["price"].dropna().values
        assert len(result) == 4

    def test_range_not_between_operator(self, sample_df: pd.DataFrame) -> None:
        """'not_between' excludes rows within the range."""
        state = {
            "price": {
                "type": "range",
                "operator": "not_between",
                "min": 20.0,
                "max": 30.0,
            }
        }
        result = _apply_filters(sample_df, state)
        assert all((result["price"] < 20.0) | (result["price"] > 30.0))
        assert len(result) == 2

    def test_range_not_between_min_only(self, sample_df: pd.DataFrame) -> None:
        """'not_between' with only min acts as less_than."""
        state = {"price": {"type": "range", "operator": "not_between", "min": 25.0}}
        result = _apply_filters(sample_df, state)
        assert all(result["price"] < 25.0)

    # --- Toggle operators ---

    def test_toggle_is_true_operator(self, sample_df: pd.DataFrame) -> None:
        """'is_true' operator keeps true rows."""
        state = {"active": {"type": "toggle", "operator": "is_true"}}
        result = _apply_filters(sample_df, state)
        assert len(result) == 2
        assert result["active"].all()

    def test_toggle_is_false_operator(self, sample_df: pd.DataFrame) -> None:
        """'is_false' operator keeps false rows."""
        state = {"active": {"type": "toggle", "operator": "is_false"}}
        result = _apply_filters(sample_df, state)
        assert len(result) == 2
        assert not any(result["active"])

    def test_toggle_is_null_operator(self, sample_df: pd.DataFrame) -> None:
        """'is_null' on toggle keeps null rows."""
        state = {"active": {"type": "toggle", "operator": "is_null"}}
        result = _apply_filters(sample_df, state)
        assert len(result) == 1
        assert result["active"].isna().all()

    # --- Date range operators ---

    def test_date_range_before_operator(self, sample_df: pd.DataFrame) -> None:
        """'before' operator selects rows before the date."""
        state = {
            "created": {
                "type": "date_range",
                "operator": "before",
                "end": "2024-06-01",
            }
        }
        result = _apply_filters(sample_df, state)
        assert len(result) == 2
        assert all(pd.to_datetime(result["created"]) < pd.Timestamp("2024-06-01"))

    def test_date_range_after_operator(self, sample_df: pd.DataFrame) -> None:
        """'after' operator selects rows after the date."""
        state = {
            "created": {
                "type": "date_range",
                "operator": "after",
                "start": "2024-06-01",
            }
        }
        result = _apply_filters(sample_df, state)
        assert len(result) == 1
        assert all(pd.to_datetime(result["created"]) > pd.Timestamp("2024-06-01"))

    def test_date_range_equals_operator(self, sample_df: pd.DataFrame) -> None:
        """'equals' operator matches exact date."""
        state = {
            "created": {
                "type": "date_range",
                "operator": "equals",
                "start": "2024-06-01",
            }
        }
        result = _apply_filters(sample_df, state)
        assert len(result) == 1

    def test_date_range_not_equals_operator(self, sample_df: pd.DataFrame) -> None:
        """'not_equals' excludes rows matching the exact date (NaT passes)."""
        state = {
            "created": {
                "type": "date_range",
                "operator": "not_equals",
                "start": "2024-06-01",
            }
        }
        result = _apply_filters(sample_df, state)
        assert len(result) == 4
        non_null_dates = pd.to_datetime(result["created"]).dropna()
        assert pd.Timestamp("2024-06-01") not in non_null_dates.values

    def test_date_range_not_between_operator(self, sample_df: pd.DataFrame) -> None:
        """'not_between' excludes rows within the date range."""
        state = {
            "created": {
                "type": "date_range",
                "operator": "not_between",
                "start": "2024-03-01",
                "end": "2024-07-01",
            }
        }
        result = _apply_filters(sample_df, state)
        col_dt = pd.to_datetime(result["created"])
        assert all(
            (col_dt < pd.Timestamp("2024-03-01"))
            | (col_dt > pd.Timestamp("2024-07-01"))
        )
        assert len(result) == 2


# --- Cardinality auto-switch tests ---


class TestCardinalityAutoSwitch:
    """Tests for automatic STRING → TEXT switch at cardinality threshold."""

    def test_low_cardinality_stays_multiselect(self) -> None:
        """STRING column with <=50 unique values stays multiselect."""
        values = [f"val_{i}" for i in range(50)]
        df = pd.DataFrame({"col": values})
        cols = _determine_filter_columns(df, _make_arrow_schema(df))
        assert cols[0].filter_type == FILTER_TYPE_MULTISELECT
        assert len(cols[0].options) == 50

    def test_high_cardinality_becomes_text(self) -> None:
        """STRING column with >50 unique values becomes TEXT."""
        values = [f"val_{i}" for i in range(51)]
        df = pd.DataFrame({"col": values})
        cols = _determine_filter_columns(df, _make_arrow_schema(df))
        assert cols[0].filter_type == FILTER_TYPE_TEXT
        assert len(cols[0].options) == 0

    def test_threshold_boundary(self) -> None:
        """Exactly 50 unique values stays multiselect, 51 switches."""
        at_threshold = pd.DataFrame({"col": [f"v{i}" for i in range(50)]})
        above_threshold = pd.DataFrame({"col": [f"v{i}" for i in range(51)]})
        cols_at = _determine_filter_columns(
            at_threshold, _make_arrow_schema(at_threshold)
        )
        cols_above = _determine_filter_columns(
            above_threshold, _make_arrow_schema(above_threshold)
        )
        assert cols_at[0].filter_type == FILTER_TYPE_MULTISELECT
        assert cols_above[0].filter_type == FILTER_TYPE_TEXT

    def test_text_type_gets_text_operators(self) -> None:
        """TEXT columns get text-specific operators."""
        values = [f"val_{i}" for i in range(101)]
        df = pd.DataFrame({"col": values})
        cols = _determine_filter_columns(df, _make_arrow_schema(df))
        assert "contains" in cols[0].operators
        assert "starts_with" in cols[0].operators
        assert "is_null" in cols[0].operators


# --- Operators in proto tests ---


class TestOperatorsInProto:
    """Tests for operators field population in FilterColumnMeta proto."""

    def test_multiselect_operators_populated(self) -> None:
        """Multiselect columns get multiselect operators."""
        df = pd.DataFrame({"status": ["a", "b", "c"]})
        cols = _determine_filter_columns(df, _make_arrow_schema(df))
        ops = list(cols[0].operators)
        assert ops == ["is", "is_not", "is_null", "is_not_null"]

    def test_range_operators_populated(self) -> None:
        """Range columns get range operators including negation."""
        df = pd.DataFrame({"price": [1.0, 2.0, 3.0]})
        cols = _determine_filter_columns(df, _make_arrow_schema(df))
        ops = list(cols[0].operators)
        assert ops == [
            "between",
            "not_between",
            "equals",
            "not_equals",
            "greater_than",
            "less_than",
            "is_null",
            "is_not_null",
        ]

    def test_toggle_operators_populated(self) -> None:
        """Toggle columns get toggle operators."""
        df = pd.DataFrame({"active": [True, False]})
        cols = _determine_filter_columns(df, _make_arrow_schema(df))
        ops = list(cols[0].operators)
        assert ops == ["is_true", "is_false", "is_null"]

    def test_date_range_operators_populated(self) -> None:
        """Date columns get date_range operators including negation."""
        df = pd.DataFrame({"d": pd.to_datetime(["2024-01-01", "2024-06-01"])})
        cols = _determine_filter_columns(df, _make_arrow_schema(df))
        ops = list(cols[0].operators)
        assert "between" in ops
        assert "not_between" in ops
        assert "before" in ops
        assert "after" in ops
        assert "equals" in ops
        assert "not_equals" in ops

    def test_filter_config_operators_restricts(self) -> None:
        """FilterConfig(operators=...) restricts the operators list."""
        df = pd.DataFrame({"price": [1.0, 2.0, 3.0]})
        all_cols = _determine_filter_columns(df, _make_arrow_schema(df))
        result = _resolve_columns_param(
            {"price": FilterConfig(operators=["between", "greater_than"])},
            all_cols,
            df,
        )
        ops = list(result[0].operators)
        assert ops == ["between", "greater_than"]

    def test_filter_config_operators_filters_invalid(self) -> None:
        """FilterConfig operators that are invalid for the type are dropped."""
        df = pd.DataFrame({"price": [1.0, 2.0, 3.0]})
        all_cols = _determine_filter_columns(df, _make_arrow_schema(df))
        result = _resolve_columns_param(
            {"price": FilterConfig(operators=["between", "contains"])},
            all_cols,
            df,
        )
        ops = list(result[0].operators)
        assert ops == ["between"]
        assert "contains" not in ops


# --- Stale filter cleanup tests ---


class TestStaleFilterCleanup:
    """Tests for _reconcile_state stale filter removal."""

    def test_removes_orphaned_columns(self) -> None:
        """Filters for columns no longer in the schema are pruned."""
        state = {
            "status": {"type": "multiselect", "values": ["active"]},
            "removed_col": {"type": "text", "query": "hello"},
        }
        valid = {"status", "price"}
        result = _reconcile_state(state, valid)
        assert "status" in result
        assert "removed_col" not in result

    def test_preserves_valid_columns(self) -> None:
        """All filters for valid columns remain intact."""
        state = {
            "status": {"type": "multiselect", "values": ["active"]},
            "price": {"type": "range", "min": 10},
        }
        valid = {"status", "price"}
        result = _reconcile_state(state, valid)
        assert result == state

    def test_empty_state_returns_empty(self) -> None:
        """Empty filter state remains empty."""
        result = _reconcile_state({}, {"status", "price"})
        assert result == {}

    def test_all_columns_removed(self) -> None:
        """All filters pruned when no valid columns remain."""
        state = {"a": {"type": "text"}, "b": {"type": "range"}}
        result = _reconcile_state(state, set())
        assert result == {}


# --- Per-column disabled tests ---


class TestDisabledSequence:
    """Tests for disabled as Sequence[str] marking per-column disabled."""

    def test_per_column_disabled_sets_meta_flag(self) -> None:
        """Columns in disabled list get disabled=True on their FilterColumnMeta."""
        df = pd.DataFrame({"status": ["a", "b"], "price": [1.0, 2.0]})
        all_cols = _determine_filter_columns(df, _make_arrow_schema(df))

        disabled_set = {"status"}
        for col_meta in all_cols:
            if col_meta.name in disabled_set:
                col_meta.disabled = True

        status_col = next(c for c in all_cols if c.name == "status")
        price_col = next(c for c in all_cols if c.name == "price")
        assert status_col.disabled is True
        assert price_col.disabled is False

    def test_per_column_disabled_does_not_affect_filtering(self) -> None:
        """Disabled columns still participate in filtering if state exists."""
        df = pd.DataFrame({"status": ["a", "b", "c"], "price": [1.0, 2.0, 3.0]})
        state = {"status": {"type": "multiselect", "values": ["a"]}}
        result = _apply_filters(df, state)
        assert len(result) == 1
        assert result.iloc[0]["status"] == "a"


# --- Groups-ready state model tests ---


class TestGroupsReadyStateModel:
    """Tests for the groups-ready AND/OR state model."""

    @pytest.fixture
    def sample_df(self) -> pd.DataFrame:
        """Sample DataFrame for group logic tests."""
        return pd.DataFrame(
            {
                "industry": ["Tech", "Finance", "Tech", "Healthcare", "Finance"],
                "stage": ["Lead", "Lead", "Customer", "Lead", "Customer"],
                "revenue": [100.0, 200.0, 300.0, 400.0, 500.0],
            }
        )

    # --- _get_filter_logic tests ---

    def test_get_logic_from_groups(self) -> None:
        """Reads logic from _groups[0].logic."""
        state = {"_groups": [{"logic": "or", "columns": ["a", "b"]}], "a": {}, "b": {}}
        assert _get_filter_logic(state) == "or"

    def test_get_logic_from_groups_default_and(self) -> None:
        """Defaults to 'and' when _groups[0] has no logic key."""
        state = {"_groups": [{"columns": ["a"]}], "a": {}}
        assert _get_filter_logic(state) == "and"

    def test_get_logic_backward_compat_flat(self) -> None:
        """Falls back to _logic key when _groups is absent."""
        state = {"_logic": "or", "a": {}}
        assert _get_filter_logic(state) == "or"

    def test_get_logic_empty_state(self) -> None:
        """Empty state defaults to 'and'."""
        assert _get_filter_logic({}) == "and"

    def test_get_logic_groups_takes_precedence_over_legacy(self) -> None:
        """_groups takes precedence when both _groups and _logic are present."""
        state = {"_groups": [{"logic": "or", "columns": []}], "_logic": "and"}
        assert _get_filter_logic(state) == "or"

    # --- _apply_filters with groups ---

    def test_groups_and_logic(self, sample_df: pd.DataFrame) -> None:
        """AND logic via _groups filters to intersection."""
        state = {
            "_groups": [{"logic": "and", "columns": ["industry", "stage"]}],
            "industry": {"type": "multiselect", "values": ["Tech"]},
            "stage": {"type": "multiselect", "values": ["Lead"]},
        }
        result = _apply_filters(sample_df, state)
        assert len(result) == 1
        assert result.iloc[0]["industry"] == "Tech"
        assert result.iloc[0]["stage"] == "Lead"

    def test_groups_or_logic(self, sample_df: pd.DataFrame) -> None:
        """OR logic via _groups filters to union."""
        state = {
            "_groups": [{"logic": "or", "columns": ["industry", "stage"]}],
            "industry": {"type": "multiselect", "values": ["Tech"]},
            "stage": {"type": "multiselect", "values": ["Lead"]},
        }
        result = _apply_filters(sample_df, state)
        # Tech OR Lead = rows 0,1,2,3 (all except Finance+Customer)
        assert len(result) == 4

    def test_legacy_logic_still_works(self, sample_df: pd.DataFrame) -> None:
        """Legacy _logic key still functions for backward compatibility."""
        state = {
            "_logic": "or",
            "industry": {"type": "multiselect", "values": ["Tech"]},
            "stage": {"type": "multiselect", "values": ["Lead"]},
        }
        result = _apply_filters(sample_df, state)
        assert len(result) == 4

    # --- _reconcile_state with groups ---

    def test_reconcile_preserves_groups_key(self) -> None:
        """_reconcile_state preserves the _groups metadata key."""
        state = {
            "_groups": [{"logic": "or", "columns": ["a", "b"]}],
            "a": {"type": "text"},
            "b": {"type": "range"},
        }
        result = _reconcile_state(state, {"a", "b"})
        assert "_groups" in result
        assert result["_groups"] == [{"logic": "or", "columns": ["a", "b"]}]

    def test_reconcile_prunes_groups_columns(self) -> None:
        """_reconcile_state removes invalid column refs from _groups[0].columns."""
        state = {
            "_groups": [{"logic": "or", "columns": ["a", "removed"]}],
            "a": {"type": "text"},
            "removed": {"type": "range"},
        }
        result = _reconcile_state(state, {"a"})
        assert "removed" not in result
        assert result["_groups"] == [{"logic": "or", "columns": ["a"]}]

    def test_reconcile_handles_missing_groups(self) -> None:
        """_reconcile_state works when _groups is absent (legacy state)."""
        state = {"_logic": "or", "a": {"type": "text"}}
        result = _reconcile_state(state, {"a"})
        assert result == state


class TestDefaultParameter:
    """Tests for the `default` parameter of FilterBarSerde."""

    def test_default_applied_when_no_ui_value(self) -> None:
        """Serde returns default state when ui_value is None (first render)."""
        default_state = {"Industry": {"type": "multiselect", "values": ["Tech"]}}
        serde = FilterBarSerde(default=default_state)
        result = serde.deserialize(None)
        assert result == default_state

    def test_default_applied_when_empty_string(self) -> None:
        """Serde returns default state when ui_value is empty string."""
        default_state = {"Status": {"type": "toggle", "value": True}}
        serde = FilterBarSerde(default=default_state)
        result = serde.deserialize("")
        assert result == default_state

    def test_default_ignored_when_user_has_value(self) -> None:
        """Serde ignores default when ui_value is a valid JSON string."""
        default_state = {"Industry": {"type": "multiselect", "values": ["Tech"]}}
        serde = FilterBarSerde(default=default_state)
        user_value = '{"Stage": {"type": "multiselect", "values": ["Lead"]}}'
        result = serde.deserialize(user_value)
        assert result == {"Stage": {"type": "multiselect", "values": ["Lead"]}}
        assert "Industry" not in result

    def test_default_none_means_empty_state(self) -> None:
        """Serde with default=None returns empty dict when no ui_value."""
        serde = FilterBarSerde(default=None)
        result = serde.deserialize(None)
        assert result == {}

    def test_default_with_invalid_columns_is_pruned(self) -> None:
        """Default state with columns not in valid set is pruned."""
        default_state = {
            "Industry": {"type": "multiselect", "values": ["Tech"]},
            "NonExistent": {"type": "text", "query": "foo"},
        }
        valid_cols = {"Industry", "Stage"}
        reconciled = _reconcile_state(default_state, valid_cols)
        assert "Industry" in reconciled
        assert "NonExistent" not in reconciled

    def test_default_is_a_copy(self) -> None:
        """Multiple deserializations return independent objects."""
        default_state = {"Industry": {"type": "multiselect", "values": ["Tech"]}}
        serde = FilterBarSerde(default=default_state)
        result1 = serde.deserialize(None)
        result2 = serde.deserialize(None)
        # Each call returns a new instance, not a shared reference.
        assert result1 is not result2
        assert result1 == result2
        # Original default dict should not be the same object.
        assert result1 is not default_state

    def test_default_returned_on_malformed_json(self) -> None:
        """Serde returns default when ui_value is invalid JSON."""
        default_state = {"Industry": {"type": "multiselect", "values": ["Tech"]}}
        serde = FilterBarSerde(default=default_state)
        result = serde.deserialize("not valid json{{{")
        assert result == default_state


class TestPersistState:
    """Tests for persist_state parameter wiring."""

    def test_persist_state_param_exists_in_signature(self) -> None:
        """filter_bar function accepts persist_state parameter."""
        import inspect

        from streamlit.elements.widgets.filter_bar import FilterBarMixin

        sig = inspect.signature(FilterBarMixin.filter_bar)
        assert "persist_state" in sig.parameters
        param = sig.parameters["persist_state"]
        assert param.default is None


class TestFilterBarState:
    """Tests for the FilterBarState typed state object."""

    def test_returns_filter_bar_state_instance(self) -> None:
        """Serde deserialize returns a FilterBarState, not a plain dict."""
        from streamlit.elements.widgets.filter_bar import FilterBarState

        serde = FilterBarSerde()
        state = serde.deserialize(
            '{"Industry": {"type": "multiselect", "values": ["Tech"]}}'
        )
        assert isinstance(state, FilterBarState)

    def test_active_filters_property(self) -> None:
        """active_filters returns column names excluding _-prefixed metadata."""
        from streamlit.elements.widgets.filter_bar import FilterBarState

        state = FilterBarState(
            {
                "_groups": [{"logic": "and", "columns": ["Industry", "Stage"]}],
                "Industry": {"type": "multiselect", "values": ["Tech"]},
                "Stage": {"type": "multiselect", "values": ["Lead"]},
            }
        )
        assert sorted(state.active_filters) == ["Industry", "Stage"]

    def test_logic_property_from_groups(self) -> None:
        """logic property reads from _groups[0].logic."""
        from streamlit.elements.widgets.filter_bar import FilterBarState

        state = FilterBarState(
            {"_groups": [{"logic": "or", "columns": ["Industry"]}], "Industry": {}}
        )
        assert state.logic == "or"

    def test_logic_property_default_and(self) -> None:
        """logic defaults to 'and' when no groups or _logic key."""
        from streamlit.elements.widgets.filter_bar import FilterBarState

        state = FilterBarState({"Industry": {"type": "multiselect"}})
        assert state.logic == "and"

    def test_attribute_access(self) -> None:
        """Supports attribute-style access for filter configs."""
        from streamlit.elements.widgets.filter_bar import FilterBarState

        state = FilterBarState(
            {
                "Industry": {
                    "type": "multiselect",
                    "values": ["Tech", "Finance"],
                    "operator": "is",
                }
            }
        )
        assert state.Industry.type == "multiselect"
        assert state.Industry.operator == "is"
        # "values" collides with dict.values() method — use bracket access.
        assert state.Industry["values"] == ["Tech", "Finance"]

    def test_dict_access(self) -> None:
        """Supports dict-style access for filter configs."""
        from streamlit.elements.widgets.filter_bar import FilterBarState

        state = FilterBarState(
            {"Industry": {"type": "multiselect", "values": ["Tech"]}}
        )
        assert state["Industry"]["type"] == "multiselect"
        assert state["Industry"]["values"] == ["Tech"]

    def test_attribute_error_on_missing_key(self) -> None:
        """Raises AttributeError for non-existent attributes."""
        from streamlit.elements.widgets.filter_bar import FilterBarState

        state = FilterBarState({"Industry": {}})
        import pytest

        with pytest.raises(AttributeError, match="no attribute 'NonExistent'"):
            _ = state.NonExistent

    def test_read_only(self) -> None:
        """FilterBarState is read-only."""
        from streamlit.elements.widgets.filter_bar import FilterBarState

        state = FilterBarState({"Industry": {"type": "multiselect"}})
        import pytest

        with pytest.raises(TypeError):
            state["NewKey"] = "value"


class TestRelativeDateOperators:
    """Tests for relative date operator resolution and filtering."""

    def test_resolve_returns_none_for_non_relative(self) -> None:
        """Non-relative operators return None."""
        assert _resolve_relative_date_range("between") is None
        assert _resolve_relative_date_range("before") is None
        assert _resolve_relative_date_range(None) is None

    def test_resolve_today(self) -> None:
        """'today' returns start-of-day to end-of-day."""
        result = _resolve_relative_date_range("today")
        assert result is not None
        start, end = result
        now = pd.Timestamp.now()
        assert start == now.normalize()
        assert end is not None
        assert end.date() == now.date()

    def test_resolve_past_7_days(self) -> None:
        """'past_7_days' returns 7 days ago to now."""
        result = _resolve_relative_date_range("past_7_days")
        assert result is not None
        start, _end = result
        now = pd.Timestamp.now()
        assert (now - start).days == 7

    def test_resolve_past_30_days(self) -> None:
        """'past_30_days' returns 30 days ago to now."""
        result = _resolve_relative_date_range("past_30_days")
        assert result is not None
        start, _end = result
        now = pd.Timestamp.now()
        assert (now - start).days == 30

    def test_resolve_past_90_days(self) -> None:
        """'past_90_days' returns 90 days ago to now."""
        result = _resolve_relative_date_range("past_90_days")
        assert result is not None
        start, _end = result
        now = pd.Timestamp.now()
        assert (now - start).days == 90

    def test_resolve_this_week(self) -> None:
        """'this_week' starts on Monday of the current week."""
        result = _resolve_relative_date_range("this_week")
        assert result is not None
        start, _end = result
        assert start.dayofweek == 0  # Monday

    def test_resolve_this_month(self) -> None:
        """'this_month' starts on the 1st of the current month."""
        result = _resolve_relative_date_range("this_month")
        assert result is not None
        start, _end = result
        assert start.day == 1
        assert start.month == pd.Timestamp.now().month

    def test_resolve_this_year(self) -> None:
        """'this_year' starts on Jan 1 of the current year."""
        result = _resolve_relative_date_range("this_year")
        assert result is not None
        start, _end = result
        assert start.month == 1
        assert start.day == 1
        assert start.year == pd.Timestamp.now().year

    def test_apply_filters_with_relative_operator(self) -> None:
        """Relative operators correctly filter a DataFrame."""
        today = pd.Timestamp.now().normalize()
        df = pd.DataFrame(
            {
                "date": [
                    today - pd.Timedelta(days=3),
                    today - pd.Timedelta(days=10),
                    today - pd.Timedelta(days=50),
                ]
            }
        )
        state = {
            "_groups": [{"logic": "and", "columns": ["date"]}],
            "date": {"type": "date_range", "operator": "past_7_days"},
        }
        result = _apply_filters(df, state)
        assert len(result) == 1
        assert result.iloc[0]["date"] == today - pd.Timedelta(days=3)

    def test_today_excludes_yesterday(self) -> None:
        """The 'today' operator excludes dates from yesterday."""
        today = pd.Timestamp.now().normalize()
        df = pd.DataFrame(
            {
                "date": [
                    today + pd.Timedelta(hours=10),
                    today - pd.Timedelta(days=1),
                ]
            }
        )
        state = {
            "_groups": [{"logic": "and", "columns": ["date"]}],
            "date": {"type": "date_range", "operator": "today"},
        }
        result = _apply_filters(df, state)
        assert len(result) == 1

    def test_relative_operators_in_operator_list(self) -> None:
        """All relative operators are in the date_range operator list."""
        from streamlit.elements.widgets.filter_bar import _OPERATORS_BY_FILTER_TYPE

        date_ops = _OPERATORS_BY_FILTER_TYPE["date_range"]
        for op in [
            "past_7_days",
            "past_30_days",
            "past_90_days",
            "this_week",
            "this_month",
            "this_year",
            "today",
        ]:
            assert op in date_ops


class TestFormatFunc:
    """Tests for FilterConfig format_func generating display_options."""

    def test_format_func_populates_display_options(self) -> None:
        """format_func applied to multiselect options populates display_options."""
        df = pd.DataFrame({"code": ["US", "GB", "DE"]})
        cols = _determine_filter_columns(df, _make_arrow_schema(df))
        config = FilterConfig(format_func=lambda x: f"Country: {x}")
        result = _apply_filter_config(cols[0], config, df)
        assert list(result.display_options) == [
            "Country: DE",
            "Country: GB",
            "Country: US",
        ]

    def test_format_func_none_leaves_display_options_empty(self) -> None:
        """Without format_func, display_options remains empty."""
        df = pd.DataFrame({"code": ["US", "GB", "DE"]})
        cols = _determine_filter_columns(df, _make_arrow_schema(df))
        config = FilterConfig()
        result = _apply_filter_config(cols[0], config, df)
        assert list(result.display_options) == []

    def test_format_func_with_explicit_options(self) -> None:
        """format_func works with explicitly provided options."""
        df = pd.DataFrame({"status": ["A", "B"]})
        cols = _determine_filter_columns(df, _make_arrow_schema(df))
        config = FilterConfig(
            options=["active", "inactive"],
            format_func=str.title,
        )
        result = _apply_filter_config(cols[0], config, df)
        assert list(result.options) == ["active", "inactive"]
        assert list(result.display_options) == ["Active", "Inactive"]

    def test_format_func_on_range_type_no_display_options(self) -> None:
        """format_func on range columns doesn't set display_options (no options)."""
        df = pd.DataFrame({"price": [1.0, 2.0, 3.0]})
        cols = _determine_filter_columns(df, _make_arrow_schema(df))
        config = FilterConfig(format_func=lambda x: f"${x}")
        result = _apply_filter_config(cols[0], config, df)
        assert list(result.display_options) == []

    def test_format_func_stored_on_config(self) -> None:
        """FilterConfig stores format_func attribute."""
        func = lambda x: x.upper()  # noqa: E731
        config = FilterConfig(format_func=func)
        assert config.format_func is func

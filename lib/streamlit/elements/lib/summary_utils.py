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

"""Utilities for processing column summary configuration in st.table."""

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import TYPE_CHECKING, Literal, TypeAlias

import pandas as pd

from streamlit.errors import StreamlitAPIException

if TYPE_CHECKING:
    from pandas import DataFrame

# Summary types that can be applied to columns (actual statistics)
SummaryType: TypeAlias = Literal["count", "sum", "average", "min", "max", "median"]

# Valid summary types as a set for validation
_VALID_SUMMARY_TYPES: frozenset[str] = frozenset(
    ["count", "sum", "average", "min", "max", "median"]
)

# Summary types that require numeric data
_NUMERIC_ONLY_SUMMARY_TYPES: frozenset[str] = frozenset(
    ["sum", "average", "min", "max", "median"]
)

# Input value type: can be a stat type, "all", or "all:stat"
SummaryInputValue: TypeAlias = str

# User-provided summary configuration input type
SummaryConfigInput: TypeAlias = Mapping[str | int, SummaryInputValue]

# Internal parsed summary value (after parsing "all:stat" format)
# Either {"type": "sum"} or {"type": "all", "default": "count"}
ParsedSummaryValue: TypeAlias = dict[str, str]

# Internal normalized summary configuration (column names only, no indices)
SummaryConfig: TypeAlias = dict[str, ParsedSummaryValue]


def _parse_numeric_string(value: str) -> float | None:
    """Try to parse a string as a number, handling comma formatting.

    Parameters
    ----------
    value : str
        The string to parse.

    Returns
    -------
    float | None
        The parsed number, or None if parsing fails.
    """
    try:
        # Remove commas (thousands separators) and try to parse
        cleaned = value.replace(",", "")
        return float(cleaned)
    except (ValueError, AttributeError):
        return None


def _is_numeric_column(column: pd.Series) -> bool:
    """Check if a pandas Series contains numeric data.

    This handles both native numeric dtypes and string columns that contain
    formatted numbers (e.g., "1,234" or "1,234.56").

    Parameters
    ----------
    column : pd.Series
        The column to check.

    Returns
    -------
    bool
        True if the column is numeric or contains parseable numeric strings.
    """
    # First check native numeric dtype
    if pd.api.types.is_numeric_dtype(column):
        return True

    # For object/string columns, check if values can be parsed as numbers
    if column.dtype == object or pd.api.types.is_string_dtype(column):
        non_null_values = column.dropna()
        if len(non_null_values) == 0:
            return False
        # Check if all non-null values can be parsed as numbers
        return all(
            _parse_numeric_string(str(val)) is not None for val in non_null_values
        )

    return False


def _parse_summary_value(value: SummaryInputValue) -> ParsedSummaryValue:
    """Parse a summary input value into the internal format.

    Handles:
    - Simple types: "sum" -> {"type": "sum"}
    - All with default: "all:sum" -> {"type": "all", "default": "sum"}
    - All without default: "all" -> {"type": "all", "default": "count"}

    Parameters
    ----------
    value : SummaryInputValue
        The user-provided summary value (e.g., "sum", "all", "all:sum").

    Returns
    -------
    ParsedSummaryValue
        The parsed summary value as a dict.

    Raises
    ------
    StreamlitAPIException
        If the value format is invalid.
    """
    # Check if it's an "all" format
    if value == "all":
        return {"type": "all", "default": "count"}

    if value.startswith("all:"):
        default_stat = value[4:]  # Get everything after "all:"
        if not default_stat:
            # "all:" with empty default -> use "count"
            return {"type": "all", "default": "count"}
        if default_stat not in _VALID_SUMMARY_TYPES:
            valid_types = ", ".join(f'"{t}"' for t in sorted(_VALID_SUMMARY_TYPES))
            raise StreamlitAPIException(
                f'Invalid default summary type "{default_stat}" in "all:{default_stat}". '
                f"Valid types are: {valid_types}"
            )
        return {"type": "all", "default": default_stat}

    # Simple summary type
    if value not in _VALID_SUMMARY_TYPES:
        valid_types = ", ".join(f'"{t}"' for t in sorted(_VALID_SUMMARY_TYPES))
        raise StreamlitAPIException(
            f'Invalid summary type "{value}". '
            f'Valid types are: {valid_types}, "all", or "all:<type>"'
        )

    return {"type": value}


def _resolve_column_reference(
    column_ref: str | int,
    data_df: DataFrame,
) -> str:
    """Resolve a column reference (name or index) to a column name.

    Parameters
    ----------
    column_ref : str | int
        The column reference - either a column name (string) or
        positional index (integer, 0-based, excluding index columns).

    data_df : DataFrame
        The DataFrame to resolve the column reference against.

    Returns
    -------
    str
        The resolved column name.

    Raises
    ------
    StreamlitAPIException
        If the column reference is invalid or out of range.
    """
    columns = list(data_df.columns)

    if isinstance(column_ref, int):
        if column_ref < 0 or column_ref >= len(columns):
            raise StreamlitAPIException(
                f"Column index {column_ref} is out of range. "
                f"Valid indices are 0 to {len(columns) - 1}."
            )
        return str(columns[column_ref])

    # It's a string - check if it exists
    if column_ref not in columns:
        available_cols = ", ".join(f'"{c}"' for c in columns)
        raise StreamlitAPIException(
            f'Column "{column_ref}" not found in data. '
            f"Available columns: [{available_cols}]"
        )
    return column_ref


def _validate_summary_for_column(
    column_name: str,
    parsed_value: ParsedSummaryValue,
    data_df: DataFrame,
) -> None:
    """Validate that the summary configuration is compatible with the column's data type.

    Parameters
    ----------
    column_name : str
        The name of the column.

    parsed_value : ParsedSummaryValue
        The parsed summary value (e.g., {"type": "sum"} or {"type": "all", "default": "sum"}).

    data_df : DataFrame
        The DataFrame containing the column.

    Raises
    ------
    StreamlitAPIException
        If the summary configuration is not compatible with the column's data type.
    """
    column = data_df[column_name]
    summary_type = parsed_value["type"]
    is_numeric = _is_numeric_column(column)

    # "all" requires numeric columns (since it shows sum, avg, min, max options)
    if summary_type == "all" and not is_numeric:
        raise StreamlitAPIException(
            f'Cannot use "all" for column "{column_name}" '
            f"because it contains non-numeric data. "
            f'"all" requires a numeric column to show all summary options. '
            f'Use "count" for text columns.'
        )

    # Count works on any column type
    if summary_type == "count":
        return

    # Other summary types require numeric data
    if summary_type in _NUMERIC_ONLY_SUMMARY_TYPES and not is_numeric:
        raise StreamlitAPIException(
            f'Cannot compute "{summary_type}" for column "{column_name}" '
            f"because it contains non-numeric data. "
            f'Only "count" is supported for text columns.'
        )


def process_summary_config(
    summary: SummaryConfigInput | None,
    data_df: DataFrame,
) -> SummaryConfig:
    """Validate and normalize summary configuration.

    This function:
    1. Converts column indices to column names
    2. Parses summary values (handles "all", "all:stat", and simple types)
    3. Validates that all column references exist
    4. Validates that summary types are compatible with column data types

    Parameters
    ----------
    summary : SummaryConfigInput | None
        The user-provided summary configuration mapping column names/indices
        to summary types. Values can be:
        - Simple type: "sum", "count", "average", "min", "max"
        - All with default: "all:sum", "all:count", etc.
        - All without default: "all" (defaults to "count")

    data_df : DataFrame
        The DataFrame to validate the configuration against.

    Returns
    -------
    SummaryConfig
        The normalized summary configuration with column names as keys
        and parsed values as dicts.

    Raises
    ------
    StreamlitAPIException
        If the configuration is invalid.
    """
    if summary is None:
        return {}

    normalized_config: SummaryConfig = {}

    for column_ref, summary_value in summary.items():
        # Parse the summary value (handles "all", "all:stat", and simple types)
        parsed_value = _parse_summary_value(summary_value)

        # Resolve column reference to name
        column_name = _resolve_column_reference(column_ref, data_df)

        # Validate summary is compatible with column data type
        _validate_summary_for_column(column_name, parsed_value, data_df)

        # Add to normalized config
        normalized_config[column_name] = parsed_value

    return normalized_config


def convert_summary_config_to_json(summary_config: SummaryConfig) -> str:
    """Convert a summary configuration to a JSON string.

    Parameters
    ----------
    summary_config : SummaryConfig
        The summary configuration to convert.

    Returns
    -------
    str
        The JSON representation of the summary configuration.
    """
    if not summary_config:
        return ""

    return json.dumps(summary_config)

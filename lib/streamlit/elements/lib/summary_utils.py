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

# Summary types that can be applied to columns
SummaryType: TypeAlias = Literal["count", "sum", "average", "min", "max"]

# Valid summary types as a set for validation
_VALID_SUMMARY_TYPES: frozenset[SummaryType] = frozenset(
    ["count", "sum", "average", "min", "max"]
)

# Summary types that require numeric data
_NUMERIC_ONLY_SUMMARY_TYPES: frozenset[SummaryType] = frozenset(
    ["sum", "average", "min", "max"]
)

# User-provided summary configuration input type
SummaryConfigInput: TypeAlias = Mapping[str | int, SummaryType]

# Internal normalized summary configuration (column names only, no indices)
SummaryConfig: TypeAlias = dict[str, SummaryType]


def _is_numeric_column(column: pd.Series) -> bool:
    """Check if a pandas Series contains numeric data.

    Parameters
    ----------
    column : pd.Series
        The column to check.

    Returns
    -------
    bool
        True if the column is numeric, False otherwise.
    """
    return pd.api.types.is_numeric_dtype(column)


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


def _validate_summary_type_for_column(
    column_name: str,
    summary_type: SummaryType,
    data_df: DataFrame,
) -> None:
    """Validate that the summary type is compatible with the column's data type.

    Parameters
    ----------
    column_name : str
        The name of the column.

    summary_type : SummaryType
        The summary type to validate.

    data_df : DataFrame
        The DataFrame containing the column.

    Raises
    ------
    StreamlitAPIException
        If the summary type is not compatible with the column's data type.
    """
    column = data_df[column_name]

    # Count works on any column type
    if summary_type == "count":
        return

    # Other summary types require numeric data
    if summary_type in _NUMERIC_ONLY_SUMMARY_TYPES and not _is_numeric_column(column):
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
    2. Validates that all column references exist
    3. Validates that summary types are valid
    4. Validates that summary types are compatible with column data types

    Parameters
    ----------
    summary : SummaryConfigInput | None
        The user-provided summary configuration mapping column names/indices
        to summary types.

    data_df : DataFrame
        The DataFrame to validate the configuration against.

    Returns
    -------
    SummaryConfig
        The normalized summary configuration with column names as keys.

    Raises
    ------
    StreamlitAPIException
        If the configuration is invalid.
    """
    if summary is None:
        return {}

    normalized_config: SummaryConfig = {}

    for column_ref, summary_type in summary.items():
        # Validate summary type
        if summary_type not in _VALID_SUMMARY_TYPES:
            valid_types = ", ".join(f'"{t}"' for t in sorted(_VALID_SUMMARY_TYPES))
            raise StreamlitAPIException(
                f'Invalid summary type "{summary_type}". Valid types are: {valid_types}'
            )

        # Resolve column reference to name
        column_name = _resolve_column_reference(column_ref, data_df)

        # Validate summary type is compatible with column data type
        _validate_summary_type_for_column(column_name, summary_type, data_df)

        # Add to normalized config
        normalized_config[column_name] = summary_type

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

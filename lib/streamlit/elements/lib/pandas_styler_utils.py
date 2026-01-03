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

from collections import defaultdict
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from streamlit import dataframe_util
from streamlit.errors import StreamlitAPIException

if TYPE_CHECKING:
    from pandas import DataFrame
    from pandas.io.formats.style import Styler

    from streamlit.proto.Arrow_pb2 import Arrow as ArrowProto

from enum import Enum


def marshall_styler(proto: ArrowProto, styler: Styler, default_uuid: str) -> None:
    """Marshall pandas.Styler into an Arrow proto.

    Parameters
    ----------
    proto : proto.Arrow
        Output. The protobuf for Streamlit Arrow proto.

    styler : pandas.Styler
        Helps style a DataFrame or Series according to the data with HTML and CSS.

    default_uuid : str
        If pandas.Styler uuid is not provided, this value will be used.

    """
    import pandas as pd

    styler_data_df: pd.DataFrame = styler.data  # type: ignore[attr-defined]
    if styler_data_df.size > int(pd.options.styler.render.max_elements):
        raise StreamlitAPIException(
            f"The dataframe has `{styler_data_df.size}` cells, but the maximum number "
            "of cells allowed to be rendered by Pandas Styler is configured to "
            f"`{pd.options.styler.render.max_elements}`. To allow more cells to be "
            'styled, you can change the `"styler.render.max_elements"` config. For example: '
            f'`pd.set_option("styler.render.max_elements", {styler_data_df.size})`'
        )

    # pandas.Styler uuid should be set before _compute is called.
    _marshall_uuid(proto, styler, default_uuid)

    # We're using protected members of pandas.Styler to get styles,
    # which is not ideal and could break if the interface changes.
    styler._compute()  # type: ignore

    pandas_styles = styler._translate(False, False)  # type: ignore

    _marshall_caption(proto, styler)
    _marshall_styles(proto, styler, pandas_styles)
    _marshall_display_values(proto, styler_data_df, pandas_styles)


def _marshall_uuid(proto: ArrowProto, styler: Styler, default_uuid: str) -> None:
    """Marshall pandas.Styler uuid into an Arrow proto.

    Parameters
    ----------
    proto : proto.Arrow
        Output. The protobuf for Streamlit Arrow proto.

    styler : pandas.Styler
        Helps style a DataFrame or Series according to the data with HTML and CSS.

    default_uuid : str
        If pandas.Styler uuid is not provided, this value will be used.

    """
    if styler.uuid is None:  # type: ignore[attr-defined]
        styler.set_uuid(default_uuid)

    proto.styler.uuid = str(styler.uuid)  # type: ignore[attr-defined]


def _marshall_caption(proto: ArrowProto, styler: Styler) -> None:
    """Marshall pandas.Styler caption into an Arrow proto.

    Parameters
    ----------
    proto : proto.Arrow
        Output. The protobuf for Streamlit Arrow proto.

    styler : pandas.Styler
        Helps style a DataFrame or Series according to the data with HTML and CSS.

    """
    if styler.caption is not None:  # type: ignore[attr-defined]
        proto.styler.caption = styler.caption  # type: ignore[attr-defined]


def _marshall_styles(
    proto: ArrowProto, styler: Styler, styles: Mapping[str, Any]
) -> None:
    """Marshall pandas.Styler styles into an Arrow proto.

    Parameters
    ----------
    proto : proto.Arrow
        Output. The protobuf for Streamlit Arrow proto.

    styler : pandas.Styler
        Helps style a DataFrame or Series according to the data with HTML and CSS.

    styles : dict
        pandas.Styler translated styles.

    """
    css_rules = []

    if "table_styles" in styles:
        table_styles = styles["table_styles"]
        table_styles = _trim_pandas_styles(table_styles)
        for style in table_styles:
            # styles in "table_styles" have a space
            # between the uuid and selector.
            rule = _pandas_style_to_css(
                "table_styles",
                style,
                styler.uuid,  # type: ignore[attr-defined]
                separator=" ",
            )
            css_rules.append(rule)

    if "cellstyle" in styles:
        cellstyle = styles["cellstyle"]
        cellstyle = _trim_pandas_styles(cellstyle)
        for style in cellstyle:
            rule = _pandas_style_to_css(
                "cell_style",
                style,
                styler.uuid,  # type: ignore[attr-defined]
                separator="_",
            )
            css_rules.append(rule)

    if len(css_rules) > 0:
        proto.styler.styles = "\n".join(css_rules)


M = TypeVar("M", bound=Mapping[str, Any])


def _trim_pandas_styles(styles: list[M]) -> list[M]:
    """Filter out empty styles.

    Every cell will have a class, but the list of props
    may just be [['', '']].

    Parameters
    ----------
    styles : list
        pandas.Styler translated styles.

    """
    return [x for x in styles if any(any(y) for y in x["props"])]


def _pandas_style_to_css(
    style_type: str,
    style: Mapping[str, Any],
    uuid: str,
    separator: str = "_",
) -> str:
    """Convert pandas.Styler translated style to CSS.

    Parameters
    ----------
    style_type : str
        Either "table_styles" or "cell_style".

    style : dict
        pandas.Styler translated style.

    uuid : str
        pandas.Styler uuid.

    separator : str
        A string separator used between table and cell selectors.

    """
    declarations = []
    for css_property, css_value in style["props"]:
        declaration = str(css_property).strip() + ": " + str(css_value).strip()
        declarations.append(declaration)

    table_selector = f"#T_{uuid}"

    # In pandas >= 1.1.0
    # translated_style["cellstyle"] has the following shape:
    # > [
    # >   {
    # >       "props": [("color", " black"), ("background-color", "orange"), ("", "")],
    # >       "selectors": ["row0_col0"]
    # >   }
    # >   ...
    # > ]
    cell_selectors = (
        [style["selector"]] if style_type == "table_styles" else style["selectors"]
    )

    selectors = [
        table_selector + separator + cell_selector for cell_selector in cell_selectors
    ]
    selector = ", ".join(selectors)

    declaration_block = "; ".join(declarations)
    return selector + " { " + declaration_block + " }"


def _marshall_display_values(
    proto: ArrowProto, df: DataFrame, styles: Mapping[str, Any]
) -> None:
    """Marshall pandas.Styler display values into an Arrow proto.

    Parameters
    ----------
    proto : proto.Arrow
        Output. The protobuf for Streamlit Arrow proto.

    df : pandas.DataFrame
        A dataframe with original values.

    styles : dict
        pandas.Styler translated styles.

    """
    new_df = _use_display_values(df, styles)
    proto.styler.display_values = dataframe_util.convert_pandas_df_to_arrow_bytes(
        new_df
    )


def _use_display_values(df: DataFrame, styles: Mapping[str, Any]) -> DataFrame:
    """Create a new pandas.DataFrame where display values are used instead of original ones.

    Parameters
    ----------
    df : pandas.DataFrame
        A dataframe with original values.

    styles : dict
        pandas.Styler translated styles.

    """
    import re

    # If values in a column are not of the same type, Arrow
    # serialization would fail. Thus, we need to cast all values
    # of the dataframe to strings before assigning them display values.

    new_df = df.astype(str)
    cell_selector_regex = re.compile(r"row(\d+)_col(\d+)")
    # Outer key = column index; inner key = row index -> target string value
    updates_by_col: defaultdict[int, dict[int, str]] = defaultdict(dict)
    for row in styles.get("body", []):
        for cell in row:
            cell_id = cell.get("id")
            if not cell_id:
                continue
            match = cell_selector_regex.match(cell_id)
            if not match:
                continue
            row_idx, col_idx = map(int, match.groups())
            display_value = cell.get("display_value")

            str_value = (
                str(display_value.value)
                # Check if the display value is an Enum type. Enum values need to be
                # converted to their `.value` attribute to ensure proper serialization
                # and display logic.
                if isinstance(display_value, Enum)
                else str(display_value)
            )
            updates_by_col[col_idx][row_idx] = str_value

    for col_idx, values_by_row in updates_by_col.items():
        row_indices = list(values_by_row.keys())
        values = list(values_by_row.values())
        # Batch-assign updates for this column using iloc for performance.
        new_df.iloc[row_indices, col_idx] = values

    return new_df

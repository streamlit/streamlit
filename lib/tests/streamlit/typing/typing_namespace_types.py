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

from typing import TYPE_CHECKING, Any, cast

from typing_extensions import assert_type

# Perform type checking tests for the public ``streamlit.typing`` namespace.
# Each export must resolve to the same type as its internal definition, so the
# public import path type-checks identically for attribute and item access.
if TYPE_CHECKING:
    from streamlit.typing import (
        ButtonColumnClickState,
        ChatInputValue,
        DataEditorState,
        DataframeState,
        PlotlyState,
        PydeckState,
        UploadedFile,
        VegaLiteState,
    )
    from streamlit.util import ReadOnlyAttributeDictionary

    # =====================================================================
    # UploadedFile: documented file metadata on a BytesIO subclass
    # =====================================================================

    uploaded_file = cast("UploadedFile", object())
    # ``name`` is inherited from ``io.BytesIO`` and typed as ``Any`` upstream, so
    # only the Streamlit-added metadata attributes are asserted here.
    assert_type(uploaded_file.file_id, str)
    assert_type(uploaded_file.type, str)
    assert_type(uploaded_file.size, int)

    # =====================================================================
    # ChatInputValue: dict-like value with attribute and item access
    # =====================================================================

    chat_input_value = cast("ChatInputValue", object())
    assert_type(chat_input_value.text, str)
    assert_type(chat_input_value["text"], str)
    assert_type(chat_input_value.files, list[UploadedFile])
    assert_type(chat_input_value["files"], list[UploadedFile])
    assert_type(chat_input_value.audio, UploadedFile | None)
    assert_type(chat_input_value["audio"], UploadedFile | None)

    # =====================================================================
    # DataEditorState: attribute and item access on pending edits
    # =====================================================================

    data_editor_state = cast("DataEditorState", object())
    assert_type(data_editor_state.edited_rows, dict[int, dict[str, Any]])
    assert_type(data_editor_state["edited_rows"], dict[int, dict[str, Any]])
    assert_type(data_editor_state.added_rows, list[dict[str, Any]])
    assert_type(data_editor_state["added_rows"], list[dict[str, Any]])
    assert_type(data_editor_state.deleted_rows, list[int])
    assert_type(data_editor_state["deleted_rows"], list[int])

    # =====================================================================
    # DataframeState: attribute and item access on the selection payload
    # =====================================================================

    dataframe_state = cast("DataframeState", object())
    assert_type(dataframe_state.selection.rows, list[int])
    assert_type(dataframe_state["selection"]["rows"], list[int])
    assert_type(dataframe_state.selection.columns, list[str])
    assert_type(dataframe_state["selection"]["columns"], list[str])

    # =====================================================================
    # PlotlyState: attribute and item access on the selection payload
    # =====================================================================

    plotly_state = cast("PlotlyState", object())
    assert_type(plotly_state.selection.points, list[dict[str, Any]])
    assert_type(plotly_state["selection"]["points"], list[dict[str, Any]])
    assert_type(plotly_state.selection.point_indices, list[int])
    assert_type(plotly_state["selection"]["point_indices"], list[int])

    # =====================================================================
    # PydeckState: attribute and item access on the selection payload
    # =====================================================================

    pydeck_state = cast("PydeckState", object())
    assert_type(pydeck_state.selection.indices, dict[str, list[int]])
    assert_type(pydeck_state["selection"]["indices"], dict[str, list[int]])
    assert_type(pydeck_state.selection.objects, dict[str, list[dict[str, Any]]])
    assert_type(pydeck_state["selection"]["objects"], dict[str, list[dict[str, Any]]])

    # =====================================================================
    # VegaLiteState: dynamic selection payload keyed by the user's spec
    # =====================================================================

    # Selection names/values come from the user's Vega-Lite spec, so the outer
    # state exposes the payload as a dynamic (read-only) dictionary rather than
    # a fixed schema, while still supporting attribute and item access.
    vega_lite_state = cast("VegaLiteState", object())
    assert_type(vega_lite_state.selection, ReadOnlyAttributeDictionary)
    assert_type(vega_lite_state["selection"], ReadOnlyAttributeDictionary)

    # =====================================================================
    # ButtonColumnClickState: documented row/label click payload
    # =====================================================================

    button_column_click_state = cast("ButtonColumnClickState", object())
    assert_type(button_column_click_state.row, int)
    assert_type(button_column_click_state["row"], int)
    assert_type(button_column_click_state.label, str)
    assert_type(button_column_click_state["label"], str)

# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import textwrap
from typing import Any, Optional, TYPE_CHECKING

import streamlit
from streamlit import type_util
from streamlit.elements.form import is_in_form
from streamlit.errors import StreamlitAPIException
from streamlit.state.session_state import get_session_state
from streamlit.state.widgets import WidgetCallback


if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


def clean_text(text: Any) -> str:
    """Convert an object to text, dedent it, and strip whitespace."""
    return textwrap.dedent(str(text)).strip()


def last_index_for_melted_dataframes(data):
    if type_util.is_dataframe_compatible(data):
        data = type_util.convert_anything_to_df(data)

        if data.index.size > 0:
            return data.index[-1]

    return None


def check_callback_rules(
    dg: "DeltaGenerator", on_change: Optional[WidgetCallback]
) -> None:
    if (
        streamlit._is_running_with_streamlit
        and is_in_form(dg)
        and on_change is not None
    ):
        raise StreamlitAPIException(
            "Callbacks are not allowed on widgets in forms;"
            " put them on the form submit button instead."
        )


def check_session_state_rules(
    widget_label: str, widget_val: Any, key: Optional[str]
) -> None:
    if key is None or widget_val is None:
        return

    session_state = get_session_state()
    if session_state.is_new_value(key):
        streamlit.warning(
            f'The widget with key "{key}" was created with a default value, but'
            " it also had its value set via the session_state api. The results"
            " of doing this are undefined behavior."
        )

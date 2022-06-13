# Copyright 2018-2022 Streamlit Inc.
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
from typing import Any, cast, Hashable, Optional, TYPE_CHECKING, Union

import streamlit
from streamlit import type_util
from streamlit.elements.form import is_in_form
from streamlit.errors import StreamlitAPIException
from streamlit.state import get_session_state, WidgetCallback

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.type_util import DataFrameCompatible, SupportsStr


def clean_text(text: "SupportsStr") -> str:
    """Convert an object to text, dedent it, and strip whitespace."""
    return textwrap.dedent(str(text)).strip()


def last_index_for_melted_dataframes(
    data: Union["DataFrameCompatible", Any]
) -> Optional[Hashable]:
    if type_util.is_dataframe_compatible(data):
        data = type_util.convert_anything_to_df(data)

        if data.index.size > 0:
            return cast(Hashable, data.index[-1])

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
            "With forms, callbacks can only be defined on the `st.form_submit_button`."
            " Defining callbacks on other widgets inside a form is not allowed."
        )


_shown_default_value_warning: bool = False


def check_session_state_rules(
    default_value: Any, key: Optional[str], writes_allowed: bool = True
) -> None:
    global _shown_default_value_warning

    if key is None or not streamlit._is_running_with_streamlit:
        return

    session_state = get_session_state()
    if not session_state.is_new_state_value(key):
        return

    if not writes_allowed:
        raise StreamlitAPIException(
            "Values for st.button, st.download_button, st.file_uploader, and "
            "st.form cannot be set using st.session_state."
        )

    if default_value is not None and not _shown_default_value_warning:
        streamlit.warning(
            f'The widget with key "{key}" was created with a default value but'
            " also had its value set via the Session State API."
        )
        _shown_default_value_warning = True

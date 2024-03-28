# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from typing import Callable

import streamlit as st
from streamlit.elements.lib.dialog import DialogWidth
from streamlit.errors import StreamlitAPIException


def dialog_decorator(
    title: str = "", *, width: DialogWidth = "small"
) -> Callable[[Callable[..., None]], Callable[..., None]]:
    if title is None or title == "":
        raise StreamlitAPIException(
            'A non-empty `title` argument has to be provided for dialogs, for example `@st.experimental_dialog("Example Title")`.'
        )

    def inner_decorator(fn: Callable[..., None], *args) -> Callable[..., None]:
        # This check is for the scenario where @st.dialog is used without parentheses
        if fn is None or len(args) > 0:
            raise StreamlitAPIException(
                "The dialog decoration failed. A common error for this to happen is when the dialog decorator is used without a title, i.e. `@st.experimental_dialog` instead of `@st.experimental_dialog(”My title”)`."
            )

        def decorated_fn(*args, **kwargs) -> None:
            dialog = st._main.dialog(title=title, dismissible=True, width=width)
            dialog.open()

            @st.experimental_fragment
            def dialog_content() -> None:
                # if the dialog should be closed, st.rerun() has to be called (same behavior as with st.fragment)
                _ = fn(*args, **kwargs)
                return None

            with dialog:
                return dialog_content()

        return decorated_fn

    return inner_decorator

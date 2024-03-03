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

from typing import Callable, TypeVar

import streamlit as st
from streamlit.elements.lib.dialog import DialogWidth

# we can specify RT better if we know that we don't return anything in the fragment-dialog or
# only use the boolean return types
RT = TypeVar("RT")


def dialog_decorator(
    title: str, *, dismissible: bool = True, width: DialogWidth = "small"
) -> Callable[[Callable[..., RT]], Callable[..., RT]]:
    def inner_decorator(fn: Callable[..., RT]) -> Callable[..., RT]:
        def decorated_fn(*args, **kwargs) -> RT:
            dialog = st._main.dialog(title=title, dismissible=dismissible, width=width)
            dialog.open()

            # TODO: here we add the @st.fragment annotation
            def dialog_content() -> RT:
                ret = fn(*args, **kwargs)
                if ret is not None:
                    dialog.close()
                return ret

            with dialog:
                return dialog_content()

        return decorated_fn

    return inner_decorator

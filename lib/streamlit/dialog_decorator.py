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

from collections.abc import Callable

import streamlit as st


def dialog_decorator(title: str = "Dialog"):
    def inner_decorator(fn: Callable):
        def decorated_fn(*args, **kwargs):
            dialog = st.dialog_container(title=title)
            dialog.open()

            @st.partial
            def dialog_content():
                ret = fn(*args, **kwargs)
                if ret is not None:
                    dialog.close()
                return ret

            with dialog:
                dialog_content()

        return decorated_fn

    return inner_decorator

# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import streamlit as st

# from dataclasses import dataclass

# The fake dialog will live in this container.
# TODO: Move this into Session.
_dlg_wrapper = None


def dialog_init_hook():
    s = st.session_state

    if "dialog_function" not in s:
        s.dialog_function = None
        s.dialog_function_args = []
        s.dialog_function_kwargs = {}
        s.dialog_return = None
        s.dialog_function_last_run = -100
        s.dialog_return_run = -100
        s.current_run = -1

    s.current_run += 1

    st.markdown(
        """
    <style>
    [data-testid=stExpander] [data-baseweb=accordion] {
        box-shadow: 0 0.5rem 2rem #3453;
        position: fixed;
        top: 10rem;
        left: calc(50vw - 22rem);
        width: 44rem;
        z-index: 101;
        background: white;
    }

    [data-testid=stExpander]::before {
        content: " ";
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: #1242;
        z-index: 100;
    }
    </style>
    """,
        unsafe_allow_html=True,
    )

    # global _dlg_wrapper
    # _dlg_wrapper = st.empty()

    if s.dialog_function is not None:
        _open_dialog()


def _open_dialog(title: str = ""):
    s = st.session_state
    is_first_run = False

    if s.dialog_function_last_run < s.current_run - 1:
        is_first_run = True

    s.dialog_function_last_run = s.current_run

    # with _dlg_wrapper.expander("PRETEND THIS IS A DIALOG", expanded=True):
    # dialog = st.dialog("Decorator Dialog", close_on_submit=True)
    # dialog.open()
    dialog = st.dialog_non_form(title, dismissible=True, is_open=True)
    with dialog:
        out = s.dialog_function(
            *s.dialog_function_args,
            **s.dialog_function_kwargs,
        )

    if out is not None:
        if is_first_run:
            return
        s.dialog_function = None
        s.dialog_function_args = []
        s.dialog_function_kwargs = {}
        s.dialog_return = out

        if s.dialog_return_run < s.current_run:
            # _dlg_wrapper.empty()
            dialog.update(False)


def dialog(title: str = "Decorator Function"):
    def inner_decorator(fn):
        def decorated_fn(*args, **kwargs):
            s = st.session_state

            s.dialog_function = fn
            s.dialog_function_args = args
            s.dialog_function_kwargs = kwargs
            s.dialog_return = None

            if s.dialog_function_last_run != s.current_run:
                _open_dialog(title)

        return decorated_fn

    return inner_decorator

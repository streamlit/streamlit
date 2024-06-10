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

from typing import TYPE_CHECKING, Any

from streamlit import config, runtime
from streamlit.elements.form import is_in_form
from streamlit.errors import StreamlitAPIException, StreamlitAPIWarning
from streamlit.runtime.scriptrunner.script_run_context import get_script_run_ctx
from streamlit.runtime.state import WidgetCallback, get_session_state

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


def check_callback_rules(dg: DeltaGenerator, on_change: WidgetCallback | None) -> None:
    """Ensures that widgets other than `st.form_submit` within a form don't have an on_change callback set.

    Raises
    ------
    StreamlitAPIException:
        Raised when the described rule is violated.
    """

    if runtime.exists() and is_in_form(dg) and on_change is not None:
        raise StreamlitAPIException(
            "With forms, callbacks can only be defined on the `st.form_submit_button`."
            " Defining callbacks on other widgets inside a form is not allowed."
        )


_shown_default_value_warning: bool = False


def check_session_state_rules(
    default_value: Any, key: str | None, writes_allowed: bool = True
) -> None:
    """Ensures that no values are set for widgets with the given key when writing is not allowed.

    Additionally, if `global.disableWidgetStateDuplicationWarning` is False a warning is shown when a widget has a default value but its value is also set via session state.

    Raises
    ------
    StreamlitAPIException:
        Raised when the described rule is violated.
    """
    global _shown_default_value_warning

    if key is None or not runtime.exists():
        return

    session_state = get_session_state()
    if not session_state.is_new_state_value(key):
        return

    if not writes_allowed:
        raise StreamlitAPIException(
            f'Values for the widget with key "{key}" cannot be set using `st.session_state`.'
        )

    if (
        default_value is not None
        and not _shown_default_value_warning
        and not config.get_option("global.disableWidgetStateDuplicationWarning")
    ):
        from streamlit import warning

        warning(
            f'The widget with key "{key}" was created with a default value but'
            " also had its value set via the Session State API."
        )
        _shown_default_value_warning = True


class CachedWidgetWarning(StreamlitAPIWarning):
    def __init__(self):
        super().__init__(
            """
Your script uses a widget command in a cached function
(function decorated with `@st.cache_data` or `@st.cache_resource`).
This code will only be called when we detect a cache "miss",
which can lead to unexpected results.

To fix this, move all widget commands outside the cached function.
"""
        )


def check_cache_replay_rules() -> None:
    """Check if a widget is allowed to be used in the current context.
    More specifically, this checks if the current context is inside a
    cached function that disallows widget usage. If so, it raises a warning.

    If there are other similar checks in the future, we could extend this
    function to check for those as well. And rename it to check_widget_usage_rules.
    """
    if runtime.exists():
        ctx = get_script_run_ctx()
        if ctx and ctx.disallow_cached_widget_usage:
            from streamlit import exception

            # We use an exception here to show a proper stack trace
            # that indicates to the user where the issue is.
            exception(CachedWidgetWarning())


_fragment_writes_widget_to_outside_error = (
    "Fragments cannot write to elements outside of their container."
)


def check_fragment_path_policy(dg: DeltaGenerator):
    ctx = get_script_run_ctx()
    # Check is only relevant for fragments
    if ctx is None or ctx.current_fragment_id is None:
        return

    current_fragment_delta_path = ctx.current_fragment_delta_path
    current_cursor = dg._active_dg._cursor
    if current_cursor is None:
        return

    current_cursor_delta_path = current_cursor.delta_path

    # the elements delta path cannot be smaller than the fragment's delta path if it is inside of the fragment
    if len(current_cursor_delta_path) < len(current_fragment_delta_path):
        raise StreamlitAPIException(_fragment_writes_widget_to_outside_error)

    # all path indices of the fragment-path must occur in the inner-elements delta path, otherwise it is outside of the fragment container
    for index, path_index in enumerate(current_fragment_delta_path):
        if current_cursor_delta_path[index] != path_index:
            raise StreamlitAPIException(_fragment_writes_widget_to_outside_error)

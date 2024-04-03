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

from streamlit.delta_generator import event_dg, get_last_dg_added_to_context_stack
from streamlit.elements.lib.dialog import DialogWidth
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.fragment import fragment as _fragment


def _assert_no_nested_dialogs() -> None:
    """Check the current stack for existing DeltaGenerator's of type 'dialog'.
    Note that the check like this only works when Dialog is called as a context manager, as this populates the dg_stack in delta_generator correctly.

    This does not detect the edge case in which someone calls, for example, `with st.sidebar` inside of a dialog function and opens a dialog in there,
    as `with st.sidebar` pushes the new DeltaGenerator to the stack. In order to check for that edge case, we could try to check all DeltaGenerators in the stack,
    and not only the last one. Since we deem this to be an edge case, we lean towards simplicity here.

    Raises
    ------
    StreamlitAPIException
        Raised if the user tries to nest dialogs inside of each other.
    """
    last_dg_in_current_context = get_last_dg_added_to_context_stack()
    if last_dg_in_current_context and "dialog" in set(
        last_dg_in_current_context._ancestor_block_types
    ):
        raise StreamlitAPIException("Dialogs may not be nested inside other dialogs.")


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
            _assert_no_nested_dialogs()
            # Call the Dialog on the event_dg because it lives outside of the normal
            # Streamlit UI flow. For example, if it is called from the sidebar, it should not
            # inherit the sidebar theming.
            dialog = event_dg.dialog(title=title, dismissible=True, width=width)
            dialog.open()

            @_fragment
            def dialog_content() -> None:
                # if the dialog should be closed, st.rerun() has to be called (same behavior as with st.fragment)
                _ = fn(*args, **kwargs)
                return None

            with dialog:
                return dialog_content()

        return decorated_fn

    return inner_decorator

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

from functools import wraps
from typing import Callable, TypeVar, cast, overload

from streamlit.delta_generator import event_dg, get_last_dg_added_to_context_stack
from streamlit.elements.lib.dialog import DialogWidth
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.fragment import fragment as _fragment
from streamlit.runtime.metrics_util import gather_metrics


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


F = TypeVar("F", bound=Callable[..., None])


def _dialog_decorator(
    non_optional_func: F, title: str, *, width: DialogWidth = "small"
) -> F:
    if title is None or title == "":
        raise StreamlitAPIException(
            'A non-empty `title` argument has to be provided for dialogs, for example `@st.experimental_dialog("Example Title")`.'
        )

    @wraps(non_optional_func)
    def wrap(*args, **kwargs) -> None:
        _assert_no_nested_dialogs()
        # Call the Dialog on the event_dg because it lives outside of the normal
        # Streamlit UI flow. For example, if it is called from the sidebar, it should not
        # inherit the sidebar theming.
        dialog = event_dg._dialog(title=title, dismissible=True, width=width)
        dialog.open()

        @_fragment
        def dialog_content() -> None:
            # if the dialog should be closed, st.rerun() has to be called (same behavior as with st.fragment)
            _ = non_optional_func(*args, **kwargs)
            return None

        with dialog:
            return dialog_content()

    return cast(F, wrap)


@overload
def dialog_decorator(title: str, *, width: DialogWidth = "small") -> Callable[[F], F]:
    ...


# 'title' can be a function since `dialog_decorator` is a decorator. We just call it 'title' here though
# to make the user-doc more friendly as we want the user to pass a title, not a function.
# The user is supposed to call it like @st.dialog("my_title") , which makes 'title' a positional arg, hence
# this 'trick'. The overload is required to have a good type hint for the decorated function args.
@overload
def dialog_decorator(title: F | None, *, width: DialogWidth = "small") -> F:
    ...


@gather_metrics("experimental_dialog")
def dialog_decorator(
    title: F | None | str = "", *, width: DialogWidth = "small"
) -> F | Callable[[F], F]:
    r"""Decorate a function to mark it as a Streamlit dialog. When the decorated function is called, a dialog element is inserted with the function's body as the content.

    The decorated function can hold multiple elements which are rendered inside of a modal when the decorated function is called.
    The decorated function is using `st.experimental_fragment`, which means that interacting with elements inside of the dialog will
    only re-run the dialog function.

    The decorated function can accept arguments that can be passed when it is called.

    Dismissing a dialog does not cause an app re-run.
    You can close the dialog programmatically by executing `st.rerun()` explicitly inside of the decorated function.

    In order to pass state from dialog widgets to the app, you can leverage `st.session_state`.

    .. warning::
        Currently, a dialog may not open another dialog.
        Also, only one dialog-decorated function may be called in a script run, which means that only one dialog can be open at any given time.

    Parameters
    ----------
    title : str
        A string that will be used as the dialog's title. It cannot be empty.
    width : "small", "large"
        The width of the dialog. Defaults to "small".

    Returns
    -------
    A decorated function that, when called, inserts a dialog element context container. The container itself contains the decorated function's elements.

    Examples
    --------
    You can annotate a function to mark it as a Streamlit dialog function and pass arguments to it. You can either dismiss the dialog via the ESC-key or the X-button or close it programmatically and trigger a re-run by using `st.rerun()`.
    Leverage `st.session_state` if you want to pass dialog widget states to the overall app:

    >>> import streamlit as st
    >>>
    >>> @st.experimental_dialog("Streamlit Example Dialog")
    >>> def example_dialog(some_arg: str, some_other_arg: int):
    >>>     st.write(f"You passed following args: {some_arg} | {some_other_arg}")
    >>>     # interacting with the text_input only re-runs `example_dialog`
    >>>     some_text_input = st.text_input("Type something:", key="example_dialog_some_text_input")
    >>>     # following write is updated when chaning the text_input inside the dialog
    >>>     st.write(f"You wrote '{some_text_input}' in the dialog")
    >>>     if st.button("Close the dialog"):
    >>>         st.rerun()
    >>>
    >>> if st.button("Open dialog"):
    >>>     example_dialog("Some string arg", 42)
    >>>
    >>> # following write is updated with the dialog's text input when the dialog was opened, the text input was interacted with and a re-run was triggered, e.g. by clicking the Close-button defined in `example_dialog`
    >>> st.write(f"You wrote '{st.session_state.get('example_dialog_some_text_input', '')}' in the dialog")

    """

    func_or_title = title
    if func_or_title is None:
        # Support passing the params via function decorator
        def wrapper(f: F) -> F:
            return _dialog_decorator(non_optional_func=f, title="", width=width)

        return wrapper
    elif type(func_or_title) is str:
        # Support passing the params via function decorator
        def wrapper(f: F) -> F:
            title: str = func_or_title
            return _dialog_decorator(non_optional_func=f, title=title, width=width)

        return wrapper

    func: F = cast(F, func_or_title)
    return _dialog_decorator(func, "", width=width)

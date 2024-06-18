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
from typing import TYPE_CHECKING, Callable, TypeVar, cast, overload

from streamlit.delta_generator import event_dg, get_last_dg_added_to_context_stack
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.fragment import _fragment
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.elements.lib.dialog import DialogWidth


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

        def dialog_content() -> None:
            # if the dialog should be closed, st.rerun() has to be called (same behavior as with st.fragment)
            _ = non_optional_func(*args, **kwargs)
            return None

        # the fragment decorator has multiple return types so that you can pass arguments to it. Here we know the return type, so we cast
        fragmented_dialog_content = cast(Callable[[], None], _fragment(dialog_content))
        with dialog:
            fragmented_dialog_content()
            return None

    return cast(F, wrap)


@overload
def dialog_decorator(
    title: str, *, width: DialogWidth = "small"
) -> Callable[[F], F]: ...


# 'title' can be a function since `dialog_decorator` is a decorator. We just call it 'title' here though
# to make the user-doc more friendly as we want the user to pass a title, not a function.
# The user is supposed to call it like @st.dialog("my_title") , which makes 'title' a positional arg, hence
# this 'trick'. The overload is required to have a good type hint for the decorated function args.
@overload
def dialog_decorator(title: F, *, width: DialogWidth = "small") -> F: ...


@gather_metrics("experimental_dialog")
def dialog_decorator(
    title: F | str, *, width: DialogWidth = "small"
) -> F | Callable[[F], F]:
    """Function decorator to create a modal dialog.

    A function decorated with ``@st.experimental_dialog`` becomes a dialog
    function. When you call a dialog function, Streamlit inserts a modal dialog
    into your app. Streamlit element commands called within the dialog function
    render inside the modal dialog.

    The dialog function can accept arguments that can be passed when it is
    called. Any values from the dialog that need to be accessed from the wider
    app should generally be stored in Session State.

    A user can dismiss a modal dialog by clicking outside of it, clicking the
    "**X**" in its upper-right corner, or pressing``ESC`` on their keyboard.
    Dismissing a modal dialog does not trigger an app rerun. To close the modal
    dialog programmatically, call ``st.rerun()`` explicitly inside of the
    dialog function.

    ``st.experimental_dialog`` inherits behavior from |st.experimental_fragment|_.
    When a user interacts with an input widget created inside a dialog function,
    Streamlit only reruns the dialog function instead of the full script.

    Calling ``st.sidebar`` in a dialog function is not supported.

    Dialog code can interact with Session State, imported modules, and other
    Streamlit elements created outside the dialog. Note that these interactions
    are additive across multiple dialog reruns. You are responsible for
    handling any side effects of that behavior.

    .. warning::
        Only one dialog function may be called in a script run, which means
        that only one dialog can be open at any given time. Since a dialog is
        also a fragment, all fragment limitations apply. Dialogs can't contain
        fragments, and fragments can't contain dialogs. Using dialogs in widget
        callback functions is not supported.

    .. |st.experimental_fragment| replace:: ``st.experimental_fragment``
    .. _st.experimental_fragment: https://docs.streamlit.io/develop/api-reference/execution-flow/st.fragment

    Parameters
    ----------
    title : str
        The title to display at the top of the modal dialog. It cannot be empty.
    width : "small", "large"
        The width of the modal dialog. If ``width`` is ``"small`` (default), the
        modal dialog will be 500 pixels wide. If ``width`` is ``"large"``, the
        modal dialog will be about 750 pixels wide.

    Examples
    --------
    The following example demonstrates the basic usage of ``@st.experimental_dialog``.
    In this app, clicking "**A**" or "**B**" will open a modal dialog and prompt you
    to enter a reason for your vote. In the modal dialog, click "**Submit**" to record
    your vote into Session State and rerun the app. This will close the modal dialog
    since the dialog function is not called during the full-script rerun.

    >>> import streamlit as st
    >>>
    >>> @st.experimental_dialog("Cast your vote")
    >>> def vote(item):
    >>>     st.write(f"Why is {item} your favorite?")
    >>>     reason = st.text_input("Because...")
    >>>     if st.button("Submit"):
    >>>         st.session_state.vote = {"item": item, "reason": reason}
    >>>         st.rerun()
    >>>
    >>> if "vote" not in st.session_state:
    >>>     st.write("Vote for your favorite")
    >>>     if st.button("A"):
    >>>         vote("A")
    >>>     if st.button("B"):
    >>>         vote("B")
    >>> else:
    >>>     f"You voted for {st.session_state.vote['item']} because {st.session_state.vote['reason']}"

    .. output::
        https://doc-modal-dialog.streamlit.app/
        height: 350px

    """

    func_or_title = title
    if isinstance(func_or_title, str):
        # Support passing the params via function decorator
        def wrapper(f: F) -> F:
            title: str = func_or_title
            return _dialog_decorator(non_optional_func=f, title=title, width=width)

        return wrapper

    func: F = func_or_title
    return _dialog_decorator(func, "", width=width)

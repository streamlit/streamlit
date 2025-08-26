# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
from typing import TYPE_CHECKING, Any, Callable, Literal, TypeVar, cast, overload

from streamlit.delta_generator_singletons import (
    get_dg_singleton_instance,
    get_last_dg_added_to_context_stack,
)
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.fragment import _fragment
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.type_util import get_object_name

if TYPE_CHECKING:
    from streamlit.elements.lib.dialog import DialogWidth
    from streamlit.runtime.state import WidgetCallback


def _assert_no_nested_dialogs() -> None:
    """Check the current stack for existing DeltaGenerator's of type 'dialog'.
    Note that the check like this only works when Dialog is called as a context manager,
    as this populates the dg_stack in delta_generator correctly.

    This does not detect the edge case in which someone calls, for example,
    `with st.sidebar` inside of a dialog function and opens a dialog in there, as
    `with st.sidebar` pushes the new DeltaGenerator to the stack. In order to check for
    that edge case, we could try to check all DeltaGenerators in the stack, and not only
    the last one. Since we deem this to be an edge case, we lean towards simplicity
    here.

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


F = TypeVar("F", bound=Callable[..., Any])


def _dialog_decorator(
    non_optional_func: F,
    title: str,
    *,
    width: DialogWidth = "small",
    dismissible: bool = True,
    on_dismiss: Literal["ignore", "rerun"] | WidgetCallback = "ignore",
) -> F:
    if title is None or title == "":
        raise StreamlitAPIException(
            "A non-empty `title` argument has to be provided for dialogs, for example "
            '`@st.dialog("Example Title")`.'
        )

    @wraps(non_optional_func)
    def wrap(*args: Any, **kwargs: Any) -> None:
        _assert_no_nested_dialogs()
        # Call the Dialog on the event_dg because it lives outside of the normal
        # Streamlit UI flow. For example, if it is called from the sidebar, it should
        # not inherit the sidebar theming.
        dialog = get_dg_singleton_instance().event_dg._dialog(
            title=title, dismissible=dismissible, width=width, on_dismiss=on_dismiss
        )
        dialog.open()

        def dialog_content() -> None:
            # if the dialog should be closed, st.rerun() has to be called
            # (same behavior as with st.fragment)
            _ = non_optional_func(*args, **kwargs)

        # the fragment decorator has multiple return types so that you can pass
        # arguments to it. Here we know the return type, so we cast
        fragmented_dialog_content = cast(
            "Callable[[], None]",
            _fragment(
                dialog_content, additional_hash_info=get_object_name(non_optional_func)
            ),
        )

        with dialog:
            fragmented_dialog_content()
            return

    return cast("F", wrap)


@overload
def dialog_decorator(
    title: str,
    *,
    width: DialogWidth = "small",
    dismissible: bool = True,
    on_dismiss: Literal["ignore", "rerun"] | WidgetCallback = "ignore",
) -> Callable[[F], F]: ...


# 'title' can be a function since `dialog_decorator` is a decorator.
# We just call it 'title' here though to make the user-doc more friendly as
# we want the user to pass a title, not a function. The user is supposed to
# call it like @st.dialog("my_title") , which makes 'title' a positional arg, hence
# this 'trick'. The overload is required to have a good type hint for the decorated
# function args.
@overload
def dialog_decorator(
    title: F,
    *,
    width: DialogWidth = "small",
    dismissible: bool = True,
    on_dismiss: Literal["ignore", "rerun"] | WidgetCallback = "ignore",
) -> F: ...


@gather_metrics("dialog")
def dialog_decorator(
    title: F | str,
    *,
    width: DialogWidth = "small",
    dismissible: bool = True,
    on_dismiss: Literal["ignore", "rerun"] | WidgetCallback = "ignore",
) -> F | Callable[[F], F]:
    r"""Function decorator to create a modal dialog.

    A function decorated with ``@st.dialog`` becomes a dialog
    function. When you call a dialog function, Streamlit inserts a modal dialog
    into your app. Streamlit element commands called within the dialog function
    render inside the modal dialog.

    The dialog function can accept arguments that can be passed when it is
    called. Any values from the dialog that need to be accessed from the wider
    app should generally be stored in Session State.

    If a dialog is dismissible, a user can dismiss it by clicking outside of
    it, clicking the "**X**" in its upper-right corner, or pressing ``ESC`` on
    their keyboard. You can configure whether this triggers a rerun of the app
    by setting the ``on_dismiss`` parameter.

    If a dialog is not dismissible, it must be closed programmatically by
    calling ``st.rerun()`` inside the dialog function. This is useful when you
    want to ensure that the dialog is always closed programmatically, such as
    when the dialog contains a form that must be submitted before closing.

    ``st.dialog`` inherits behavior from |st.fragment|_.
    When a user interacts with an input widget created inside a dialog function,
    Streamlit only reruns the dialog function instead of the full script.

    Calling ``st.sidebar`` in a dialog function is not supported.

    Dialog code can interact with Session State, imported modules, and other
    Streamlit elements created outside the dialog. Note that these interactions
    are additive across multiple dialog reruns. You are responsible for
    handling any side effects of that behavior.

    .. warning::
        Only one dialog function may be called in a script run, which means
        that only one dialog can be open at any given time.

    .. |st.fragment| replace:: ``st.fragment``
    .. _st.fragment: https://docs.streamlit.io/develop/api-reference/execution-flow/st.fragment

    Parameters
    ----------
    title : str
        The title to display at the top of the modal dialog. It cannot be empty.

        The title can optionally contain GitHub-flavored Markdown of the
        following types: Bold, Italics, Strikethroughs, Inline Code, Links,
        and Images. Images display like icons, with a max height equal to
        the font height.

        Unsupported Markdown elements are unwrapped so only their children
        (text contents) render. Display unsupported elements as literal
        characters by backslash-escaping them. E.g.,
        ``"1\. Not an ordered list"``.

        See the ``body`` parameter of |st.markdown|_ for additional,
        supported Markdown directives.

        .. |st.markdown| replace:: ``st.markdown``
        .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

    width : "small", "medium", "large"
        The width of the modal dialog. This can be one of the following:

        - ``"small"`` (default): The modal dialog will be a maximum of 500
          pixels wide.
        - ``"medium"``: The modal dialog will be up to 750 pixels wide.
        - ``"large"``: The modal dialog will be up to 1280 pixels wide.

    dismissible : bool
        Whether the modal dialog can be dismissed by the user. If this is
        ``True`` (default), the user can dismiss the dialog by clicking
        outside of it, clicking the "**X**" in its upper-right corner, or
        pressing ``ESC`` on their keyboard. If this is ``False``, the "**X**"
        in the upper-right corner is hidden and the dialog must be closed
        programmatically by calling ``st.rerun()`` inside the dialog function.

        .. note::
            Setting ``dismissible`` to ``False`` does not guarantee that all
            interactions in the main app are blocked. Don't rely on
            ``dismissible`` for security-critical checks.

    on_dismiss : "ignore", "rerun", or callable
        How the dialog should respond to dismissal events.
        This can be one of the following:

        - ``"ignore"`` (default): Streamlit will not rerun the app when the
          user dismisses the dialog.

        - ``"rerun"``: Streamlit will rerun the app when the user dismisses
          the dialog.

        - A ``callable``: Streamlit will rerun the app when the user dismisses
          the dialog and execute the ``callable`` as a callback function
          before the rest of the app.

    Examples
    --------
    The following example demonstrates the basic usage of ``@st.dialog``.
    In this app, clicking "**A**" or "**B**" will open a modal dialog and prompt you
    to enter a reason for your vote. In the modal dialog, click "**Submit**" to record
    your vote into Session State and rerun the app. This will close the modal dialog
    since the dialog function is not called during the full-script rerun.

    >>> import streamlit as st
    >>>
    >>> @st.dialog("Cast your vote")
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
            return _dialog_decorator(
                non_optional_func=f,
                title=func_or_title,
                width=width,
                dismissible=dismissible,
                on_dismiss=on_dismiss,
            )

        return wrapper

    func: F = func_or_title
    return _dialog_decorator(
        func, "", width=width, dismissible=dismissible, on_dismiss=on_dismiss
    )

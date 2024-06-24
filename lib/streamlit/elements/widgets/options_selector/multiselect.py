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

from textwrap import dedent
from typing import TYPE_CHECKING, Any, Callable, Sequence, cast

from streamlit.elements.form import current_form_id
from streamlit.elements.lib.utils import get_label_visibility_proto_value
from streamlit.elements.widgets.options_selector.options_selector_utils import (
    check_multiselect_policies,
    register_widget_and_enqueue,
    transform_options,
)
from streamlit.proto.MultiSelect_pb2 import MultiSelect as MultiSelectProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.runtime.state.common import compute_widget_id
from streamlit.type_util import (
    Key,
    LabelVisibility,
    OptionSequence,
    T,
    maybe_raise_label_warnings,
    to_key,
)

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.runtime.state import (
        WidgetArgs,
        WidgetCallback,
        WidgetKwargs,
    )


class MultiSelectMixin:
    @gather_metrics("multiselect")
    def multiselect(
        self,
        label: str,
        options: OptionSequence[T],
        default: Any | None = None,
        format_func: Callable[[Any], Any] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        max_selections: int | None = None,
        placeholder: str = "Choose an option",
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
    ) -> list[T]:
        r"""Display a multiselect widget.
        The multiselect widget starts as empty.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this select widget is for.
            The label can optionally contain Markdown and supports the following
            elements: Bold, Italics, Strikethroughs, Inline Code, Emojis, and Links.

            This also supports:

            * Emoji shortcodes, such as ``:+1:``  and ``:sunglasses:``.
              For a list of all supported codes,
              see https://share.streamlit.io/streamlit/emoji-shortcodes.

            * LaTeX expressions, by wrapping them in "$" or "$$" (the "$$"
              must be on their own lines). Supported LaTeX functions are listed
              at https://katex.org/docs/supported.html.

            * Colored text and background colors for text, using the syntax
              ``:color[text to be colored]`` and
              ``:color-background[text to be colored]``, respectively.
              ``color`` must be replaced with any of the following
              supported colors: blue, green, orange, red, violet, gray/grey, rainbow.
              For example, you can use ``:orange[your text here]`` or
              ``:blue-background[your text here]``.

            Unsupported elements are unwrapped so only their children (text contents)
            render. Display unsupported elements as literal characters by
            backslash-escaping them. E.g. ``1\. Not an ordered list``.

            For accessibility reasons, you should never set an empty label (label="")
            but hide it with label_visibility if needed. In the future, we may disallow
            empty labels by raising an exception.
        options : Iterable
            Labels for the select options in an Iterable. For example, this can
            be a list, numpy.ndarray, pandas.Series, pandas.DataFrame, or
            pandas.Index. For pandas.DataFrame, the first column is used.
            Each label will be cast to str internally by default.
        default: Iterable of V, V, or None
            List of default values. Can also be a single value.
        format_func : function
            Function to modify the display of selectbox options. It receives
            the raw option as an argument and should output the label to be
            shown for that option. This has no impact on the return value of
            the multiselect.
        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        help : str
            An optional tooltip that gets displayed next to the multiselect.
        on_change : callable
            An optional callback invoked when this multiselect's value changes.
        args : tuple
            An optional tuple of args to pass to the callback.
        kwargs : dict
            An optional dict of kwargs to pass to the callback.
        max_selections : int
            The max selections that can be selected at a time.
        placeholder : str
            A string to display when no options are selected.
            Defaults to 'Choose an option'.
        disabled : bool
            An optional boolean, which disables the multiselect widget if set
            to True. The default is False. This argument can only be supplied
            by keyword.
        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. If "hidden", the label doesn't show but there
            is still empty space for it above the widget (equivalent to label="").
            If "collapsed", both the label and the space are removed. Default is
            "visible".

        Returns
        -------
        list
            A list with the selected options

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> options = st.multiselect(
        ...     "What are your favorite colors",
        ...     ["Green", "Yellow", "Red", "Blue"],
        ...     ["Yellow", "Red"])
        >>>
        >>> st.write("You selected:", options)

        .. output::
           https://doc-multiselect.streamlit.app/
           height: 420px

        """
        ctx = get_script_run_ctx()
        return self._multiselect(
            label=label,
            options=options,
            default=default,
            format_func=format_func,
            key=key,
            help=help,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            max_selections=max_selections,
            placeholder=placeholder,
            disabled=disabled,
            label_visibility=label_visibility,
            ctx=ctx,
        )

    def _multiselect(
        self,
        label: str,
        options: OptionSequence[T],
        default: Sequence[Any] | Any | None = None,
        format_func: Callable[[Any], Any] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        max_selections: int | None = None,
        placeholder: str = "Choose an option",
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        ctx: ScriptRunContext | None = None,
    ) -> list[T]:
        key = to_key(key)

        check_multiselect_policies(self.dg, key, on_change, default)

        widget_name = "multiselect"
        maybe_raise_label_warnings(label, label_visibility)

        indexable_options, formatted_options, default_values = transform_options(
            options, default, format_func
        )

        form_id = current_form_id(self.dg)
        widget_id = compute_widget_id(
            widget_name,
            user_key=key,
            label=label,
            options=formatted_options,
            default=default_values,
            key=key,
            help=help,
            max_selections=max_selections,
            placeholder=placeholder,
            form_id=form_id,
            page=ctx.active_script_hash if ctx else None,
        )

        proto = MultiSelectProto()
        proto.id = widget_id
        proto.default[:] = default_values
        proto.form_id = form_id
        proto.disabled = disabled
        proto.label = label
        proto.max_selections = max_selections or 0
        proto.placeholder = placeholder
        proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )
        proto.options[:] = formatted_options
        if help is not None:
            proto.help = dedent(help)

        return register_widget_and_enqueue(
            self.dg,
            widget_name,
            proto,
            widget_id,
            formatted_options,
            indexable_options,
            default_values,
            ctx,
            on_change,
            args,
            kwargs,
            max_selections=max_selections,
            app_testing_value=format_func,
        )

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

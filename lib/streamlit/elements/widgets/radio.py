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

from dataclasses import dataclass
from textwrap import dedent
from typing import TYPE_CHECKING, Any, Callable, Generic, Sequence, cast, overload

from streamlit.dataframe_util import OptionSequence, convert_anything_to_list
from streamlit.elements.form_utils import current_form_id
from streamlit.elements.lib.policies import (
    check_widget_policies,
    maybe_raise_label_warnings,
)
from streamlit.elements.lib.utils import (
    Key,
    LabelVisibility,
    get_label_visibility_proto_value,
    maybe_coerce_enum,
    to_key,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Radio_pb2 import Radio as RadioProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    get_session_state,
    register_widget,
)
from streamlit.runtime.state.common import compute_widget_id, save_for_app_testing
from streamlit.type_util import (
    T,
    check_python_comparable,
)
from streamlit.util import index_

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


@dataclass
class RadioSerde(Generic[T]):
    options: Sequence[T]
    index: int | None

    def serialize(self, v: object) -> int | None:
        if v is None:
            return None

        return 0 if len(self.options) == 0 else index_(self.options, v)

    def deserialize(
        self,
        ui_value: int | None,
        widget_id: str = "",
    ) -> T | None:
        idx = ui_value if ui_value is not None else self.index

        return (
            self.options[idx]
            if idx is not None
            and len(self.options) > 0
            and self.options[idx] is not None
            else None
        )


class RadioMixin:
    @overload
    def radio(
        self,
        label: str,
        options: OptionSequence[T],
        index: int = 0,
        format_func: Callable[[Any], Any] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only args:
        disabled: bool = False,
        horizontal: bool = False,
        captions: Sequence[str] | None = None,
        label_visibility: LabelVisibility = "visible",
    ) -> T: ...

    @overload
    def radio(
        self,
        label: str,
        options: OptionSequence[T],
        index: None,
        format_func: Callable[[Any], Any] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only args:
        disabled: bool = False,
        horizontal: bool = False,
        captions: Sequence[str] | None = None,
        label_visibility: LabelVisibility = "visible",
    ) -> T | None: ...

    @gather_metrics("radio")
    def radio(
        self,
        label: str,
        options: OptionSequence[T],
        index: int | None = 0,
        format_func: Callable[[Any], Any] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only args:
        disabled: bool = False,
        horizontal: bool = False,
        captions: Sequence[str] | None = None,
        label_visibility: LabelVisibility = "visible",
    ) -> T | None:
        r"""Display a radio button widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this radio group is for.
            The label can optionally contain GitHub-flavored Markdown of the
            following types: Bold, Italics, Strikethroughs, Inline Code, and
            Links.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Display unsupported elements as literal
            characters by backslash-escaping them. E.g.,
            ``"1\. Not an ordered list"``.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            For accessibility reasons, you should never set an empty label (label="")
            but hide it with label_visibility if needed. In the future, we may disallow
            empty labels by raising an exception.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        options : Iterable
            Labels for the select options in an ``Iterable``. This can be a
            ``list``, ``set``, or anything supported by ``st.dataframe``. If
            ``options`` is dataframe-like, the first column will be used. Each
            label will be cast to ``str`` internally by default.

            Labels can include markdown as described in the ``label`` parameter
            and will be cast to str internally by default.

        index : int or None
            The index of the preselected option on first render. If ``None``,
            will initialize empty and return ``None`` until the user selects an option.
            Defaults to 0 (the first option).

        format_func : function
            Function to modify the display of radio options. It receives
            the raw option as an argument and should output the label to be
            shown for that option. This has no impact on the return value of
            the radio.

        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        help : str
            An optional tooltip that gets displayed next to the radio.

        on_change : callable
            An optional callback invoked when this radio's value changes.

        args : tuple
            An optional tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        disabled : bool
            An optional boolean, which disables the radio button if set to
            True. The default is False.

        horizontal : bool
            An optional boolean, which orients the radio group horizontally.
            The default is false (vertical buttons).

        captions : iterable of str or None
            A list of captions to show below each radio button. If None (default),
            no captions are shown.

        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. If "hidden", the label doesn't show but there
            is still empty space for it above the widget (equivalent to label="").
            If "collapsed", both the label and the space are removed. Default is
            "visible".

        Returns
        -------
        any
            The selected option or ``None`` if no option is selected.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> genre = st.radio(
        ...     "What's your favorite movie genre",
        ...     [":rainbow[Comedy]", "***Drama***", "Documentary :movie_camera:"],
        ...     captions=[
        ...         "Laugh out loud.",
        ...         "Get the popcorn.",
        ...         "Never stop learning.",
        ...     ],
        ... )
        >>>
        >>> if genre == ":rainbow[Comedy]":
        ...     st.write("You selected comedy.")
        ... else:
        ...     st.write("You didn't select comedy.")

        .. output::
           https://doc-radio.streamlit.app/
           height: 300px

        To initialize an empty radio widget, use ``None`` as the index value:

        >>> import streamlit as st
        >>>
        >>> genre = st.radio(
        ...     "What's your favorite movie genre",
        ...     [":rainbow[Comedy]", "***Drama***", "Documentary :movie_camera:"],
        ...     index=None,
        ... )
        >>>
        >>> st.write("You selected:", genre)

        .. output::
           https://doc-radio-empty.streamlit.app/
           height: 300px

        """
        ctx = get_script_run_ctx()
        return self._radio(
            label=label,
            options=options,
            index=index,
            format_func=format_func,
            key=key,
            help=help,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            disabled=disabled,
            horizontal=horizontal,
            captions=captions,
            label_visibility=label_visibility,
            ctx=ctx,
        )

    def _radio(
        self,
        label: str,
        options: OptionSequence[T],
        index: int | None = 0,
        format_func: Callable[[Any], Any] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only args:
        disabled: bool = False,
        horizontal: bool = False,
        label_visibility: LabelVisibility = "visible",
        captions: Sequence[str] | None = None,
        ctx: ScriptRunContext | None,
    ) -> T | None:
        key = to_key(key)

        check_widget_policies(
            self.dg,
            key,
            on_change,
            default_value=None if index == 0 else index,
        )
        maybe_raise_label_warnings(label, label_visibility)

        opt = convert_anything_to_list(options)
        check_python_comparable(opt)

        id = compute_widget_id(
            "radio",
            user_key=key,
            label=label,
            options=[str(format_func(option)) for option in opt],
            index=index,
            key=key,
            help=help,
            horizontal=horizontal,
            captions=captions,
            form_id=current_form_id(self.dg),
            page=ctx.active_script_hash if ctx else None,
        )

        if not isinstance(index, int) and index is not None:
            raise StreamlitAPIException(
                "Radio Value has invalid type: %s" % type(index).__name__
            )

        if index is not None and len(opt) > 0 and not 0 <= index < len(opt):
            raise StreamlitAPIException(
                "Radio index must be between 0 and length of options"
            )

        def handle_captions(caption: str | None) -> str:
            if caption is None:
                return ""
            elif isinstance(caption, str):
                return caption
            else:
                raise StreamlitAPIException(
                    f"Radio captions must be strings. Passed type: {type(caption).__name__}"
                )

        session_state = get_session_state().filtered_state
        if key is not None and key in session_state and session_state[key] is None:
            index = None

        radio_proto = RadioProto()
        radio_proto.id = id
        radio_proto.label = label
        if index is not None:
            radio_proto.default = index
        radio_proto.options[:] = [str(format_func(option)) for option in opt]
        radio_proto.form_id = current_form_id(self.dg)
        radio_proto.horizontal = horizontal
        radio_proto.disabled = disabled
        radio_proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )

        if captions is not None:
            radio_proto.captions[:] = map(handle_captions, captions)

        if help is not None:
            radio_proto.help = dedent(help)

        serde = RadioSerde(opt, index)

        widget_state = register_widget(
            "radio",
            radio_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
        )
        widget_state = maybe_coerce_enum(widget_state, options, opt)

        if widget_state.value_changed:
            if widget_state.value is not None:
                serialized_value = serde.serialize(widget_state.value)
                if serialized_value is not None:
                    radio_proto.value = serialized_value
            radio_proto.set_value = True

        if ctx:
            save_for_app_testing(ctx, id, format_func)
        self.dg._enqueue("radio", radio_proto)
        return widget_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

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
from typing import TYPE_CHECKING, Literal, cast, overload

from streamlit.elements.form import current_form_id
from streamlit.elements.lib.policies import (
    check_cache_replay_rules,
    check_callback_rules,
    check_fragment_path_policy,
    check_session_state_rules,
)
from streamlit.elements.lib.utils import get_label_visibility_proto_value
from streamlit.errors import StreamlitAPIException
from streamlit.proto.TextArea_pb2 import TextArea as TextAreaProto
from streamlit.proto.TextInput_pb2 import TextInput as TextInputProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    get_session_state,
    register_widget,
)
from streamlit.runtime.state.common import compute_widget_id
from streamlit.type_util import (
    Key,
    LabelVisibility,
    SupportsStr,
    maybe_raise_label_warnings,
    to_key,
)

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


@dataclass
class TextInputSerde:
    value: str | None

    def deserialize(self, ui_value: str | None, widget_id: str = "") -> str | None:
        return ui_value if ui_value is not None else self.value

    def serialize(self, v: str | None) -> str | None:
        return v


@dataclass
class TextAreaSerde:
    value: str | None

    def deserialize(self, ui_value: str | None, widget_id: str = "") -> str | None:
        return ui_value if ui_value is not None else self.value

    def serialize(self, v: str | None) -> str | None:
        return v


class TextWidgetsMixin:
    @overload
    def text_input(
        self,
        label: str,
        value: str = "",
        max_chars: int | None = None,
        key: Key | None = None,
        type: Literal["default", "password"] = "default",
        help: str | None = None,
        autocomplete: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
    ) -> str:
        pass

    @overload
    def text_input(
        self,
        label: str,
        value: SupportsStr | None = None,
        max_chars: int | None = None,
        key: Key | None = None,
        type: Literal["default", "password"] = "default",
        help: str | None = None,
        autocomplete: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
    ) -> str | None:
        pass

    @gather_metrics("text_input")
    def text_input(
        self,
        label: str,
        value: str | SupportsStr | None = "",
        max_chars: int | None = None,
        key: Key | None = None,
        type: Literal["default", "password"] = "default",
        help: str | None = None,
        autocomplete: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
    ) -> str | None:
        r"""Display a single-line text input widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this input is for.
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
              ``:color[text to be colored]`` and ``:color-background[text to be colored]``,
              respectively. ``color`` must be replaced with any of the following
              supported colors: blue, green, orange, red, violet, gray/grey, rainbow.
              For example, you can use ``:orange[your text here]`` or
              ``:blue-background[your text here]``.

            Unsupported elements are unwrapped so only their children (text contents) render.
            Display unsupported elements as literal characters by
            backslash-escaping them. E.g. ``1\. Not an ordered list``.

            For accessibility reasons, you should never set an empty label (label="")
            but hide it with label_visibility if needed. In the future, we may disallow
            empty labels by raising an exception.
        value : object or None
            The text value of this widget when it first renders. This will be
            cast to str internally. If ``None``, will initialize empty and
            return ``None`` until the user provides input. Defaults to empty string.
        max_chars : int or None
            Max number of characters allowed in text input.
        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        type : "default" or "password"
            The type of the text input. This can be either "default" (for
            a regular text input), or "password" (for a text input that
            masks the user's typed value). Defaults to "default".
        help : str
            An optional tooltip that gets displayed next to the input.
        autocomplete : str
            An optional value that will be passed to the <input> element's
            autocomplete property. If unspecified, this value will be set to
            "new-password" for "password" inputs, and the empty string for
            "default" inputs. For more details, see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete
        on_change : callable
            An optional callback invoked when this text input's value changes.
        args : tuple
            An optional tuple of args to pass to the callback.
        kwargs : dict
            An optional dict of kwargs to pass to the callback.
        placeholder : str or None
            An optional string displayed when the text input is empty. If None,
            no text is displayed.
        disabled : bool
            An optional boolean, which disables the text input if set to True.
            The default is False.
        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. If "hidden", the label doesn't show but there
            is still empty space for it above the widget (equivalent to label="").
            If "collapsed", both the label and the space are removed. Default is
            "visible".

        Returns
        -------
        str or None
            The current value of the text input widget or ``None`` if no value has been
            provided by the user.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> title = st.text_input("Movie title", "Life of Brian")
        >>> st.write("The current movie title is", title)

        .. output::
           https://doc-text-input.streamlit.app/
           height: 260px

        """
        ctx = get_script_run_ctx()
        return self._text_input(
            label=label,
            value=value,
            max_chars=max_chars,
            key=key,
            type=type,
            help=help,
            autocomplete=autocomplete,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            placeholder=placeholder,
            disabled=disabled,
            label_visibility=label_visibility,
            ctx=ctx,
        )

    def _text_input(
        self,
        label: str,
        value: SupportsStr | None = "",
        max_chars: int | None = None,
        key: Key | None = None,
        type: str = "default",
        help: str | None = None,
        autocomplete: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        ctx: ScriptRunContext | None = None,
    ) -> str | None:
        key = to_key(key)

        check_fragment_path_policy(self.dg)
        check_cache_replay_rules()
        check_callback_rules(self.dg, on_change)
        check_session_state_rules(default_value=None if value == "" else value, key=key)
        maybe_raise_label_warnings(label, label_visibility)

        # Make sure value is always string or None:
        value = str(value) if value is not None else None

        id = compute_widget_id(
            "text_input",
            user_key=key,
            label=label,
            value=value,
            max_chars=max_chars,
            key=key,
            type=type,
            help=help,
            autocomplete=autocomplete,
            placeholder=str(placeholder),
            form_id=current_form_id(self.dg),
            page=ctx.active_script_hash if ctx else None,
        )

        session_state = get_session_state().filtered_state
        if key is not None and key in session_state and session_state[key] is None:
            value = None

        text_input_proto = TextInputProto()
        text_input_proto.id = id
        text_input_proto.label = label
        if value is not None:
            text_input_proto.default = value
        text_input_proto.form_id = current_form_id(self.dg)
        text_input_proto.disabled = disabled
        text_input_proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )

        if help is not None:
            text_input_proto.help = dedent(help)

        if max_chars is not None:
            text_input_proto.max_chars = max_chars

        if placeholder is not None:
            text_input_proto.placeholder = str(placeholder)

        if type == "default":
            text_input_proto.type = TextInputProto.DEFAULT
        elif type == "password":
            text_input_proto.type = TextInputProto.PASSWORD
        else:
            raise StreamlitAPIException(
                "'%s' is not a valid text_input type. Valid types are 'default' and 'password'."
                % type
            )

        # Marshall the autocomplete param. If unspecified, this will be
        # set to "new-password" for password inputs.
        if autocomplete is None:
            autocomplete = "new-password" if type == "password" else ""
        text_input_proto.autocomplete = autocomplete

        serde = TextInputSerde(value)

        widget_state = register_widget(
            "text_input",
            text_input_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
        )

        if widget_state.value_changed:
            if widget_state.value is not None:
                text_input_proto.value = widget_state.value
            text_input_proto.set_value = True

        self.dg._enqueue("text_input", text_input_proto)
        return widget_state.value

    @overload
    def text_area(
        self,
        label: str,
        value: str = "",
        height: int | None = None,
        max_chars: int | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
    ) -> str:
        pass

    @overload
    def text_area(
        self,
        label: str,
        value: SupportsStr | None = None,
        height: int | None = None,
        max_chars: int | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
    ) -> str | None:
        pass

    @gather_metrics("text_area")
    def text_area(
        self,
        label: str,
        value: str | SupportsStr | None = "",
        height: int | None = None,
        max_chars: int | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
    ) -> str | None:
        r"""Display a multi-line text input widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this input is for.
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
              ``:color[text to be colored]`` and ``:color-background[text to be colored]``,
              respectively. ``color`` must be replaced with any of the following
              supported colors: blue, green, orange, red, violet, gray/grey, rainbow.
              For example, you can use ``:orange[your text here]`` or
              ``:blue-background[your text here]``.

            Unsupported elements are unwrapped so only their children (text contents) render.
            Display unsupported elements as literal characters by
            backslash-escaping them. E.g. ``1\. Not an ordered list``.

            For accessibility reasons, you should never set an empty label (label="")
            but hide it with label_visibility if needed. In the future, we may disallow
            empty labels by raising an exception.
        value : object or None
            The text value of this widget when it first renders. This will be
            cast to str internally. If ``None``, will initialize empty and
            return ``None`` until the user provides input. Defaults to empty string.
        height : int or None
            Desired height of the UI element expressed in pixels. If None, a
            default height is used.
        max_chars : int or None
            Maximum number of characters allowed in text area.
        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        help : str
            An optional tooltip that gets displayed next to the textarea.
        on_change : callable
            An optional callback invoked when this text_area's value changes.
        args : tuple
            An optional tuple of args to pass to the callback.
        kwargs : dict
            An optional dict of kwargs to pass to the callback.
        placeholder : str or None
            An optional string displayed when the text area is empty. If None,
            no text is displayed.
        disabled : bool
            An optional boolean, which disables the text area if set to True.
            The default is False.
        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. If "hidden", the label doesn't show but there
            is still empty space for it above the widget (equivalent to label="").
            If "collapsed", both the label and the space are removed. Default is
            "visible".

        Returns
        -------
        str or None
            The current value of the text area widget or ``None`` if no value has been
            provided by the user.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> txt = st.text_area(
        ...     "Text to analyze",
        ...     "It was the best of times, it was the worst of times, it was the age of "
        ...     "wisdom, it was the age of foolishness, it was the epoch of belief, it "
        ...     "was the epoch of incredulity, it was the season of Light, it was the "
        ...     "season of Darkness, it was the spring of hope, it was the winter of "
        ...     "despair, (...)",
        ...     )
        >>>
        >>> st.write(f"You wrote {len(txt)} characters.")

        .. output::
           https://doc-text-area.streamlit.app/
           height: 300px

        """
        ctx = get_script_run_ctx()
        return self._text_area(
            label=label,
            value=value,
            height=height,
            max_chars=max_chars,
            key=key,
            help=help,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            placeholder=placeholder,
            disabled=disabled,
            label_visibility=label_visibility,
            ctx=ctx,
        )

    def _text_area(
        self,
        label: str,
        value: SupportsStr | None = "",
        height: int | None = None,
        max_chars: int | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        ctx: ScriptRunContext | None = None,
    ) -> str | None:
        key = to_key(key)

        check_fragment_path_policy(self.dg)
        check_cache_replay_rules()
        check_callback_rules(self.dg, on_change)
        check_session_state_rules(default_value=None if value == "" else value, key=key)
        maybe_raise_label_warnings(label, label_visibility)

        value = str(value) if value is not None else None

        id = compute_widget_id(
            "text_area",
            user_key=key,
            label=label,
            value=value,
            height=height,
            max_chars=max_chars,
            key=key,
            help=help,
            placeholder=str(placeholder),
            form_id=current_form_id(self.dg),
            page=ctx.active_script_hash if ctx else None,
        )

        session_state = get_session_state().filtered_state
        if key is not None and key in session_state and session_state[key] is None:
            value = None

        text_area_proto = TextAreaProto()
        text_area_proto.id = id
        text_area_proto.label = label
        if value is not None:
            text_area_proto.default = value
        text_area_proto.form_id = current_form_id(self.dg)
        text_area_proto.disabled = disabled
        text_area_proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )

        if help is not None:
            text_area_proto.help = dedent(help)

        if height is not None:
            text_area_proto.height = height

        if max_chars is not None:
            text_area_proto.max_chars = max_chars

        if placeholder is not None:
            text_area_proto.placeholder = str(placeholder)

        serde = TextAreaSerde(value)
        widget_state = register_widget(
            "text_area",
            text_area_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
        )

        if widget_state.value_changed:
            if widget_state.value is not None:
                text_area_proto.value = widget_state.value
            text_area_proto.set_value = True

        self.dg._enqueue("text_area", text_area_proto)
        return widget_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

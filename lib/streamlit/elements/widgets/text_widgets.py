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

from dataclasses import dataclass
from textwrap import dedent
from typing import TYPE_CHECKING, Literal, cast, overload

from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.layout_utils import (
    Height,
    LayoutConfig,
    WidthWithoutContent,
    validate_height,
    validate_width,
)
from streamlit.elements.lib.policies import (
    check_widget_policies,
    maybe_raise_label_warnings,
)
from streamlit.elements.lib.utils import (
    Key,
    LabelVisibility,
    compute_and_register_element_id,
    get_label_visibility_proto_value,
    to_key,
)
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
from streamlit.string_util import validate_icon_or_emoji
from streamlit.type_util import SupportsStr

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.type_util import SupportsStr


@dataclass
class TextInputSerde:
    value: str | None

    def deserialize(self, ui_value: str | None) -> str | None:
        return ui_value if ui_value is not None else self.value

    def serialize(self, v: str | None) -> str | None:
        return v


@dataclass
class TextAreaSerde:
    value: str | None

    def deserialize(self, ui_value: str | None) -> str | None:
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
        icon: str | None = None,
        width: WidthWithoutContent = "stretch",
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
        icon: str | None = None,
        width: WidthWithoutContent = "stretch",
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
        icon: str | None = None,
        width: WidthWithoutContent = "stretch",
    ) -> str | None:
        r"""Display a single-line text input widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this input is for.
            The label can optionally contain GitHub-flavored Markdown of the
            following types: Bold, Italics, Strikethroughs, Inline Code, Links,
            and Images. Images display like icons, with a max height equal to
            the font height.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Display unsupported elements as literal
            characters by backslash-escaping them. E.g.,
            ``"1\. Not an ordered list"``.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            For accessibility reasons, you should never set an empty label, but
            you can hide it with ``label_visibility`` if needed. In the future,
            we may disallow empty labels by raising an exception.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        value : object or None
            The text value of this widget when it first renders. This will be
            cast to str internally. If ``None``, will initialize empty and
            return ``None`` until the user provides input. Defaults to empty string.

        max_chars : int or None
            Max number of characters allowed in text input.

        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. No two widgets may have the same key.

        type : "default" or "password"
            The type of the text input. This can be either "default" (for
            a regular text input), or "password" (for a text input that
            masks the user's typed value). Defaults to "default".

        help : str or None
            A tooltip that gets displayed next to the widget label. Streamlit
            only displays the tooltip when ``label_visibility="visible"``. If
            this is ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        autocomplete : str
            An optional value that will be passed to the <input> element's
            autocomplete property. If unspecified, this value will be set to
            "new-password" for "password" inputs, and the empty string for
            "default" inputs. For more details, see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete

        on_change : callable
            An optional callback invoked when this text input's value changes.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        placeholder : str or None
            An optional string displayed when the text input is empty. If None,
            no text is displayed.

        disabled : bool
            An optional boolean that disables the text input if set to
            ``True``. The default is ``False``.

        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. The default is ``"visible"``. If this
            is ``"hidden"``, Streamlit displays an empty spacer instead of the
            label, which can help keep the widget aligned with other widgets.

        icon : str, None
            An optional emoji or icon to display within the input field to the
            left of the value. If ``icon`` is ``None`` (default), no icon is
            displayed. If ``icon`` is a string, the following options are
            valid:

            - A single-character emoji. For example, you can set ``icon="🚨"``
              or ``icon="🔥"``. Emoji short codes are not supported.

            - An icon from the Material Symbols library (rounded style) in the
              format ``":material/icon_name:"`` where "icon_name" is the name
              of the icon in snake case.

              For example, ``icon=":material/thumb_up:"`` will display the
              Thumb Up icon. Find additional icons in the `Material Symbols \
              <https://fonts.google.com/icons?icon.set=Material+Symbols&icon.style=Rounded>`_
              font library.

            - ``"spinner"``: Displays a spinner as an icon.

        width : "stretch" or int
            The width of the text input widget. This can be one of the
            following:

            - ``"stretch"`` (default): The width of the widget matches the
              width of the parent container.
            - An integer specifying the width in pixels: The widget has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the widget matches the width
              of the parent container.

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
            icon=icon,
            width=width,
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
        icon: str | None = None,
        width: WidthWithoutContent = "stretch",
        ctx: ScriptRunContext | None = None,
    ) -> str | None:
        key = to_key(key)

        check_widget_policies(
            self.dg,
            key,
            on_change,
            default_value=None if value == "" else value,
        )
        maybe_raise_label_warnings(label, label_visibility)

        # Make sure value is always string or None:
        value = str(value) if value is not None else None

        element_id = compute_and_register_element_id(
            "text_input",
            user_key=key,
            # Explicitly whitelist max_chars to make sure the ID changes when it changes
            # since the widget value might become invalid based on a different max_chars
            key_as_main_identity={"max_chars"},
            dg=self.dg,
            label=label,
            value=value,
            max_chars=max_chars,
            type=type,
            help=help,
            autocomplete=autocomplete,
            placeholder=str(placeholder),
            icon=icon,
            width=width,
        )

        session_state = get_session_state().filtered_state
        if key is not None and key in session_state and session_state[key] is None:
            value = None

        text_input_proto = TextInputProto()
        text_input_proto.id = element_id
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

        if icon is not None:
            text_input_proto.icon = validate_icon_or_emoji(icon)

        if type == "default":
            text_input_proto.type = TextInputProto.DEFAULT
        elif type == "password":
            text_input_proto.type = TextInputProto.PASSWORD
        else:
            raise StreamlitAPIException(
                f"'{type}' is not a valid text_input type. Valid types are 'default' and 'password'."
            )

        # Marshall the autocomplete param. If unspecified, this will be
        # set to "new-password" for password inputs.
        if autocomplete is None:
            autocomplete = "new-password" if type == "password" else ""
        text_input_proto.autocomplete = autocomplete

        serde = TextInputSerde(value)

        widget_state = register_widget(
            text_input_proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="string_value",
        )

        if widget_state.value_changed:
            if widget_state.value is not None:
                text_input_proto.value = widget_state.value
            text_input_proto.set_value = True

        validate_width(width)
        layout_config = LayoutConfig(width=width)

        self.dg._enqueue("text_input", text_input_proto, layout_config=layout_config)
        return widget_state.value

    @overload
    def text_area(
        self,
        label: str,
        value: str = "",
        height: Height | None = None,
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
        width: WidthWithoutContent = "stretch",
    ) -> str:
        pass

    @overload
    def text_area(
        self,
        label: str,
        value: SupportsStr | None = None,
        height: Height | None = None,
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
        width: WidthWithoutContent = "stretch",
    ) -> str | None:
        pass

    @gather_metrics("text_area")
    def text_area(
        self,
        label: str,
        value: str | SupportsStr | None = "",
        height: Height | None = None,
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
        width: WidthWithoutContent = "stretch",
    ) -> str | None:
        r"""Display a multi-line text input widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this input is for.
            The label can optionally contain GitHub-flavored Markdown of the
            following types: Bold, Italics, Strikethroughs, Inline Code, Links,
            and Images. Images display like icons, with a max height equal to
            the font height.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Display unsupported elements as literal
            characters by backslash-escaping them. E.g.,
            ``"1\. Not an ordered list"``.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            For accessibility reasons, you should never set an empty label, but
            you can hide it with ``label_visibility`` if needed. In the future,
            we may disallow empty labels by raising an exception.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        value : object or None
            The text value of this widget when it first renders. This will be
            cast to str internally. If ``None``, will initialize empty and
            return ``None`` until the user provides input. Defaults to empty string.

        height : "content", "stretch", int, or None
            The height of the text area widget. This can be one of the
            following:

            - ``None`` (default): The height of the widget fits three lines.
            - ``"content"``: The height of the widget matches the
              height of its content.
            - ``"stretch"``: The height of the widget matches the height of
              its content or the height of the parent container, whichever is
              larger. If the widget is not in a parent container, the height
              of the widget matches the height of its content.
            - An integer specifying the height in pixels: The widget has a
              fixed height. If the content is larger than the specified
              height, scrolling is enabled.

            The widget's height can't be smaller than the height of two lines.
            When ``label_visibility="collapsed"``, the minimum height is 68
            pixels. Otherwise, the minimum height is 98 pixels.

        max_chars : int or None
            Maximum number of characters allowed in text area.

        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. No two widgets may have the same key.

        help : str or None
            A tooltip that gets displayed next to the widget label. Streamlit
            only displays the tooltip when ``label_visibility="visible"``. If
            this is ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        on_change : callable
            An optional callback invoked when this text_area's value changes.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        placeholder : str or None
            An optional string displayed when the text area is empty. If None,
            no text is displayed.

        disabled : bool
            An optional boolean that disables the text area if set to ``True``.
            The default is ``False``.

        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. The default is ``"visible"``. If this
            is ``"hidden"``, Streamlit displays an empty spacer instead of the
            label, which can help keep the widget aligned with other widgets.
            If this is ``"collapsed"``, Streamlit displays no label or spacer.

        width : "stretch" or int
            The width of the text area widget. This can be one of the
            following:

            - ``"stretch"`` (default): The width of the widget matches the
              width of the parent container.
            - An integer specifying the width in pixels: The widget has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the widget matches the width
              of the parent container.

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
        ... )
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
            width=width,
            ctx=ctx,
        )

    def _text_area(
        self,
        label: str,
        value: SupportsStr | None = "",
        height: Height | None = None,
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
        width: WidthWithoutContent = "stretch",
        ctx: ScriptRunContext | None = None,
    ) -> str | None:
        key = to_key(key)

        check_widget_policies(
            self.dg,
            key,
            on_change,
            default_value=None if value == "" else value,
        )
        maybe_raise_label_warnings(label, label_visibility)

        value = str(value) if value is not None else None

        element_id = compute_and_register_element_id(
            "text_area",
            user_key=key,
            # Explicitly whitelist max_chars to make sure the ID changes when it changes
            # since the widget value might become invalid based on a different max_chars
            key_as_main_identity={"max_chars"},
            dg=self.dg,
            label=label,
            value=value,
            height=height,
            max_chars=max_chars,
            help=help,
            placeholder=str(placeholder),
            width=width,
        )

        session_state = get_session_state().filtered_state
        if key is not None and key in session_state and session_state[key] is None:
            value = None

        text_area_proto = TextAreaProto()
        text_area_proto.id = element_id
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

        if max_chars is not None:
            text_area_proto.max_chars = max_chars

        if placeholder is not None:
            text_area_proto.placeholder = str(placeholder)

        serde = TextAreaSerde(value)
        widget_state = register_widget(
            text_area_proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="string_value",
        )

        if widget_state.value_changed:
            if widget_state.value is not None:
                text_area_proto.value = widget_state.value
            text_area_proto.set_value = True

        validate_width(width)
        if height is not None:
            validate_height(height, allow_content=True)
        else:
            # We want to maintain the same approximately three lines of text height
            # for the text input when the label is collapsed.
            # These numbers are for the entire element including the label and
            # padding.
            height = 122 if label_visibility != "collapsed" else 94

        layout_config = LayoutConfig(width=width, height=height)

        self.dg._enqueue("text_area", text_area_proto, layout_config=layout_config)
        return widget_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

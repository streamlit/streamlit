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

import re
from dataclasses import dataclass
from textwrap import dedent
from typing import TYPE_CHECKING, cast

from streamlit.elements.lib.form_utils import current_form_id
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
from streamlit.proto.ColorPicker_pb2 import ColorPicker as ColorPickerProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    register_widget,
)

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


@dataclass
class ColorPickerSerde:
    value: str

    def serialize(self, v: str) -> str:
        return str(v)

    def deserialize(self, ui_value: str | None, widget_id: str = "") -> str:
        return str(ui_value if ui_value is not None else self.value)


class ColorPickerMixin:
    @gather_metrics("color_picker")
    def color_picker(
        self,
        label: str,
        value: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
    ) -> str:
        r"""Display a color picker widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this input is for.
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

        value : str
            The hex value of this widget when it first renders. If None,
            defaults to black.

        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. No two widgets may have the same key.

        help : str
            An optional tooltip that gets displayed next to the color picker.

        on_change : callable
            An optional callback invoked when this color_picker's value
            changes.

        args : tuple
            An optional tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        disabled : bool
            An optional boolean, which disables the color picker if set to
            True. The default is False. This argument can only be supplied by
            keyword.

        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. If "hidden", the label doesn't show but there
            is still empty space for it above the widget (equivalent to label="").
            If "collapsed", both the label and the space are removed. Default is
            "visible".

        Returns
        -------
        str
            The selected color as a hex string.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> color = st.color_picker("Pick A Color", "#00f900")
        >>> st.write("The current color is", color)

        .. output::
           https://doc-color-picker.streamlit.app/
           height: 335px

        """
        ctx = get_script_run_ctx()
        return self._color_picker(
            label=label,
            value=value,
            key=key,
            help=help,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            disabled=disabled,
            label_visibility=label_visibility,
            ctx=ctx,
        )

    def _color_picker(
        self,
        label: str,
        value: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        ctx: ScriptRunContext | None = None,
    ) -> str:
        key = to_key(key)

        check_widget_policies(
            self.dg,
            key,
            on_change,
            default_value=value,
        )
        maybe_raise_label_warnings(label, label_visibility)

        element_id = compute_and_register_element_id(
            "color_picker",
            user_key=key,
            form_id=current_form_id(self.dg),
            label=label,
            value=str(value),
            help=help,
        )

        # set value default
        if value is None:
            value = "#000000"

        # make sure the value is a string
        if not isinstance(value, str):
            raise StreamlitAPIException(
                """
                Color Picker Value has invalid type: %s. Expects a hex string
                like '#00FFAA' or '#000'.
                """
                % type(value).__name__
            )

        # validate the value and expects a hex string
        match = re.match(r"^#(?:[0-9a-fA-F]{3}){1,2}$", value)

        if not match:
            raise StreamlitAPIException(
                """
                '%s' is not a valid hex code for colors. Valid ones are like
                '#00FFAA' or '#000'.
                """
                % value
            )

        color_picker_proto = ColorPickerProto()
        color_picker_proto.id = element_id
        color_picker_proto.label = label
        color_picker_proto.default = str(value)
        color_picker_proto.form_id = current_form_id(self.dg)
        color_picker_proto.disabled = disabled
        color_picker_proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )

        if help is not None:
            color_picker_proto.help = dedent(help)

        serde = ColorPickerSerde(value)

        widget_state = register_widget(
            "color_picker",
            color_picker_proto,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
        )

        if widget_state.value_changed:
            color_picker_proto.value = widget_state.value
            color_picker_proto.set_value = True

        self.dg._enqueue("color_picker", color_picker_proto)
        return widget_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

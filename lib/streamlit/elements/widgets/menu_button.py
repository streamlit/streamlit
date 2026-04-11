# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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
from typing import TYPE_CHECKING, Any, Final, Generic, Literal, TypeVar, cast

from streamlit import runtime
from streamlit.dataframe_util import OptionSequence, convert_anything_to_list
from streamlit.elements.lib.form_utils import is_in_form
from streamlit.elements.lib.layout_utils import Width, create_layout_config
from streamlit.elements.lib.options_selector_utils import create_mappings
from streamlit.elements.lib.policies import check_widget_policies
from streamlit.elements.lib.utils import (
    Key,
    compute_and_register_element_id,
    save_for_app_testing,
    to_key,
)
from streamlit.errors import StreamlitAPIException, StreamlitValueError
from streamlit.proto.Common_pb2 import StringTriggerValue
from streamlit.proto.MenuButton_pb2 import MenuButton as MenuButtonProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    register_widget,
)
from streamlit.string_util import validate_icon_or_emoji
from streamlit.type_util import check_python_comparable

if TYPE_CHECKING:
    from collections.abc import Callable, Sequence

    from streamlit.delta_generator import DeltaGenerator

T = TypeVar("T")

_FORM_DOCS_INFO: Final = """

For more information, refer to the
[documentation for forms](https://docs.streamlit.io/develop/api-reference/execution-flow/st.form).
"""


class MenuButtonSerde(Generic[T]):
    """Serializer/deserializer for MenuButton widget values.

    Uses string trigger value pattern for trigger behavior (value resets after each run).
    The frontend sends the selected option value as a string.
    """

    options: Sequence[T]
    formatted_options: list[str]
    formatted_option_to_option_index: dict[str, int]
    format_func: Callable[[Any], str]

    def __init__(
        self,
        options: Sequence[T],
        *,
        formatted_options: list[str],
        formatted_option_to_option_index: dict[str, int],
        format_func: Callable[[Any], str] = str,
    ) -> None:
        self.options = options
        self.formatted_options = formatted_options
        self.formatted_option_to_option_index = formatted_option_to_option_index
        self.format_func = format_func

    def serialize(self, v: T | None) -> StringTriggerValue:
        if v is None or len(self.options) == 0:
            # Always return a valid proto object (like ChatInputSerde)
            return StringTriggerValue()

        try:
            formatted_value = self.format_func(v)
        except Exception:
            formatted_value = str(v)

        return StringTriggerValue(data=formatted_value)

    def deserialize(self, ui_value: str | None) -> T | None:
        if ui_value is None or len(self.options) == 0:
            return None

        option_index = self.formatted_option_to_option_index.get(ui_value)
        return self.options[option_index] if option_index is not None else None


class MenuButtonMixin:
    @gather_metrics("menu_button")
    def menu_button(
        self,
        label: str,
        options: OptionSequence[T],
        *,
        key: Key | None = None,
        help: str | None = None,
        on_click: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        type: Literal["primary", "secondary", "tertiary"] = "secondary",
        icon: str | None = None,
        disabled: bool = False,
        width: Width = "content",
        format_func: Callable[[Any], str] = str,
    ) -> T | None:
        r"""Display a dropdown menu button widget.

        A menu button displays a button which, when clicked, opens a dropdown
        menu with multiple options. Selecting an option triggers a rerun and
        returns the selected option value. If you open and close the dropdown
        menu without selecting an option, the app doesn't rerun.

        ``st.menu_button`` behaves like ``st.button`` except that it returns
        one of multiple options when triggered instead of only ``True``. Unlike
        ``st.selectbox``, the button label remains unchanged after a selection,
        and the return value reverts to ``None`` on the next rerun, until the
        menu button is triggered again.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this button is for.
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

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        options : Iterable
            Labels for the menu options in an ``Iterable``. This can be a
            ``list``, ``set``, or anything supported by ``st.dataframe``. If
            ``options`` is dataframe-like, the first column will be used. Each
            label will be cast to ``str`` internally by default.

            Labels can include markdown as described in the ``label`` parameter.

        key : str, int, or None
            An optional string or integer to use as the unique key for
            the widget. If this is ``None`` (default), a key will be
            generated for the widget based on the values of the other
            parameters. No two widgets may have the same key. Assigning
            a key stabilizes the widget's identity and preserves its
            state across reruns even when other parameters change.

            A key lets you access the widget's value via
            ``st.session_state[key]`` (read-only). For more details, see
            `Widget behavior
            <https://docs.streamlit.io/develop/concepts/architecture/widget-behavior>`_.

            Additionally, if ``key`` is provided, it will be used as a
            CSS class name prefixed with ``st-key-``.

        help : str or None
            A tooltip that gets displayed when the button is hovered over. If
            this is ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        on_click : callable
            An optional callback invoked when an option is selected.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        type : "primary", "secondary", or "tertiary"
            An optional string that specifies the button type. This can be one
            of the following:

            - ``"primary"``: The button's background is the app's primary color
              for additional emphasis.
            - ``"secondary"`` (default): The button's background coordinates
              with the app's background color for normal emphasis.
            - ``"tertiary"``: The button is plain text without a border or
              background for subtlety.

        icon : str or None
            An optional emoji or icon to display next to the button label. If ``icon``
            is ``None`` (default), no icon is displayed. If ``icon`` is a
            string, the following options are valid:

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

        disabled : bool
            An optional boolean that disables the button if set to ``True``.
            The default is ``False``.

        width : "content", "stretch", or int
            The width of the menu button. This can be one of the following:

            - ``"content"`` (default): The width of the button matches the
              width of its content, but doesn't exceed the width of the parent
              container.
            - ``"stretch"``: The width of the button matches the width of the
              parent container.
            - An integer specifying the width in pixels: The button has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the button matches the width
              of the parent container.

        format_func : function
            Function to modify the display of the menu options. It receives
            the raw option as an argument and should output the label to be
            shown for that option. This has no impact on the return value of
            the menu button.

        Returns
        -------
        any or None
            The selected option value when an option is clicked, or ``None``
            if no option was clicked.

            This is a copy of the selected option, not the original.

        Examples
        --------
        .. code-block:: python
            :filename: streamlit_app.py

            import streamlit as st

            action = st.menu_button("Export", options=["CSV", "JSON", "PDF"])
            if action == "CSV":
                st.write("Exporting as CSV...")
            elif action == "JSON":
                st.write("Exporting as JSON...")
            elif action == "PDF":
                st.write("Exporting as PDF...")

        .. output::
            https://doc-menu-button.streamlit.app/
            height: 300px

        """
        ctx = get_script_run_ctx()
        return self._menu_button(
            label=label,
            options=options,
            key=key,
            help=help,
            on_click=on_click,
            args=args,
            kwargs=kwargs,
            type=type,
            icon=icon,
            disabled=disabled,
            width=width,
            format_func=format_func,
            ctx=ctx,
        )

    def _menu_button(
        self,
        label: str,
        options: OptionSequence[T],
        *,
        key: Key | None = None,
        help: str | None = None,
        on_click: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        type: Literal["primary", "secondary", "tertiary"] = "secondary",
        icon: str | None = None,
        disabled: bool = False,
        width: Width = "content",
        format_func: Callable[[Any], str] = str,
        ctx: ScriptRunContext | None = None,
    ) -> T | None:
        key = to_key(key)

        check_widget_policies(
            self.dg,
            key,
            on_click,
            default_value=None,
            writes_allowed=False,
        )

        if runtime.exists() and is_in_form(self.dg):
            raise StreamlitAPIException(
                f"`st.menu_button()` can't be used in an `st.form()`.{_FORM_DOCS_INFO}"
            )

        if type not in {"primary", "secondary", "tertiary"}:
            raise StreamlitValueError(
                "type", ["'primary'", "'secondary'", "'tertiary'"]
            )

        layout_config = create_layout_config(width=width, allow_content_width=True)

        opt = convert_anything_to_list(options)

        if len(opt) == 0:
            raise StreamlitAPIException(
                "The options argument to st.menu_button must contain at least one option."
            )

        check_python_comparable(opt)

        formatted_options, formatted_option_to_option_index = create_mappings(
            opt, format_func
        )

        # Check for duplicate formatted labels - unlike selectbox/radio, menu_button
        # uses string-based selection where duplicates would be ambiguous.
        if len(formatted_options) != len(formatted_option_to_option_index):
            raise StreamlitAPIException(
                "The `format_func` produced duplicate labels for the menu button "
                "options. Each formatted option label must be unique."
            )

        element_id = compute_and_register_element_id(
            "menu_button",
            user_key=key,
            key_as_main_identity=True,
            dg=self.dg,
            label=label,
            options=formatted_options,
            help=help,
            type=type,
            icon=icon,
            width=width,
        )

        menu_button_proto = MenuButtonProto()
        menu_button_proto.id = element_id
        menu_button_proto.label = label
        menu_button_proto.options[:] = formatted_options
        menu_button_proto.type = type
        menu_button_proto.disabled = disabled

        if help is not None:
            menu_button_proto.help = dedent(help)

        if icon is not None:
            menu_button_proto.icon = validate_icon_or_emoji(icon)

        serde = MenuButtonSerde(
            opt,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=format_func,
        )

        widget_state = register_widget(
            menu_button_proto.id,
            on_change_handler=on_click,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="string_trigger_value",
        )

        if ctx:
            # Save format_func, value, and original options for AppTest support.
            # Trigger widgets need to save the value since it resets after each run.
            # Original options are needed for click_index() to return the correct type.
            save_for_app_testing(
                ctx,
                element_id,
                {
                    "format_func": format_func,
                    "value": widget_state.value,
                    "options": opt,
                },
            )

        self.dg._enqueue("menu_button", menu_button_proto, layout_config=layout_config)
        return widget_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

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
from typing import (
    TYPE_CHECKING,
    Final,
    Literal,
    cast,
)

from streamlit import runtime
from streamlit.elements.lib.form_utils import current_form_id, is_in_form
from streamlit.elements.lib.policies import check_widget_policies
from streamlit.elements.lib.utils import (
    Key,
    compute_and_register_element_id,
    save_for_app_testing,
    to_key,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.DropdownButton_pb2 import DropdownButton as DropdownButtonProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    register_widget,
)
from streamlit.string_util import validate_icon_or_emoji

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator

FORM_DOCS_INFO: Final = """

For more information, refer to the
[documentation for forms](https://docs.streamlit.io/develop/api-reference/execution-flow/st.form).
"""


@dataclass
class DropdownButtonSerde:
    def serialize(self, v: str | None) -> str:
        return v or ""

    def deserialize(self, ui_value: str | None) -> str | None:
        return ui_value if ui_value else None


class DropdownButtonMixin:
    @gather_metrics("dropdown_button")
    def dropdown_button(
        self,
        label: str,
        options: list[str],
        key: Key | None = None,
        help: str | None = None,
        on_click: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        type: Literal["primary", "secondary", "tertiary"] = "secondary",
        icon: str | None = None,
        disabled: bool = False,
        use_container_width: bool = False,
        placeholder: str | None = "Select an option",
    ) -> str | None:
        """Display a dropdown button widget.

        A dropdown button combines a button with a dropdown menu. When clicked,
        it shows a list of options that the user can select from. The selected
        option is returned as a string.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this dropdown button is for.
            The label can contain Markdown and supports the following elements:
            Bold, Italics, Strikethroughs, Inline Code, Emojis, and Links.

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

        options : list of str
            Labels for the dropdown options. This will be cast to str internally.

        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        help : str
            An optional tooltip that gets displayed when the user hovers over
            the dropdown button.

        on_click : callable
            An optional callback invoked when this dropdown button is clicked.
            The callback will be called with the selected option as an argument.

        args : tuple
            An optional tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        type : "primary", "secondary", or "tertiary"
            An optional string that specifies the button type. Can be "primary"
            for a button with additional emphasis, "secondary" for a normal button
            (default), or "tertiary" for a button with less emphasis.

        icon : str
            An optional emoji or icon to display on the button. This can be an
            emoji (e.g. "🔥") or a material icon (e.g. ":material/search:").

        disabled : bool
            An optional boolean, which disables the dropdown button if set to
            True. The default is False.

        use_container_width : bool
            An optional boolean, which makes the button occupy the full width
            of its container. The default is False.

        placeholder : str
            An optional string displayed when no option has been selected.
            Defaults to "Select an option".

        Returns
        -------
        str or None
            The selected option as a string. Returns None if no option has been
            selected yet.

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> # Basic dropdown button
        >>> selected = st.dropdown_button("Actions", options=["Save", "Load", "Delete"])
        >>> st.write(f"You selected: {selected}")
        >>>
        >>> # Dropdown button with callback
        >>> def handle_action(action):
        ...     st.success(f"Performed action: {action}")
        >>>
        >>> st.dropdown_button(
        ...     "File Operations",
        ...     options=["New", "Open", "Save", "Export"],
        ...     on_click=handle_action,
        ...     type="primary",
        ...     icon="📁",
        ... )
        >>>
        >>> # Dropdown button with custom styling
        >>> st.dropdown_button(
        ...     "Settings",
        ...     options=["Profile", "Preferences", "Logout"],
        ...     type="tertiary",
        ...     icon=":material/settings:",
        ...     placeholder="Choose setting",
        ...     help="Select a setting to configure",
        ...     use_container_width=True,
        ... )

        .. note::
           Dropdown buttons cannot be used inside ``st.form``. Use ``st.selectbox``
           inside forms instead.

        .. note::
           The dropdown button value resets to None when the user interacts with
           other widgets or when the script reruns.
        """
        key = to_key(key)
        ctx = get_script_run_ctx()

        # Checks whether the entered button type is one of the allowed options
        if type not in ["primary", "secondary", "tertiary"]:
            raise StreamlitAPIException(
                'The type argument to st.dropdown_button must be "primary", "secondary", or "tertiary". '
                f'\nThe argument passed was "{type}".'
            )

        return self.dg._dropdown_button(
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
            use_container_width=use_container_width,
            placeholder=placeholder,
            ctx=ctx,
        )

    def _dropdown_button(
        self,
        label: str,
        options: list[str],
        key: str | None,
        help: str | None,
        on_click: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        type: Literal["primary", "secondary", "tertiary"] = "secondary",
        icon: str | None = None,
        disabled: bool = False,
        use_container_width: bool = False,
        placeholder: str | None = "Select an option",
        ctx: ScriptRunContext | None = None,
    ) -> str | None:
        key = to_key(key)

        check_widget_policies(
            self.dg,
            key,
            on_click,
            default_value=None,
        )

        # Only the form submitter button needs a form ID at the moment.
        form_id = current_form_id(self.dg)

        element_id = compute_and_register_element_id(
            "dropdown_button",
            user_key=key,
            key_as_main_identity=True,
            form_id=form_id,
            dg=self.dg,
            label=label,
            icon=icon,
            help=help,
            type=type,
            use_container_width=use_container_width,
            placeholder=placeholder,
        )

        # It doesn't make sense to create a button inside a form (except
        # for the "Form Submitter" button that's automatically created in
        # every form). We throw an error to warn the user about this.
        # We omit this check for scripts running outside streamlit, because
        # they will have no script_run_ctx.
        if runtime.exists() and is_in_form(self.dg):
            raise StreamlitAPIException(
                f"`st.dropdown_button()` can't be used in an `st.form()`.{FORM_DOCS_INFO}"
            )

        dropdown_button_proto = DropdownButtonProto()
        dropdown_button_proto.id = element_id
        dropdown_button_proto.label = label
        dropdown_button_proto.options.extend(options)
        dropdown_button_proto.type = type
        dropdown_button_proto.use_container_width = use_container_width
        dropdown_button_proto.disabled = disabled
        dropdown_button_proto.placeholder = placeholder or "Select an option"

        if help is not None:
            dropdown_button_proto.help = dedent(help)

        if icon is not None:
            dropdown_button_proto.icon = validate_icon_or_emoji(icon)

        serde = DropdownButtonSerde()

        dropdown_button_state = register_widget(
            dropdown_button_proto.id,
            on_change_handler=on_click,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="string_value",
        )

        if dropdown_button_state.value_changed:
            dropdown_button_proto.value = dropdown_button_state.value or ""
            dropdown_button_proto.set_value = True

        if ctx:
            save_for_app_testing(ctx, element_id, dropdown_button_state.value)
        self.dg._enqueue("dropdown_button", dropdown_button_proto)

        return dropdown_button_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

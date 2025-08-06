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

from textwrap import dedent
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Generic,
    Literal,
    TypeVar,
    cast,
    overload,
)

from typing_extensions import Never

from streamlit.dataframe_util import OptionSequence, convert_anything_to_list
from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.layout_utils import (
    LayoutConfig,
    WidthWithoutContent,
    validate_width,
)
from streamlit.elements.lib.options_selector_utils import (
    create_mappings,
    index_,
    maybe_coerce_enum,
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
    save_for_app_testing,
    to_key,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Selectbox_pb2 import Selectbox as SelectboxProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    get_session_state,
    register_widget,
)
from streamlit.type_util import (
    check_python_comparable,
)

if TYPE_CHECKING:
    from collections.abc import Sequence

    from streamlit.delta_generator import DeltaGenerator

T = TypeVar("T")


class SelectboxSerde(Generic[T]):
    options: Sequence[T]
    formatted_options: list[str]
    formatted_option_to_option_index: dict[str, int]
    default_option_index: int | None

    def __init__(
        self,
        options: Sequence[T],
        *,
        formatted_options: list[str],
        formatted_option_to_option_index: dict[str, int],
        default_option_index: int | None = None,
    ) -> None:
        """Initialize the SelectboxSerde.

        We do not store an option_to_formatted_option mapping because the generic
        options might not be hashable, which would raise a RuntimeError. So we do
        two lookups: option -> index -> formatted_option[index].


        Parameters
        ----------
        options : Sequence[T]
            The sequence of selectable options.
        formatted_options : list[str]
            The string representations of each option. The formatted_options correspond
            to the options sequence by index.
        formatted_option_to_option_index : dict[str, int]
            A mapping from formatted option strings to their corresponding indices in
            the options sequence.
        default_option_index : int or None, optional
            The index of the default option to use when no selection is made.
            If None, no default option is selected.
        """

        self.options = options
        self.formatted_options = formatted_options
        self.formatted_option_to_option_index = formatted_option_to_option_index
        self.default_option_index = default_option_index

    def serialize(self, v: T | str | None) -> str | None:
        if v is None:
            return None
        if len(self.options) == 0:
            return ""

        # we don't check for isinstance(v, str) because this could lead to wrong
        # results if v is a string that is part of the options itself as it would
        # skip formatting in that case
        try:
            option_index = index_(self.options, v)
            return self.formatted_options[option_index]
        except ValueError:
            # we know that v is a string, otherwise it would have been found in the
            # options
            return cast("str", v)

    def deserialize(self, ui_value: str | None) -> T | str | None:
        # check if the option is pointing to a generic option type T,
        # otherwise return the option itself
        if ui_value is None:
            return (
                self.options[self.default_option_index]
                if self.default_option_index is not None and len(self.options) > 0
                else None
            )

        option_index = self.formatted_option_to_option_index.get(ui_value)
        return self.options[option_index] if option_index is not None else ui_value


class SelectboxMixin:
    @overload
    def selectbox(
        self,
        label: str,
        options: Sequence[Never],  # Type for empty or Never-inferred options
        index: int = 0,
        format_func: Callable[[Any], str] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        accept_new_options: Literal[False] = False,
        width: WidthWithoutContent = "stretch",
    ) -> None: ...  # Returns None if options is empty and accept_new_options is False

    @overload
    def selectbox(
        self,
        label: str,
        options: OptionSequence[T],
        index: int = 0,
        format_func: Callable[[Any], str] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        accept_new_options: Literal[False] = False,
        width: WidthWithoutContent = "stretch",
    ) -> T: ...

    @overload
    def selectbox(
        self,
        label: str,
        options: OptionSequence[T],
        index: int = 0,
        format_func: Callable[[Any], str] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        accept_new_options: Literal[True] = True,
        width: WidthWithoutContent = "stretch",
    ) -> T | str: ...

    @overload
    def selectbox(
        self,
        label: str,
        options: OptionSequence[T],
        index: None,
        format_func: Callable[[Any], str] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        accept_new_options: Literal[False] = False,
        width: WidthWithoutContent = "stretch",
    ) -> T | None: ...

    @overload
    def selectbox(
        self,
        label: str,
        options: OptionSequence[T],
        index: None,
        format_func: Callable[[Any], str] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        accept_new_options: Literal[True] = True,
        width: WidthWithoutContent = "stretch",
    ) -> T | str | None: ...

    @overload
    def selectbox(
        self,
        label: str,
        options: OptionSequence[T],
        index: int | None = 0,
        format_func: Callable[[Any], str] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        accept_new_options: bool = False,
        width: WidthWithoutContent = "stretch",
    ) -> T | str | None: ...

    @gather_metrics("selectbox")
    def selectbox(
        self,
        label: str,
        options: OptionSequence[T],
        index: int | None = 0,
        format_func: Callable[[Any], str] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        accept_new_options: bool = False,
        width: WidthWithoutContent = "stretch",
    ) -> T | str | None:
        r"""Display a select widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this select widget is for.
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

        options : Iterable
            Labels for the select options in an ``Iterable``. This can be a
            ``list``, ``set``, or anything supported by ``st.dataframe``. If
            ``options`` is dataframe-like, the first column will be used. Each
            label will be cast to ``str`` internally by default.

        index : int or None
            The index of the preselected option on first render. If ``None``,
            will initialize empty and return ``None`` until the user selects an option.
            Defaults to 0 (the first option).

        format_func : function
            Function to modify the display of the options. It receives
            the raw option as an argument and should output the label to be
            shown for that option. This has no impact on the return value of
            the command.

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
            An optional callback invoked when this selectbox's value changes.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        placeholder : str or None
            A string to display when no options are selected.
            If this is ``None`` (default), the widget displays placeholder text
            based on the widget's configuration:

            - "Choose an option" is displayed when options are available and
              ``accept_new_options=False``.
            - "Choose or add an option" is displayed when options are available
              and ``accept_new_options=True``.
            - "Add an option" is displayed when no options are available and
              ``accept_new_options=True``.
            - "No options to select" is displayed when no options are available
              and ``accept_new_options=False``. The widget is also disabled in
              this case.

        disabled : bool
            An optional boolean that disables the selectbox if set to ``True``.
            The default is ``False``.

        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. The default is ``"visible"``. If this
            is ``"hidden"``, Streamlit displays an empty spacer instead of the
            label, which can help keep the widget aligned with other widgets.
            If this is ``"collapsed"``, Streamlit displays no label or spacer.

        accept_new_options : bool
            Whether the user can add a selection that isn't included in ``options``.
            If this is ``False`` (default), the user can only select from the
            items in ``options``. If this is ``True``, the user can enter a new
            item that doesn't exist in ``options``.

            When a user enters a new item, it is returned by the widget as a
            string. The new item is not added to the widget's drop-down menu.
            Streamlit will use a case-insensitive match from ``options`` before
            adding a new item.

        width : "stretch" or int
            The width of the selectbox widget. This can be one of the
            following:

            - ``"stretch"`` (default): The width of the widget matches the
              width of the parent container.
            - An integer specifying the width in pixels: The widget has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the widget matches the width
              of the parent container.

        Returns
        -------
        any
            The selected option or ``None`` if no option is selected.

        Examples
        --------
        **Example 1: Use a basic selectbox widget**

        If no index is provided, the first option is selected by default.

        >>> import streamlit as st
        >>>
        >>> option = st.selectbox(
        ...     "How would you like to be contacted?",
        ...     ("Email", "Home phone", "Mobile phone"),
        ... )
        >>>
        >>> st.write("You selected:", option)

        .. output::
           https://doc-selectbox.streamlit.app/
           height: 320px

        **Example 2: Use a selectbox widget with no initial selection**

        To initialize an empty selectbox, use ``None`` as the index value.

        >>> import streamlit as st
        >>>
        >>> option = st.selectbox(
        ...     "How would you like to be contacted?",
        ...     ("Email", "Home phone", "Mobile phone"),
        ...     index=None,
        ...     placeholder="Select contact method...",
        ... )
        >>>
        >>> st.write("You selected:", option)

        .. output::
           https://doc-selectbox-empty.streamlit.app/
           height: 320px

        **Example 3: Let users add a new option**

        To allow users to add a new option that isn't included in the
        ``options`` list, use the ``accept_new_options=True`` parameter. You
        can also customize the placeholder text.

        >>> import streamlit as st
        >>>
        >>> option = st.selectbox(
        ...     "Default email",
        ...     ["foo@example.com", "bar@example.com", "baz@example.com"],
        ...     index=None,
        ...     placeholder="Select a saved email or enter a new one",
        ...     accept_new_options=True,
        ... )
        >>>
        >>> st.write("You selected:", option)

        .. output::
           https://doc-selectbox-accept-new-options.streamlit.app/
           height: 320px

        """
        ctx = get_script_run_ctx()
        return self._selectbox(
            label=label,
            options=options,
            index=index,
            format_func=format_func,
            key=key,
            help=help,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            placeholder=placeholder,
            disabled=disabled,
            label_visibility=label_visibility,
            accept_new_options=accept_new_options,
            width=width,
            ctx=ctx,
        )

    def _selectbox(
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
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        accept_new_options: bool = False,
        width: WidthWithoutContent = "stretch",
        ctx: ScriptRunContext | None = None,
    ) -> T | str | None:
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

        if not isinstance(index, int) and index is not None:
            raise StreamlitAPIException(
                f"Selectbox Value has invalid type: {type(index).__name__}"
            )

        if index is not None and len(opt) > 0 and not 0 <= index < len(opt):
            raise StreamlitAPIException(
                "Selectbox index must be greater than or equal to 0 "
                "and less than the length of options."
            )

        # Convert empty string to single space to distinguish from None:
        # - None (default) → "" → Frontend shows contextual placeholders
        # - "" (explicit empty) → " " → Frontend shows empty placeholder
        # - "Custom" → "Custom" → Frontend shows custom placeholder
        if placeholder == "":
            placeholder = " "

        formatted_options, formatted_option_to_option_index = create_mappings(
            opt, format_func
        )

        element_id = compute_and_register_element_id(
            "selectbox",
            user_key=key,
            dg=self.dg,
            label=label,
            options=formatted_options,
            index=index,
            help=help,
            placeholder=placeholder,
            accept_new_options=accept_new_options,
            width=width,
        )

        session_state = get_session_state().filtered_state
        if key is not None and key in session_state and session_state[key] is None:
            index = None

        selectbox_proto = SelectboxProto()
        selectbox_proto.id = element_id
        selectbox_proto.label = label
        if index is not None:
            selectbox_proto.default = index
        selectbox_proto.options[:] = formatted_options
        selectbox_proto.form_id = current_form_id(self.dg)
        selectbox_proto.placeholder = placeholder or ""
        selectbox_proto.disabled = disabled
        selectbox_proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )
        selectbox_proto.accept_new_options = accept_new_options

        if help is not None:
            selectbox_proto.help = dedent(help)

        serde = SelectboxSerde(
            opt,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            default_option_index=index,
        )
        widget_state = register_widget(
            selectbox_proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="string_value",
        )
        widget_state = maybe_coerce_enum(widget_state, options, opt)

        if widget_state.value_changed:
            serialized_value = serde.serialize(widget_state.value)
            if serialized_value is not None:
                selectbox_proto.raw_value = serialized_value
            selectbox_proto.set_value = True

        validate_width(width)
        layout_config = LayoutConfig(width=width)

        if ctx:
            save_for_app_testing(ctx, element_id, format_func)
        self.dg._enqueue("selectbox", selectbox_proto, layout_config=layout_config)
        return widget_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

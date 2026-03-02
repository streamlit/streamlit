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

from collections.abc import Callable, Sequence
from typing import (
    TYPE_CHECKING,
    Any,
    Generic,
    Literal,
    TypeAlias,
    TypeVar,
    cast,
    overload,
)

from streamlit.dataframe_util import convert_anything_to_list
from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.layout_utils import (
    LayoutConfig,
    Width,
    validate_width,
)
from streamlit.elements.lib.options_selector_utils import (
    convert_to_sequence_and_check_comparable,
    get_default_indices,
    maybe_coerce_enum,
    maybe_coerce_enum_sequence,
    validate_and_sync_multiselect_value_with_options,
    validate_and_sync_value_with_options,
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
from streamlit.proto.ButtonGroup_pb2 import ButtonGroup as ButtonGroupProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state import BindOption, register_widget
from streamlit.string_util import is_emoji, validate_material_icon

if TYPE_CHECKING:
    from streamlit.dataframe_util import OptionSequence
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.runtime.state import (
        WidgetArgs,
        WidgetCallback,
        WidgetKwargs,
    )
    from streamlit.runtime.state.common import (
        RegisterWidgetResult,
        WidgetDeserializer,
        WidgetSerializer,
    )

T = TypeVar("T")
V = TypeVar("V")

SelectionMode: TypeAlias = Literal["single", "multi"]


class _SingleSelectButtonGroupSerde(Generic[T]):
    """String-based serde for single-select ButtonGroup widgets.

    Uses string-based values (formatted option strings) for robust handling
    of dynamic option changes.
    """

    options: Sequence[T]
    formatted_options: list[str]
    formatted_option_to_option_index: dict[str, int]
    default_option_index: int | None
    format_func: Callable[[Any], str]

    def __init__(
        self,
        options: Sequence[T],
        *,
        formatted_options: list[str],
        formatted_option_to_option_index: dict[str, int],
        default_option_index: int | None = None,
        format_func: Callable[[Any], str] = str,
    ) -> None:
        self.options = options
        self.formatted_options = formatted_options
        self.formatted_option_to_option_index = formatted_option_to_option_index
        self.default_option_index = default_option_index
        self.format_func = format_func

    def serialize(self, v: T | str | None) -> list[str]:
        """Serialize single-select value to a list of strings for wire format."""
        if v is None:
            return []
        if len(self.options) == 0:
            return []

        # First, try to find the option by value in the options list
        for index, opt in enumerate(self.options):
            if opt == v:
                return [self.formatted_options[index]]

        # If not found by direct comparison, try by formatted string
        try:
            formatted_value = self.format_func(v)
        except Exception:
            return [str(v)]

        return [formatted_value]

    def deserialize(self, ui_value: list[str] | None) -> T | str | None:
        """Deserialize from a list of strings to a single value."""
        if len(self.options) == 0:
            return None

        # None means initial state - use default if available
        if ui_value is None:
            if self.default_option_index is not None:
                return self.options[self.default_option_index]
            return None

        # Empty list means explicit deselection by user - return None
        if len(ui_value) == 0:
            return None

        string_value = ui_value[0]

        # Look up the option index by formatted string
        option_index = self.formatted_option_to_option_index.get(string_value)
        if option_index is not None:
            return self.options[option_index]

        # Value not found in options - return as-is
        return string_value


class _MultiSelectButtonGroupSerde(Generic[T]):
    """String-based serde for multi-select ButtonGroup widgets.

    Uses string-based values (formatted option strings) for robust handling
    of dynamic option changes.
    """

    options: Sequence[T]
    formatted_options: list[str]
    formatted_option_to_option_index: dict[str, int]
    default_option_indices: list[int]
    format_func: Callable[[Any], str]

    def __init__(
        self,
        options: Sequence[T],
        *,
        formatted_options: list[str],
        formatted_option_to_option_index: dict[str, int],
        default_option_indices: list[int] | None = None,
        format_func: Callable[[Any], str] = str,
    ) -> None:
        self.options = options
        self.formatted_options = formatted_options
        self.formatted_option_to_option_index = formatted_option_to_option_index
        self.default_option_indices = default_option_indices or []
        self.format_func = format_func

    def serialize(self, value: list[T | str] | list[T] | None) -> list[str]:
        """Serialize multi-select values to list of strings for wire format."""
        if value is None:
            return []
        converted_value = convert_anything_to_list(value)
        values: list[str] = []
        for v in converted_value:
            # First, try to find the option by value in the options list
            found = False
            for index, opt in enumerate(self.options):
                if opt == v:
                    values.append(self.formatted_options[index])
                    found = True
                    break

            if found:
                continue

            # If not found by direct comparison, try by formatted string
            try:
                formatted_value = self.format_func(v)
            except Exception:
                values.append(str(v))
                continue

            values.append(formatted_value)
        return values

    def deserialize(self, ui_value: list[str] | None) -> list[T | str] | list[T]:
        """Deserialize from list of strings to list of values."""
        if ui_value is None:
            return [self.options[i] for i in self.default_option_indices]

        values: list[T | str] = []
        for v in ui_value:
            option_index = self.formatted_option_to_option_index.get(v)
            if option_index is not None:
                values.append(self.options[option_index])
            else:
                # Value not found in options - append as-is
                values.append(v)
        return values


def _build_proto(
    widget_id: str,
    formatted_options: Sequence[ButtonGroupProto.Option],
    default_values: list[int],
    disabled: bool,
    current_form_id: str,
    click_mode: ButtonGroupProto.ClickMode.ValueType,
    style: Literal["pills", "segmented_control"] = "pills",
    label: str | None = None,
    label_visibility: LabelVisibility = "visible",
    help: str | None = None,
) -> ButtonGroupProto:
    proto = ButtonGroupProto()

    proto.id = widget_id
    proto.default[:] = default_values
    proto.form_id = current_form_id
    proto.disabled = disabled
    proto.click_mode = click_mode
    proto.style = ButtonGroupProto.Style.Value(style.upper())

    # not passing the label looks the same as a collapsed label
    if label is not None:
        proto.label = label
        proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )
        if help is not None:
            proto.help = help

    for formatted_option in formatted_options:
        proto.options.append(formatted_option)
    return proto


def _maybe_raise_selection_mode_warning(selection_mode: SelectionMode) -> None:
    """Check if the selection_mode value is valid or raise exception otherwise."""
    if selection_mode not in {"single", "multi"}:
        raise StreamlitAPIException(
            "The selection_mode argument must be one of ['single', 'multi']. "
            f"The argument passed was '{selection_mode}'."
        )


class ButtonGroupMixin:
    @overload
    def pills(
        self,
        label: str,
        options: OptionSequence[V],
        *,
        selection_mode: Literal["single"] = "single",
        default: V | None = None,
        format_func: Callable[[Any], str] | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: Width = "content",
        bind: BindOption = None,
    ) -> V | None: ...
    @overload
    def pills(
        self,
        label: str,
        options: OptionSequence[V],
        *,
        selection_mode: Literal["multi"],
        default: Sequence[V] | V | None = None,
        format_func: Callable[[Any], str] | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: Width = "content",
        bind: BindOption = None,
    ) -> list[V]: ...
    @gather_metrics("pills")
    def pills(
        self,
        label: str,
        options: OptionSequence[V],
        *,
        selection_mode: Literal["single", "multi"] = "single",
        default: Sequence[V] | V | None = None,
        format_func: Callable[[Any], str] | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: Width = "content",
        bind: BindOption = None,
    ) -> list[V] | V | None:
        r"""Display a pills widget.

        A pills widget is similar to a ``st.selectbox`` or ``st.multiselect``
        where the ``options`` are displayed as pill-buttons instead of a
        drop-down list.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this widget is for.
            The label can optionally contain GitHub-flavored Markdown of the
            following types: Bold, Italics, Strikethroughs, Inline Code, Links,
            and Images. Images display like icons, with a max height equal to
            the font height.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Common block-level Markdown (headings,
            lists, blockquotes) is automatically escaped and displays as
            literal text in labels.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            For accessibility reasons, you should never set an empty label, but
            you can hide it with ``label_visibility`` if needed. In the future,
            we may disallow empty labels by raising an exception.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        options : Iterable of V
            Labels for the select options in an ``Iterable``. This can be a
            ``list``, ``set``, or anything supported by ``st.dataframe``. If
            ``options`` is dataframe-like, the first column will be used. Each
            label will be cast to ``str`` internally by default and can
            optionally contain GitHub-flavored Markdown, including the Markdown
            directives described in the ``body`` parameter of ``st.markdown``.

        selection_mode : "single" or "multi"
            The selection mode for the widget. If this is ``"single"``
            (default), only one option can be selected. If this is ``"multi"``,
            multiple options can be selected.

        default : Iterable of V, V, or None
            The value of the widget when it first renders. If the
            ``selection_mode`` is ``multi``, this can be a list of values, a
            single value, or ``None``. If the ``selection_mode`` is
            ``"single"``, this can be a single value or ``None``.

        format_func : function
            Function to modify the display of the options. It receives
            the raw option as an argument and should output the label to be
            shown for that option. This has no impact on the return value of
            the command. The output can optionally contain GitHub-flavored
            Markdown, including the Markdown directives described in the
            ``body`` parameter of ``st.markdown``.

        key : str, int, or None
            An optional string or integer to use as the unique key for
            the widget. If this is ``None`` (default), a key will be
            generated for the widget based on the values of the other
            parameters. No two widgets may have the same key. Assigning
            a key stabilizes the widget's identity and preserves its
            state across reruns even when other parameters change.

            .. note::
               Changing ``selection_mode`` resets the widget even when a
               key is provided.

            A key lets you read or update the widget's value via
            ``st.session_state[key]``. For more details, see `Widget
            behavior <https://docs.streamlit.io/develop/concepts/architecture/widget-behavior>`_.

            Additionally, if ``key`` is provided, it will be used as a
            CSS class name prefixed with ``st-key-``.

        help : str or None
            A tooltip that gets displayed next to the widget label. Streamlit
            only displays the tooltip when ``label_visibility="visible"``. If
            this is ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        on_change : callable
            An optional callback invoked when this widget's value changes.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        disabled : bool
            An optional boolean that disables the widget if set to ``True``.
            The default is ``False``.

        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. The default is ``"visible"``. If this
            is ``"hidden"``, Streamlit displays an empty spacer instead of the
            label, which can help keep the widget aligned with other widgets.
            If this is ``"collapsed"``, Streamlit displays no label or spacer.

        width : "content", "stretch", or int
            The width of the pills widget. This can be one of the following:

            - ``"content"`` (default): The width of the widget matches the
              width of its content, but doesn't exceed the width of the parent
              container.
            - ``"stretch"``: The width of the widget matches the width of the
              parent container.
            - An integer specifying the width in pixels: The widget has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the widget matches the width
              of the parent container.

        bind : "query-params" or None
            Binding mode for syncing the widget's value with a URL query
            parameter. If this is ``None`` (default), the widget's value
            is not synced to the URL. When this is set to
            ``"query-params"``, changes to the widget update the URL, and
            the widget can be initialized or updated through a query
            parameter in the URL. This requires ``key`` to be set. The
            key is used as the query parameter name.

            When the widget's value equals its default, the query
            parameter is removed from the URL to keep it clean. A bound
            query parameter can't be set or deleted through
            ``st.query_params``; it can only be programmatically changed
            through ``st.session_state``.

            An empty query parameter (e.g., ``?tags=``) clears the
            widget. Invalid query parameter values are ignored and removed from
            the URL. For ``selection_mode="multi"``, multiple selections use
            repeated parameters (e.g., ``?tags=Red&tags=Blue``) and duplicates
            are deduplicated.

        Returns
        -------
        list of V, V, or None
            If the ``selection_mode`` is ``multi``, this is a list of selected
            options or an empty list. If the ``selection_mode`` is
            ``"single"``, this is a selected option or ``None``.

            This contains copies of the selected options, not the originals.

        Examples
        --------
        **Example 1: Multi-select pills**

        Display a multi-select pills widget, and show the selection:

        >>> import streamlit as st
        >>>
        >>> options = ["North", "East", "South", "West"]
        >>> selection = st.pills("Directions", options, selection_mode="multi")
        >>> st.markdown(f"Your selected options: {selection}.")

        .. output::
           https://doc-pills-multi.streamlit.app/
           height: 200px

        **Example 2: Single-select pills with icons**

        Display a single-select pills widget with icons:

        >>> import streamlit as st
        >>>
        >>> option_map = {
        ...     0: ":material/add:",
        ...     1: ":material/zoom_in:",
        ...     2: ":material/zoom_out:",
        ...     3: ":material/zoom_out_map:",
        ... }
        >>> selection = st.pills(
        ...     "Tool",
        ...     options=option_map.keys(),
        ...     format_func=lambda option: option_map[option],
        ...     selection_mode="single",
        ... )
        >>> st.write(
        ...     "Your selected option: "
        ...     f"{None if selection is None else option_map[selection]}"
        ... )

        .. output::
           https://doc-pills-single.streamlit.app/
           height: 200px

        """
        return self._internal_button_group(
            options,
            label=label,
            selection_mode=selection_mode,
            default=default,
            format_func=format_func,
            key=key,
            help=help,
            style="pills",
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            disabled=disabled,
            label_visibility=label_visibility,
            width=width,
            bind=bind,
        )

    @overload
    def segmented_control(
        self,
        label: str,
        options: OptionSequence[V],
        *,
        selection_mode: Literal["single"] = "single",
        default: V | None = None,
        format_func: Callable[[Any], str] | None = None,
        key: str | int | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: Width = "content",
        bind: BindOption = None,
    ) -> V | None: ...
    @overload
    def segmented_control(
        self,
        label: str,
        options: OptionSequence[V],
        *,
        selection_mode: Literal["multi"],
        default: Sequence[V] | V | None = None,
        format_func: Callable[[Any], str] | None = None,
        key: str | int | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: Width = "content",
        bind: BindOption = None,
    ) -> list[V]: ...

    @gather_metrics("segmented_control")
    def segmented_control(
        self,
        label: str,
        options: OptionSequence[V],
        *,
        selection_mode: Literal["single", "multi"] = "single",
        default: Sequence[V] | V | None = None,
        format_func: Callable[[Any], str] | None = None,
        key: str | int | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: Width = "content",
        bind: BindOption = None,
    ) -> list[V] | V | None:
        r"""Display a segmented control widget.

        A segmented control widget is a linear set of segments where each of
        the passed ``options`` functions like a toggle button.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this widget is for.
            The label can optionally contain GitHub-flavored Markdown of the
            following types: Bold, Italics, Strikethroughs, Inline Code, Links,
            and Images. Images display like icons, with a max height equal to
            the font height.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Common block-level Markdown (headings,
            lists, blockquotes) is automatically escaped and displays as
            literal text in labels.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            For accessibility reasons, you should never set an empty label, but
            you can hide it with ``label_visibility`` if needed. In the future,
            we may disallow empty labels by raising an exception.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        options : Iterable of V
            Labels for the select options in an ``Iterable``. This can be a
            ``list``, ``set``, or anything supported by ``st.dataframe``. If
            ``options`` is dataframe-like, the first column will be used. Each
            label will be cast to ``str`` internally by default and can
            optionally contain GitHub-flavored Markdown, including the Markdown
            directives described in the ``body`` parameter of ``st.markdown``.

        selection_mode : "single" or "multi"
            The selection mode for the widget. If this is ``"single"``
            (default), only one option can be selected. If this is ``"multi"``,
            multiple options can be selected.

        default : Iterable of V, V, or None
            The value of the widget when it first renders. If the
            ``selection_mode`` is ``multi``, this can be a list of values, a
            single value, or ``None``. If the ``selection_mode`` is
            ``"single"``, this can be a single value or ``None``.

        format_func : function
            Function to modify the display of the options. It receives
            the raw option as an argument and should output the label to be
            shown for that option. This has no impact on the return value of
            the command. The output can optionally contain GitHub-flavored
            Markdown, including the Markdown directives described in the
            ``body`` parameter of ``st.markdown``.

        key : str, int, or None
            An optional string or integer to use as the unique key for
            the widget. If this is ``None`` (default), a key will be
            generated for the widget based on the values of the other
            parameters. No two widgets may have the same key. Assigning
            a key stabilizes the widget's identity and preserves its
            state across reruns even when other parameters change.

            .. note::
               Changing ``selection_mode`` resets the widget even when a
               key is provided.

            A key lets you read or update the widget's value via
            ``st.session_state[key]``. For more details, see `Widget
            behavior <https://docs.streamlit.io/develop/concepts/architecture/widget-behavior>`_.

            Additionally, if ``key`` is provided, it will be used as a
            CSS class name prefixed with ``st-key-``.

        help : str or None
            A tooltip that gets displayed next to the widget label. Streamlit
            only displays the tooltip when ``label_visibility="visible"``. If
            this is ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        on_change : callable
            An optional callback invoked when this widget's value changes.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        disabled : bool
            An optional boolean that disables the widget if set to ``True``.
            The default is ``False``.

        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. The default is ``"visible"``. If this
            is ``"hidden"``, Streamlit displays an empty spacer instead of the
            label, which can help keep the widget aligned with other widgets.
            If this is ``"collapsed"``, Streamlit displays no label or spacer.

        width : "content", "stretch", or int
            The width of the segmented control widget. This can be one of the
            following:

            - ``"content"`` (default): The width of the widget matches the
              width of its content, but doesn't exceed the width of the parent
              container.
            - ``"stretch"``: The width of the widget matches the width of the
              parent container.
            - An integer specifying the width in pixels: The widget has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the widget matches the width
              of the parent container.

        bind : "query-params" or None
            Binding mode for syncing the widget's value with a URL query
            parameter. If this is ``None`` (default), the widget's value
            is not synced to the URL. When this is set to
            ``"query-params"``, changes to the widget update the URL, and
            the widget can be initialized or updated through a query
            parameter in the URL. This requires ``key`` to be set. The
            key is used as the query parameter name.

            When the widget's value equals its default, the query
            parameter is removed from the URL to keep it clean. A bound
            query parameter can't be set or deleted through
            ``st.query_params``; it can only be programmatically changed
            through ``st.session_state``.

            An empty query parameter (e.g., ``?tags=``) clears the
            widget. Invalid query parameter values are ignored and removed from
            the URL. For ``selection_mode="multi"``, multiple selections use
            repeated parameters (e.g., ``?tags=Red&tags=Blue``) and duplicates
            are deduplicated.

        Returns
        -------
        list of V, V, or None
            If the ``selection_mode`` is ``multi``, this is a list of selected
            options or an empty list. If the ``selection_mode`` is
            ``"single"``, this is a selected option or ``None``.

            This contains copies of the selected options, not the originals.

        Examples
        --------
        **Example 1: Multi-select segmented control**

        Display a multi-select segmented control widget, and show the
        selection:

        >>> import streamlit as st
        >>>
        >>> options = ["North", "East", "South", "West"]
        >>> selection = st.segmented_control(
        ...     "Directions", options, selection_mode="multi"
        ... )
        >>> st.markdown(f"Your selected options: {selection}.")

        .. output::
           https://doc-segmented-control-multi.streamlit.app/
           height: 200px

        **Example 2: Single-select segmented control with icons**

        Display a single-select segmented control widget with icons:

        >>> import streamlit as st
        >>>
        >>> option_map = {
        ...     0: ":material/add:",
        ...     1: ":material/zoom_in:",
        ...     2: ":material/zoom_out:",
        ...     3: ":material/zoom_out_map:",
        ... }
        >>> selection = st.segmented_control(
        ...     "Tool",
        ...     options=option_map.keys(),
        ...     format_func=lambda option: option_map[option],
        ...     selection_mode="single",
        ... )
        >>> st.write(
        ...     "Your selected option: "
        ...     f"{None if selection is None else option_map[selection]}"
        ... )

        .. output::
           https://doc-segmented-control-single.streamlit.app/
           height: 200px

        """
        return self._internal_button_group(
            options,
            label=label,
            selection_mode=selection_mode,
            default=default,
            format_func=format_func,
            key=key,
            help=help,
            style="segmented_control",
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            disabled=disabled,
            label_visibility=label_visibility,
            width=width,
            bind=bind,
        )

    @gather_metrics("_internal_button_group")
    def _internal_button_group(
        self,
        options: OptionSequence[V],
        *,
        key: Key | None = None,
        default: Sequence[V] | V | None = None,
        selection_mode: Literal["single", "multi"] = "single",
        disabled: bool = False,
        format_func: Callable[[Any], str] | None = None,
        style: Literal["pills", "segmented_control"] = "segmented_control",
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        label: str | None = None,
        label_visibility: LabelVisibility = "visible",
        help: str | None = None,
        width: Width = "content",
        bind: BindOption = None,
    ) -> list[V] | V | None:
        maybe_raise_label_warnings(label, label_visibility)

        # Use str as default format_func
        actual_format_func: Callable[[Any], str] = format_func or str

        def _transformed_format_func(option: V) -> ButtonGroupProto.Option:
            """If option starts with a material icon or an emoji, we extract it to send
            it parsed to the frontend.
            """
            transformed = actual_format_func(option)
            transformed_parts = transformed.split(" ")
            icon: str | None = None
            if len(transformed_parts) > 0:
                maybe_icon = transformed_parts[0].strip()
                try:
                    if maybe_icon.startswith(":material"):
                        icon = validate_material_icon(maybe_icon)
                    elif is_emoji(maybe_icon):
                        icon = maybe_icon

                    if icon:
                        # reassamble the option string without the icon - also
                        # works if len(transformed_parts) == 1
                        transformed = " ".join(transformed_parts[1:])
                except StreamlitAPIException:
                    # we don't have a valid icon or emoji, so we just pass
                    pass
            return ButtonGroupProto.Option(
                content=transformed,
                content_icon=icon,
            )

        indexable_options = convert_to_sequence_and_check_comparable(options)
        default_values = get_default_indices(indexable_options, default)

        # Create string-based mappings for the serde
        formatted_options: list[str] = []
        formatted_option_to_option_index: dict[str, int] = {}
        for index, option in enumerate(indexable_options):
            formatted = actual_format_func(option)
            formatted_options.append(formatted)
            # If formatted labels are duplicated, the last one wins. We keep this
            # behavior to mirror radio/selectbox/multiselect.
            formatted_option_to_option_index[formatted] = index

        # Create appropriate serde based on selection mode
        serializer: WidgetSerializer[Any]
        deserializer: WidgetDeserializer[Any]
        if selection_mode == "multi":
            multi_serde = _MultiSelectButtonGroupSerde[V](
                indexable_options,
                formatted_options=formatted_options,
                formatted_option_to_option_index=formatted_option_to_option_index,
                default_option_indices=default_values,
                format_func=actual_format_func,
            )
            serializer = multi_serde.serialize
            deserializer = multi_serde.deserialize
        else:
            single_serde = _SingleSelectButtonGroupSerde[V](
                indexable_options,
                formatted_options=formatted_options,
                formatted_option_to_option_index=formatted_option_to_option_index,
                default_option_index=default_values[0] if default_values else None,
                format_func=actual_format_func,
            )
            serializer = single_serde.serialize
            deserializer = single_serde.deserialize

        # Single call to _button_group with the appropriate serde
        result: RegisterWidgetResult[Any] = self._button_group(
            indexable_options,
            default=default_values,
            selection_mode=selection_mode,
            disabled=disabled,
            format_func=_transformed_format_func,
            key=key,
            help=help,
            style=style,
            serializer=serializer,
            deserializer=deserializer,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            label=label,
            label_visibility=label_visibility,
            width=width,
            options_format_func=actual_format_func,
            bind=bind,
            string_formatted_options=formatted_options,
        )

        # Handle return type based on selection mode
        if selection_mode == "multi":
            multi_res = cast("RegisterWidgetResult[list[V] | list[V | str]]", result)
            multi_res = maybe_coerce_enum_sequence(
                multi_res, options, indexable_options
            )
            return cast("list[V]", multi_res.value)

        single_res = cast("RegisterWidgetResult[V | str | None]", result)
        single_res = maybe_coerce_enum(single_res, options, indexable_options)
        return cast("V | None", single_res.value)

    def _button_group(
        self,
        indexable_options: Sequence[Any],
        *,
        key: Key | None = None,
        default: list[int] | None = None,
        selection_mode: SelectionMode = "single",
        disabled: bool = False,
        style: Literal["pills", "segmented_control"] = "segmented_control",
        format_func: Callable[[V], ButtonGroupProto.Option] | None = None,
        deserializer: WidgetDeserializer[T],
        serializer: WidgetSerializer[T],
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        label: str | None = None,
        label_visibility: LabelVisibility = "visible",
        help: str | None = None,
        width: Width = "content",
        options_format_func: Callable[[Any], str] | None = None,
        bind: BindOption = None,
        string_formatted_options: list[str] | None = None,
    ) -> RegisterWidgetResult[T]:
        _maybe_raise_selection_mode_warning(selection_mode)

        parsed_selection_mode: ButtonGroupProto.ClickMode.ValueType = (
            ButtonGroupProto.SINGLE_SELECT
            if selection_mode == "single"
            else ButtonGroupProto.MULTI_SELECT
        )

        # when selection mode is a single-value selection, the default must be a single
        # value too.
        if (
            parsed_selection_mode == ButtonGroupProto.SINGLE_SELECT
            and default is not None
            and isinstance(default, Sequence)
            and len(default) > 1
        ):
            # add more commands to the error message
            raise StreamlitAPIException(
                "The default argument to `st.pills` must be a single value when "
                "`selection_mode='single'`."
            )

        if style not in {"pills", "segmented_control"}:
            raise StreamlitAPIException(
                "The style argument must be one of ['pills', 'segmented_control']. "
                f"The argument passed was '{style}'."
            )

        key = to_key(key)

        _default = default
        if default is not None and len(default) == 0:
            _default = None

        validate_width(width, allow_content=True)
        layout_config = LayoutConfig(width=width)

        check_widget_policies(self.dg, key, on_change, default_value=_default)

        ctx = get_script_run_ctx()
        form_id = current_form_id(self.dg)
        formatted_options = (
            indexable_options
            if format_func is None
            else [
                format_func(indexable_options[index])
                for index, _ in enumerate(indexable_options)
            ]
        )

        element_id = compute_and_register_element_id(
            style,
            user_key=key,
            key_as_main_identity={"click_mode"},
            dg=self.dg,
            options=formatted_options,
            default=default,
            click_mode=parsed_selection_mode,
            style=style,
            width=width,
            label=label,
            help=help,
        )

        proto = _build_proto(
            element_id,
            formatted_options,
            default or [],
            disabled,
            form_id,
            click_mode=parsed_selection_mode,
            style=style,
            label=label,
            label_visibility=label_visibility,
            help=help,
        )

        if bind == "query-params" and key is not None:
            proto.query_param_key = str(key)

        widget_state = register_widget(
            proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=deserializer,
            serializer=serializer,
            ctx=ctx,
            value_type="string_array_value",
            bind=bind,
            clearable=True,
            formatted_options=string_formatted_options,
            max_array_length=1 if selection_mode == "single" else None,
        )

        # Validate and sync value with options for pills/segmented_control
        value_needs_reset = False
        current_value: T | list[T] | list[T | str] | None = widget_state.value
        if options_format_func is not None:
            if selection_mode == "single":
                # Single select: validate and possibly reset to default
                default_index = default[0] if default else None
                current_value, value_needs_reset = validate_and_sync_value_with_options(
                    cast("T | None", widget_state.value),
                    indexable_options,
                    default_index,
                    key,
                    options_format_func,
                )
            else:
                # Multi select: filter out invalid values
                current_value, value_needs_reset = (
                    validate_and_sync_multiselect_value_with_options(
                        cast("list[T] | list[T | str]", widget_state.value),
                        indexable_options,
                        key,
                        options_format_func,
                    )
                )

        if value_needs_reset or widget_state.value_changed:
            # Always use string-based raw_values field
            value_for_serialization = (
                current_value if value_needs_reset else widget_state.value
            )
            proto.raw_values[:] = serializer(cast("T", value_for_serialization))
            proto.set_value = True

        if ctx:
            # Save format function for AppTest to serialize values as strings
            save_for_app_testing(ctx, element_id, options_format_func or str)

        self.dg._enqueue("button_group", proto, layout_config=layout_config)

        # Return widget_state with possibly updated value
        if value_needs_reset:
            from streamlit.runtime.state.common import RegisterWidgetResult

            return RegisterWidgetResult(
                cast("T", current_value),
                widget_state.value_changed or value_needs_reset,
            )

        return widget_state

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

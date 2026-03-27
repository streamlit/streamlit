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

from collections.abc import Sequence
from textwrap import dedent
from typing import (
    TYPE_CHECKING,
    Any,
    Generic,
    Literal,
    TypeVar,
    cast,
    overload,
)

from streamlit.dataframe_util import OptionSequence, convert_anything_to_list
from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.layout_utils import (
    LayoutConfig,
    WidthWithoutContent,
    validate_width,
)
from streamlit.elements.lib.options_selector_utils import (
    SelectWidgetFilterMode,
    convert_to_sequence_and_check_comparable,
    create_mappings,
    get_default_indices,
    maybe_coerce_enum_sequence,
    validate_and_sync_multiselect_value_with_options,
    validate_select_widget_filter_mode,
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
from streamlit.errors import (
    StreamlitInvalidMaxError,
    StreamlitSelectionCountExceedsMaxError,
)
from streamlit.proto.MultiSelect_pb2 import MultiSelect as MultiSelectProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.runtime.state import BindOption, register_widget
from streamlit.type_util import (
    is_iterable,
)

if TYPE_CHECKING:
    from collections.abc import Callable, Sequence

    from streamlit.dataframe_util import OptionSequence
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.runtime.state import (
        WidgetArgs,
        WidgetCallback,
        WidgetKwargs,
    )

T = TypeVar("T")


class MultiSelectSerde(Generic[T]):
    options: Sequence[T]
    formatted_options: list[str]
    formatted_option_to_option_index: dict[str, int]
    default_options_indices: list[int]
    format_func: Callable[[Any], str]

    def __init__(
        self,
        options: Sequence[T],
        *,
        formatted_options: list[str],
        formatted_option_to_option_index: dict[str, int],
        default_options_indices: list[int] | None = None,
        format_func: Callable[[Any], str] = str,
    ) -> None:
        """Initialize the MultiSelectSerde.

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
        default_options_indices : list[int] or None, optional
            The indices of the default options to use when no selection is made.
            If None, no default options are selected.
        format_func : Callable[[Any], str], optional
            Function to format options for comparison. Used to compare values by their
            string representation instead of using == directly. This is necessary because
            widget values are deepcopied, and for custom classes without __eq__, the
            deepcopied instances would fail identity comparison.
        """

        self.options = options
        self.formatted_options = formatted_options
        self.formatted_option_to_option_index = formatted_option_to_option_index
        self.default_options_indices = default_options_indices or []
        self.format_func = format_func

    def serialize(self, value: list[T | str] | list[T]) -> list[str]:
        converted_value = convert_anything_to_list(value)
        values: list[str] = []
        for v in converted_value:
            # Use format_func to find the formatted option instead of using
            # self.options.index(v) which relies on == comparison. This is necessary
            # because widget values are deepcopied, and for custom classes without
            # __eq__, the deepcopied instances would fail identity comparison.
            try:
                formatted_value = self.format_func(v)
            except Exception:
                # format_func failed (e.g., v is a string but format_func expects
                # an object with specific attributes). Use str(v) to ensure we append
                # a proper string, not the original object. This handles both cases:
                # - v is already a string -> str(v) returns it unchanged
                # - v is a custom object -> str(v) gives its string representation
                values.append(str(v))
                continue

            if formatted_value in self.formatted_option_to_option_index:
                values.append(formatted_value)
            else:
                # Value not found in options - it's likely a user-entered string
                # (when accept_new_options=True) or an invalid value. Use the
                # formatted string (not the original object) for type consistency.
                values.append(formatted_value)
        return values

    def deserialize(self, ui_value: list[str] | None) -> list[T | str] | list[T]:
        if ui_value is None:
            return [self.options[i] for i in self.default_options_indices]

        values: list[T | str] = []
        for v in ui_value:
            try:
                option_index = self.formatted_options.index(v)
                values.append(self.options[option_index])
            except ValueError:  # noqa: PERF203
                values.append(v)
        return values


def _get_default_count(default: Sequence[Any] | Any | None) -> int:
    if default is None:
        return 0
    if not is_iterable(default):
        return 1
    return len(cast("Sequence[Any]", default))


def _check_max_selections(
    selections: Sequence[Any] | Any | None, max_selections: int | None
) -> None:
    if max_selections is None:
        return

    default_count = _get_default_count(selections)
    if default_count > max_selections:
        raise StreamlitSelectionCountExceedsMaxError(
            current_selections_count=default_count, max_selections_count=max_selections
        )


class MultiSelectMixin:
    @overload
    def multiselect(
        self,
        label: str,
        options: OptionSequence[T],
        default: Any | None = None,
        format_func: Callable[[Any], str] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        max_selections: int | None = None,
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        accept_new_options: Literal[False] = False,
        filter_mode: SelectWidgetFilterMode = "fuzzy",
        width: WidthWithoutContent = "stretch",
        bind: BindOption = None,
    ) -> list[T]: ...

    @overload
    def multiselect(
        self,
        label: str,
        options: OptionSequence[T],
        default: Any | None = None,
        format_func: Callable[[Any], str] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        max_selections: int | None = None,
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        accept_new_options: Literal[True] = True,
        filter_mode: SelectWidgetFilterMode = "fuzzy",
        width: WidthWithoutContent = "stretch",
        bind: BindOption = None,
    ) -> list[T | str]: ...

    @overload
    def multiselect(
        self,
        label: str,
        options: OptionSequence[T],
        default: Any | None = None,
        format_func: Callable[[Any], str] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        max_selections: int | None = None,
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        accept_new_options: bool = False,
        filter_mode: SelectWidgetFilterMode = "fuzzy",
        width: WidthWithoutContent = "stretch",
        bind: BindOption = None,
    ) -> list[T] | list[T | str]: ...

    @gather_metrics("multiselect")
    def multiselect(
        self,
        label: str,
        options: OptionSequence[T],
        default: Any | None = None,
        format_func: Callable[[Any], str] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        max_selections: int | None = None,
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        accept_new_options: bool = False,
        filter_mode: SelectWidgetFilterMode = "fuzzy",
        width: WidthWithoutContent = "stretch",
        bind: BindOption = None,
    ) -> list[T] | list[T | str]:
        r"""Display a multiselect widget.
        The multiselect widget starts as empty.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this select widget is for.
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

        options : Iterable
            Labels for the select options in an ``Iterable``. This can be a
            ``list``, ``set``, or anything supported by ``st.dataframe``. If
            ``options`` is dataframe-like, the first column will be used. Each
            label will be cast to ``str`` internally by default.

        default : Iterable of V, V, or None
            List of default values. Can also be a single value.

        format_func : function
            Function to modify the display of the options. It receives
            the raw option as an argument and should output the label to be
            shown for that option. This has no impact on the return value of
            the command.

        key : str, int, or None
            An optional string or integer to use as the unique key for
            the widget. If this is ``None`` (default), a key will be
            generated for the widget based on the values of the other
            parameters. No two widgets may have the same key. Assigning
            a key stabilizes the widget's identity and preserves its
            state across reruns even when other parameters change.

            .. note::
               Changing ``max_selections`` or ``accept_new_options``
               resets the widget even when a key is provided.

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

        max_selections : int or None
            The max selections that can be selected at a time. If this is
            ``None`` (default), there is no limit on the number of selections.
            If this is an integer, it must be positive.

        placeholder : str or  None
            A string to display when no options are selected.
            If this is ``None`` (default), the widget displays placeholder text
            based on the widget's configuration:

            - "Choose options" is displayed when options are available and
              ``accept_new_options=False``.
            - "Choose or add options" is displayed when options are available
              and ``accept_new_options=True``.
            - "Add options" is displayed when no options are available and
              ``accept_new_options=True``.
            - "No options to select" is displayed when no options are available
              and ``accept_new_options=False``. The widget is also disabled in
              this case.

        disabled : bool
            An optional boolean that disables the multiselect widget if set
            to ``True``. The default is ``False``.

        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. The default is ``"visible"``. If this
            is ``"hidden"``, Streamlit displays an empty spacer instead of the
            label, which can help keep the widget aligned with other widgets.
            If this is ``"collapsed"``, Streamlit displays no label or spacer.

        accept_new_options : bool
            Whether the user can add selections that aren't included in ``options``.
            If this is ``False`` (default), the user can only select from the
            items in ``options``. If this is ``True``, the user can enter new
            items that don't exist in ``options``.

            When a user enters and selects a new item, it is included in the
            widget's returned list as a string. The new item is not added to
            the widget's drop-down menu. Streamlit will use a case-insensitive
            match from ``options`` before adding a new item, and a new item
            can't be added if a case-insensitive match is already selected. The
            ``max_selections`` argument is still enforced.

        filter_mode : "fuzzy", "contains", "prefix", or None
            The matching mode used to filter options while the user types.
            If this is ``"fuzzy"`` (default), options are matched by in-order
            subsequence and sorted by match score. If this is ``"contains"``,
            options are matched by case-insensitive substring. If this is
            ``"prefix"``, options are matched by case-insensitive prefix. If
            this is ``None``, typing is disabled and the options are not
            filtered.

            ``filter_mode=None`` is incompatible with
            ``accept_new_options=True``.

        width : "stretch" or int
            The width of the multiselect widget. This can be one of the
            following:

            - ``"stretch"`` (default): The width of the widget matches the
              width of the parent container.
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
            widget. Invalid query parameter values are ignored and
            removed from the URL. Multiple selections use repeated
            parameters (e.g., ``?tags=Red&tags=Blue``). Duplicates are
            deduplicated. If ``max_selections`` is set, excess values
            are truncated. When ``accept_new_options`` is ``True``, any
            value is accepted.

        Returns
        -------
        list
            A list of the selected options.

            The list contains copies of the selected options, not the originals.

        Examples
        --------
        **Example 1: Use a basic multiselect widget**

        You can declare one or more initial selections with the ``default``
        parameter.

        >>> import streamlit as st
        >>>
        >>> options = st.multiselect(
        ...     "What are your favorite colors?",
        ...     ["Green", "Yellow", "Red", "Blue"],
        ...     default=["Yellow", "Red"],
        ... )
        >>>
        >>> st.write("You selected:", options)

        .. output::
           https://doc-multiselect.streamlit.app/
           height: 350px

        **Example 2: Let users to add new options**

        To allow users to enter and select new options that aren't included in
        the ``options`` list, use the ``accept_new_options`` parameter. To
        prevent users from adding an unbounded number of new options, use the
        ``max_selections`` parameter.

        >>> import streamlit as st
        >>>
        >>> options = st.multiselect(
        ...     "What are your favorite cat names?",
        ...     ["Jellybeans", "Fish Biscuit", "Madam President"],
        ...     max_selections=5,
        ...     accept_new_options=True,
        ... )
        >>>
        >>> st.write("You selected:", options)

        .. output::
           https://doc-multiselect-accept-new-options.streamlit.app/
           height: 350px

        """
        # Convert empty string to single space to distinguish from None:
        # - None (default) → "" → Frontend shows contextual placeholders
        # - "" (explicit empty) → " " → Frontend shows empty placeholder
        # - "Custom" → "Custom" → Frontend shows custom placeholder
        if placeholder == "":
            placeholder = " "

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
            accept_new_options=accept_new_options,
            filter_mode=filter_mode,
            width=width,
            bind=bind,
            ctx=ctx,
        )

    def _multiselect(
        self,
        label: str,
        options: OptionSequence[T],
        default: Any | None = None,
        format_func: Callable[[Any], str] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        max_selections: int | None = None,
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        accept_new_options: bool = False,
        filter_mode: SelectWidgetFilterMode = "fuzzy",
        width: WidthWithoutContent = "stretch",
        bind: BindOption = None,
        ctx: ScriptRunContext | None = None,
    ) -> list[T] | list[T | str]:
        key = to_key(key)

        widget_name = "multiselect"
        check_widget_policies(
            self.dg,
            key,
            on_change,
            default_value=default,
        )
        maybe_raise_label_warnings(label, label_visibility)

        if max_selections is not None and max_selections < 1:
            raise StreamlitInvalidMaxError(
                "st.multiselect",
                "max_selections",
                max_selections,
                corrective_action="To disable `st.multiselect`, use `disabled=True`."
                if max_selections == 0
                else None,
            )

        indexable_options = convert_to_sequence_and_check_comparable(options)
        formatted_options, formatted_option_to_option_index = create_mappings(
            indexable_options, format_func
        )

        default_values = get_default_indices(indexable_options, default)

        # Convert empty string to single space to distinguish from None:
        # - None (default) → "" → Frontend shows contextual placeholders
        # - "" (explicit empty) → " " → Frontend shows empty placeholder
        # - "Custom" → "Custom" → Frontend shows custom placeholder
        if placeholder == "":
            placeholder = " "

        proto_filter_mode = validate_select_widget_filter_mode(
            filter_mode,
            accept_new_options=accept_new_options,
            command="st.multiselect",
        )

        form_id = current_form_id(self.dg)
        element_id = compute_and_register_element_id(
            widget_name,
            user_key=key,
            key_as_main_identity={
                "max_selections",
                "accept_new_options",
            },
            dg=self.dg,
            label=label,
            options=formatted_options,
            default=default_values,
            help=help,
            max_selections=max_selections,
            placeholder=placeholder,
            accept_new_options=accept_new_options,
            filter_mode=filter_mode,
            width=width,
        )

        proto = MultiSelectProto()
        proto.id = element_id
        proto.default[:] = default_values
        proto.form_id = form_id
        proto.disabled = disabled
        proto.label = label
        proto.max_selections = max_selections or 0
        proto.placeholder = placeholder or ""
        proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )
        proto.options[:] = formatted_options
        if help is not None:
            proto.help = dedent(help)
        proto.accept_new_options = accept_new_options
        proto.filter_mode = proto_filter_mode

        # Set query param key if bound
        if bind == "query-params" and key is not None:
            proto.query_param_key = str(key)

        serde = MultiSelectSerde(
            indexable_options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            default_options_indices=default_values,
            format_func=format_func,
        )

        widget_state = register_widget(
            proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="string_array_value",
            bind=bind,
            # Multiselect is always clearable: users can always remove all
            # selections, so ?key= (empty URL param) should clear to [].
            clearable=True,
            # Pass formatted_options so _seed_widget_from_url can filter out
            # invalid option strings from URLs. Not passed when
            # accept_new_options=True since any string is valid.
            formatted_options=None if accept_new_options else formatted_options,
            # Pass max_selections so _seed_widget_from_url can truncate
            # URL-seeded arrays that exceed the limit, instead of crashing.
            max_array_length=max_selections,
        )

        _check_max_selections(widget_state.value, max_selections)

        widget_state = maybe_coerce_enum_sequence(
            widget_state, options, indexable_options
        )

        if accept_new_options:
            # accept_new_options is True, so we keep the user-entered values.
            current_values = widget_state.value
            value_needs_reset = False
        else:
            # Validate the current values against the new options.
            # If values are no longer valid (not in options), filter them out.
            # This handles the case where options change dynamically and the
            # previously selected values are no longer available.
            current_values, value_needs_reset = (
                validate_and_sync_multiselect_value_with_options(
                    widget_state.value, indexable_options, key, format_func
                )
            )

        if value_needs_reset or widget_state.value_changed:
            proto.raw_values[:] = serde.serialize(current_values)
            proto.set_value = True

        validate_width(width)
        layout_config = LayoutConfig(width=width)

        if ctx:
            save_for_app_testing(ctx, element_id, format_func)

        self.dg._enqueue(widget_name, proto, layout_config=layout_config)

        return current_values

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

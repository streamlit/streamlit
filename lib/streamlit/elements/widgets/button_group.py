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
    Final,
    Generic,
    Literal,
    TypeAlias,
    TypeVar,
    cast,
    overload,
)

from streamlit import config
from streamlit.dataframe_util import convert_anything_to_list
from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.layout_utils import (
    LayoutConfig,
    Width,
    validate_width,
)
from streamlit.elements.lib.options_selector_utils import (
    convert_to_sequence_and_check_comparable,
    create_mappings,
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
from streamlit.runtime.state import register_widget
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

_THUMB_ICONS: Final = (":material/thumb_up:", ":material/thumb_down:")
_FACES_ICONS: Final = (
    ":material/sentiment_sad:",
    ":material/sentiment_dissatisfied:",
    ":material/sentiment_neutral:",
    ":material/sentiment_satisfied:",
    ":material/sentiment_very_satisfied:",
)
_NUMBER_STARS: Final = 5
_STAR_ICON: Final = ":material/star:"
# we don't have the filled-material icon library as a dependency. Hence, we have it here
# in base64 format and send it over the wire as an image.
_SELECTED_STAR_ICON: Final = ":material/star_filled:"

SelectionMode: TypeAlias = Literal["single", "multi"]


class _ButtonGroupSerde(Generic[T]):
    """String-based serde for ButtonGroup widgets.

    Uses string-based values (formatted option strings) for robust handling
    of dynamic option changes. Handles both single-select and multi-select modes.
    """

    options: Sequence[T]
    formatted_options: list[str]
    formatted_option_to_option_index: dict[str, int]
    default_values: list[int]
    format_func: Callable[[Any], str]
    selection_mode: SelectionMode

    def __init__(
        self,
        options: Sequence[T],
        *,
        formatted_options: list[str],
        formatted_option_to_option_index: dict[str, int],
        default_values: list[int] | None = None,
        format_func: Callable[[Any], str] = str,
        selection_mode: SelectionMode = "single",
    ) -> None:
        self.options = options
        self.formatted_options = formatted_options
        self.formatted_option_to_option_index = formatted_option_to_option_index
        self.default_values = default_values or []
        self.format_func = format_func
        self.selection_mode = selection_mode

    def serialize(self, value: T | str | list[T | str] | None) -> list[str]:
        """Serialize value to list of formatted strings for wire format."""
        if self.selection_mode == "multi":
            return self._serialize_multi(value)
        return self._serialize_single(cast("T | str | None", value))

    def deserialize(
        self, ui_value: list[str] | None
    ) -> T | str | list[T] | list[T | str] | None:
        """Deserialize from list of strings to appropriate value type."""
        if self.selection_mode == "multi":
            return self._deserialize_multi(ui_value)
        return self._deserialize_single(ui_value)

    def _serialize_single(self, v: T | str | None) -> list[str]:
        """Serialize single-select value to a list of strings."""
        if v is None:
            return []
        if len(self.options) == 0:
            return []

        try:
            formatted_value = self.format_func(v)
        except Exception:
            # format_func failed (e.g., v is a string but format_func expects
            # an object with specific attributes). Use str(v) to ensure we return
            # a proper string, not the original object.
            return [str(v)]

        if formatted_value in self.formatted_option_to_option_index:
            return [formatted_value]
        # Value not found in options - return formatted string for type consistency.
        return [formatted_value]

    def _deserialize_single(self, ui_value: list[str] | None) -> T | str | None:
        """Deserialize from a list of strings to a single value."""
        if len(self.options) == 0:
            return None

        if ui_value is None or len(ui_value) == 0:
            if self.default_values:
                return self.options[self.default_values[0]]
            return None

        # Take the first value from the list
        string_value = ui_value[0]
        option_index = self.formatted_option_to_option_index.get(string_value)
        return self.options[option_index] if option_index is not None else string_value

    def _serialize_multi(self, value: T | str | list[T | str] | None) -> list[str]:
        """Serialize multi-select values to list of strings."""
        if value is None:
            return []
        converted_value = convert_anything_to_list(cast("Any", value))
        values: list[str] = []
        for v in converted_value:
            try:
                formatted_value = self.format_func(v)
            except Exception:
                # format_func failed (e.g., v is a string but format_func expects
                # an object with specific attributes). Use str(v) to ensure we append
                # a proper string, not the original object.
                values.append(str(v))
                continue
            if formatted_value in self.formatted_option_to_option_index:
                values.append(formatted_value)
            else:
                # Value not found in options - return formatted string for type consistency.
                values.append(formatted_value)
        return values

    def _deserialize_multi(self, ui_value: list[str] | None) -> list[T | str] | list[T]:
        """Deserialize from list of strings to list of values."""
        if ui_value is None:
            return [self.options[i] for i in self.default_values]

        values: list[T | str] = []
        for v in ui_value:
            option_index = self.formatted_option_to_option_index.get(v)
            if option_index is not None:
                values.append(self.options[option_index])
            else:
                values.append(v)
        return values


def get_mapped_options(
    feedback_option: Literal["thumbs", "faces", "stars"],
) -> tuple[list[ButtonGroupProto.Option], list[int]]:
    # options object understandable by the web app
    options: list[ButtonGroupProto.Option] = []
    # we use the option index in the webapp communication to
    # indicate which option is selected
    options_indices: list[int] = []

    if feedback_option == "thumbs":
        # reversing the index mapping to have thumbs up first (but still with the higher
        # index (=sentiment) in the list)
        options_indices = list(reversed(range(len(_THUMB_ICONS))))
        options = [ButtonGroupProto.Option(content_icon=icon) for icon in _THUMB_ICONS]
    elif feedback_option == "faces":
        options_indices = list(range(len(_FACES_ICONS)))
        options = [ButtonGroupProto.Option(content_icon=icon) for icon in _FACES_ICONS]
    elif feedback_option == "stars":
        options_indices = list(range(_NUMBER_STARS))
        options = [
            ButtonGroupProto.Option(
                content_icon=_STAR_ICON,
                selected_content_icon=_SELECTED_STAR_ICON,
            )
        ] * _NUMBER_STARS

    return options, options_indices


def _build_proto(
    widget_id: str,
    formatted_options: Sequence[ButtonGroupProto.Option],
    default_values: list[int],
    disabled: bool,
    current_form_id: str,
    click_mode: ButtonGroupProto.ClickMode.ValueType,
    selection_visualization: ButtonGroupProto.SelectionVisualization.ValueType = (
        ButtonGroupProto.SelectionVisualization.ONLY_SELECTED
    ),
    style: Literal["borderless", "pills", "segmented_control"] = "pills",
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
    proto.selection_visualization = selection_visualization
    return proto


def _maybe_raise_selection_mode_warning(selection_mode: SelectionMode) -> None:
    """Check if the selection_mode value is valid or raise exception otherwise."""
    if selection_mode not in {"single", "multi"}:
        raise StreamlitAPIException(
            "The selection_mode argument must be one of ['single', 'multi']. "
            f"The argument passed was '{selection_mode}'."
        )


class ButtonGroupMixin:
    # These overloads are not documented in the docstring, at least not at this time, on
    # the theory that most people won't know what it means. And the Literals here are a
    # subclass of int anyway. Usually, we would make a type alias for
    # Literal["thumbs", "faces", "stars"]; but, in this case, we don't use it in too
    # many other places, and it's a more helpful autocomplete if we just enumerate the
    # values explicitly, so a decision has been made to keep it as not an alias.
    @overload
    def feedback(
        self,
        options: Literal["thumbs"] = ...,
        *,
        key: Key | None = None,
        default: int | None = None,
        disabled: bool = False,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        width: Width = "content",
    ) -> Literal[0, 1] | None: ...
    @overload
    def feedback(
        self,
        options: Literal["faces", "stars"] = ...,
        *,
        key: Key | None = None,
        default: int | None = None,
        disabled: bool = False,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        width: Width = "content",
    ) -> Literal[0, 1, 2, 3, 4] | None: ...
    @gather_metrics("feedback")
    def feedback(
        self,
        options: Literal["thumbs", "faces", "stars"] = "thumbs",
        *,
        key: Key | None = None,
        default: int | None = None,
        disabled: bool = False,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        width: Width = "content",
    ) -> int | None:
        """Display a feedback widget.

        A feedback widget is an icon-based button group available in three
        styles, as described in ``options``. It is commonly used in chat and AI
        apps to allow users to rate responses.

        Parameters
        ----------
        options : "thumbs", "faces", or "stars"
            The feedback options displayed to the user. ``options`` can be one
            of the following:

            - ``"thumbs"`` (default): Streamlit displays a thumb-up and
              thumb-down button group.
            - ``"faces"``: Streamlit displays a row of five buttons with
              facial expressions depicting increasing satisfaction from left to
              right.
            - ``"stars"``: Streamlit displays a row of star icons, allowing the
              user to select a rating from one to five stars.

        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. No two widgets may have the same key.

        default : int or None
            Default feedback value. This must be consistent with the feedback
            type in ``options``:

            - 0 or 1 if ``options="thumbs"``.
            - Between 0 and 4, inclusive, if ``options="faces"`` or
              ``options="stars"``.

        disabled : bool
            An optional boolean that disables the feedback widget if set
            to ``True``. The default is ``False``.

        on_change : callable
            An optional callback invoked when this feedback widget's value
            changes.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        width : "content", "stretch", or int
            The width of the feedback widget. This can be one of the following:

            - ``"content"`` (default): The width of the widget matches the
              width of its content, but doesn't exceed the width of the parent
              container.
            - ``"stretch"``: The width of the widget matches the width of the
              parent container.
            - An integer specifying the width in pixels: The widget has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the widget matches the width
              of the parent container.

        Returns
        -------
        int or None
            An integer indicating the user's selection, where ``0`` is the
            lowest feedback. Higher values indicate more positive feedback.
            If no option was selected, the widget returns ``None``.

            - For ``options="thumbs"``, a return value of ``0`` indicates
              thumbs-down, and ``1`` indicates thumbs-up.
            - For ``options="faces"`` and ``options="stars"``, return values
              range from ``0`` (least satisfied) to ``4`` (most satisfied).

        Examples
        --------
        Display a feedback widget with stars, and show the selected sentiment:

        >>> import streamlit as st
        >>>
        >>> sentiment_mapping = ["one", "two", "three", "four", "five"]
        >>> selected = st.feedback("stars")
        >>> if selected is not None:
        >>>     st.markdown(f"You selected {sentiment_mapping[selected]} star(s).")

        .. output::
            https://doc-feedback-stars.streamlit.app/
            height: 200px

        Display a feedback widget with thumbs, and show the selected sentiment:

        >>> import streamlit as st
        >>>
        >>> sentiment_mapping = [":material/thumb_down:", ":material/thumb_up:"]
        >>> selected = st.feedback("thumbs")
        >>> if selected is not None:
        >>>     st.markdown(f"You selected: {sentiment_mapping[selected]}")

        .. output::
            https://doc-feedback-thumbs.streamlit.app/
            height: 200px

        """

        if options not in {"thumbs", "faces", "stars"}:
            raise StreamlitAPIException(
                "The options argument to st.feedback must be one of "
                "['thumbs', 'faces', 'stars']. "
                f"The argument passed was '{options}'."
            )
        transformed_options, options_indices = get_mapped_options(options)

        if default is not None and (default < 0 or default >= len(transformed_options)):
            raise StreamlitAPIException(
                f"The default value in '{options}' must be a number between 0 and {len(transformed_options) - 1}."
                f" The passed default value is {default}"
            )

        # Convert small pixel widths to "content" to prevent icon wrapping.
        # Calculate threshold based on theme.baseFontSize to be responsive to
        # custom themes. The calculation is based on icon buttons sized in rem:
        # - Button size: ~1.5rem (icon 1.25rem + padding 0.125rem x 2)
        # - Gap: 0.125rem between buttons
        # - thumbs: 2 buttons + 1 gap = 3.125rem
        # - faces/stars: 5 buttons + 4 gaps = 8rem
        base_font_size = config.get_option("theme.baseFontSize") or 16
        button_size_rem = 1.5
        gap_size_rem = 0.125

        if options == "thumbs":
            # 2 buttons + 1 gap
            min_width_rem = 2 * button_size_rem + gap_size_rem
        else:
            # 5 buttons + 4 gaps (faces or stars)
            min_width_rem = 5 * button_size_rem + 4 * gap_size_rem

        # Convert rem to pixels based on base font size, add 10% buffer
        min_width_threshold = int(min_width_rem * base_font_size * 1.1)

        if isinstance(width, int) and width < min_width_threshold:
            width = "content"

        _default: list[int] | None = (
            [options_indices[default]] if default is not None else None
        )

        # Create string-based serde for feedback
        # Use the icon strings as formatted options to match what frontend sends.
        # transformed_options contains ButtonGroupProto.Option objects with contentIcon.
        # The frontend reconstructs the formatted string from contentIcon + content.
        def _format_feedback_option(idx: int) -> str:
            """Format a sentiment index to its icon string."""
            # Find the button index for this sentiment value
            button_idx = options_indices.index(idx)
            opt = transformed_options[button_idx]
            icon = opt.content_icon or ""
            content = opt.content or ""
            if icon:
                return f"{icon} {content}".strip()
            return content

        formatted_options = [_format_feedback_option(idx) for idx in options_indices]
        formatted_option_to_option_index = {
            formatted: i for i, formatted in enumerate(formatted_options)
        }
        default_values = [options_indices.index(default)] if default is not None else []
        serde = _ButtonGroupSerde[int](
            options_indices,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            default_values=default_values,
            format_func=_format_feedback_option,
            selection_mode="single",
        )

        selection_visualization = ButtonGroupProto.SelectionVisualization.ONLY_SELECTED
        if options == "stars":
            selection_visualization = (
                ButtonGroupProto.SelectionVisualization.ALL_UP_TO_SELECTED
            )

        sentiment = cast(
            "RegisterWidgetResult[int]",
            self._button_group(
                transformed_options,
                default=_default,
                key=key,
                selection_mode="single",
                disabled=disabled,
                deserializer=cast("WidgetDeserializer[int]", serde.deserialize),
                serializer=cast("WidgetSerializer[int]", serde.serialize),
                on_change=on_change,
                args=args,
                kwargs=kwargs,
                selection_visualization=selection_visualization,
                style="borderless",
                width=width,
                options_format_func=_format_feedback_option,
            ),
        )
        return sentiment.value

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

        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

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

        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

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
        formatted_options, formatted_option_to_option_index = create_mappings(
            indexable_options, actual_format_func
        )

        # Create string-based serde for pills/segmented_control
        serde = _ButtonGroupSerde[V](
            indexable_options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            default_values=default_values,
            format_func=actual_format_func,
            selection_mode=selection_mode,
        )

        if selection_mode == "multi":
            multi_res = cast(
                "RegisterWidgetResult[list[V] | list[V | str]]",
                self._button_group(
                    indexable_options,
                    default=default_values,
                    selection_mode=selection_mode,
                    disabled=disabled,
                    format_func=_transformed_format_func,
                    key=key,
                    help=help,
                    style=style,
                    serializer=cast(
                        "WidgetSerializer[list[V] | list[V | str]]", serde.serialize
                    ),
                    deserializer=cast(
                        "WidgetDeserializer[list[V] | list[V | str]]",
                        serde.deserialize,
                    ),
                    on_change=on_change,
                    args=args,
                    kwargs=kwargs,
                    label=label,
                    label_visibility=label_visibility,
                    width=width,
                    options_format_func=actual_format_func,
                ),
            )
            multi_res = maybe_coerce_enum_sequence(
                multi_res, options, indexable_options
            )
            return cast("list[V]", multi_res.value)

        single_res = cast(
            "RegisterWidgetResult[V | str | None]",
            self._button_group(
                indexable_options,
                default=default_values,
                selection_mode=selection_mode,
                disabled=disabled,
                format_func=_transformed_format_func,
                key=key,
                help=help,
                style=style,
                serializer=cast("WidgetSerializer[V | str | None]", serde.serialize),
                deserializer=cast(
                    "WidgetDeserializer[V | str | None]", serde.deserialize
                ),
                on_change=on_change,
                args=args,
                kwargs=kwargs,
                label=label,
                label_visibility=label_visibility,
                width=width,
                options_format_func=actual_format_func,
            ),
        )
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
        style: Literal[
            "borderless", "pills", "segmented_control"
        ] = "segmented_control",
        format_func: Callable[[V], ButtonGroupProto.Option] | None = None,
        deserializer: WidgetDeserializer[T],
        serializer: WidgetSerializer[T],
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        selection_visualization: ButtonGroupProto.SelectionVisualization.ValueType = (
            ButtonGroupProto.SelectionVisualization.ONLY_SELECTED
        ),
        label: str | None = None,
        label_visibility: LabelVisibility = "visible",
        help: str | None = None,
        width: Width = "content",
        options_format_func: Callable[[Any], str] | None = None,
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

        if style not in {"borderless", "pills", "segmented_control"}:
            raise StreamlitAPIException(
                "The style argument must be one of ['borderless', 'pills', 'segmented_control']. "
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

        # Determine key_as_main_identity based on style:
        # - For feedback (borderless): include options and click_mode in identity
        #   so widget resets when both options or click_mode change
        # - For pills/segmented_control: only include click_mode in identity to allow
        #   dynamic option changes without resetting, but reset when selection_mode changes
        #   (since changing from single to multi or vice versa changes the value format)
        is_feedback = style == "borderless"
        key_as_main_identity: set[str] = (
            {"options", "click_mode"} if is_feedback else {"click_mode"}
        )

        element_id = compute_and_register_element_id(
            # The borderless style is used by st.feedback, but users expect to see
            # "feedback" in errors
            "feedback" if is_feedback else style,
            user_key=key,
            key_as_main_identity=key_as_main_identity,
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
            selection_visualization=selection_visualization,
            style=style,
            label=label,
            label_visibility=label_visibility,
            help=help,
        )

        # Always use string-based values for all ButtonGroup widgets
        widget_state = register_widget(
            proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=deserializer,
            serializer=serializer,
            ctx=ctx,
            value_type="string_array_value",
        )

        # Validate and sync value with options (for pills/segmented_control)
        # Feedback handles reset via key_as_main_identity so no validation needed
        value_needs_reset = False
        current_value: T | list[T] | list[T | str] | None = widget_state.value
        if not is_feedback and options_format_func is not None:
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
            save_for_app_testing(ctx, element_id, format_func)

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

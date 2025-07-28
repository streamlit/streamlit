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

from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Final,
    Generic,
    Literal,
    TypeVar,
    cast,
    overload,
)

from typing_extensions import TypeAlias

from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.layout_utils import (
    LayoutConfig,
    Width,
    validate_width,
)
from streamlit.elements.lib.options_selector_utils import (
    check_and_convert_to_indices,
    convert_to_sequence_and_check_comparable,
    get_default_indices,
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


@dataclass
class _MultiSelectSerde(Generic[T]):
    """Only meant to be used internally for the button_group element.

    This serde is inspired by the MultiSelectSerde from multiselect.py. That serde has
    been updated since then to support the accept_new_options parameter, which is not
    required by the button_group element. If this changes again at some point,
    the two elements can share the same serde again.
    """

    options: Sequence[T]
    default_value: list[int] = field(default_factory=list)

    def serialize(self, value: list[T]) -> list[int]:
        indices = check_and_convert_to_indices(self.options, value)
        return indices if indices is not None else []

    def deserialize(self, ui_value: list[int] | None) -> list[T]:
        current_value: list[int] = (
            ui_value if ui_value is not None else self.default_value
        )
        return [self.options[i] for i in current_value]


class _SingleSelectSerde(Generic[T]):
    """Only meant to be used internally for the button_group element.

    Uses the ButtonGroup's _MultiSelectSerde under-the-hood, but accepts a single
    index value and deserializes to a single index value.
    This is because button_group can be single and multi select, but we use the same
    proto for both and, thus, map single values to a list of values and a receiving
    value wrapped in a list to a single value.

    When a default_value is provided is provided, the option corresponding to the
    index is serialized/deserialized.
    """

    def __init__(
        self,
        option_indices: Sequence[T],
        default_value: list[int] | None = None,
    ) -> None:
        # see docstring about why we use MultiSelectSerde here
        self.multiselect_serde: _MultiSelectSerde[T] = _MultiSelectSerde(
            option_indices, default_value if default_value is not None else []
        )

    def serialize(self, value: T | None) -> list[int]:
        _value = [value] if value is not None else []
        return self.multiselect_serde.serialize(_value)

    def deserialize(self, ui_value: list[int] | None) -> T | None:
        deserialized = self.multiselect_serde.deserialize(ui_value)

        if len(deserialized) == 0:
            return None

        return deserialized[0]


class ButtonGroupSerde(Generic[T]):
    """A serde that can handle both single and multi select options.

    It uses the same proto to wire the data, so that we can send and receive
    single values via a list. We have different serdes for both cases though so
    that when setting / getting the value via session_state, it is mapped correctly.
    So for single select, the value will be a single value and for multi select, it will
    be a list of values.
    """

    def __init__(
        self,
        options: Sequence[T],
        default_values: list[int],
        type: Literal["single", "multi"],
    ) -> None:
        self.options = options
        self.default_values = default_values
        self.type = type
        self.serde: _SingleSelectSerde[T] | _MultiSelectSerde[T] = (
            _SingleSelectSerde(options, default_value=default_values)
            if type == "single"
            else _MultiSelectSerde(options, default_values)
        )

    def serialize(self, value: T | list[T] | None) -> list[int]:
        return self.serde.serialize(cast("Any", value))

    def deserialize(self, ui_value: list[int] | None) -> list[T] | T | None:
        return self.serde.deserialize(ui_value)


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
    if selection_mode not in ["single", "multi"]:
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

        .. output ::
            https://doc-feedback-stars.streamlit.app/
            height: 200px

        Display a feedback widget with thumbs, and show the selected sentiment:

        >>> import streamlit as st
        >>>
        >>> sentiment_mapping = [":material/thumb_down:", ":material/thumb_up:"]
        >>> selected = st.feedback("thumbs")
        >>> if selected is not None:
        >>>     st.markdown(f"You selected: {sentiment_mapping[selected]}")

        .. output ::
            https://doc-feedback-thumbs.streamlit.app/
            height: 200px

        """

        if options not in ["thumbs", "faces", "stars"]:
            raise StreamlitAPIException(
                "The options argument to st.feedback must be one of "
                "['thumbs', 'faces', 'stars']. "
                f"The argument passed was '{options}'."
            )
        transformed_options, options_indices = get_mapped_options(options)
        serde = _SingleSelectSerde[int](options_indices)

        selection_visualization = ButtonGroupProto.SelectionVisualization.ONLY_SELECTED
        if options == "stars":
            selection_visualization = (
                ButtonGroupProto.SelectionVisualization.ALL_UP_TO_SELECTED
            )

        sentiment = self._button_group(
            transformed_options,
            default=None,
            key=key,
            selection_mode="single",
            disabled=disabled,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            selection_visualization=selection_visualization,
            style="borderless",
            width=width,
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

        def _transformed_format_func(option: V) -> ButtonGroupProto.Option:
            """If option starts with a material icon or an emoji, we extract it to send
            it parsed to the frontend.
            """
            transformed = format_func(option) if format_func else str(option)
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

        serde: ButtonGroupSerde[V] = ButtonGroupSerde[V](
            indexable_options, default_values, selection_mode
        )

        res = self._button_group(
            indexable_options,
            default=default_values,
            selection_mode=selection_mode,
            disabled=disabled,
            format_func=_transformed_format_func,
            key=key,
            help=help,
            style=style,
            serializer=serde.serialize,
            deserializer=serde.deserialize,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            label=label,
            label_visibility=label_visibility,
            width=width,
        )

        if selection_mode == "multi":
            return res.value

        return res.value

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

        if style not in ["borderless", "pills", "segmented_control"]:
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

        widget_name = "button_group"
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
            widget_name,
            user_key=key,
            form_id=form_id,
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

        widget_state = register_widget(
            proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=deserializer,
            serializer=serializer,
            ctx=ctx,
            value_type="int_array_value",
        )

        if widget_state.value_changed:
            proto.value[:] = serializer(widget_state.value)
            proto.set_value = True

        if ctx:
            save_for_app_testing(ctx, element_id, format_func)

        self.dg._enqueue(widget_name, proto, layout_config=layout_config)

        return widget_state

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

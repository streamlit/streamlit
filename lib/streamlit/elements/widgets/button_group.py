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

from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Final,
    Generic,
    Literal,
    Sequence,
    TypeVar,
    cast,
    overload,
)

from typing_extensions import TypeAlias

from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.options_selector_utils import (
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
from streamlit.elements.widgets.multiselect import MultiSelectSerde
from streamlit.errors import StreamlitAPIException
from streamlit.proto.ButtonGroup_pb2 import ButtonGroup as ButtonGroupProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state import register_widget
from streamlit.string_util import validate_material_icon
from streamlit.type_util import T

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

SelectionMode: TypeAlias = Literal["single", "multiple"]


class SingleSelectSerde(Generic[T]):
    """Uses the MultiSelectSerde under-the-hood, but accepts a single index value
    and deserializes to a single index value.
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
        self.multiselect_serde: MultiSelectSerde[T] = MultiSelectSerde(
            option_indices, default_value if default_value is not None else []
        )

    def serialize(self, value: T | None) -> list[int]:
        _value = [value] if value is not None else []
        return self.multiselect_serde.serialize(_value)

    def deserialize(self, ui_value: list[int] | None, widget_id: str = "") -> T | None:
        deserialized = self.multiselect_serde.deserialize(ui_value, widget_id)

        if len(deserialized) == 0:
            return None

        return deserialized[0]


class SingleOrMultiSelectSerde(Generic[T]):
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
        type: Literal["single", "multiple"],
    ):
        self.options = options
        self.default_values = default_values
        self.type = type
        self.serde: SingleSelectSerde[T] | MultiSelectSerde[T] = (
            SingleSelectSerde(options, default_value=default_values)
            if type == "single"
            else MultiSelectSerde(options, default_values)
        )

    def serialize(self, value: T | list[T] | None) -> list[int]:
        return self.serde.serialize(cast(Any, value))

    def deserialize(
        self, ui_value: list[int] | None, widget_id: str = ""
    ) -> list[T] | T | None:
        return self.serde.deserialize(ui_value, widget_id)


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
    style: Literal["segment", "pills", "borderless"] = "segment",
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


def _maybe_raise_selection_mode_warning(selection_mode: SelectionMode):
    """Check if the selection_mode value is valid or raise exception otherwise."""
    if selection_mode not in ["single", "multiple"]:
        raise StreamlitAPIException(
            "The selection_mode argument must be one of ['single', 'multiple']. "
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
    ) -> int | None:
        """Display a feedback widget.

        A feedback widget is an icon-based button group available in three
        styles, as described in ``options``. It is commonly used in chat and AI
        apps to allow users to rate responses.

        Parameters
        ----------
        options: "thumbs", "faces", or "stars"
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
            An optional boolean, which disables the feedback widget if set
            to True. The default is False. This argument can only be supplied
            by keyword.

        on_change : callable
            An optional callback invoked when this feedback widget's value
            changes.

        args : tuple
            An optional tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

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
        serde = SingleSelectSerde[int](options_indices)

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
        )
        return sentiment.value

    @gather_metrics("pills")
    def _pills(
        self,
        label: str,
        options: OptionSequence[V],
        *,
        selection_mode: Literal["single", "multiple"] = "single",
        default: Sequence[V] | V | None = None,
        format_func: Callable[[Any], str] | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
    ) -> list[V] | V | None:
        maybe_raise_label_warnings(label, label_visibility)

        def _transformed_format_func(option: V) -> ButtonGroupProto.Option:
            """If option starts with a material icon or an emoji, we extract it to send
            it parsed to the frontend."""
            transformed = format_func(option) if format_func else str(option)
            transformed_parts = transformed.split(" ")
            icon: str | None = None
            if len(transformed_parts) > 0:
                maybe_icon = transformed_parts[0].strip()
                try:
                    # we only want to extract material icons because we treat them
                    # differently than emojis visually
                    if maybe_icon.startswith(":material"):
                        icon = validate_material_icon(maybe_icon)
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

        serde: SingleOrMultiSelectSerde[V] = SingleOrMultiSelectSerde[V](
            indexable_options, default_values, selection_mode
        )
        res = self._button_group(
            indexable_options,
            key=key,
            default=default_values,
            selection_mode=selection_mode,
            disabled=disabled,
            format_func=_transformed_format_func,
            serializer=serde.serialize,
            deserializer=serde.deserialize,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            style="pills",
            label=label,
            label_visibility=label_visibility,
            help=help,
        )

        if selection_mode == "multiple":
            return res.value

        return res.value

    @gather_metrics("_internal_button_group")
    def _internal_button_group(
        self,
        options: OptionSequence[V],
        *,
        key: Key | None = None,
        default: Sequence[V] | V | None = None,
        selection_mode: Literal["single", "multiple"] = "single",
        disabled: bool = False,
        format_func: Callable[[Any], str] | None = None,
        style: Literal["segment", "pills"] = "segment",
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
    ) -> list[V] | V | None:
        def _transformed_format_func(option: V) -> ButtonGroupProto.Option:
            """If option starts with a material icon or an emoji, we extract it to send
            it parsed to the frontend."""
            transformed = format_func(option) if format_func else str(option)
            transformed_parts = transformed.split(" ")
            icon: str | None = None
            if len(transformed_parts) > 0:
                maybe_icon = transformed_parts[0].strip()
                try:
                    # we only want to extract material icons because we treat them
                    # differently than emojis visually
                    if maybe_icon.startswith(":material"):
                        icon = validate_material_icon(maybe_icon)
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

        serde: SingleOrMultiSelectSerde[V] = SingleOrMultiSelectSerde[V](
            indexable_options, default_values, selection_mode
        )

        res = self._button_group(
            indexable_options,
            key=key,
            default=default_values,
            selection_mode=selection_mode,
            disabled=disabled,
            format_func=_transformed_format_func,
            style=style,
            serializer=serde.serialize,
            deserializer=serde.deserialize,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
        )

        if selection_mode == "multiple":
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
        style: Literal["segment", "pills", "borderless"] = "segment",
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

        if style not in ["segment", "pills", "borderless"]:
            raise StreamlitAPIException(
                "The style argument must be one of ['segment', 'pills', 'borderless']. "
                f"The argument passed was '{style}'."
            )

        key = to_key(key)

        _default = default
        if default is not None and len(default) == 0:
            _default = None

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
            options=formatted_options,
            default=default,
            click_mode=parsed_selection_mode,
            style=style,
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
            widget_name,
            proto,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=deserializer,
            serializer=serializer,
            ctx=ctx,
        )

        if widget_state.value_changed:
            proto.value[:] = serializer(widget_state.value)
            proto.set_value = True

        if ctx:
            save_for_app_testing(ctx, element_id, format_func)

        self.dg._enqueue(widget_name, proto)

        return widget_state

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

from abc import ABC
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from typing import Any, Generic, List, Sequence, TypeVar, Union, cast, overload

from typing_extensions import Literal, TypeAlias

from streamlit import util
from streamlit.elements.heading import HeadingProtoTag
from streamlit.elements.widgets.select_slider import SelectSliderSerde
from streamlit.elements.widgets.slider import (
    SliderScalar,
    SliderScalarT,
    SliderSerde,
    Step,
)
from streamlit.elements.widgets.time_widgets import (
    DateInputSerde,
    DateWidgetReturn,
    TimeInputSerde,
    _parse_date_value,
)
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.proto.Button_pb2 import Button as ButtonProto
from streamlit.proto.Checkbox_pb2 import Checkbox as CheckboxProto
from streamlit.proto.Code_pb2 import Code as CodeProto
from streamlit.proto.ColorPicker_pb2 import ColorPicker as ColorPickerProto
from streamlit.proto.DateInput_pb2 import DateInput as DateInputProto
from streamlit.proto.Element_pb2 import Element as ElementProto
from streamlit.proto.Exception_pb2 import Exception as ExceptionProto
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.Heading_pb2 import Heading as HeadingProto
from streamlit.proto.Markdown_pb2 import Markdown as MarkdownProto
from streamlit.proto.MultiSelect_pb2 import MultiSelect as MultiSelectProto
from streamlit.proto.NumberInput_pb2 import NumberInput as NumberInputProto
from streamlit.proto.Radio_pb2 import Radio as RadioProto
from streamlit.proto.Selectbox_pb2 import Selectbox as SelectboxProto
from streamlit.proto.Slider_pb2 import Slider as SliderProto
from streamlit.proto.Text_pb2 import Text as TextProto
from streamlit.proto.TextArea_pb2 import TextArea as TextAreaProto
from streamlit.proto.TextInput_pb2 import TextInput as TextInputProto
from streamlit.proto.TimeInput_pb2 import TimeInput as TimeInputProto
from streamlit.proto.WidgetStates_pb2 import WidgetState, WidgetStates
from streamlit.runtime.state.common import user_key_from_widget_id
from streamlit.runtime.state.session_state import SessionState

T = TypeVar("T")


@dataclass
class InitialValue:
    """This class is used to represent the initial value of a widget."""

    pass


# TODO This class serves as a fallback option for elements that have not
# been implemented yet, as well as providing implementations of some
# trivial methods. It may have significantly reduced scope, or be removed
# entirely, once all elements have been implemented.
# This class will not be sufficient implementation for most elements.
# Widgets need their own classes to translate interactions into the appropriate
# WidgetState and provide higher level interaction interfaces, and other elements
# have enough variation in how to get their values that most will need their
# own classes too.
@dataclass
class Element:
    type: str
    proto: Any = field(repr=False)
    root: ElementTree = field(repr=False)
    key: str | None

    def __init__(self, proto: ElementProto, root: ElementTree):
        self.proto = proto
        self.root = root
        ty = proto.WhichOneof("type")
        assert ty is not None
        self.type = ty
        self.key = None

    def __iter__(self):
        yield self

    @property
    def value(self) -> Any:
        p = getattr(self.proto, self.type)
        try:
            state = self.root.session_state
            assert state
            return state[p.id]
        except ValueError:
            # No id field, not a widget
            return p.value

    def widget_state(self) -> WidgetState | None:
        return None

    def run(self, timeout: float | None = None) -> ElementTree:
        """Run the script with updated widget values.
        Timeout is a number of seconds, or None to use the default.
        """
        return self.root.run(timeout=timeout)

    def __repr__(self):
        return util.repr_(self)


@dataclass(repr=False)
class Widget(ABC, Element):
    id: str
    label: str
    help: str
    form_id: str
    disabled: bool
    key: str | None
    _value: Any

    def set_value(self, v: Any):
        self._value = v
        return self

    @property
    def as_button(self) -> Button:
        assert isinstance(self, Button)
        return self

    @property
    def as_checkbox(self) -> Checkbox:
        assert isinstance(self, Checkbox)
        return self

    @property
    def as_color_picker(self) -> ColorPicker:
        assert isinstance(self, ColorPicker)
        return self

    @property
    def as_date_input(self) -> DateInput:
        assert isinstance(self, DateInput)
        return self

    @property
    def as_multiselect(self) -> Multiselect[Any]:
        assert isinstance(self, Multiselect)
        return self

    @property
    def as_number_input(self) -> NumberInput:
        assert isinstance(self, NumberInput)
        return self

    @property
    def as_radio(self) -> Radio[Any]:
        assert isinstance(self, Radio)
        return self

    @property
    def as_select_slider(self) -> SelectSlider[Any]:
        assert isinstance(self, SelectSlider)
        return self

    @property
    def as_selectbox(self) -> Selectbox[Any]:
        assert isinstance(self, Selectbox)
        return self

    @property
    def as_slider(self) -> Slider[Any]:
        assert isinstance(self, Slider)
        return self

    @property
    def as_text_area(self) -> TextArea:
        assert isinstance(self, TextArea)
        return self

    @property
    def as_text_input(self) -> TextInput:
        assert isinstance(self, TextInput)
        return self

    @property
    def as_time_input(self) -> TimeInput:
        assert isinstance(self, TimeInput)
        return self


El = TypeVar("El", bound=Element, covariant=True)


class ElementList(Generic[El]):
    def __init__(self, els: Sequence[El]):
        self._list: Sequence[El] = els

    def __len__(self) -> int:
        return len(self._list)

    def len(self) -> int:
        return len(self)

    def __getitem__(self, idx: int) -> El:
        return self._list[idx]

    def __iter__(self):
        yield from self._list

    def values(self) -> Sequence[Any]:
        return [e.value for e in self]


W = TypeVar("W", bound=Widget, covariant=True)


class WidgetList(Generic[W], ElementList[W]):
    def get_widget(self, key: str) -> W:
        for e in self._list:
            if e.key == key:
                return e

        raise KeyError(key)


@dataclass(repr=False)
class Button(Widget):
    _value: bool

    proto: ButtonProto

    def __init__(self, proto: ButtonProto, root: ElementTree):
        self.proto = proto
        self.root = root
        self._value = False

        self.type = "button"
        self.id = proto.id
        self.label = proto.label
        self.help = proto.help
        self.form_id = proto.form_id
        self.disabled = proto.disabled
        self.key = user_key_from_widget_id(self.id)

    def widget_state(self) -> WidgetState:
        ws = WidgetState()
        ws.id = self.id
        ws.trigger_value = self._value
        return ws

    @property
    def value(self) -> bool:
        if self._value:
            return self._value
        else:
            state = self.root.session_state
            assert state
            return cast(bool, state[self.id])

    def set_value(self, v: bool) -> Button:
        self._value = v
        return self

    def click(self) -> Button:
        return self.set_value(True)


@dataclass(repr=False)
class Checkbox(Widget):
    _value: bool | None

    proto: CheckboxProto

    def __init__(self, proto: CheckboxProto, root: ElementTree):
        self.proto = proto
        self.root = root
        self._value = None

        self.type = "checkbox"
        self.id = proto.id
        self.label = proto.label
        self.help = proto.help
        self.form_id = proto.form_id
        self.disabled = proto.disabled
        self.key = user_key_from_widget_id(self.id)

    def widget_state(self) -> WidgetState:
        ws = WidgetState()
        ws.id = self.id
        ws.bool_value = self.value
        return ws

    @property
    def value(self) -> bool:
        if self._value is not None:
            return self._value
        else:
            state = self.root.session_state
            assert state
            return cast(bool, state[self.id])

    def set_value(self, v: bool) -> Checkbox:
        self._value = v
        return self

    def check(self) -> Checkbox:
        return self.set_value(True)

    def uncheck(self) -> Checkbox:
        return self.set_value(False)


@dataclass(repr=False)
class Code(Element):
    proto: CodeProto

    language: str
    show_line_numbers: bool
    key: None

    def __init__(self, proto: CodeProto, root: ElementTree):
        self.proto = proto
        self.key = None
        self.language = proto.language
        self.show_line_numbers = proto.show_line_numbers
        self.root = root
        self.type = "code"

    @property
    def value(self) -> str:
        return self.proto.code_text


@dataclass(repr=False)
class ColorPicker(Widget):
    _value: str | None

    proto: ColorPickerProto

    def __init__(self, proto: ColorPickerProto, root: ElementTree):
        self.proto = proto
        self.root = root
        self._value = None

        self.type = "color_picker"
        self.id = proto.id
        self.label = proto.label
        self.help = proto.help
        self.form_id = proto.form_id
        self.disabled = proto.disabled
        self.key = user_key_from_widget_id(self.id)

    @property
    def value(self) -> str:
        """The currently selected value from the options."""
        if self._value is not None:
            return self._value
        else:
            state = self.root.session_state
            assert state
            return cast(str, state[self.id])

    def widget_state(self) -> WidgetState:
        """Protobuf message representing the state of the widget, including
        any interactions that have happened.
        Should be the same as the frontend would produce for those interactions.
        """
        ws = WidgetState()
        ws.id = self.id
        ws.string_value = self.value
        return ws

    def set_value(self, v: str) -> ColorPicker:
        self._value = v
        return self

    def pick(self, v: str) -> ColorPicker:
        if not v.startswith("#"):
            v = f"#{v}"
        return self.set_value(v)


SingleDateValue: TypeAlias = Union[date, datetime]
DateValue: TypeAlias = Union[SingleDateValue, Sequence[SingleDateValue], None]


@dataclass(repr=False)
class DateInput(Widget):
    _value: DateValue | None | InitialValue
    proto: DateInputProto
    min: date
    max: date
    is_range: bool

    def __init__(self, proto: DateInputProto, root: ElementTree):
        self.proto = proto
        self.root = root
        self._value = InitialValue()

        self.type = "date_input"
        self.id = proto.id
        self.label = proto.label
        self.min = datetime.strptime(proto.min, "%Y/%m/%d").date()
        self.max = datetime.strptime(proto.max, "%Y/%m/%d").date()
        self.is_range = proto.is_range
        self.help = proto.help
        self.form_id = proto.form_id
        self.disabled = proto.disabled
        self.key = user_key_from_widget_id(self.id)

    def set_value(self, v: DateValue) -> DateInput:
        self._value = v
        return self

    def widget_state(self) -> WidgetState:
        ws = WidgetState()
        ws.id = self.id

        serde = DateInputSerde(None)  # type: ignore
        ws.string_array_value.data[:] = serde.serialize(self.value)
        return ws

    @property
    def value(self) -> DateWidgetReturn:
        if not isinstance(self._value, InitialValue):
            parsed, _ = _parse_date_value(self._value)
            return tuple(parsed) if parsed is not None else None  # type: ignore
        else:
            state = self.root.session_state
            assert state
            return state[self.id]  # type: ignore


@dataclass(repr=False)
class Exception(Element):
    message: str
    is_markdown: bool
    stack_trace: list[str]
    is_warning: bool

    def __init__(self, proto: ExceptionProto, root: ElementTree):
        self.key = None
        self.root = root
        self.proto = proto
        self.type = "exception"

        self.message = proto.message
        self.is_markdown = proto.message_is_markdown
        self.stack_trace = list(proto.stack_trace)
        self.is_warning = proto.is_warning

    @property
    def value(self) -> str:
        return self.message


@dataclass(repr=False)
class HeadingBase(Element, ABC):
    proto: HeadingProto

    tag: str
    anchor: str | None
    hide_anchor: bool
    key: None

    def __init__(self, proto: HeadingProto, root: ElementTree, type_: str):
        self.proto = proto
        self.key = None
        self.tag = proto.tag
        self.anchor = proto.anchor
        self.hide_anchor = proto.hide_anchor
        self.root = root
        self.type = type_

    @property
    def value(self) -> str:
        return self.proto.body


@dataclass(repr=False)
class Header(HeadingBase):
    def __init__(self, proto: HeadingProto, root: ElementTree):
        super().__init__(proto, root, "header")


@dataclass(repr=False)
class Subheader(HeadingBase):
    def __init__(self, proto: HeadingProto, root: ElementTree):
        super().__init__(proto, root, "subheader")


@dataclass(repr=False)
class Title(HeadingBase):
    def __init__(self, proto: HeadingProto, root: ElementTree):
        super().__init__(proto, root, "title")


@dataclass(repr=False)
class Markdown(Element):
    proto: MarkdownProto

    is_caption: bool
    allow_html: bool
    key: None

    def __init__(self, proto: MarkdownProto, root: ElementTree):
        self.proto = proto
        self.key = None
        self.is_caption = proto.is_caption
        self.allow_html = proto.allow_html
        self.root = root
        self.type = "markdown"

    @property
    def value(self) -> str:
        return self.proto.body


@dataclass(repr=False)
class Caption(Markdown):
    def __init__(self, proto: MarkdownProto, root: ElementTree):
        super().__init__(proto, root)
        self.type = "caption"


@dataclass(repr=False)
class Divider(Markdown):
    def __init__(self, proto: MarkdownProto, root: ElementTree):
        super().__init__(proto, root)
        self.type = "divider"


@dataclass(repr=False)
class Latex(Markdown):
    def __init__(self, proto: MarkdownProto, root: ElementTree):
        super().__init__(proto, root)
        self.type = "latex"


@dataclass(repr=False)
class Multiselect(Widget, Generic[T]):
    _value: list[T] | None

    proto: MultiSelectProto
    options: list[str]
    max_selections: int

    def __init__(self, proto: MultiSelectProto, root: ElementTree):
        self.proto = proto
        self.root = root
        self._value = None

        self.type = "multiselect"
        self.id = proto.id
        self.label = proto.label
        self.options = list(proto.options)
        self.help = proto.help
        self.form_id = proto.form_id
        self.disabled = proto.disabled
        self.max_selections = proto.max_selections
        self.key = user_key_from_widget_id(self.id)

    def widget_state(self) -> WidgetState:
        """Protobuf message representing the state of the widget, including
        any interactions that have happened.
        Should be the same as the frontend would produce for those interactions.
        """
        ws = WidgetState()
        ws.id = self.id
        ws.int_array_value.data[:] = self.indices
        return ws

    @property
    def value(self) -> list[T]:
        """The currently selected values from the options."""
        if self._value is not None:
            return self._value
        else:
            state = self.root.session_state
            assert state
            return cast(List[T], state[self.id])

    @property
    def indices(self) -> Sequence[int]:
        return [self.options.index(str(v)) for v in self.value]

    def set_value(self, v: list[T]) -> Multiselect[T]:
        """
        Set the value of the multiselect widget.
        Implementation note: set_value not work correctly if `format_func` is also
        passed to the multiselect. This is because we send options via proto with
        applied `format_func`, but keep original values in session state
        as widget value.
        """
        self._value = v
        return self

    def select(self, v: T) -> Multiselect[T]:
        current = self.value
        if v in current:
            return self
        else:
            new = current.copy()
            new.append(v)
            self.set_value(new)
            return self

    def unselect(self, v: T) -> Multiselect[T]:
        current = self.value
        if v not in current:
            return self
        else:
            new = current.copy()
            while v in new:
                new.remove(v)
            self.set_value(new)
            return self


Number = Union[int, float]


@dataclass(repr=False)
class NumberInput(Widget):
    _value: Number | None | InitialValue
    proto: NumberInputProto
    min_value: Number | None
    max_value: Number | None
    step: Number

    def __init__(self, proto: NumberInputProto, root: ElementTree):
        self.proto = proto
        self.root = root
        self._value = InitialValue()

        self.type = "number_input"
        self.id = proto.id
        self.label = proto.label
        self.min_value = proto.min if proto.has_min else None
        self.max_value = proto.max if proto.has_max else None
        self.step = proto.step
        self.help = proto.help
        self.form_id = proto.form_id
        self.disabled = proto.disabled
        self.key = user_key_from_widget_id(self.id)

    def set_value(self, v: Number | None) -> NumberInput:
        self._value = v
        return self

    def widget_state(self) -> WidgetState:
        ws = WidgetState()
        ws.id = self.id
        if self.value is not None:
            ws.double_value = self.value
        return ws

    @property
    def value(self) -> Number | None:
        if not isinstance(self._value, InitialValue):
            return self._value
        else:
            state = self.root.session_state
            assert state

            # Awkward to do this with `cast`
            return state[self.id]  # type: ignore

    def increment(self) -> NumberInput:
        if self.value is None:
            return self

        v = min(self.value + self.step, self.max_value or float("inf"))
        return self.set_value(v)

    def decrement(self) -> NumberInput:
        if self.value is None:
            return self

        v = max(self.value - self.step, self.min_value or float("-inf"))
        return self.set_value(v)


@dataclass(repr=False)
class Radio(Widget, Generic[T]):
    _value: T | None | InitialValue

    proto: RadioProto
    options: list[str]
    horizontal: bool

    def __init__(self, proto: RadioProto, root: ElementTree):
        self.proto = proto
        self.root = root
        self._value = InitialValue()

        self.type = "radio"
        self.id = proto.id
        self.label = proto.label
        self.options = list(proto.options)
        self.help = proto.help
        self.form_id = proto.form_id
        self.disabled = proto.disabled
        self.horizontal = proto.horizontal
        self.key = user_key_from_widget_id(self.id)

    @property
    def index(self) -> int | None:
        if self.value is None:
            return None
        return self.options.index(str(self.value))

    @property
    def value(self) -> T | None:
        """The currently selected value from the options."""
        if not isinstance(self._value, InitialValue):
            return self._value
        else:
            state = self.root.session_state
            assert state
            return cast(T, state[self.id])

    def set_value(self, v: T | None) -> Radio[T]:
        self._value = v
        return self

    def widget_state(self) -> WidgetState:
        """Protobuf message representing the state of the widget, including
        any interactions that have happened.
        Should be the same as the frontend would produce for those interactions.
        """
        ws = WidgetState()
        ws.id = self.id
        if self.index is not None:
            ws.int_value = self.index
        return ws


@dataclass(repr=False)
class Selectbox(Widget, Generic[T]):
    _value: T | None | InitialValue

    proto: SelectboxProto = field(repr=False)
    options: list[str]

    def __init__(self, proto: SelectboxProto, root: ElementTree):
        self.proto = proto
        self.root = root
        self._value = InitialValue()

        self.type = "selectbox"
        self.id = proto.id
        self.label = proto.label
        self.options = list(proto.options)
        self.help = proto.help
        self.form_id = proto.form_id
        self.disabled = proto.disabled
        self.key = user_key_from_widget_id(self.id)

    @property
    def index(self) -> int | None:
        if self.value is None:
            return None

        if len(self.options) == 0:
            return 0
        return self.options.index(str(self.value))

    @property
    def value(self) -> T | None:
        """The currently selected value from the options."""
        if not isinstance(self._value, InitialValue):
            return self._value
        else:
            state = self.root.session_state
            assert state
            return cast(T, state[self.id])

    def set_value(self, v: T | None) -> Selectbox[T]:
        """
        Set the value of the selectbox.
        Implementation note: set_value not work correctly if `format_func` is also
        passed to the selectbox. This is because we send options via proto with applied
        `format_func`, but keep original values in session state as widget value.
        """
        self._value = v
        return self

    def select(self, v: T | None) -> Selectbox[T]:
        return self.set_value(v)

    def select_index(self, index: int | None) -> Selectbox[T]:
        if index is None:
            return self.set_value(None)
        return self.set_value(cast(T, self.options[index]))

    def widget_state(self) -> WidgetState:
        """Protobuf message representing the state of the widget, including
        any interactions that have happened.
        Should be the same as the frontend would produce for those interactions.
        """
        ws = WidgetState()
        ws.id = self.id
        if self.index is not None:
            ws.int_value = self.index
        return ws


@dataclass(repr=False)
class SelectSlider(Widget, Generic[T]):
    _value: T | Sequence[T] | None

    proto: SliderProto
    data_type: SliderProto.DataType.ValueType
    options: list[str]

    def __init__(self, proto: SliderProto, root: ElementTree):
        self.proto = proto
        self.root = root
        self._value = None

        self.type = "select_slider"
        self.data_type = proto.data_type
        self.id = proto.id
        self.label = proto.label
        self.options = list(proto.options)
        self.help = proto.help
        self.form_id = proto.form_id
        self.disabled = proto.disabled
        self.key = user_key_from_widget_id(self.id)

    def set_value(self, v: T | Sequence[T]) -> SelectSlider[T]:
        self._value = v
        return self

    def widget_state(self) -> WidgetState:
        serde = SelectSliderSerde(self.options, [], False)
        v = serde.serialize(self.value)

        ws = WidgetState()
        ws.id = self.id
        ws.double_array_value.data[:] = v
        return ws

    @property
    def value(self) -> T | Sequence[T]:
        """The currently selected value or range."""
        if self._value is not None:
            return self._value
        else:
            state = self.root.session_state
            assert state
            # Awkward to do this with `cast`
            return state[self.id]  # type: ignore

    def set_range(self, lower: T, upper: T) -> SelectSlider[T]:
        return self.set_value([lower, upper])


@dataclass(repr=False)
class Slider(Widget, Generic[SliderScalarT]):
    _value: SliderScalarT | Sequence[SliderScalarT] | None

    proto: SliderProto
    data_type: SliderProto.DataType.ValueType
    min_value: SliderScalar
    max_value: SliderScalar
    step: Step

    def __init__(self, proto: SliderProto, root: ElementTree):
        self.proto = proto
        self.root = root
        self._value = None

        self.type = "slider"
        self.data_type = proto.data_type
        self.id = proto.id
        self.label = proto.label
        self.min_value = proto.min
        self.max_value = proto.max
        self.step = proto.step
        self.help = proto.help
        self.form_id = proto.form_id
        self.disabled = proto.disabled
        self.key = user_key_from_widget_id(self.id)

    def set_value(
        self, v: SliderScalarT | Sequence[SliderScalarT]
    ) -> Slider[SliderScalarT]:
        self._value = v
        return self

    def widget_state(self) -> WidgetState:
        data_type = self.proto.data_type
        serde = SliderSerde([], data_type, True, None)
        v = serde.serialize(self.value)

        ws = WidgetState()
        ws.id = self.id
        ws.double_array_value.data[:] = v
        return ws

    @property
    def value(self) -> SliderScalarT | Sequence[SliderScalarT]:
        """The currently selected value or range."""
        if self._value is not None:
            return self._value
        else:
            state = self.root.session_state
            assert state
            # Awkward to do this with `cast`
            return state[self.id]  # type: ignore

    def set_range(
        self, lower: SliderScalarT, upper: SliderScalarT
    ) -> Slider[SliderScalarT]:
        return self.set_value([lower, upper])


@dataclass(repr=False)
class Text(Element):
    proto: TextProto

    key: None = None

    def __init__(self, proto: TextProto, root: ElementTree):
        self.proto = proto
        self.root = root
        self.type = "text"

    @property
    def value(self) -> str:
        return self.proto.body


@dataclass(repr=False)
class TextArea(Widget):
    _value: str | None | InitialValue

    proto: TextAreaProto
    max_chars: int
    placeholder: str

    def __init__(self, proto: TextAreaProto, root: ElementTree):
        self.proto = proto
        self.root = root
        self._value = InitialValue()

        self.type = "text_area"
        self.id = proto.id
        self.label = proto.label
        self.max_chars = proto.max_chars
        self.help = proto.help
        self.form_id = proto.form_id
        self.placeholder = proto.placeholder
        self.disabled = proto.disabled
        self.key = user_key_from_widget_id(self.id)

    def set_value(self, v: str | None) -> TextArea:
        self._value = v
        return self

    def widget_state(self) -> WidgetState:
        ws = WidgetState()
        ws.id = self.id
        if self.value is not None:
            ws.string_value = self.value
        return ws

    @property
    def value(self) -> str | None:
        if not isinstance(self._value, InitialValue):
            return self._value
        else:
            state = self.root.session_state
            assert state
            # Awkward to do this with `cast`
            return state[self.id]  # type: ignore

    def input(self, v: str) -> TextArea:
        # TODO should input be setting or appending?
        if self.max_chars and len(v) > self.max_chars:
            return self
        return self.set_value(v)


@dataclass(repr=False)
class TextInput(Widget):
    _value: str | None | InitialValue
    proto: TextInputProto
    max_chars: int
    autocomplete: str
    placeholder: str

    def __init__(self, proto: TextInputProto, root: ElementTree):
        self.proto = proto
        self.root = root
        self._value = InitialValue()

        self.type = "text_input"
        self.id = proto.id
        self.label = proto.label
        self.max_chars = proto.max_chars
        self.help = proto.help
        self.form_id = proto.form_id
        self.autocomplete = proto.autocomplete
        self.placeholder = proto.placeholder
        self.disabled = proto.disabled
        self.key = user_key_from_widget_id(self.id)

    def set_value(self, v: str | None) -> TextInput:
        self._value = v
        return self

    def widget_state(self) -> WidgetState:
        ws = WidgetState()
        ws.id = self.id
        if self.value is not None:
            ws.string_value = self.value
        return ws

    @property
    def value(self) -> str | None:
        if not isinstance(self._value, InitialValue):
            return self._value
        else:
            state = self.root.session_state
            assert state
            # Awkward to do this with `cast`
            return state[self.id]  # type: ignore

    def input(self, v: str) -> TextInput:
        # TODO should input be setting or appending?
        if self.max_chars and len(v) > self.max_chars:
            return self
        return self.set_value(v)


TimeValue: TypeAlias = Union[time, datetime]


@dataclass(repr=False)
class TimeInput(Widget):
    _value: TimeValue | None | InitialValue
    proto: TimeInputProto
    step: int

    def __init__(self, proto: TimeInputProto, root: ElementTree):
        self.proto = proto
        self.root = root
        self._value = InitialValue()

        self.type = "time_input"
        self.id = proto.id
        self.label = proto.label
        self.step = proto.step
        self.help = proto.help
        self.form_id = proto.form_id
        self.disabled = proto.disabled
        self.key = user_key_from_widget_id(self.id)

    def set_value(self, v: TimeValue | None) -> TimeInput:
        self._value = v
        return self

    def widget_state(self) -> WidgetState:
        ws = WidgetState()
        ws.id = self.id

        serde = TimeInputSerde(None)
        serialized_value = serde.serialize(self.value)
        if serialized_value is not None:
            ws.string_value = serialized_value
        return ws

    @property
    def value(self) -> time | None:
        if not isinstance(self._value, InitialValue):
            v = self._value
            v = v.time() if isinstance(v, datetime) else v
            return v
        else:
            state = self.root.session_state
            assert state
            return state[self.id]  # type: ignore

    def increment(self) -> TimeInput:
        """Select the next available time."""
        if self.value is None:
            return self
        dt = datetime.combine(date.today(), self.value) + timedelta(seconds=self.step)
        return self.set_value(dt.time())

    def decrement(self) -> TimeInput:
        """Select the previous available time."""
        if self.value is None:
            return self
        dt = datetime.combine(date.today(), self.value) - timedelta(seconds=self.step)
        return self.set_value(dt.time())


@dataclass(repr=False)
class Block:
    type: str
    children: dict[int, Node]
    proto: BlockProto | None = field(repr=False)
    root: ElementTree = field(repr=False)

    def __init__(
        self,
        root: ElementTree,
        proto: BlockProto | None = None,
        type: str | None = None,
    ):
        self.children = {}
        self.proto = proto
        if proto:
            ty = proto.WhichOneof("type")
            # TODO does not work for `st.container` which has no block proto
            assert ty is not None
            self.type = ty
        elif type is not None:
            self.type = type
        else:
            self.type = ""
        self.root = root

    def __len__(self) -> int:
        return len(self.children)

    def __iter__(self):
        yield self
        for child_idx in self.children:
            for c in self.children[child_idx]:
                yield c

    def __getitem__(self, k: int) -> Node:
        return self.children[k]

    @property
    def key(self) -> str | None:
        return None

    # We could implement these using __getattr__ but that would have
    # much worse type information.
    @property
    def button(self) -> WidgetList[Button]:
        return WidgetList(self.get("button"))

    @property
    def caption(self) -> ElementList[Caption]:
        return ElementList(self.get("caption"))

    @property
    def checkbox(self) -> WidgetList[Checkbox]:
        return WidgetList(self.get("checkbox"))

    @property
    def code(self) -> ElementList[Code]:
        return ElementList(self.get("code"))

    @property
    def color_picker(self) -> WidgetList[ColorPicker]:
        return WidgetList(self.get("color_picker"))

    @property
    def date_input(self) -> WidgetList[DateInput]:
        return WidgetList(self.get("date_input"))

    @property
    def divider(self) -> ElementList[Divider]:
        return ElementList(self.get("divider"))

    @property
    def exception(self) -> ElementList[Exception]:
        return ElementList(self.get("exception"))

    @property
    def header(self) -> ElementList[Header]:
        return ElementList(self.get("header"))

    @property
    def latex(self) -> ElementList[Latex]:
        return ElementList(self.get("latex"))

    @property
    def markdown(self) -> ElementList[Markdown]:
        return ElementList(self.get("markdown"))

    @property
    def multiselect(self) -> WidgetList[Multiselect[Any]]:
        return WidgetList(self.get("multiselect"))

    @property
    def number_input(self) -> WidgetList[NumberInput]:
        return WidgetList(self.get("number_input"))

    @property
    def radio(self) -> WidgetList[Radio[Any]]:
        return WidgetList(self.get("radio"))

    @property
    def select_slider(self) -> WidgetList[SelectSlider[Any]]:
        return WidgetList(self.get("select_slider"))

    @property
    def selectbox(self) -> WidgetList[Selectbox[Any]]:
        return WidgetList(self.get("selectbox"))

    @property
    def slider(self) -> WidgetList[Slider[Any]]:
        return WidgetList(self.get("slider"))

    @property
    def subheader(self) -> ElementList[Subheader]:
        return ElementList(self.get("subheader"))

    @property
    def text(self) -> ElementList[Text]:
        return ElementList(self.get("text"))

    @property
    def text_area(self) -> WidgetList[TextArea]:
        return WidgetList(self.get("text_area"))

    @property
    def text_input(self) -> WidgetList[TextInput]:
        return WidgetList(self.get("text_input"))

    @property
    def time_input(self) -> WidgetList[TimeInput]:
        return WidgetList(self.get("time_input"))

    @property
    def title(self) -> ElementList[Title]:
        return ElementList(self.get("title"))

    # These overloads improve type information for code calling `get`
    @overload
    def get(self, element_type: Literal["button"]) -> Sequence[Button]:
        ...

    @overload
    def get(self, element_type: Literal["caption"]) -> Sequence[Caption]:
        ...

    @overload
    def get(self, element_type: Literal["checkbox"]) -> Sequence[Checkbox]:
        ...

    @overload
    def get(self, element_type: Literal["code"]) -> Sequence[Code]:
        ...

    @overload
    def get(self, element_type: Literal["color_picker"]) -> Sequence[ColorPicker]:
        ...

    @overload
    def get(self, element_type: Literal["date_input"]) -> Sequence[DateInput]:
        ...

    @overload
    def get(self, element_type: Literal["divider"]) -> Sequence[Divider]:
        ...

    @overload
    def get(self, element_type: Literal["exception"]) -> Sequence[Exception]:
        ...

    @overload
    def get(self, element_type: Literal["header"]) -> Sequence[Header]:
        ...

    @overload
    def get(self, element_type: Literal["latex"]) -> Sequence[Latex]:
        ...

    @overload
    def get(self, element_type: Literal["markdown"]) -> Sequence[Markdown]:
        ...

    @overload
    def get(self, element_type: Literal["multiselect"]) -> Sequence[Multiselect[Any]]:
        ...

    @overload
    def get(self, element_type: Literal["number_input"]) -> Sequence[NumberInput]:
        ...

    @overload
    def get(self, element_type: Literal["radio"]) -> Sequence[Radio[Any]]:
        ...

    @overload
    def get(
        self, element_type: Literal["select_slider"]
    ) -> Sequence[SelectSlider[Any]]:
        ...

    @overload
    def get(self, element_type: Literal["selectbox"]) -> Sequence[Selectbox[Any]]:
        ...

    @overload
    def get(self, element_type: Literal["slider"]) -> Sequence[Slider[Any]]:
        ...

    @overload
    def get(self, element_type: Literal["subheader"]) -> Sequence[Subheader]:
        ...

    @overload
    def get(self, element_type: Literal["text"]) -> Sequence[Text]:
        ...

    @overload
    def get(self, element_type: Literal["text_area"]) -> Sequence[TextArea]:
        ...

    @overload
    def get(self, element_type: Literal["text_input"]) -> Sequence[TextInput]:
        ...

    @overload
    def get(self, element_type: Literal["time_input"]) -> Sequence[TimeInput]:
        ...

    @overload
    def get(self, element_type: Literal["title"]) -> Sequence[Title]:
        ...

    def get(self, element_type: str) -> Sequence[Node]:
        return [e for e in self if e.type == element_type]

    def get_widget(self, key: str) -> Widget:
        for e in self:
            if e.key == key:
                assert isinstance(e, Widget)
                return e

        raise KeyError(key)

    def widget_state(self) -> WidgetState | None:
        return None

    def run(self, timeout: float | None = None) -> ElementTree:
        """Run the script with updated widget values.
        Timeout is a number of seconds, or None to use the default.
        """
        return self.root.run(timeout=timeout)

    def __repr__(self):
        return util.repr_(self)


Node: TypeAlias = Union[Element, Block]


@dataclass(repr=False)
class ElementTree(Block):
    """A tree of the elements produced by running a streamlit script.

    This acts as the initial entrypoint for querying the produced elements,
    and interacting with widgets.

    Elements can be queried in three ways:
    - By element type, using `.get(...)` to get a list of all of that element,
    in the order they appear in the app
    - By user key, for widgets, using `.get_widget(...)` to get that widget node
    - Positionally, using list indexing syntax (`[...]`) to access a child of a
    block element. Not recommended because the exact tree structure can be surprising.

    Element queries made on a block will return only the elements descending
    from that block.

    Returned elements have methods for accessing whatever attributes are relevant.
    For very simple elements this may be only its value, while complex elements
    like widgets have many.

    Widgets provide a fluent API for faking frontend interaction and rerunning
    the script with the new widget values. All widgets provide a low level `set_value`
    method, along with higher level methods specific to that type of widget.
    After an interaction, calling `.run()` will return the ElementTree for
    the rerun.
    """

    script_path: str | None = field(repr=False, default=None)
    _session_state: SessionState | None = field(repr=False, default=None)
    _default_timeout: float = field(repr=False, default=3)

    def __init__(self):
        # Expect script_path and session_state to be filled in afterwards
        self.children = {}
        self.root = self
        self.type = "root"

    @property
    def main(self) -> Block:
        m = self[0]
        assert isinstance(m, Block)
        return m

    @property
    def sidebar(self) -> Block:
        s = self[1]
        assert isinstance(s, Block)
        return s

    @property
    def session_state(self) -> SessionState:
        assert self._session_state is not None
        return self._session_state

    def get_widget_states(self) -> WidgetStates:
        ws = WidgetStates()
        for node in self:
            w = node.widget_state()
            if w is not None:
                ws.widgets.append(w)

        return ws

    def run(self, timeout: float | None = None) -> ElementTree:
        """Run the script with updated widget values.
        Timeout is a number of seconds, or None to use the default.
        """
        assert self.script_path is not None
        from streamlit.testing.local_script_runner import LocalScriptRunner

        widget_states = self.get_widget_states()
        runner = LocalScriptRunner(
            self.script_path, self.session_state, default_timeout=self._default_timeout
        )
        return runner.run(widget_states, timeout=timeout)


def parse_tree_from_messages(messages: list[ForwardMsg]) -> ElementTree:
    """Transform a list of `ForwardMsg` into a tree matching the implicit
    tree structure of blocks and elements in a streamlit app.

    Returns the root of the tree, which acts as the entrypoint for the query
    and interaction API.
    """
    root = ElementTree()
    root.children = {
        0: Block(type="main", root=root),
        1: Block(type="sidebar", root=root),
    }

    for msg in messages:
        if not msg.HasField("delta"):
            continue
        delta_path = msg.metadata.delta_path
        delta = msg.delta
        if delta.WhichOneof("type") == "new_element":
            elt = delta.new_element
            ty = elt.WhichOneof("type")
            new_node: Node
            if ty == "button":
                new_node = Button(elt.button, root=root)
            elif ty == "checkbox":
                new_node = Checkbox(elt.checkbox, root=root)
            elif ty == "code":
                new_node = Code(elt.code, root=root)
            elif ty == "color_picker":
                new_node = ColorPicker(elt.color_picker, root=root)
            elif ty == "date_input":
                new_node = DateInput(elt.date_input, root=root)
            elif ty == "exception":
                new_node = Exception(elt.exception, root=root)
            elif ty == "heading":
                if elt.heading.tag == HeadingProtoTag.TITLE_TAG.value:
                    new_node = Title(elt.heading, root=root)
                elif elt.heading.tag == HeadingProtoTag.HEADER_TAG.value:
                    new_node = Header(elt.heading, root=root)
                elif elt.heading.tag == HeadingProtoTag.SUBHEADER_TAG.value:
                    new_node = Subheader(elt.heading, root=root)
                else:
                    raise ValueError(f"Unknown heading type with tag {elt.heading.tag}")
            elif ty == "markdown":
                if elt.markdown.element_type == MarkdownProto.Type.NATIVE:
                    new_node = Markdown(elt.markdown, root=root)
                elif elt.markdown.element_type == MarkdownProto.Type.CAPTION:
                    new_node = Caption(elt.markdown, root=root)
                elif elt.markdown.element_type == MarkdownProto.Type.LATEX:
                    new_node = Latex(elt.markdown, root=root)
                elif elt.markdown.element_type == MarkdownProto.Type.DIVIDER:
                    new_node = Divider(elt.markdown, root=root)
                else:
                    raise ValueError(
                        f"Unknown markdown type {elt.markdown.element_type}"
                    )
            elif ty == "multiselect":
                new_node = Multiselect(elt.multiselect, root=root)
            elif ty == "number_input":
                new_node = NumberInput(elt.number_input, root=root)
            elif ty == "radio":
                new_node = Radio(elt.radio, root=root)
            elif ty == "selectbox":
                new_node = Selectbox(elt.selectbox, root=root)
            elif ty == "slider":
                if elt.slider.type == SliderProto.Type.SLIDER:
                    new_node = Slider(elt.slider, root=root)
                elif elt.slider.type == SliderProto.Type.SELECT_SLIDER:
                    new_node = SelectSlider(elt.slider, root=root)
                else:
                    raise ValueError(f"Slider with unknown type {elt.slider}")
            elif ty == "text":
                new_node = Text(elt.text, root=root)
            elif ty == "text_area":
                new_node = TextArea(elt.text_area, root=root)
            elif ty == "text_input":
                new_node = TextInput(elt.text_input, root=root)
            elif ty == "time_input":
                new_node = TimeInput(elt.time_input, root=root)
            else:
                new_node = Element(elt, root=root)
        elif delta.WhichOneof("type") == "add_block":
            new_node = Block(proto=delta.add_block, root=root)
        else:
            # add_rows
            continue

        current_node: Block = root
        # Every node up to the end is a Block
        for idx in delta_path[:-1]:
            children = current_node.children
            child = children.get(idx)
            if child is None:
                child = Block(root=root)
                children[idx] = child
            assert isinstance(child, Block)
            current_node = child
        current_node.children[delta_path[-1]] = new_node

    return root

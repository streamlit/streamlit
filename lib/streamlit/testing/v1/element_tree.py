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

# Assert statements are allowed here since the app testing logic is used within unit tests:
# ruff: noqa: S101

from __future__ import annotations

import textwrap
from abc import ABC, abstractmethod
from collections.abc import Iterator, Sequence
from dataclasses import dataclass, field, fields, is_dataclass
from datetime import date, datetime, time, timedelta
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Generic,
    TypeVar,
    Union,
    cast,
    overload,
)

from typing_extensions import Self, TypeAlias

from streamlit import dataframe_util, util
from streamlit.elements.heading import HeadingProtoTag
from streamlit.elements.widgets.select_slider import SelectSliderSerde
from streamlit.elements.widgets.slider import (
    SliderSerde,
    SliderStep,
    SliderValueT,
)
from streamlit.elements.widgets.time_widgets import (
    DateInputSerde,
    DateWidgetReturn,
    TimeInputSerde,
    _parse_date_value,
)
from streamlit.proto.Alert_pb2 import Alert as AlertProto
from streamlit.proto.Checkbox_pb2 import Checkbox as CheckboxProto
from streamlit.proto.Markdown_pb2 import Markdown as MarkdownProto
from streamlit.proto.Slider_pb2 import Slider as SliderProto
from streamlit.proto.WidgetStates_pb2 import WidgetState, WidgetStates
from streamlit.runtime.state.common import TESTING_KEY, user_key_from_element_id

if TYPE_CHECKING:
    from pandas import DataFrame as PandasDataframe

    from streamlit.proto.Arrow_pb2 import Arrow as ArrowProto
    from streamlit.proto.Block_pb2 import Block as BlockProto
    from streamlit.proto.Button_pb2 import Button as ButtonProto
    from streamlit.proto.ButtonGroup_pb2 import ButtonGroup as ButtonGroupProto
    from streamlit.proto.ChatInput_pb2 import ChatInput as ChatInputProto
    from streamlit.proto.Code_pb2 import Code as CodeProto
    from streamlit.proto.ColorPicker_pb2 import ColorPicker as ColorPickerProto
    from streamlit.proto.DateInput_pb2 import DateInput as DateInputProto
    from streamlit.proto.Element_pb2 import Element as ElementProto
    from streamlit.proto.Exception_pb2 import Exception as ExceptionProto
    from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
    from streamlit.proto.Heading_pb2 import Heading as HeadingProto
    from streamlit.proto.Json_pb2 import Json as JsonProto
    from streamlit.proto.Metric_pb2 import Metric as MetricProto
    from streamlit.proto.MultiSelect_pb2 import MultiSelect as MultiSelectProto
    from streamlit.proto.NumberInput_pb2 import NumberInput as NumberInputProto
    from streamlit.proto.Radio_pb2 import Radio as RadioProto
    from streamlit.proto.Selectbox_pb2 import Selectbox as SelectboxProto
    from streamlit.proto.Text_pb2 import Text as TextProto
    from streamlit.proto.TextArea_pb2 import TextArea as TextAreaProto
    from streamlit.proto.TextInput_pb2 import TextInput as TextInputProto
    from streamlit.proto.TimeInput_pb2 import TimeInput as TimeInputProto
    from streamlit.proto.Toast_pb2 import Toast as ToastProto
    from streamlit.runtime.state.safe_session_state import SafeSessionState
    from streamlit.testing.v1.app_test import AppTest

T = TypeVar("T")


@dataclass
class InitialValue:
    """Used to represent the initial value of a widget."""

    pass


# TODO: This class serves as a fallback option for elements that have not
# been implemented yet, as well as providing implementations of some
# trivial methods. It may have significantly reduced scope once all elements
# have been implemented.
# This class will not be sufficient implementation for most elements.
# Widgets need their own classes to translate interactions into the appropriate
# WidgetState and provide higher level interaction interfaces, and other elements
# have enough variation in how to get their values that most will need their
# own classes too.
@dataclass
class Element(ABC):
    """
    Element base class for testing.

    This class's methods and attributes are universal for all elements
    implemented in testing. For example, ``Caption``, ``Code``, ``Text``, and
    ``Title`` inherit from ``Element``. All widget classes also
    inherit from Element, but have additional methods specific to each
    widget type. See the ``AppTest`` class for the full list of supported
    elements.

    For all element classes, parameters of the original element can be obtained
    as properties. For example, ``Button.label``, ``Caption.help``, and
    ``Toast.icon``.

    """

    type: str = field(repr=False)
    proto: Any = field(repr=False)
    root: ElementTree = field(repr=False)
    key: str | None

    @abstractmethod
    def __init__(self, proto: ElementProto, root: ElementTree) -> None: ...

    def __iter__(self) -> Iterator[Self]:
        yield self

    @property
    @abstractmethod
    def value(self) -> Any:
        """The value or contents of the element."""
        ...

    def __getattr__(self, name: str) -> Any:
        """Fallback attempt to get an attribute from the proto."""
        return getattr(self.proto, name)

    def run(self, *, timeout: float | None = None) -> AppTest:
        """Run the ``AppTest`` script which contains the element.

        Parameters
        ----------
        timeout
            The maximum number of seconds to run the script. None means
            use the AppTest's default.
        """
        return self.root.run(timeout=timeout)

    def __repr__(self) -> str:
        return util.repr_(self)


@dataclass(repr=False)
class UnknownElement(Element):
    def __init__(self, proto: ElementProto, root: ElementTree) -> None:
        ty = proto.WhichOneof("type")
        assert ty is not None
        self.proto = getattr(proto, ty)
        self.root = root
        self.type = ty
        self.key = None

    @property
    def value(self) -> Any:
        try:
            state = self.root.session_state
            assert state is not None
            return state[self.proto.id]
        except ValueError:
            # No id field, not a widget
            return self.proto.value


@dataclass(repr=False)
class Widget(Element, ABC):
    """Widget base class for testing."""

    id: str = field(repr=False)
    disabled: bool
    key: str | None
    _value: Any

    def __init__(self, proto: Any, root: ElementTree) -> None:
        self.proto = proto
        self.root = root
        self.key = user_key_from_element_id(self.id)
        self._value = None

    def set_value(self, v: Any) -> Self:
        """Set the value of the widget."""
        self._value = v
        return self

    @property
    @abstractmethod
    def _widget_state(self) -> WidgetState: ...


El_co = TypeVar("El_co", bound=Element, covariant=True)


class ElementList(Generic[El_co]):
    def __init__(self, els: Sequence[El_co]) -> None:
        self._list: Sequence[El_co] = els

    def __len__(self) -> int:
        return len(self._list)

    @property
    def len(self) -> int:
        return len(self)

    @overload
    def __getitem__(self, idx: int) -> El_co: ...

    @overload
    def __getitem__(self, idx: slice) -> ElementList[El_co]: ...

    def __getitem__(self, idx: int | slice) -> El_co | ElementList[El_co]:
        if isinstance(idx, slice):
            return ElementList(self._list[idx])
        return self._list[idx]

    def __iter__(self) -> Iterator[El_co]:
        yield from self._list

    def __repr__(self) -> str:
        return util.repr_(self)

    def __eq__(self, other: ElementList[El_co] | object) -> bool:
        if isinstance(other, ElementList):
            return self._list == other._list
        return self._list == other

    @property
    def values(self) -> Sequence[Any]:
        return [e.value for e in self]


W_co = TypeVar("W_co", bound=Widget, covariant=True)


class WidgetList(ElementList[W_co], Generic[W_co]):
    def __call__(self, key: str) -> W_co:
        for e in self._list:
            if e.key == key:
                return e

        raise KeyError(key)


@dataclass(repr=False)
class AlertBase(Element):
    proto: AlertProto = field(repr=False)
    icon: str

    def __init__(self, proto: AlertProto, root: ElementTree) -> None:
        self.proto = proto
        self.key = None
        self.root = root

    @property
    def value(self) -> str:
        return self.proto.body


@dataclass(repr=False)
class Error(AlertBase):
    def __init__(self, proto: AlertProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self.type = "error"


@dataclass(repr=False)
class Warning(AlertBase):  # noqa: A001
    def __init__(self, proto: AlertProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self.type = "warning"


@dataclass(repr=False)
class Info(AlertBase):
    def __init__(self, proto: AlertProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self.type = "info"


@dataclass(repr=False)
class Success(AlertBase):
    def __init__(self, proto: AlertProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self.type = "success"


@dataclass(repr=False)
class Button(Widget):
    """A representation of ``st.button`` and ``st.form_submit_button``."""

    _value: bool

    proto: ButtonProto = field(repr=False)
    label: str
    help: str
    form_id: str

    def __init__(self, proto: ButtonProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self._value = False
        self.type = "button"

    @property
    def _widget_state(self) -> WidgetState:
        ws = WidgetState()
        ws.id = self.id
        ws.trigger_value = self._value
        return ws

    @property
    def value(self) -> bool:
        """The value of the button. (bool)"""  # noqa: D400
        if self._value:
            return self._value
        state = self.root.session_state
        assert state
        return cast("bool", state[TESTING_KEY][self.id])

    def set_value(self, v: bool) -> Button:
        """Set the value of the button."""
        self._value = v
        return self

    def click(self) -> Button:
        """Set the value of the button to True."""
        return self.set_value(True)


@dataclass(repr=False)
class ChatInput(Widget):
    """A representation of ``st.chat_input``."""

    _value: str | None
    proto: ChatInputProto = field(repr=False)
    placeholder: str

    def __init__(self, proto: ChatInputProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self.type = "chat_input"

    def set_value(self, v: str | None) -> ChatInput:
        """Set the value of the widget."""
        self._value = v
        return self

    @property
    def _widget_state(self) -> WidgetState:
        ws = WidgetState()
        ws.id = self.id
        if self._value is not None:
            ws.string_trigger_value.data = self._value
        return ws

    @property
    def value(self) -> str | None:
        """The value of the widget. (str)"""  # noqa: D400
        if self._value:
            return self._value
        state = self.root.session_state
        assert state
        return state[TESTING_KEY][self.id]  # type: ignore


@dataclass(repr=False)
class Checkbox(Widget):
    """A representation of ``st.checkbox``."""

    _value: bool | None

    proto: CheckboxProto = field(repr=False)
    label: str
    help: str
    form_id: str

    def __init__(self, proto: CheckboxProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self.type = "checkbox"

    @property
    def _widget_state(self) -> WidgetState:
        ws = WidgetState()
        ws.id = self.id
        ws.bool_value = self.value
        return ws

    @property
    def value(self) -> bool:
        """The value of the widget. (bool)"""  # noqa: D400
        if self._value is not None:
            return self._value
        state = self.root.session_state
        assert state
        return cast("bool", state[self.id])

    def set_value(self, v: bool) -> Checkbox:
        """Set the value of the widget."""
        self._value = v
        return self

    def check(self) -> Checkbox:
        """Set the value of the widget to True."""
        return self.set_value(True)

    def uncheck(self) -> Checkbox:
        """Set the value of the widget to False."""
        return self.set_value(False)


@dataclass(repr=False)
class Code(Element):
    """A representation of ``st.code``."""

    proto: CodeProto = field(repr=False)

    language: str
    show_line_numbers: bool
    key: None

    def __init__(self, proto: CodeProto, root: ElementTree) -> None:
        self.proto = proto
        self.key = None
        self.root = root
        self.type = "code"

    @property
    def value(self) -> str:
        """The value of the element. (str)"""  # noqa: D400
        return self.proto.code_text


@dataclass(repr=False)
class ColorPicker(Widget):
    """A representation of ``st.color_picker``."""

    _value: str | None
    label: str
    help: str
    form_id: str

    proto: ColorPickerProto = field(repr=False)

    def __init__(self, proto: ColorPickerProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self.type = "color_picker"

    @property
    def value(self) -> str:
        """The currently selected value as a hex string. (str)"""  # noqa: D400
        if self._value is not None:
            return self._value
        state = self.root.session_state
        assert state
        return cast("str", state[self.id])

    @property
    def _widget_state(self) -> WidgetState:
        """Protobuf message representing the state of the widget, including
        any interactions that have happened.
        Should be the same as the frontend would produce for those interactions.
        """
        ws = WidgetState()
        ws.id = self.id
        ws.string_value = self.value
        return ws

    def set_value(self, v: str) -> ColorPicker:
        """Set the value of the widget as a hex string."""
        self._value = v
        return self

    def pick(self, v: str) -> ColorPicker:
        """Set the value of the widget as a hex string. May omit the "#" prefix."""
        if not v.startswith("#"):
            v = f"#{v}"
        return self.set_value(v)


@dataclass(repr=False)
class Dataframe(Element):
    proto: ArrowProto = field(repr=False)

    def __init__(self, proto: ArrowProto, root: ElementTree) -> None:
        self.key = None
        self.proto = proto
        self.root = root
        self.type = "arrow_data_frame"

    @property
    def value(self) -> PandasDataframe:
        return dataframe_util.convert_arrow_bytes_to_pandas_df(self.proto.data)


SingleDateValue: TypeAlias = Union[date, datetime]
DateValue: TypeAlias = Union[SingleDateValue, Sequence[SingleDateValue], None]


@dataclass(repr=False)
class DateInput(Widget):
    """A representation of ``st.date_input``."""

    _value: DateValue | None | InitialValue
    proto: DateInputProto = field(repr=False)
    label: str
    min: date
    max: date
    is_range: bool
    help: str
    form_id: str

    def __init__(self, proto: DateInputProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self._value = InitialValue()
        self.type = "date_input"
        self.min = datetime.strptime(proto.min, "%Y/%m/%d").date()
        self.max = datetime.strptime(proto.max, "%Y/%m/%d").date()

    def set_value(self, v: DateValue) -> DateInput:
        """Set the value of the widget."""
        self._value = v
        return self

    @property
    def _widget_state(self) -> WidgetState:
        ws = WidgetState()
        ws.id = self.id

        serde = DateInputSerde(None)  # type: ignore
        ws.string_array_value.data[:] = serde.serialize(self.value)
        return ws

    @property
    def value(self) -> DateWidgetReturn:
        """The value of the widget. (date or Tuple of date)"""  # noqa: D400
        if not isinstance(self._value, InitialValue):
            parsed, _ = _parse_date_value(self._value)
            return tuple(parsed) if parsed is not None else None  # type: ignore
        state = self.root.session_state
        assert state
        return state[self.id]  # type: ignore


@dataclass(repr=False)
class Exception(Element):  # noqa: A001
    message: str
    is_markdown: bool
    stack_trace: list[str]
    is_warning: bool

    def __init__(self, proto: ExceptionProto, root: ElementTree) -> None:
        self.key = None
        self.root = root
        self.proto = proto
        self.type = "exception"

        self.is_markdown = proto.message_is_markdown
        self.stack_trace = list(proto.stack_trace)

    @property
    def value(self) -> str:
        return self.message


@dataclass(repr=False)
class HeadingBase(Element, ABC):
    proto: HeadingProto = field(repr=False)

    tag: str
    anchor: str | None
    hide_anchor: bool
    key: None

    def __init__(self, proto: HeadingProto, root: ElementTree, type_: str) -> None:
        self.proto = proto
        self.key = None
        self.root = root
        self.type = type_

    @property
    def value(self) -> str:
        return self.proto.body


@dataclass(repr=False)
class Header(HeadingBase):
    def __init__(self, proto: HeadingProto, root: ElementTree) -> None:
        super().__init__(proto, root, "header")


@dataclass(repr=False)
class Subheader(HeadingBase):
    def __init__(self, proto: HeadingProto, root: ElementTree) -> None:
        super().__init__(proto, root, "subheader")


@dataclass(repr=False)
class Title(HeadingBase):
    def __init__(self, proto: HeadingProto, root: ElementTree) -> None:
        super().__init__(proto, root, "title")


@dataclass(repr=False)
class Json(Element):
    proto: JsonProto = field(repr=False)

    expanded: bool

    def __init__(self, proto: JsonProto, root: ElementTree) -> None:
        self.proto = proto
        self.key = None
        self.root = root
        self.type = "json"

    @property
    def value(self) -> str:
        return self.proto.body


@dataclass(repr=False)
class Markdown(Element):
    proto: MarkdownProto = field(repr=False)

    is_caption: bool
    allow_html: bool
    key: None

    def __init__(self, proto: MarkdownProto, root: ElementTree) -> None:
        self.proto = proto
        self.key = None
        self.root = root
        self.type = "markdown"

    @property
    def value(self) -> str:
        return self.proto.body


@dataclass(repr=False)
class Caption(Markdown):
    def __init__(self, proto: MarkdownProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self.type = "caption"


@dataclass(repr=False)
class Divider(Markdown):
    def __init__(self, proto: MarkdownProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self.type = "divider"


@dataclass(repr=False)
class Latex(Markdown):
    def __init__(self, proto: MarkdownProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self.type = "latex"


@dataclass(repr=False)
class Metric(Element):
    proto: MetricProto
    label: str
    delta: str
    color: str
    help: str

    def __init__(self, proto: MetricProto, root: ElementTree) -> None:
        self.proto = proto
        self.key = None
        self.root = root
        self.type = "metric"

    @property
    def value(self) -> str:
        return self.proto.body


@dataclass(repr=False)
class ButtonGroup(Widget, Generic[T]):
    """A representation of button_group that is used by ``st.feedback``."""

    _value: list[T] | None

    proto: ButtonGroupProto = field(repr=False)
    options: list[ButtonGroupProto.Option]
    form_id: str

    def __init__(self, proto: ButtonGroupProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self.type = "button_group"
        self.options = list(proto.options)

    @property
    def _widget_state(self) -> WidgetState:
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
        """The currently selected values from the options. (list)"""  # noqa: D400
        if self._value is not None:
            return self._value
        state = self.root.session_state
        assert state
        return cast("list[T]", state[self.id])

    @property
    def indices(self) -> Sequence[int]:
        """The indices of the currently selected values from the options. (list)"""  # noqa: D400
        return [self.options.index(self.format_func(v)) for v in self.value]

    @property
    def format_func(self) -> Callable[[Any], Any]:
        """The widget's formatting function for displaying options. (callable)"""  # noqa: D400
        ss = self.root.session_state
        return cast("Callable[[Any], Any]", ss[TESTING_KEY][self.id])

    def set_value(self, v: list[T]) -> ButtonGroup[T]:
        """Set the value of the multiselect widget. (list)"""  # noqa: D400

        self._value = v
        return self

    def select(self, v: T) -> ButtonGroup[T]:
        """
        Add a selection to the widget. Do nothing if the value is already selected.\
        If testing a multiselect widget with repeated options, use ``set_value``\
        instead.
        """
        current = self.value
        if v in current:
            return self
        new = current.copy()
        new.append(v)
        self.set_value(new)
        return self

    def unselect(self, v: T) -> ButtonGroup[T]:
        """
        Remove a selection from the widget. Do nothing if the value is not\
        already selected. If a value is selected multiple times, the first\
        instance is removed.
        """
        current = self.value
        if v not in current:
            return self
        new = current.copy()
        while v in new:
            new.remove(v)
        self.set_value(new)
        return self


@dataclass(repr=False)
class Multiselect(Widget, Generic[T]):
    """A representation of ``st.multiselect``."""

    _value: list[T] | None

    proto: MultiSelectProto = field(repr=False)
    label: str
    options: list[str]
    max_selections: int
    help: str
    form_id: str

    def __init__(self, proto: MultiSelectProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self.type = "multiselect"
        self.options = list(proto.options)

    @property
    def _widget_state(self) -> WidgetState:
        """Protobuf message representing the state of the widget, including
        any interactions that have happened.
        Should be the same as the frontend would produce for those interactions.
        """
        ws = WidgetState()
        ws.id = self.id
        ws.string_array_value.data[:] = self.values
        return ws

    @property
    def value(self) -> list[T]:
        """The currently selected values from the options. (list)"""  # noqa: D400
        if self._value is not None:
            return self._value
        state = self.root.session_state
        assert state
        return cast("list[T]", state[self.id])

    @property
    def indices(self) -> Sequence[int]:
        """The indices of the currently selected values from the options. (list)"""  # noqa: D400
        return [self.options.index(self.format_func(v)) for v in self.value]

    @property
    def values(self) -> Sequence[str]:
        """The currently selected values from the options. (list)"""  # noqa: D400
        return [self.format_func(v) for v in self.value]

    @property
    def format_func(self) -> Callable[[Any], Any]:
        """The widget's formatting function for displaying options. (callable)"""  # noqa: D400
        ss = self.root.session_state
        return cast("Callable[[Any], Any]", ss[TESTING_KEY][self.id])

    def set_value(self, v: list[T]) -> Multiselect[T]:
        """Set the value of the multiselect widget. (list)"""  # noqa: D400

        self._value = v
        return self

    def select(self, v: T) -> Multiselect[T]:
        """
        Add a selection to the widget. Do nothing if the value is already selected.\
        If testing a multiselect widget with repeated options, use ``set_value``\
        instead.
        """
        current = self.value
        if v in current:
            return self
        new = current.copy()
        new.append(v)
        self.set_value(new)
        return self

    def unselect(self, v: T) -> Multiselect[T]:
        """
        Remove a selection from the widget. Do nothing if the value is not\
        already selected. If a value is selected multiple times, the first\
        instance is removed.
        """
        current = self.value
        if v not in current:
            return self
        new = current.copy()
        while v in new:
            new.remove(v)
        self.set_value(new)
        return self


Number = Union[int, float]


@dataclass(repr=False)
class NumberInput(Widget):
    """A representation of ``st.number_input``."""

    _value: Number | None | InitialValue
    proto: NumberInputProto = field(repr=False)
    label: str
    min: Number | None
    max: Number | None
    step: Number
    help: str
    form_id: str

    def __init__(self, proto: NumberInputProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self._value = InitialValue()
        self.type = "number_input"
        self.min = proto.min if proto.has_min else None
        self.max = proto.max if proto.has_max else None

    def set_value(self, v: Number | None) -> NumberInput:
        """Set the value of the ``st.number_input`` widget."""
        self._value = v
        return self

    @property
    def _widget_state(self) -> WidgetState:
        ws = WidgetState()
        ws.id = self.id
        if self.value is not None:
            ws.double_value = self.value
        return ws

    @property
    def value(self) -> Number | None:
        """Get the current value of the ``st.number_input`` widget."""
        if not isinstance(self._value, InitialValue):
            return self._value
        state = self.root.session_state
        assert state

        # Awkward to do this with `cast`
        return state[self.id]  # type: ignore

    def increment(self) -> NumberInput:
        """Increment the ``st.number_input`` widget as if the user clicked "+"."""
        if self.value is None:
            return self

        v = min(self.value + self.step, self.max or float("inf"))
        return self.set_value(v)

    def decrement(self) -> NumberInput:
        """Decrement the ``st.number_input`` widget as if the user clicked "-"."""
        if self.value is None:
            return self

        v = max(self.value - self.step, self.min or float("-inf"))
        return self.set_value(v)


@dataclass(repr=False)
class Radio(Widget, Generic[T]):
    """A representation of ``st.radio``."""

    _value: T | None | InitialValue

    proto: RadioProto = field(repr=False)
    label: str
    options: list[str]
    horizontal: bool
    help: str
    form_id: str

    def __init__(self, proto: RadioProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self._value = InitialValue()
        self.type = "radio"
        self.options = list(proto.options)

    @property
    def index(self) -> int | None:
        """The index of the current selection. (int)"""  # noqa: D400
        if self.value is None:
            return None
        return self.options.index(self.format_func(self.value))

    @property
    def value(self) -> T | None:
        """The currently selected value from the options. (Any)"""  # noqa: D400
        if not isinstance(self._value, InitialValue):
            return self._value
        state = self.root.session_state
        assert state
        return cast("T", state[self.id])

    @property
    def format_func(self) -> Callable[[Any], Any]:
        """The widget's formatting function for displaying options. (callable)"""  # noqa: D400
        ss = self.root.session_state
        return cast("Callable[[Any], Any]", ss[TESTING_KEY][self.id])

    def set_value(self, v: T | None) -> Radio[T]:
        """Set the selection by value."""
        self._value = v
        return self

    @property
    def _widget_state(self) -> WidgetState:
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
    """A representation of ``st.selectbox``."""

    _value: T | None | InitialValue

    proto: SelectboxProto = field(repr=False)
    label: str
    options: list[str]
    help: str
    form_id: str

    def __init__(self, proto: SelectboxProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self._value = InitialValue()
        self.type = "selectbox"
        self.options = list(proto.options)

    @property
    def index(self) -> int | None:
        """The index of the current selection. (int)"""  # noqa: D400
        if self.value is None:
            return None

        if len(self.options) == 0:
            return 0
        return self.options.index(self.format_func(self.value))

    @property
    def value(self) -> T | None:
        """The currently selected value from the options. (Any)"""  # noqa: D400
        if not isinstance(self._value, InitialValue):
            return self._value
        state = self.root.session_state
        assert state
        return cast("T", state[self.id])

    @property
    def format_func(self) -> Callable[[Any], Any]:
        """The widget's formatting function for displaying options. (callable)"""  # noqa: D400
        ss = self.root.session_state
        return cast("Callable[[Any], Any]", ss[TESTING_KEY][self.id])

    def set_value(self, v: T | None) -> Selectbox[T]:
        """Set the selection by value."""
        self._value = v
        return self

    def select(self, v: T | None) -> Selectbox[T]:
        """Set the selection by value."""
        return self.set_value(v)

    def select_index(self, index: int | None) -> Selectbox[T]:
        """Set the selection by index."""
        if index is None:
            return self.set_value(None)
        return self.set_value(cast("T", self.options[index]))

    @property
    def _widget_state(self) -> WidgetState:
        """Protobuf message representing the state of the widget, including
        any interactions that have happened.
        Should be the same as the frontend would produce for those interactions.
        """
        ws = WidgetState()
        ws.id = self.id
        if self.index is not None and len(self.options) > 0:
            ws.string_value = self.options[self.index]
        return ws


@dataclass(repr=False)
class SelectSlider(Widget, Generic[T]):
    """A representation of ``st.select_slider``."""

    _value: T | Sequence[T] | None

    proto: SliderProto = field(repr=False)
    label: str
    data_type: SliderProto.DataType.ValueType
    options: list[str]
    help: str
    form_id: str

    def __init__(self, proto: SliderProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self.type = "select_slider"
        self.options = list(proto.options)

    def set_value(self, v: T | Sequence[T]) -> SelectSlider[T]:
        """Set the (single) selection by value."""
        self._value = v
        return self

    @property
    def _widget_state(self) -> WidgetState:
        serde = SelectSliderSerde(self.options, [], False)
        try:
            v = serde.serialize(self.format_func(self.value))
        except (ValueError, TypeError):
            try:
                v = serde.serialize([self.format_func(val) for val in self.value])  # type: ignore
            except:  # noqa: E722
                raise ValueError(f"Could not find index for {self.value}")

        ws = WidgetState()
        ws.id = self.id
        ws.double_array_value.data[:] = v
        return ws

    @property
    def value(self) -> T | Sequence[T]:
        """The currently selected value or range. (Any or Sequence of Any)"""  # noqa: D400
        if self._value is not None:
            return self._value
        state = self.root.session_state
        assert state
        # Awkward to do this with `cast`
        return state[self.id]  # type: ignore

    @property
    def format_func(self) -> Callable[[Any], Any]:
        """The widget's formatting function for displaying options. (callable)"""  # noqa: D400
        ss = self.root.session_state
        return cast("Callable[[Any], Any]", ss[TESTING_KEY][self.id])

    def set_range(self, lower: T, upper: T) -> SelectSlider[T]:
        """Set the ranged selection by values."""
        return self.set_value([lower, upper])


@dataclass(repr=False)
class Slider(Widget, Generic[SliderValueT]):
    """A representation of ``st.slider``."""

    _value: SliderValueT | Sequence[SliderValueT] | None

    proto: SliderProto = field(repr=False)
    label: str
    data_type: SliderProto.DataType.ValueType
    min: SliderValueT
    max: SliderValueT
    step: SliderStep
    help: str
    form_id: str

    def __init__(self, proto: SliderProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self.type = "slider"

    def set_value(
        self, v: SliderValueT | Sequence[SliderValueT]
    ) -> Slider[SliderValueT]:
        """Set the (single) value of the slider."""
        self._value = v
        return self

    @property
    def _widget_state(self) -> WidgetState:
        data_type = self.proto.data_type
        serde = SliderSerde([], data_type, True, None)
        v = serde.serialize(self.value)

        ws = WidgetState()
        ws.id = self.id
        ws.double_array_value.data[:] = v
        return ws

    @property
    def value(self) -> SliderValueT | Sequence[SliderValueT]:
        """The currently selected value or range. (Any or Sequence of Any)"""  # noqa: D400
        if self._value is not None:
            return self._value
        state = self.root.session_state
        assert state
        # Awkward to do this with `cast`
        return state[self.id]  # type: ignore

    def set_range(
        self, lower: SliderValueT, upper: SliderValueT
    ) -> Slider[SliderValueT]:
        """Set the ranged value of the slider."""
        return self.set_value([lower, upper])


@dataclass(repr=False)
class Table(Element):
    proto: ArrowProto = field(repr=False)

    def __init__(self, proto: ArrowProto, root: ElementTree) -> None:
        self.key = None
        self.proto = proto
        self.root = root
        self.type = "arrow_table"

    @property
    def value(self) -> PandasDataframe:
        return dataframe_util.convert_arrow_bytes_to_pandas_df(self.proto.data)


@dataclass(repr=False)
class Text(Element):
    proto: TextProto = field(repr=False)

    key: None = None

    def __init__(self, proto: TextProto, root: ElementTree) -> None:
        self.proto = proto
        self.root = root
        self.type = "text"

    @property
    def value(self) -> str:
        """The value of the element. (str)"""  # noqa: D400
        return self.proto.body


@dataclass(repr=False)
class TextArea(Widget):
    """A representation of ``st.text_area``."""

    _value: str | None | InitialValue

    proto: TextAreaProto = field(repr=False)
    label: str
    max_chars: int
    placeholder: str
    help: str
    form_id: str

    def __init__(self, proto: TextAreaProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self._value = InitialValue()
        self.type = "text_area"

    def set_value(self, v: str | None) -> TextArea:
        """Set the value of the widget."""
        self._value = v
        return self

    @property
    def _widget_state(self) -> WidgetState:
        ws = WidgetState()
        ws.id = self.id
        if self.value is not None:
            ws.string_value = self.value
        return ws

    @property
    def value(self) -> str | None:
        """The current value of the widget. (str)"""  # noqa: D400
        if not isinstance(self._value, InitialValue):
            return self._value
        state = self.root.session_state
        assert state
        # Awkward to do this with `cast`
        return state[self.id]  # type: ignore

    def input(self, v: str) -> TextArea:
        """
        Set the value of the widget only if the value does not exceed the\
        maximum allowed characters.
        """
        # TODO: should input be setting or appending?
        if self.max_chars and len(v) > self.max_chars:
            return self
        return self.set_value(v)


@dataclass(repr=False)
class TextInput(Widget):
    """A representation of ``st.text_input``."""

    _value: str | None | InitialValue
    proto: TextInputProto = field(repr=False)
    label: str
    max_chars: int
    autocomplete: str
    placeholder: str
    help: str
    form_id: str

    def __init__(self, proto: TextInputProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self._value = InitialValue()
        self.type = "text_input"

    def set_value(self, v: str | None) -> TextInput:
        """Set the value of the widget."""
        self._value = v
        return self

    @property
    def _widget_state(self) -> WidgetState:
        ws = WidgetState()
        ws.id = self.id
        if self.value is not None:
            ws.string_value = self.value
        return ws

    @property
    def value(self) -> str | None:
        """The current value of the widget. (str)"""  # noqa: D400
        if not isinstance(self._value, InitialValue):
            return self._value
        state = self.root.session_state
        assert state
        # Awkward to do this with `cast`
        return state[self.id]  # type: ignore

    def input(self, v: str) -> TextInput:
        """
        Set the value of the widget only if the value does not exceed the\
        maximum allowed characters.
        """
        # TODO: should input be setting or appending?
        if self.max_chars and len(v) > self.max_chars:
            return self
        return self.set_value(v)


TimeValue: TypeAlias = Union[time, datetime]


@dataclass(repr=False)
class TimeInput(Widget):
    """A representation of ``st.time_input``."""

    _value: TimeValue | None | InitialValue
    proto: TimeInputProto = field(repr=False)
    label: str
    step: int
    help: str
    form_id: str

    def __init__(self, proto: TimeInputProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self._value = InitialValue()
        self.type = "time_input"

    def set_value(self, v: TimeValue | None) -> TimeInput:
        """Set the value of the widget."""
        self._value = v
        return self

    @property
    def _widget_state(self) -> WidgetState:
        ws = WidgetState()
        ws.id = self.id

        serde = TimeInputSerde(None)
        serialized_value = serde.serialize(self.value)
        if serialized_value is not None:
            ws.string_value = serialized_value
        return ws

    @property
    def value(self) -> time | None:
        """The current value of the widget. (time)"""  # noqa: D400
        if not isinstance(self._value, InitialValue):
            v = self._value
            return v.time() if isinstance(v, datetime) else v
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
class Toast(Element):
    proto: ToastProto = field(repr=False)
    icon: str

    def __init__(self, proto: ToastProto, root: ElementTree) -> None:
        self.proto = proto
        self.key = None
        self.root = root
        self.type = "toast"

    @property
    def value(self) -> str:
        return self.proto.body


@dataclass(repr=False)
class Toggle(Widget):
    """A representation of ``st.toggle``."""

    _value: bool | None

    proto: CheckboxProto = field(repr=False)
    label: str
    help: str
    form_id: str

    def __init__(self, proto: CheckboxProto, root: ElementTree) -> None:
        super().__init__(proto, root)
        self._value = None
        self.type = "toggle"

    @property
    def _widget_state(self) -> WidgetState:
        ws = WidgetState()
        ws.id = self.id
        ws.bool_value = self.value
        return ws

    @property
    def value(self) -> bool:
        """The current value of the widget. (bool)"""  # noqa: D400
        if self._value is not None:
            return self._value
        state = self.root.session_state
        assert state
        return cast("bool", state[self.id])

    def set_value(self, v: bool) -> Toggle:
        """Set the value of the widget."""
        self._value = v
        return self


@dataclass(repr=False)
class Block:
    """A container of other elements.

    Elements within a Block can be inspected and interacted with. This follows
    the same syntax as inspecting and interacting within an ``AppTest`` object.

    For all container classes, parameters of the original element can be
    obtained as properties. For example, ``ChatMessage.avatar`` and
    ``Tab.label``.
    """

    type: str
    children: dict[int, Node]
    proto: Any = field(repr=False)
    root: ElementTree = field(repr=False)

    def __init__(
        self,
        proto: BlockProto | None,
        root: ElementTree,
    ) -> None:
        self.children = {}
        self.proto = proto
        if proto:
            ty = proto.WhichOneof("type")
            if ty is not None:
                self.type = ty
            else:
                # `st.container` has no sub-message
                self.type = "container"
        else:
            self.type = "unknown"
        self.root = root

    def __len__(self) -> int:
        return len(self.children)

    def __iter__(self) -> Iterator[Node]:
        yield self
        for child_idx in self.children:
            yield from self.children[child_idx]

    def __getitem__(self, k: int) -> Node:
        return self.children[k]

    @property
    def key(self) -> str | None:
        return None

    # We could implement these using __getattr__ but that would have
    # much worse type information.
    @property
    def button(self) -> WidgetList[Button]:
        return WidgetList(self.get("button"))  # type: ignore

    @property
    def button_group(self) -> WidgetList[ButtonGroup[Any]]:
        return WidgetList(self.get("button_group"))  # type: ignore

    @property
    def caption(self) -> ElementList[Caption]:
        return ElementList(self.get("caption"))  # type: ignore

    @property
    def chat_input(self) -> WidgetList[ChatInput]:
        return WidgetList(self.get("chat_input"))  # type: ignore

    @property
    def chat_message(self) -> Sequence[ChatMessage]:
        return self.get("chat_message")  # type: ignore

    @property
    def checkbox(self) -> WidgetList[Checkbox]:
        return WidgetList(self.get("checkbox"))  # type: ignore

    @property
    def code(self) -> ElementList[Code]:
        return ElementList(self.get("code"))  # type: ignore

    @property
    def color_picker(self) -> WidgetList[ColorPicker]:
        return WidgetList(self.get("color_picker"))  # type: ignore

    @property
    def columns(self) -> Sequence[Column]:
        return self.get("column")  # type: ignore

    @property
    def dataframe(self) -> ElementList[Dataframe]:
        return ElementList(self.get("arrow_data_frame"))  # type: ignore

    @property
    def date_input(self) -> WidgetList[DateInput]:
        return WidgetList(self.get("date_input"))  # type: ignore

    @property
    def divider(self) -> ElementList[Divider]:
        return ElementList(self.get("divider"))  # type: ignore

    @property
    def error(self) -> ElementList[Error]:
        return ElementList(self.get("error"))  # type: ignore

    @property
    def exception(self) -> ElementList[Exception]:
        return ElementList(self.get("exception"))  # type: ignore

    @property
    def expander(self) -> Sequence[Expander]:
        return self.get("expander")  # type: ignore

    @property
    def header(self) -> ElementList[Header]:
        return ElementList(self.get("header"))  # type: ignore

    @property
    def info(self) -> ElementList[Info]:
        return ElementList(self.get("info"))  # type: ignore

    @property
    def json(self) -> ElementList[Json]:
        return ElementList(self.get("json"))  # type: ignore

    @property
    def latex(self) -> ElementList[Latex]:
        return ElementList(self.get("latex"))  # type: ignore

    @property
    def markdown(self) -> ElementList[Markdown]:
        return ElementList(self.get("markdown"))  # type: ignore

    @property
    def metric(self) -> ElementList[Metric]:
        return ElementList(self.get("metric"))  # type: ignore

    @property
    def multiselect(self) -> WidgetList[Multiselect[Any]]:
        return WidgetList(self.get("multiselect"))  # type: ignore

    @property
    def number_input(self) -> WidgetList[NumberInput]:
        return WidgetList(self.get("number_input"))  # type: ignore

    @property
    def radio(self) -> WidgetList[Radio[Any]]:
        return WidgetList(self.get("radio"))  # type: ignore

    @property
    def select_slider(self) -> WidgetList[SelectSlider[Any]]:
        return WidgetList(self.get("select_slider"))  # type: ignore

    @property
    def selectbox(self) -> WidgetList[Selectbox[Any]]:
        return WidgetList(self.get("selectbox"))  # type: ignore

    @property
    def slider(self) -> WidgetList[Slider[Any]]:
        return WidgetList(self.get("slider"))  # type: ignore

    @property
    def status(self) -> Sequence[Status]:
        return self.get("status")  # type: ignore

    @property
    def subheader(self) -> ElementList[Subheader]:
        return ElementList(self.get("subheader"))  # type: ignore

    @property
    def success(self) -> ElementList[Success]:
        return ElementList(self.get("success"))  # type: ignore

    @property
    def table(self) -> ElementList[Table]:
        return ElementList(self.get("arrow_table"))  # type: ignore

    @property
    def tabs(self) -> Sequence[Tab]:
        return self.get("tab")  # type: ignore

    @property
    def text(self) -> ElementList[Text]:
        return ElementList(self.get("text"))  # type: ignore

    @property
    def text_area(self) -> WidgetList[TextArea]:
        return WidgetList(self.get("text_area"))  # type: ignore

    @property
    def text_input(self) -> WidgetList[TextInput]:
        return WidgetList(self.get("text_input"))  # type: ignore

    @property
    def time_input(self) -> WidgetList[TimeInput]:
        return WidgetList(self.get("time_input"))  # type: ignore

    @property
    def title(self) -> ElementList[Title]:
        return ElementList(self.get("title"))  # type: ignore

    @property
    def toast(self) -> ElementList[Toast]:
        return ElementList(self.get("toast"))  # type: ignore

    @property
    def toggle(self) -> WidgetList[Toggle]:
        return WidgetList(self.get("toggle"))  # type: ignore

    @property
    def warning(self) -> ElementList[Warning]:
        return ElementList(self.get("warning"))  # type: ignore

    def get(self, element_type: str) -> Sequence[Node]:
        return [e for e in self if e.type == element_type]

    def run(self, *, timeout: float | None = None) -> AppTest:
        """Run the script with updated widget values.

        Parameters
        ----------
        timeout
            The maximum number of seconds to run the script. None means
            use the AppTest's default.
        """
        return self.root.run(timeout=timeout)

    def __repr__(self) -> str:
        return repr_(self)


def repr_(self: object) -> str:
    """A custom repr similar to `streamlit.util.repr_` but that shows tree
    structure using indentation.
    """
    classname = self.__class__.__name__

    defaults: list[Any] = [None, "", False, [], set(), {}]

    if is_dataclass(self):
        fields_vals = (
            (f.name, getattr(self, f.name))
            for f in fields(self)
            if f.repr
            and getattr(self, f.name) != f.default
            and getattr(self, f.name) not in defaults
        )
    else:
        fields_vals = ((f, v) for (f, v) in self.__dict__.items() if v not in defaults)

    reprs = []
    for field_name, value in fields_vals:
        line = (
            f"{field_name}={format_dict(value)}"
            if isinstance(value, dict)
            else f"{field_name}={value!r}"
        )
        reprs.append(line)

    reprs[0] = "\n" + reprs[0]
    field_reprs = ",\n".join(reprs)

    field_reprs = textwrap.indent(field_reprs, " " * 4)
    return f"{classname}({field_reprs}\n)"


def format_dict(d: dict[Any, Any]) -> str:
    lines = []
    for k, v in d.items():
        line = f"{k}: {v!r}"
        lines.append(line)
    r = ",\n".join(lines)
    r = textwrap.indent(r, " " * 4)
    return f"{{\n{r}\n}}"


@dataclass(repr=False)
class SpecialBlock(Block):
    """Base class for the sidebar and main body containers."""

    def __init__(
        self,
        proto: BlockProto | None,
        root: ElementTree,
        type: str | None = None,
    ) -> None:
        self.children = {}
        self.proto = proto
        if type:
            self.type = type
        elif proto and proto.WhichOneof("type"):
            ty = proto.WhichOneof("type")
            assert ty is not None
            self.type = ty
        else:
            self.type = "unknown"
        self.root = root


@dataclass(repr=False)
class ChatMessage(Block):
    """A representation of ``st.chat_message``."""

    type: str = field(repr=False)
    proto: BlockProto.ChatMessage = field(repr=False)
    name: str
    avatar: str

    def __init__(
        self,
        proto: BlockProto.ChatMessage,
        root: ElementTree,
    ) -> None:
        self.children = {}
        self.proto = proto
        self.root = root
        self.type = "chat_message"
        self.name = proto.name
        self.avatar = proto.avatar


@dataclass(repr=False)
class Column(Block):
    """A representation of a column within ``st.columns``."""

    type: str = field(repr=False)
    proto: BlockProto.Column = field(repr=False)
    weight: float
    gap: str

    def __init__(
        self,
        proto: BlockProto.Column,
        root: ElementTree,
    ) -> None:
        self.children = {}
        self.proto = proto
        self.root = root
        self.type = "column"
        self.weight = proto.weight
        self.gap = proto.gap


@dataclass(repr=False)
class Expander(Block):
    type: str = field(repr=False)
    proto: BlockProto.Expandable = field(repr=False)
    icon: str
    label: str

    def __init__(self, proto: BlockProto.Expandable, root: ElementTree) -> None:
        self.children = {}
        self.proto = proto
        self.root = root
        # The internal name is "expandable" but the public API uses "expander"
        # so the naming of the class and type follows the public name.
        self.type = "expander"
        self.icon = proto.icon
        self.label = proto.label


@dataclass(repr=False)
class Status(Block):
    type: str = field(repr=False)
    proto: BlockProto.Expandable = field(repr=False)
    icon: str
    label: str

    def __init__(self, proto: BlockProto.Expandable, root: ElementTree) -> None:
        self.children = {}
        self.proto = proto
        self.root = root
        self.type = "status"
        self.icon = proto.icon
        self.label = proto.label

    @property
    def state(self) -> str:
        if self.icon == "spinner":
            return "running"
        if self.icon == ":material/check:":
            return "complete"
        if self.icon == ":material/error:":
            return "error"
        raise ValueError("Unknown Status state")


@dataclass(repr=False)
class Tab(Block):
    """A representation of tab within ``st.tabs``."""

    type: str = field(repr=False)
    proto: BlockProto.Tab = field(repr=False)
    label: str

    def __init__(
        self,
        proto: BlockProto.Tab,
        root: ElementTree,
    ) -> None:
        self.children = {}
        self.proto = proto
        self.root = root
        self.type = "tab"
        self.label = proto.label


Node: TypeAlias = Union[Element, Block]


def get_widget_state(node: Node) -> WidgetState | None:
    if isinstance(node, Widget):
        return node._widget_state
    return None


@dataclass(repr=False)
class ElementTree(Block):
    """A tree of the elements produced by running a streamlit script.

    Elements can be queried in three ways:
    - By element type, using `.foo` properties to get a list of all of that element,
    in the order they appear in the app
    - By user key, for widgets, by calling the above list with a key: `.foo(key='bar')`
    - Positionally, using list indexing syntax (`[...]`) to access a child of a
    block element. Not recommended because the exact tree structure can be surprising.

    Element queries made on a block container will return only the elements
    descending from that block.

    Returned elements have methods for accessing whatever attributes are relevant.
    For very simple elements this may be only its value, while complex elements
    like widgets have many.

    Widgets provide a fluent API for faking frontend interaction and rerunning
    the script with the new widget values. All widgets provide a low level `set_value`
    method, along with higher level methods specific to that type of widget.
    After an interaction, calling `.run()` will update the AppTest with the
    results of that script run.
    """

    _runner: AppTest | None = field(repr=False, default=None)

    def __init__(self) -> None:
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
    def session_state(self) -> SafeSessionState:
        assert self._runner is not None
        return self._runner.session_state

    def get_widget_states(self) -> WidgetStates:
        ws = WidgetStates()
        for node in self:
            w = get_widget_state(node)
            if w is not None:
                ws.widgets.append(w)

        return ws

    def run(self, *, timeout: float | None = None) -> AppTest:
        """Run the script with updated widget values.

        Parameters
        ----------
        timeout
            The maximum number of seconds to run the script. None means
            use the AppTest's default.
        """
        assert self._runner is not None

        widget_states = self.get_widget_states()
        return self._runner._run(widget_states, timeout=timeout)

    def __repr__(self) -> str:
        return format_dict(self.children)


def parse_tree_from_messages(messages: list[ForwardMsg]) -> ElementTree:
    """Transform a list of `ForwardMsg` into a tree matching the implicit
    tree structure of blocks and elements in a streamlit app.

    Returns the root of the tree, which acts as the entrypoint for the query
    and interaction API.
    """
    root = ElementTree()
    root.children = {
        0: SpecialBlock(type="main", root=root, proto=None),
        1: SpecialBlock(type="sidebar", root=root, proto=None),
        2: SpecialBlock(type="event", root=root, proto=None),
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
            if ty == "alert":
                alert_format = elt.alert.format
                if alert_format == AlertProto.Format.ERROR:
                    new_node = Error(elt.alert, root=root)
                elif alert_format == AlertProto.Format.INFO:
                    new_node = Info(elt.alert, root=root)
                elif alert_format == AlertProto.Format.SUCCESS:
                    new_node = Success(elt.alert, root=root)
                elif alert_format == AlertProto.Format.WARNING:
                    new_node = Warning(elt.alert, root=root)
                else:
                    raise ValueError(
                        f"Unknown alert type with format {elt.alert.format}"
                    )
            elif ty == "arrow_data_frame":
                new_node = Dataframe(elt.arrow_data_frame, root=root)
            elif ty == "arrow_table":
                new_node = Table(elt.arrow_table, root=root)
            elif ty == "button":
                new_node = Button(elt.button, root=root)
            elif ty == "button_group":
                new_node = ButtonGroup(elt.button_group, root=root)
            elif ty == "chat_input":
                new_node = ChatInput(elt.chat_input, root=root)
            elif ty == "checkbox":
                style = elt.checkbox.type
                if style == CheckboxProto.StyleType.TOGGLE:
                    new_node = Toggle(elt.checkbox, root=root)
                else:
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
            elif ty == "json":
                new_node = Json(elt.json, root=root)
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
            elif ty == "metric":
                new_node = Metric(elt.metric, root=root)
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
            elif ty == "toast":
                new_node = Toast(elt.toast, root=root)
            else:
                new_node = UnknownElement(elt, root=root)
        elif delta.WhichOneof("type") == "add_block":
            block = delta.add_block
            bty = block.WhichOneof("type")
            if bty == "chat_message":
                new_node = ChatMessage(block.chat_message, root=root)
            elif bty == "column":
                new_node = Column(block.column, root=root)
            elif bty == "expandable":
                if block.expandable.icon:
                    new_node = Status(block.expandable, root=root)
                else:
                    new_node = Expander(block.expandable, root=root)
            elif bty == "tab":
                new_node = Tab(block.tab, root=root)
            else:
                new_node = Block(proto=block, root=root)
        else:
            # add_rows
            continue

        current_node: Block = root
        # Every node up to the end is a Block
        for idx in delta_path[:-1]:
            children = current_node.children
            child = children.get(idx)
            if child is None:
                child = Block(proto=None, root=root)
                children[idx] = child
            assert isinstance(child, Block)
            current_node = child

        # Handle a block when we already have a placeholder for that location
        if isinstance(new_node, Block):
            placeholder_block = current_node.children.get(delta_path[-1])
            if placeholder_block is not None:
                new_node.children = placeholder_block.children

        current_node.children[delta_path[-1]] = new_node

    return root

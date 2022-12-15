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

from dataclasses import dataclass, field
from typing import Any, Generic, Sequence, TypeVar, Union, cast, overload

from typing_extensions import Literal, Protocol, TypeAlias, runtime_checkable

from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.proto.Element_pb2 import Element as ElementProto
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.Radio_pb2 import Radio as RadioProto
from streamlit.proto.Text_pb2 import Text as TextProto
from streamlit.proto.WidgetStates_pb2 import WidgetState, WidgetStates
from streamlit.runtime.state.session_state import SessionState
from streamlit.runtime.state.widgets import user_key_from_widget_id


# TODO This class serves as a fallback option for elements that have not
# been implemented yet, as well as providing implementations of some
# trivial methods. It may have significantly reduced scope, or be removed
# entirely, once all elements have been implemented.
# This class will not be sufficient implementation for most elements.
# Widgets need their own classes to translate interactions into the appropriate
# WidgetState and provide higher level interaction interfaces, and other elements
# have enough variation in how to get their values that most will need their
# own classes too.
@dataclass(init=False)
class Element:
    type: str
    proto: Any = field(repr=False)
    root: ElementTree = field(repr=False)
    key: str | None = None

    def __init__(self, proto: ElementProto, root: ElementTree):
        self.proto = proto
        self.root = root
        ty = proto.WhichOneof("type")
        assert ty is not None
        self.type = ty

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

    def run(self) -> ElementTree:
        return self.root.run()


@dataclass(init=False)
class Text(Element):
    proto: TextProto

    type: str
    root: ElementTree = field(repr=False)
    key: None = None

    def __init__(self, proto: TextProto, root: ElementTree):
        self.proto = proto
        self.root = root
        self.type = "text"

    @property
    def value(self) -> str:
        return self.proto.body


@runtime_checkable
class Widget(Protocol):
    id: str
    key: str | None

    def set_value(self, v: Any):
        ...


T = TypeVar("T")


@dataclass(init=False)
class Radio(Element, Widget, Generic[T]):
    _value: T | None

    proto: RadioProto
    type: str
    id: str
    label: str
    options: list[str]
    help: str
    form_id: str
    disabled: bool
    horizontal: bool
    key: str | None

    root: ElementTree = field(repr=False)

    def __init__(self, proto: RadioProto, root: ElementTree):
        self.proto = proto
        self.root = root
        self._value = None

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
    def index(self) -> int:
        return self.options.index(str(self.value))

    @property
    def value(self) -> T:
        """The currently selected value from the options."""
        if self._value is not None:
            return self._value
        else:
            state = self.root.session_state
            assert state
            return cast(T, state[self.id])

    def set_value(self, v: T) -> Radio[T]:
        self._value = v
        return self

    def widget_state(self) -> WidgetState:
        """Protobuf message representing the state of the widget, including
        any interactions that have happened.
        Should be the same as the frontend would produce for those interactions.
        """
        ws = WidgetState()
        ws.id = self.id
        ws.int_value = self.index
        return ws


@dataclass(init=False)
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

    @overload
    def get(self, elt: Literal["text"]) -> Sequence[Text]:
        ...

    @overload
    def get(self, elt: Literal["radio"]) -> Sequence[Radio[Any]]:
        ...

    def get(self, elt: str) -> Sequence[Node]:
        return [e for e in self if e.type == elt]

    def get_widget(self, key: str) -> Widget | None:
        for e in self:
            if e.key == key:
                assert isinstance(e, Widget)
                return e
        return None

    def widget_state(self) -> WidgetState | None:
        return None

    def run(self) -> ElementTree:
        return self.root.run()


Node: TypeAlias = Union[Element, Block]


@dataclass(init=False)
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

    type: str

    def __init__(self):
        # Expect script_path and session_state to be filled in afterwards
        self.children = {}
        self.root = self
        self.type = "root"

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

    def run(self) -> ElementTree:
        assert self.script_path is not None
        from streamlit.testing.local_script_runner import LocalScriptRunner

        widget_states = self.get_widget_states()
        runner = LocalScriptRunner(self.script_path, self.session_state)
        return runner.run(widget_states)


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
            new_node: Node
            if elt.WhichOneof("type") == "text":
                new_node = Text(elt.text, root=root)
            elif elt.WhichOneof("type") == "radio":
                new_node = Radio(elt.radio, root=root)
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

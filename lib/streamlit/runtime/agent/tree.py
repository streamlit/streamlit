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

"""Merge one run's deltas into the tree a snapshot walks.

Block replacement follows the frontend: a block of the same type keeps its
children, and a different type or dialog identity drops them. A descendant
that arrives before its container is kept until that container claims it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Final

from streamlit.elements.lib import agent_spec
from streamlit.proto.RootContainer_pb2 import RootContainer

if TYPE_CHECKING:
    from streamlit.proto.Block_pb2 import Block as BlockProto
    from streamlit.proto.Element_pb2 import Element as ElementProto
    from streamlit.proto.ForwardMsg_pb2 import ForwardMsg

_ROOT_CONTAINER_NAMES: Final = {
    RootContainer.MAIN: "main",
    RootContainer.SIDEBAR: "sidebar",
    RootContainer.EVENT: "event",
    RootContainer.BOTTOM: "bottom",
}


@dataclass
class _Node:
    """A merged tree node: either a container or a single element."""

    block: BlockProto | None = None
    element: ElementProto | None = None
    # What the command said about itself, from ForwardMsgMetadata.agent_props.
    description: dict[str, Any] = field(default_factory=dict)
    # The fragment that emitted this node, when one did. A dialog's block is
    # emitted by the fragment that opened it, and the dialog body by the
    # dialog's own fragment, so the two ids differ.
    fragment_id: str | None = None
    # Root containers have a fixed name rather than a proto.
    root_name: str | None = None
    children: dict[int, _Node] = field(default_factory=dict)

    @property
    def is_container(self) -> bool:
        return self.element is None


def merge_deltas(messages: list[ForwardMsg]) -> _Node:
    """Merge one run's deltas into a tree of the four root containers.

    ``messages`` are the forward messages for the page as the frontend would
    apply them for that run, in order. This does not drop nodes a later
    fragment run would clear; the caller passes the messages that already
    make up the page.

    Block replacement follows the frontend: a block of the same type keeps its
    children, and a different type or dialog identity drops them. Unlike the
    frontend, which rejects a delta whose parent container is missing, this
    creates a placeholder and lets the block that later claims the position
    adopt its children.
    """
    root = _Node(
        root_name="root",
        children={
            index: _Node(root_name=name)
            for index, name in _ROOT_CONTAINER_NAMES.items()
        },
    )

    for msg in messages:
        if not msg.HasField("delta"):
            continue

        description = (
            agent_spec.decode(msg.metadata.agent_props)
            if msg.metadata.HasField("agent_props")
            else {}
        )

        delta_type = msg.delta.WhichOneof("type")
        # Set on every delta written while a fragment was running, which is how
        # a partial rerun says what it owns.
        fragment_id = msg.delta.fragment_id or None
        if delta_type == "new_element":
            node = _Node(
                element=msg.delta.new_element,
                description=description,
                fragment_id=fragment_id,
            )
        elif delta_type == "add_block":
            node = _Node(
                block=msg.delta.add_block,
                description=description,
                fragment_id=fragment_id,
            )
        else:
            # Transient elements (spinners) report progress for a run that has
            # already finished by the time a snapshot is built.
            continue

        delta_path = list(msg.metadata.delta_path)
        if not delta_path:
            continue

        parent = root
        for index in delta_path[:-1]:
            child = parent.children.get(index)
            if child is None or not child.is_container:
                child = _Node()
                parent.children[index] = child
            parent = child

        position = delta_path[-1]
        if node.is_container:
            existing = parent.children.get(position)
            if existing is not None and _keep_existing_children(existing, node):
                node.children = existing.children
        parent.children[position] = node

    return root


def _keep_existing_children(existing: _Node, incoming: _Node) -> bool:
    """Whether a newly arrived container keeps the children already there.

    A placeholder has no block of its own: a descendant arrived first, and the
    block that claims the position adopts those children. A container re-sent
    with the same proto type, such as a dialog updating ``is_open``, is the
    same container. A different type replaces it, the way the frontend replaces
    a block, so the previous children are gone.
    """
    if not existing.is_container:
        return False
    if existing.block is None:
        return True
    if incoming.block is None:
        return False
    if existing.block.WhichOneof("type") != incoming.block.WhichOneof("type"):
        return False
    # A dialog's id is its identity. Any difference drops the previous body,
    # including when only one of the two dialogs has an id.
    if incoming.block.HasField("dialog"):
        return existing.block.id == incoming.block.id
    return True

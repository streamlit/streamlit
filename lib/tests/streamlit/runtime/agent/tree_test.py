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

"""Merging a run's deltas, observed through the snapshot that run produces."""

from __future__ import annotations

import json

import streamlit as st
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from tests.streamlit.runtime.agent.snapshot_test_case import (
    SnapshotCase,
    _by_type,
    _describe,
    _one,
)


class DeltaTreeTest(SnapshotCase):
    """Delta replacement, and which children a re-sent container keeps."""

    def test_later_delta_replaces_the_same_position(self) -> None:
        """A slot written twice keeps the later element, as the frontend does."""
        slot = st.empty()
        slot.markdown("first")
        slot.markdown("second")

        document = self._build().document
        bodies = [node["props"]["body"] for node in _by_type(document, "markdown")]
        assert bodies == ["second"]
        assert _by_type(document, "empty") == []

    def test_block_adopts_children_that_arrived_first(self) -> None:
        """A block written after its child keeps that child."""
        child = _describe(
            [0, 0, 0],
            {"type": "markdown", "props": {"body": "inside"}},
        )
        block = ForwardMsg()
        block.metadata.delta_path[:] = [0, 0]
        block.metadata.agent_props = json.dumps(
            {"type": "expander", "props": {"label": "More", "expanded": False}}
        )
        block.delta.add_block.expandable.label = "More"

        document = self._build(child, block).document
        expander = _one(document, "expander")
        assert expander["props"]["label"] == "More"
        assert expander["children"] == [
            {"type": "markdown", "props": {"body": "inside"}}
        ]

        # Re-sending the same block, as a dialog does when it updates, keeps
        # the children. A different block type replaces them.
        again = ForwardMsg()
        again.metadata.delta_path[:] = [0, 0]
        again.metadata.agent_props = json.dumps(
            {
                "type": "expander",
                "props": {"label": "More", "expanded": True},
            }
        )
        again.delta.add_block.expandable.label = "More"
        updated = self._build(child, block, again).document
        assert _one(updated, "expander")["props"]["expanded"] is True
        assert _one(updated, "expander")["children"][0]["props"]["body"] == "inside"

    def test_replacing_a_container_drops_its_children(self) -> None:
        """A different block replaces the previous one, as the frontend does.

        The same proto type keeps its children. A dialog with a new identity
        does not, so the previous dialog's widgets do not stay mounted.
        """
        container = ForwardMsg()
        container.metadata.delta_path[:] = [0, 0]
        container.metadata.agent_props = json.dumps({"type": "container"})
        container.delta.add_block.flex_container.SetInParent()
        first = _describe(
            [0, 0, 0],
            {
                "type": "button",
                "key": "$$ID-1-one",
                "action": "trigger",
                "props": {"label": "One"},
            },
        )
        second = _describe(
            [0, 0, 1],
            {
                "type": "button",
                "key": "$$ID-2-two",
                "action": "trigger",
                "props": {"label": "Two"},
            },
        )
        expander = ForwardMsg()
        expander.metadata.delta_path[:] = [0, 0]
        expander.metadata.agent_props = json.dumps(
            {"type": "expander", "props": {"label": "More", "expanded": False}}
        )
        expander.delta.add_block.expandable.label = "More"
        only = _describe([0, 0, 0], {"type": "text", "props": {"body": "only"}})

        document = self._build(container, first, second, expander, only).document
        assert document["actions"] == []
        assert [
            child["props"]["body"] for child in _one(document, "expander")["children"]
        ] == ["only"]

        previous = ForwardMsg()
        previous.metadata.delta_path[:] = [2, 0]
        previous.metadata.agent_props = json.dumps(
            {"type": "dialog", "props": {"title": "A", "is_open": True}}
        )
        previous.delta.add_block.id = "dialog-a"
        previous.delta.add_block.dialog.title = "A"
        body = _describe([2, 0, 0], {"type": "markdown", "props": {"body": "secret"}})
        same = ForwardMsg()
        same.metadata.delta_path[:] = [2, 0]
        same.metadata.agent_props = json.dumps(
            {"type": "dialog", "props": {"title": "A", "is_open": False}}
        )
        same.delta.add_block.id = "dialog-a"
        same.delta.add_block.dialog.title = "A"
        kept = self._build(previous, body, same).document
        assert _one(kept, "dialog")["children"][0]["props"]["body"] == "secret"

        replacement = ForwardMsg()
        replacement.metadata.delta_path[:] = [2, 0]
        replacement.metadata.agent_props = json.dumps(
            {"type": "dialog", "props": {"title": "B", "is_open": True}}
        )
        replacement.delta.add_block.id = "dialog-b"
        replacement.delta.add_block.dialog.title = "B"
        replaced = self._build(previous, body, replacement).document
        assert _one(replaced, "dialog")["props"]["title"] == "B"
        assert _one(replaced, "dialog")["children"] == []

    def test_transient_messages_are_skipped(self) -> None:
        """A spinner is progress for a run that has already finished."""
        st.markdown("done")
        no_path = ForwardMsg()
        no_path.delta.new_element.markdown.body = "nowhere"
        transient = ForwardMsg()
        transient.metadata.delta_path[:] = [0, 1]
        transient.metadata.agent_props = json.dumps(
            {"type": "spinner", "props": {"text": "wait"}}
        )
        transient.delta.new_transient.elements.add().spinner.text = "wait"

        # A descendant whose own block never arrived is still in the tree.
        orphan = _describe(
            [0, 2, 0],
            {"type": "caption", "props": {"body": "unwrapped"}},
        )
        document = self._build(no_path, transient, orphan).document
        assert _by_type(document, "spinner") == []
        assert [node["props"]["body"] for node in _by_type(document, "markdown")] == [
            "done"
        ]
        assert _one(document, "caption")["props"]["body"] == "unwrapped"

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

from dataclasses import dataclass
from typing import Any, Literal

from streamlit.cursor import Cursor
from streamlit.delta_generator import DeltaGenerator
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.proto.Button_pb2 import Button as ButtonProto
from streamlit.proto.Common_pb2 import StringTriggerValue as StringTriggerValueProto
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.state import register_widget


@dataclass
class ButtonGroupSerde:
    def deserialize(
        self, ui_value: StringTriggerValueProto | None, widget_id: str = ""
    ) -> int | None:
        if ui_value is None or not ui_value.HasField("data"):
            return None

        return int(ui_value.data)

    def serialize(self, v: int | None) -> StringTriggerValueProto:
        return StringTriggerValueProto(data=str(v))


class ButtonGroup(DeltaGenerator):
    @staticmethod
    def _create(
        parent: DeltaGenerator,
        key: str,
    ) -> ButtonGroup:
        # return cast(
        #     ButtonGroup, parent._block(block_proto=block_proto, dg_type=ButtonGroup)
        # )
        button_group = ButtonGroup(
            parent._root_container, parent._cursor, parent, "button_group"
        )
        button_group._key = key
        return button_group

    def __init__(
        self,
        root_container: int | None,
        cursor: Cursor | None,
        parent: DeltaGenerator | None,
        block_type: str | None,
    ):
        super().__init__(root_container, cursor, parent, block_type)
        self._buttons: list[bytes] = []
        self._surpress_button = True
        self._key = ""
        self._value: int | None = -1

    def _add(self, element: ButtonProto):
        print("ADD BUTTON PROTO")
        self._buttons.append(element.SerializeToString())

    def render(self) -> int | None:
        print("RENDER BUTTON_GROUP!")
        block_proto = BlockProto()
        # block_proto.button_group = BlockProto.ButtonGroup()
        block_proto.button_group.id = self._key
        block_proto.button_group.selected_index = -1
        block_proto.button_group.elements[:] = self._buttons
        self.dg._block(block_proto, dg_type=ButtonGroup)

        serde = ButtonGroupSerde()

        button_group_state = register_widget(
            "button_group",
            block_proto.button_group,
            user_key=self._key,
            on_change_handler=None,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=get_script_run_ctx(),
        )

        return button_group_state.value

    def __enter__(self):
        """Ignore."""
        super().__enter__()
        return self

    def __exit__(self, type: Any, value: Any, traceback: Any) -> Literal[False]:
        # self._surpress_button = False
        print("EXIT BUTTON_GROUP!")
        self._value = self.render()
        return super().__exit__(type, value, traceback)


# def button_group(dg: DeltaGenerator, key: str = "") -> ButtonGroup:
#     return ButtonGroup._create(dg, key=key)


# class button_group():
#     def __enter__(self):
#         self._surpress_button = True

#     def __exit__(self):
#         self._surpress_button = False

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

import time
from types import TracebackType
from typing import List, Literal, Optional, Type, cast

from streamlit.delta_generator import DeltaGenerator, _enqueue_message
from streamlit.proto import Block_pb2
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg


class Dialog(DeltaGenerator):
    _is_open: bool = False

    @staticmethod
    def _create(
        parent: DeltaGenerator,
        title: str,
        *,
        dismissible: bool = True,
    ) -> "Dialog":
        block_proto = Block_pb2.Block()
        block_proto.dialog.title = title
        block_proto.dialog.dismissible = dismissible

        delta_path: List[int] = (
            parent._active_dg._cursor.delta_path if parent._active_dg._cursor else []
        )
        dialog = cast(Dialog, parent._block(block_proto=block_proto, dg_type=Dialog))

        dialog._delta_path = delta_path
        dialog._current_proto = block_proto
        time.sleep(0.05)
        return dialog

    def _update(self, is_open: bool):
        assert self._current_proto is not None, "Status not correctly initialized!"
        assert self._delta_path is not None, "Status not correctly initialized!"

        msg = ForwardMsg()
        msg.metadata.delta_path[:] = self._delta_path
        msg.delta.add_block.CopyFrom(self._current_proto)
        msg.delta.add_block.dialog.is_open = is_open

        self._current_proto = msg.delta.add_block

        _enqueue_message(msg)
        time.sleep(0.05)

    def open(self) -> None:
        self._update(True)

    def close(self) -> None:
        self._update(False)

    def __enter__(self) -> "Dialog":  # type: ignore[override]
        # This is a little dubious: we're returning a different type than
        # our superclass' `__enter__` function. Maybe DeltaGenerator.__enter__
        # should always return `self`?
        # self.close()
        super().__enter__()
        return self

    def __exit__(
        self,
        exc_type: Optional[Type[BaseException]],
        exc_val: Optional[BaseException],
        exc_tb: Optional[TracebackType],
    ) -> Literal[False]:
        return super().__exit__(exc_type, exc_val, exc_tb)

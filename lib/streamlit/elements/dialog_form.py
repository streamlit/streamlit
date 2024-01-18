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

from streamlit.delta_generator import DeltaGenerator
from streamlit.elements.dialog_non_form import DialogNonForm
from streamlit.elements.form import FormData, FormMixin
from streamlit.proto import Block_pb2


class DialogMixinV2(DialogNonForm):
    @staticmethod
    def _create(
        parent: DeltaGenerator,
        title: str,
        *,
        dismissible: bool = True,
        is_open: Optional[bool] = None,
        key: str,
    ) -> "DialogMixinV2":
        # Import this here to avoid circular imports.
        from streamlit.elements.utils import check_session_state_rules

        if not key:
            key = title

        check_session_state_rules(default_value=None, key=key, writes_allowed=False)

        block_proto = Block_pb2.Block()
        block_proto.dialog_non_form.title = title
        block_proto.dialog_non_form.dismissible = dismissible
        if is_open is not None:
            block_proto.dialog_non_form.is_open = is_open
        # block_dg = parent._active_dg._block(block_proto)

        # return parent.dg._block(block_proto)

        delta_path: List[int] = (
            parent._active_dg._cursor.delta_path if parent._active_dg._cursor else []
        )

        dialog_non_form_container = cast(
            DialogMixinV2, parent._block(block_proto=block_proto, dg_type=DialogMixinV2)
        )

        # Apply initial configuration
        dialog_non_form_container._delta_path = delta_path
        dialog_non_form_container._current_proto = block_proto
        dialog_non_form_container._current_is_open = is_open

        # We need to sleep here for a very short time to prevent issues when
        # the status is updated too quickly. If an .update() directly follows the
        # the initialization, sometimes only the latest update is applied.
        # Adding a short timeout here allows the frontend to render the update before.
        time.sleep(0.05)

        # Attach the form's button info to the newly-created block's
        # DeltaGenerator.
        # block_dg._form_data = FormData(form_id)
        dialog_non_form_container._form_dg = dialog_non_form_container.form(
            title, border=False
        )
        return dialog_non_form_container

    # def dialogv2(self, title: str, close_on_submit: bool = False, border: bool = True) -> FormMixin:
    #     return st.dialog_non_form(title=title).form(title, border=border)
    def __enter__(self) -> DeltaGenerator:  # type: ignore[override]
        # print("Enter NonFormDialog!")
        # time.sleep(0.05)
        # self.update(self._current_is_open)
        # This is a little dubious: we're returning a different type than
        # our superclass' `__enter__` function. Maybe DeltaGenerator.__enter__
        # should always return `self`?
        return self._form_dg.__enter__()

    def __exit__(
        self,
        exc_type: Optional[Type[BaseException]],
        exc_val: Optional[BaseException],
        exc_tb: Optional[TracebackType],
    ) -> Literal[False]:
        # self._form.__exit__(exc_type, exc_val, exc_tb)
        return super().__exit__(exc_type, exc_val, exc_tb)

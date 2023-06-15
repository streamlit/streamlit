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

from dataclasses import dataclass
from typing import TYPE_CHECKING, Optional, cast

from typing_extensions import Final

from streamlit import runtime
from streamlit.elements.form import is_in_form
from streamlit.elements.utils import check_callback_rules
from streamlit.errors import StreamlitAPIException
from streamlit.proto.ChatInput_pb2 import ChatInput as ChatInputProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    register_widget,
)
from streamlit.type_util import Key, SupportsStr, to_key

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator

FORM_DOCS_INFO: Final = """
For more information, refer to the
[documentation for forms](https://docs.streamlit.io/library/api-reference/control-flow/st.form).
"""


@dataclass
class ChatInputSerde:
    value: SupportsStr

    def deserialize(self, ui_value: Optional[str], widget_id: str = "") -> str | None:
        return ui_value

    def serialize(self, v: str | None) -> str | None:
        return v


class ChatMixin:
    @gather_metrics("chat_input")
    def chat_input(
        self,
        placeholder: str | None = None,
        *,
        key: Key | None = None,
        max_chars: int | None = None,
        disabled: bool = False,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
    ) -> str | None:
        # We default to an empty string here and disallow user choice intentionally
        default = ""
        key = to_key(key)
        check_callback_rules(self.dg, on_change)

        # We omit this check for scripts running outside streamlit, because
        # they will have no script_run_ctx.
        if runtime.exists():
            if is_in_form(self.dg):
                # It doesn't make sense to create a chat_input inside a form.
                # We throw an error to warn the user about this.
                raise StreamlitAPIException(
                    f"`st.chat_input()` can't be used in an `st.form()`. {FORM_DOCS_INFO}"
                )
            if self.dg._active_dg == self.dg._main_dg:
                pass

        # TODO(lukasmasuch): Should we really do this?:
        # if not in_main_dg and position == "bottom":
        #     raise StreamlitAPIException(
        #         "`st.chat_input()` with position='bottom' can only be used in the main container."
        #     )

        chat_input_proto = ChatInputProto()
        if placeholder is not None:
            chat_input_proto.placeholder = str(placeholder)

        if max_chars is not None:
            chat_input_proto.max_chars = max_chars

        chat_input_proto.default = default if default is not None else ""
        chat_input_proto.position = ChatInputProto.Position.BOTTOM

        ctx = get_script_run_ctx()
        serde = ChatInputSerde("")
        widget_state = register_widget(
            "chat_input",
            chat_input_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
        )

        chat_input_proto.disabled = disabled
        if widget_state.value_changed and widget_state.value is not None:
            chat_input_proto.value = widget_state.value
            chat_input_proto.set_value = True

        self.dg._enqueue("chat_input", chat_input_proto)

        # If the widget value was changed by the user via the session state,
        # we return None here. This should only put the configured value into
        # the chat input on the frontend but should not automatically trigger the value.
        return None if widget_state.value_changed else widget_state.value

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

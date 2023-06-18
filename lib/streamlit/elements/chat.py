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
from streamlit.elements.utils import check_callback_rules, check_session_state_rules
from streamlit.errors import StreamlitAPIException
from streamlit.proto.ChatInput_pb2 import ChatInput as ChatInputProto
from streamlit.proto.Common_pb2 import StringTriggerValue as StringTriggerValueProto
from streamlit.proto.RootContainer_pb2 import RootContainer
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    register_widget,
)
from streamlit.type_util import Key, to_key

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator

DISALLOWED_CONTAINERS_ERROR_TEXT = "`st.chat_input()` can't be used inside an `st.expander`, `st.form`, `st.tabs`, `st.columns`, `st.container`, or `st.sidebar`."


@dataclass
class ChatInputSerde:
    def deserialize(
        self, ui_value: Optional[StringTriggerValueProto], widget_id: str = ""
    ) -> str | None:
        if ui_value is None or not ui_value.HasField("data"):
            return None

        return ui_value.data

    def serialize(self, v: str | None) -> StringTriggerValueProto:
        return StringTriggerValueProto(data=v)


class ChatMixin:
    @gather_metrics("chat_input")
    def chat_input(
        self,
        placeholder: str = "Your message",
        *,
        key: Key | None = None,
        max_chars: int | None = None,
        disabled: bool = False,
        on_submit: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
    ) -> str | None:
        # We default to an empty string here and disallow user choice intentionally
        default = ""
        key = to_key(key)
        check_callback_rules(self.dg, on_submit)
        check_session_state_rules(default_value=default, key=key, writes_allowed=False)

        # We omit this check for scripts running outside streamlit, because
        # they will have no script_run_ctx.
        if runtime.exists():
            if (
                len(list(self.dg._active_dg._parent_block_types)) > 0
                or self.dg._active_dg._root_container == RootContainer.SIDEBAR
            ):
                raise StreamlitAPIException(DISALLOWED_CONTAINERS_ERROR_TEXT)

        chat_input_proto = ChatInputProto()
        chat_input_proto.placeholder = str(placeholder)

        if max_chars is not None:
            chat_input_proto.max_chars = max_chars

        chat_input_proto.default = default
        chat_input_proto.position = ChatInputProto.Position.BOTTOM

        ctx = get_script_run_ctx()

        serde = ChatInputSerde()
        widget_state = register_widget(
            "chat_input",
            chat_input_proto,
            user_key=key,
            on_change_handler=on_submit,
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
        return widget_state.value if not widget_state.value_changed else None

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

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

from typing import TYPE_CHECKING, cast

from streamlit.proto.AudioInput_pb2 import AudioInput as AudioInputProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.state import register_widget
from streamlit.runtime.state.common import compute_widget_id

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


class AudioInputMixin:
    @gather_metrics("audio_input")
    def audio_input(
        self,
    ) -> None:
        ctx = get_script_run_ctx()
        id = compute_widget_id("audio_input")

        audio_input_proto = AudioInputProto(id=id)

        register_widget(
            "audio_input",
            audio_input_proto,
            user_key=None,
            deserializer=lambda x, _: x,
            serializer=lambda x: x,
            ctx=ctx,
        )

        self.dg._enqueue("audio_input", audio_input_proto)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

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

from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from textwrap import dedent
from typing import TYPE_CHECKING, cast

from streamlit.elements.lib.policies import (
    check_widget_policies,
    maybe_raise_label_warnings,
)
from streamlit.elements.lib.utils import (
    Key,
    LabelVisibility,
    compute_and_register_element_id,
    get_label_visibility_proto_value,
    to_key,
)
from streamlit.proto.Lens_pb2 import Lens as LensProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    register_widget,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    from streamlit.delta_generator import DeltaGenerator


@dataclass
class LensSerde:
    on_result: Callable[..., str | None] | None = None
    args: WidgetArgs | None = None
    kwargs: WidgetKwargs | None = None
    _was_closed: bool = False

    def serialize(self, v: str | None) -> str:
        return v or ""

    def deserialize(self, ui_value: str | dict[str, object] | None) -> str | None:
        if ui_value is None:
            return None

        if isinstance(ui_value, dict):
            payload = ui_value
        else:
            try:
                payload = json.loads(ui_value)
            except (json.JSONDecodeError, TypeError):
                return str(ui_value) if ui_value else None

        if payload.get("closed"):
            self._was_closed = True
            return None

        snapshot_b64 = payload.get("snapshot", "")
        if not isinstance(snapshot_b64, str) or not snapshot_b64:
            return None
        snapshot_bytes = base64.b64decode(snapshot_b64)
        snapshot_text = snapshot_bytes.decode("utf-8", errors="replace")
        user_prompt = payload.get("prompt", "")
        user_prompt = user_prompt if isinstance(user_prompt, str) else ""
        if self.on_result is not None:
            args = self.args or ()
            kwargs = self.kwargs or {}
            return self.on_result(snapshot_text, user_prompt, *args, **kwargs)
        return None


class LensMixin:
    @gather_metrics("lens")
    def lens(
        self,
        target_key: str | None = None,
        label: str = "",
        *,
        key: Key | None = None,
        help: str | None = None,
        on_result: Callable[..., str | None] | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
    ) -> str | None:
        ctx = get_script_run_ctx()
        return self._lens(
            target_key=target_key,
            label=label,
            key=key,
            help=help,
            on_result=on_result,
            args=args,
            kwargs=kwargs,
            disabled=disabled,
            label_visibility=label_visibility,
            ctx=ctx,
        )

    def _lens(
        self,
        target_key: str | None = None,
        label: str = "",
        key: Key | None = None,
        help: str | None = None,
        on_result: Callable[..., str | None] | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        ctx: ScriptRunContext | None = None,
    ) -> str | None:
        key = to_key(key)

        check_widget_policies(
            self.dg,
            key,
            cast("WidgetCallback | None", on_result),
        )
        maybe_raise_label_warnings(label, label_visibility)

        element_id = compute_and_register_element_id(
            "lens",
            user_key=key,
            key_as_main_identity=True,
            dg=self.dg,
            label=label,
            target_key=target_key,
            help=help,
        )

        lens_proto = LensProto()
        lens_proto.id = element_id
        lens_proto.label = label
        if target_key:
            lens_proto.target_key = target_key
        if help:
            lens_proto.help = dedent(help)
        lens_proto.disabled = disabled
        lens_proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )

        serde = LensSerde(on_result=on_result, args=args, kwargs=kwargs)

        widget_state = register_widget(
            lens_proto.id,
            on_change_handler=None,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="json_value",
        )

        if serde._was_closed:
            lens_proto.closed = True
        elif widget_state.value_changed:
            lens_proto.result = (
                widget_state.value if widget_state.value is not None else ""
            )
            lens_proto.result_ready = bool(widget_state.value)
        elif widget_state.value is not None:
            lens_proto.result = widget_state.value
            lens_proto.result_ready = True

        self.dg._enqueue("lens", lens_proto)
        return None if serde._was_closed else widget_state.value

    @property
    def dg(self) -> DeltaGenerator:
        return cast("DeltaGenerator", self)

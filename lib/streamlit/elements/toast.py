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

from enum import Enum
from typing import TYPE_CHECKING, Optional, cast

from streamlit.errors import StreamlitAPIException
from streamlit.proto.Toast_pb2 import Toast as ToastProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import clean_text, validate_emoji
from streamlit.type_util import SupportsStr

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


class ToastProtoType(Enum):
    DEFAULT = "default"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"


def validate_type(toast_type: str) -> str:
    valid_types = [type.value for type in ToastProtoType]

    if toast_type is None:
        return ToastProtoType.DEFAULT.value

    toast_type = toast_type.lower()
    if toast_type in valid_types:
        if toast_type == "success":
            return ToastProtoType.SUCCESS.value
        elif toast_type == "warning":
            return ToastProtoType.WARNING.value
        else:
            return ToastProtoType.ERROR.value
    else:
        raise StreamlitAPIException(
            f"Invalid toast type: {toast_type}. Valid types are “success”, “warning”, “error”, or None"
        )


class ToastMixin:
    @gather_metrics("toast")
    def toast(
        self,
        text: SupportsStr,
        *,  # keyword-only args:
        icon: Optional[str] = None,
        type: Optional[ToastProtoType] = None,
    ) -> "DeltaGenerator":
        """Display a toast in the bottom right corner of the screen. Will disappear after four seconds.

        Parameters
        ----------
        text : str
            Short message for the toast.
        icon : str or None
            An optional, keyword-only argument that specifies an emoji to use as
            the icon for the toast. Shortcodes are not allowed, please use a
            single character instead. E.g. "🚨", "🔥", "🤖", etc.
            Defaults to None, which means no icon is displayed.
        type : “success”, “warning”, “error”, or None
            An optional, keyword-only argument that specifies the type of toast.
            Defaults to None.


        Example
        -------
        >>> import streamlit as st
        >>>
        >>> st.toast('Your edited image was saved!', icon='😍', type='success')

        """
        toast_proto = ToastProto()
        toast_proto.text = clean_text(text)
        toast_proto.icon = validate_emoji(icon)
        toast_proto.type = validate_type(type)
        return self.dg._enqueue("toast", toast_proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

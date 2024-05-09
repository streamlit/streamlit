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

from streamlit.errors import StreamlitAPIException
from streamlit.proto.Toast_pb2 import Toast as ToastProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import clean_text, validate_icon_or_emoji
from streamlit.type_util import SupportsStr

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


def validate_text(toast_text: SupportsStr) -> SupportsStr:
    if str(toast_text) == "":
        raise StreamlitAPIException(
            f"Toast body cannot be blank - please provide a message."
        )
    else:
        return toast_text


class ToastMixin:
    @gather_metrics("toast")
    def toast(
        self,
        body: SupportsStr,
        *,  # keyword-only args:
        icon: str | None = None,
    ) -> DeltaGenerator:
        """Display a short message, known as a notification "toast".
        The toast appears in the app's bottom-right corner and disappears after four seconds.

        .. warning::
            ``st.toast`` is not compatible with Streamlit's `caching \
            <https://docs.streamlit.io/library/advanced-features/caching>`_ and
            cannot be called within a cached function.

        Parameters
        ----------
        body : str
            The string to display as Github-flavored Markdown. Syntax
            information can be found at: https://github.github.com/gfm.

            This also supports:

            * Emoji shortcodes, such as ``:+1:``  and ``:sunglasses:``.
              For a list of all supported codes,
              see https://share.streamlit.io/streamlit/emoji-shortcodes.

            * LaTeX expressions, by wrapping them in "$" or "$$" (the "$$"
              must be on their own lines). Supported LaTeX functions are listed
              at https://katex.org/docs/supported.html.

            * Colored text and background colors for text, using the syntax
              ``:color[text to be colored]`` and ``:color-background[text to be colored]``,
              respectively. ``color`` must be replaced with any of the following
              supported colors: blue, green, orange, red, violet, gray/grey, rainbow.
              For example, you can use ``:orange[your text here]`` or
              ``:blue-background[your text here]``.

        icon : str, None
            An optional emoji or icon to display next to the alert. If ``icon``
            is ``None`` (default), no icon is displayed. If ``icon`` is a
            string, the following options are valid:

            * A single-character emoji. For example, you can set ``icon="🚨"``
              or ``icon="🔥"``. Emoji short codes are not supported.

            * An icon from the Material Symbols library (outlined style) in the
              format ``":material/icon_name:"`` where "icon_name" is the name
              of the icon in snake case.

              For example, ``icon=":material/thumb_up:"`` will display the
              Thumb Up icon. Find additional icons in the `Material Symbols \
              <https://fonts.google.com/icons?icon.set=Material+Symbols&icon.style=Outlined>`_
              font library.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> st.toast('Your edited image was saved!', icon='😍')
        """
        toast_proto = ToastProto()
        toast_proto.body = clean_text(validate_text(body))
        toast_proto.icon = validate_icon_or_emoji(icon)
        return self.dg._enqueue("toast", toast_proto)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

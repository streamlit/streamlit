# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from streamlit.elements.lib.layout_utils import LayoutConfig, validate_width
from streamlit.proto.Text_pb2 import Text as TextProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import clean_text

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import Width
    from streamlit.type_util import SupportsStr


class TextMixin:
    @gather_metrics("text")
    def text(
        self,
        body: SupportsStr,
        *,  # keyword-only arguments:
        help: str | None = None,
        width: Width = "content",
    ) -> DeltaGenerator:
        r"""Write text without Markdown or HTML parsing.

        For monospace text, use |st.code|_.

        .. |st.code| replace:: ``st.code``
        .. _st.code: https://docs.streamlit.io/develop/api-reference/text/st.code

        Parameters
        ----------
        body : str
            The string to display.

        help : str or None
            A tooltip that gets displayed next to the text. If this is ``None``
            (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        width : int or "stretch" or "content"
            The width of the text element. Can be an integer (pixels), "stretch" to
            use the full width of the container, or "content" (default) to size
            based on the content.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> st.text("This is text\n[and more text](that's not a Markdown link).")

        .. output ::
            https://doc-text.streamlit.app/
            height: 220px

        """
        text_proto = TextProto()
        text_proto.body = clean_text(body)
        if help:
            text_proto.help = help

        validate_width(width, allow_content=True)
        layout_config = LayoutConfig(width=width)

        return self.dg._enqueue("text", text_proto, layout_config=layout_config)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

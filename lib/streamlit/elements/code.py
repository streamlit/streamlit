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

from streamlit.elements.lib.layout_utils import (
    Height,
    LayoutConfig,
    WidthWithoutContent,
    validate_height,
    validate_width,
)
from streamlit.proto.Code_pb2 import Code as CodeProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import clean_text

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.type_util import SupportsStr


class CodeMixin:
    @gather_metrics("code")
    def code(
        self,
        body: SupportsStr,
        language: str | None = "python",
        *,
        line_numbers: bool = False,
        wrap_lines: bool = False,
        height: Height = "content",
        width: WidthWithoutContent = "stretch",
    ) -> DeltaGenerator:
        """Display a code block with optional syntax highlighting.

        Parameters
        ----------
        body : str
            The string to display as code or monospace text.

        language : str or None
            The language that the code is written in, for syntax highlighting.
            This defaults to ``"python"``. If this is ``None``, the code will
            be plain, monospace text.

            For a list of available ``language`` values, see
            `react-syntax-highlighter
            <https://github.com/react-syntax-highlighter/react-syntax-highlighter/blob/master/AVAILABLE_LANGUAGES_PRISM.MD>`_
            on GitHub.

        line_numbers : bool
            An optional boolean indicating whether to show line numbers to the
            left of the code block. This defaults to ``False``.

        wrap_lines : bool
            An optional boolean indicating whether to wrap lines. This defaults
            to ``False``.

        height : int or None
            Desired height of the code block expressed in pixels. If ``height``
            is ``None`` (default), Streamlit sets the element's height to fit
            its content. Vertical scrolling within the element is enabled when
            the height does not accommodate all lines.

        width : "stretch" or int
            The width of the code block. This can be either:
            - "stretch" (default): The code block will stretch to fill the container width
            - An integer: The code block will have a fixed width in pixels

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> code = '''def hello():
        ...     print("Hello, Streamlit!")'''
        >>> st.code(code, language="python")

        .. output ::
            https://doc-code.streamlit.app/
            height: 220px

        >>> import streamlit as st
        >>> code = '''Is it a crown or boat?
        ...                         ii
        ...                       iiiiii
        ... WWw                 .iiiiiiii.                ...:
        ...  WWWWWWw          .iiiiiiiiiiii.         ........
        ...   WWWWWWWWWWw    iiiiiiiiiiiiiiii    ...........
        ...    WWWWWWWWWWWWWWwiiiiiiiiiiiiiiiii............
        ...     WWWWWWWWWWWWWWWWWWwiiiiiiiiiiiiii.........
        ...      WWWWWWWWWWWWWWWWWWWWWWwiiiiiiiiii.......
        ...       WWWWWWWWWWWWWWWWWWWWWWWWWWwiiiiiii....
        ...        WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWwiiii.
        ...           -MMMWWWWWWWWWWWWWWWWWWWWWWMMM-
        ... '''
        >>> st.code(code, language=None)

        .. output ::
            https://doc-code-ascii.streamlit.app/
            height: 380px
        """
        code_proto = CodeProto()
        code_proto.code_text = clean_text(body)
        code_proto.language = language or "plaintext"
        code_proto.show_line_numbers = line_numbers
        code_proto.wrap_lines = wrap_lines

        validate_height(height, allow_content=True)
        validate_width(width)
        layout_config = LayoutConfig(height=height, width=width)

        return self.dg._enqueue("code", code_proto, layout_config=layout_config)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

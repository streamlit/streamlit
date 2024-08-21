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
    ) -> DeltaGenerator:
        """Display a code block with optional syntax highlighting.

        Parameters
        ----------
        body : str
            The string to display as code.

        language : str or None
            The language that the code is written in, for syntax highlighting.
            If ``None``, the code will be unstyled. Defaults to ``"python"``.

            For a list of available ``language`` values, see:

            https://github.com/react-syntax-highlighter/react-syntax-highlighter/blob/master/AVAILABLE_LANGUAGES_PRISM.MD

        line_numbers : bool
            An optional boolean indicating whether to show line numbers to the
            left of the code block. Defaults to ``False``.

        wrap_lines : bool
            An optional boolean indicating whether to wrap lines. Defaults
            to ``False``.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> code = '''def hello():
        ...     print("Hello, Streamlit!")'''
        >>> st.code(code, language="python")

        """
        code_proto = CodeProto()
        code_proto.code_text = clean_text(body)
        code_proto.language = language or "plaintext"
        code_proto.show_line_numbers = line_numbers
        code_proto.wrap_lines = wrap_lines
        return self.dg._enqueue("code", code_proto)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

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

from streamlit.proto.Html_pb2 import Html as HtmlProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import clean_text
from streamlit.type_util import SupportsStr

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


class HtmlMixin:
    @gather_metrics("unsafe_html")
    def unsafe_html(
        self,
        body: str,
        unsafe_scripts: bool = False,
    ) -> DeltaGenerator:
        """Insert HTML into your app. We *strongly advise against it*. It is hard to write
            secure HTML, so by using this command you may be compromising your users' security.

        Parameters
        ----------
        body : str
            The HTML code to insert, or pointer to an HTML code file which is loaded and inserted.

        unsafe_script: bool
            An optional boolean indicating whether to allow scripts in the HTML. Defaults to ``False``.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> code = '''<style>
        ...     p {
        ...         color: red;
        ...     }
        ... </style>'''
        >>> st.unsafe_html(code)

        """
        html_proto = HtmlProto()
        # TODO: Add support for file pointers
        html_proto.body = clean_text(body)
        html_proto.unsafe_scripts = unsafe_scripts
        return self.dg._enqueue("unsafe_html", html_proto)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

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

import os
from typing import TYPE_CHECKING, cast

from streamlit.proto.Html_pb2 import Html as HtmlProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import clean_text

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


class HtmlMixin:
    @gather_metrics("html")
    def html(
        self,
        body: str,
    ) -> DeltaGenerator:
        """Insert HTML into your app.

        Adding custom HTML to your app impacts safety, styling, and
        maintainability. We sanitize HTML with `DOMPurify
        <https://github.com/cure53/DOMPurify>`_, but inserting HTML remains a
        developer risk. Passing untrusted code to ``st.html`` or dynamically
        loading external code can increase the risk of vulnerabilities in your
        app.

        ``st.html`` content is **not** iframed. Executing JavaScript is not
        supported at this time.

        Parameters
        ----------
        body : str
            The HTML code to insert, or path to an HTML code file which is
            loaded and inserted.

            If the provided string is the path of a local file, Streamlit will
            load the file and render its contents as HTML. Otherwise, Streamlit
            will render the string directly as HTML.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> code = \"""
        ... <style>
        ...     p {
        ...         color: red;
        ...     }
        ... </style>
        ... \"""
        >>> st.html(code)
        >>> st.markdown("Lorem ipsum")

        .. output::
           https://doc-html.streamlit.app/
           height: 300px

        """
        html_proto = HtmlProto()
        # Check if the body is a file path
        if os.path.isfile(body):
            with open(body, "r", encoding="utf-8") as f:
                html_proto.body = f.read()
        else:
            html_proto.body = clean_text(body)
        return self.dg._enqueue("html", html_proto)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

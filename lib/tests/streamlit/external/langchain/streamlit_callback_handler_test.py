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

import unittest

import pytest

import streamlit as st


@pytest.mark.require_integration
class StreamlitCallbackHandlerAPITest(unittest.TestCase):
    def test_import_path(self):
        """StreamlitCallbackHandler is imported by LangChain itself, and so it
        must always be importable from the same location.
        """

        # We exec a string here to prevent the import path from being updated
        # by an IDE during a refactor.
        exec("from streamlit.external.langchain import StreamlitCallbackHandler")

    def test_stable_api(self):
        """StreamlitCallbackHandler must support its original API."""
        from streamlit.external.langchain import (
            LLMThoughtLabeler,
            StreamlitCallbackHandler,
        )

        StreamlitCallbackHandler(
            st.container(),
            max_thought_containers=55,
            expand_new_thoughts=True,
            collapse_completed_thoughts=False,
            thought_labeler=LLMThoughtLabeler(),
        )

    def test_import_from_langchain(self):
        """We can import and use the callback handler from LangChain itself."""
        from langchain_community.callbacks import (
            StreamlitCallbackHandler as LangChainStreamlitCallbackHandler,
        )

        from streamlit.external.langchain import (
            StreamlitCallbackHandler as InternalStreamlitCallbackHandler,
        )

        # LangChain's StreamlitCallbackHandler() function will use Streamlit's
        # internal StreamlitCallbackHandler class if it exists.
        handler = LangChainStreamlitCallbackHandler(
            st.container(),
            max_thought_containers=55,
            expand_new_thoughts=True,
            collapse_completed_thoughts=False,
            thought_labeler=None,
        )
        self.assertIsInstance(handler, InternalStreamlitCallbackHandler)
